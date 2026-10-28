(()=>{
'use strict';
const C=globalThis.LimitLiveCore;
const UI=globalThis.LimitLiveUI;
const t=UI.t;
let cfg=C.settings(),stopped=false,pollTimer,eventTimer,tickTimer,generationTimer,observer,wasGenerating=false,storageError='',lastAttempt=0;
let root,host,layout,hoverDetails,pillRing,refs={};
const styleCache={};
function css(key,value){if(styleCache[key]===value)return;styleCache[key]=value;host.style.setProperty(key,value);}
let lastPublished=null,cachedPublicState,cachedUsage,cachedStatus,cachedAt,cachedInterval;
let nativeResetRevision=0,checkedResetRevision=0;
function publicState(){
  const state=monitor.state;
  if(!cachedPublicState||cachedUsage!==state.usage||cachedStatus!==state.status||cachedAt!==state.updatedAt||cachedInterval!==cfg.interval){
    cachedUsage=state.usage;cachedStatus=state.status;cachedAt=state.updatedAt;cachedInterval=cfg.interval;cachedPublicState=C.snapshot({...state,interval:cfg.interval});
  }
  return cachedPublicState;
}
function publish(force=false){
  if(stopped||!alive())return;
  const state=publicState(),foreground=!document.hidden&&(document.hasFocus?.()??true),badge=C.badge(state).text;
  if(!force&&lastPublished?.state===state&&lastPublished.foreground===foreground&&lastPublished.badge===badge)return;
  const publication={state,foreground,badge};lastPublished=publication;
  try{const pending=chrome.runtime.sendMessage({type:'limit-live-snapshot',state,foreground});pending?.catch(()=>{if(lastPublished===publication)lastPublished=null;});}catch{if(lastPublished===publication)lastPublished=null;}
}
const alive=()=>{try{return !!chrome.runtime.id}catch{return false}};
function stop(){stopped=true;clearTimeout(pollTimer);clearTimeout(eventTimer);clearInterval(tickTimer);clearTimeout(generationTimer);observer?.disconnect();layout?.destroy();hoverDetails?.destroy();pillRing?.destroy();monitor.invalidate();if(refs.orb)refs.orb.title=t.update;}
async function get(key){try{return(await chrome.storage.local.get(key))[key]}catch{return undefined}}
async function save(){try{await chrome.storage.local.set({limitLiveSettings:cfg});storageError='';}catch{storageError=true;if(cfg.hidden)cfg.hidden=false;}render();publish();}
async function json(path,headers={},signal,timeoutMs=12000){
  if(!['/api/auth/session','/backend-api/wham/usage','/backend-api/wham/rate-limit-reset-credits'].includes(path))throw new Error('Blocked endpoint');
  const timeout=AbortSignal.timeout(timeoutMs);
  const joined=new AbortController();const abort=()=>joined.abort();signal?.addEventListener('abort',abort,{once:true});timeout.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  try {
    const response=await fetch('https://chatgpt.com'+path,{method:'GET',credentials:'include',cache:'no-store',redirect:'error',headers:{accept:'application/json',...headers},signal:joined.signal});
    if(!response.ok){const value=response.headers.get('retry-after');const seconds=Number(value);const retryAfter=value?(Number.isFinite(seconds)?seconds*1000:Date.parse(value)-Date.now()):0;throw Object.assign(new Error('Usage HTTP error'),{status:response.status,retryAfter});}
    if(!response.headers.get('content-type')?.includes('application/json'))throw Object.assign(new Error('Unexpected format'),{code:'schema'});
    return await response.json();
  } finally {signal?.removeEventListener('abort',abort);timeout.removeEventListener('abort',abort);}
}
// Persist only an allowlisted usage schema. Never persist session, token, email or raw response.
function wire(n){
  const pool=rows=>Object.fromEntries(rows.map((w,i)=>[i?'secondary_window':'primary_window',{limit_window_seconds:w.seconds,used_percent:w.used,reset_at:w.resetAt===null?null:w.resetAt/1000}]));
  return {plan_type:n.plan,rate_limit:pool(n.windows),additional_rate_limits:n.additional.map(p=>({limit_name:p.name,rate_limit:pool(p.windows)})),rate_limit_reset_credits:C.resetWire(n.resets)};
}
async function usage(auth,signal){
  const bytes=new TextEncoder().encode(auth.key);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const run=async()=>{
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    const entries=await get('limitLiveCache')||{};const cached=entries[hash];
    const resetRevision=nativeResetRevision,resetPending=resetRevision!==checkedResetRevision;
    if(!resetPending&&cached&&cached.at<=Date.now()&&Date.now()-cached.at<20000){try{return {normalized:C.normalize(cached.raw),updatedAt:cached.at}}catch{}}
    const headers={'authorization':'Bearer '+auth.token,'chatgpt-account-id':auth.account};
    const raw=await json('/backend-api/wham/usage',headers,signal);
    const normalized=C.normalize(raw);const at=Date.now();let resetsCheckedAt=0;
    if(normalized.resets?.available>0){
      let previous=null;try{previous=C.normalize(cached?.raw).resets}catch{}
      // Recheck once when a cached credit reaches its expiry, even if the count lags.
      const crossedExpiry=previous?.details.some(c=>c.expiresAt>cached.resetsCheckedAt&&c.expiresAt<=at);
      if(!resetPending&&cached?.resetsCheckedAt<=at&&at-cached.resetsCheckedAt<300000&&!crossedExpiry&&previous?.available===normalized.resets.available){
        resetsCheckedAt=cached.resetsCheckedAt;
        if(previous.detailsKnown)normalized.resets=previous;
      }else{
        resetsCheckedAt=at;
        try{const details=C.resetCredits(await json('/backend-api/wham/rate-limit-reset-credits',headers,signal,3000));if(details)normalized.resets=details;}
        catch{/* Counts and ordinary usage remain available if the optional details endpoint fails. */}
      }
    }
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    const next=Object.fromEntries(Object.entries(entries).filter(([,v])=>typeof v?.at==='number'&&at-v.at<3600000).sort((a,b)=>b[1].at-a[1].at).slice(0,7));next[hash]={raw:wire(normalized),at,resetsCheckedAt};
    try{await chrome.storage.local.set({limitLiveCache:next})}catch{/* Monitoring works without a cache. */}
    checkedResetRevision=resetRevision;
    return {normalized,updatedAt:at};
  };
  return navigator.locks?navigator.locks.request('chatgpt-limit-live-usage-v1',{signal},run):run();
}
const monitor=new C.Monitor({session:signal=>json('/api/auth/session',{},signal),usage,changed:()=>{render();publish()}});
function request(delay=1000){
  if(stopped)return;
  // Coalesce page activity; a busy page cannot produce an unbounded request loop.
  if(eventTimer)return;
  eventTimer=setTimeout(()=>{eventTimer=null;refresh()},Math.max(delay,5000-(Date.now()-lastAttempt)));
}
async function refresh(){
  if(stopped)return;if(!alive()){stop();return;}
  clearTimeout(pollTimer);
  if(!navigator.onLine){monitor.emit({status:'offline'});schedule();return;}
  lastAttempt=Date.now();await monitor.refresh();schedule();
}
function schedule(){clearTimeout(pollTimer);if(!stopped)pollTimer=setTimeout(refresh,Math.max((document.hidden?Math.max(120,cfg.interval):cfg.interval)*1000,monitor.state.retryAt-Date.now()));}
function setText(node,value){if(node.textContent!==value)node.textContent=value;}
function setAttr(node,key,value){if(node.getAttribute?.(key)!==String(value))node.setAttribute(key,String(value));}
function render(){
  if(!root)return;
  UI.setLanguage(cfg.language);host.lang=UI.language;
  host.dataset.theme=cfg.theme;host.dataset.collapsed=cfg.collapsed?'yes':'no';host.dataset.hidden=cfg.hidden?'yes':'no';
  css('--diameter',cfg.diameter+'px');
  if(cfg.hidden){hoverDetails?.hide();return;}
  const state=publicState(),model=UI.orbModel(state,cfg),primary=state.usage?.windows.find(w=>w.kind==='weekly')||state.usage?.windows[0],colors=UI.effectiveColors(cfg);
  css('--orb-text',colors.percent);css('--orb-bg',colors.background+Math.round(cfg.backgroundOpacity*2.55).toString(16).padStart(2,'0'));
  css('--orb-ring',cfg.adaptiveColors&&primary?.remaining<=10?colors.critical:cfg.adaptiveColors&&primary?.remaining<=30?colors.warning:colors.ring);
  css('--orb-track',colors.track);css('--pill-bg',colors.pill);css('--pill-text',colors.pillText);css('--tip-bg',colors.tooltip);css('--tip-text',colors.tooltipText);css('--tip-border',colors.tooltipBorder);
  css('--tip-font',cfg.tooltipFontSize+'px');css('--tip-width',cfg.tooltipWidth+'px');
  setAttr(refs.pillShell,'aria-label',t.drag);setAttr(refs.pill,'aria-label',model.title.replace(/\n/g,'. ')+'. '+t.expand);
  css('--number-scale',cfg.numberScale);css('--number-weight',cfg.fontWeight);css('--ring-px',cfg.ringWidth+'px');css('--text-factor',Math.max(1.5,model.percent.length*.58));
  setText(refs.orbPercent,model.percent);setAttr(refs.ringSvg,'viewBox',`0 0 ${cfg.diameter} ${cfg.diameter}`);
  for(const circle of [refs.ringProgress,refs.ringTrack]){setAttr(circle,'cx',cfg.diameter/2);setAttr(circle,'cy',cfg.diameter/2);setAttr(circle,'r',(cfg.diameter-cfg.ringWidth)/2);setAttr(circle,'stroke-width',cfg.ringWidth);}
  setAttr(refs.ringProgress,'transform',`rotate(-90 ${cfg.diameter/2} ${cfg.diameter/2})`);setAttr(refs.ringProgress,'stroke-linecap',cfg.roundCaps?'round':'butt');
  setAttr(refs.ringProgress,'stroke-dashoffset',model.offset);setAttr(refs.ringProgress,'visibility',model.progress>0?'visible':'hidden');setAttr(refs.ringTrack,'visibility',cfg.track?'visible':'hidden');
  refs.orb.dataset.stale=model.stale?'yes':'no';refs.orb.dataset.shadow=cfg.shadow?'yes':'no';
  setAttr(refs.orb,'aria-label',`${model.title.replace(/\n/g,'. ')}${storageError?'. '+t.notSaved:''}`);
  const status=state.usage&&model.stale?t.stale:UI.t[state.status]||t.loading;
  setText(refs.pill,primary?`${model.label} · ${model.percent}${model.stale?' · ?':''}`:status);
  pillRing?.update(model,cfg);layout?.update();hoverDetails?.update();
}
function setMode(mode){cfg=C.settings({...cfg,hidden:mode==='icon',collapsed:mode==='compact'});render();save();}
function mount(){
  if(stopped||host?.isConnected)return;
  if(!host){
    host=document.createElement('div');host.id='chatgpt-limit-live';host.style.cssText='position:fixed;z-index:2147483000;display:block';root=host.attachShadow({mode:'closed'});
    root.innerHTML=`<style>${UI.styles}</style><div class="pill-shell" id="pillShell" tabindex="0" role="group" aria-label="${UI.t.drag}"><svg class="pill-ring" id="pillRingSvg" aria-hidden="true"><path class="pill-ring-track" id="pillRingTrack"/><path class="pill-ring-progress" id="pillRingProgress" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg><div class="pill" id="pill" role="button" tabindex="0" aria-label="${UI.t.expand}"></div></div><article class="orb" id="orb" tabindex="0" role="group" aria-describedby="orbTooltip"><svg class="orb-ring" id="ringSvg" viewBox="0 0 50 50" aria-hidden="true"><circle class="ring-track" id="ringTrack"/><circle class="ring-progress" id="ringProgress" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg><div class="orb-center"><strong class="orb-number" id="orbPercent">…</strong></div></article><div class="orb-tooltip" id="orbTooltip" role="tooltip" hidden></div>`;
    for(const id of ['orb','orbPercent','ringSvg','ringProgress','ringTrack','pill','pillShell','pillRingSvg','pillRingTrack','pillRingProgress','orbTooltip'])refs[id]=root.getElementById(id);
    pillRing=new globalThis.LimitLivePill(refs.pillShell,refs.pillRingSvg,refs.pillRingTrack,refs.pillRingProgress);
    refs.pill.onclick=()=>setMode('panel');
    refs.pill.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setMode('panel')}});
    layout=new globalThis.LimitLiveLayout(host,[refs.orb,root.getElementById('pillShell')],()=>cfg,(patch,persist)=>{cfg=C.settings({...cfg,...patch});if(persist)save()});
    hoverDetails=new globalThis.LimitLiveTooltip(host,[refs.orb,root.getElementById('pillShell')],refs.orbTooltip,()=>({...publicState(),error:storageError?t.notSaved:''}),()=>cfg);
  }
  document.documentElement.appendChild(host);render();
}
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!=='https://chatgpt.com'||event.data?.source!=='limit-live-v1')return;
  const {type,value}=event.data;
  if(type==='context'&&typeof value==='string'&&/^[\w-]{1,128}$/.test(value)&&monitor.hint!==value){monitor.invalidate(value);request(0)}
  else if(type==='session'){monitor.invalidate(monitor.hint);request(0)}
  else if(type==='activity')request(3000);
  // A native reset completion is only a refresh hint. Percentages still come from our GET.
  else if(type==='reset'){nativeResetRevision++;request(0);}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)request(0);publish(true);schedule()});
window.addEventListener('focus',()=>{request(0);publish(true)});window.addEventListener('online',()=>request(0));window.addEventListener('offline',()=>{monitor.emit({status:'offline'});schedule()});
window.addEventListener('pageshow',()=>request(0));window.addEventListener('pagehide',()=>{clearTimeout(pollTimer);clearTimeout(eventTimer);eventTimer=null});
chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
  if(message?.type==='limit-live-state'){respond(publicState());}
  if(message?.type==='limit-live-settings'){setMode('panel');respond({ok:true})}
});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.limitLiveSettings){cfg=C.settings(changes.limitLiveSettings.newValue);render();publish();schedule()}});
globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change',()=>render());
(async()=>{
  cfg=C.settings(await get('limitLiveSettings'));UI.setLanguage(cfg.language);mount();
  observer=new MutationObserver(()=>{
    if(!host?.isConnected)mount();
    if(generationTimer)return;
    generationTimer=setTimeout(()=>{generationTimer=null;if(stopped)return;
      const generating=!!document.querySelector('[data-testid="stop-button"],button[aria-label="Stop generating"]');
      if(wasGenerating&&!generating)request(1500);wasGenerating=generating;
    },250);
  });observer.observe(document.documentElement,{subtree:true,childList:true});
  tickTimer=setInterval(()=>{if(!alive()){stop();return}if(!document.hidden)render();publish()},15000);
  window.postMessage({source:'limit-live-query-v1'},location.origin);refresh();
})();
})();
