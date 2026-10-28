'use strict';
const C=globalThis.LimitLiveCore,UI=globalThis.LimitLiveUI,t=UI.t;
let cfg=C.settings(),savedCfg=cfg,state=null,saving=0,revision=0,sizeTimer=null,saveTimer=null,saveState='idle',colorEditor,writes=Promise.resolve();
let view='overview',prefSection='geometryGroup',mountedLanguage='',errorMessage='',errorCode='',backupState='',undoSettings=null,importBusy=false,pendingScroll=null;
const version=chrome.runtime.getManifest?.().version||'',htmlCache=new Map(),q=id=>document.getElementById(id);
const groupIds=UI.settingsSections.map(row=>row[0]);
const style=document.createElement('style');style.textContent=UI.styles;document.head.appendChild(style);
function setError(message='',code=''){errorMessage=message;errorCode=code;if(mountedLanguage)q('error').textContent=code?t[code]:message;}
function setHTML(id,markup){if(htmlCache.get(id)===markup)return false;htmlCache.set(id,markup);q(id).innerHTML=markup;return true;}
function mount(){
  const scroller=mountedLanguage?q(view==='settings'?'prefsHolder':'overview'):null,scrollTop=scroller?.scrollTop||0;
  colorEditor?.destroy();htmlCache.clear();mountedLanguage=UI.language;
  q('app').innerHTML=`<header class="popup-header"><div class="brand"><span class="brand-mark">${UI.svg('logo')}</span><span class="brand-copy"><strong>Limit Live</strong><small>Work / Codex${version?' · v'+UI.esc(version):''}</small></span></div><span id="plan" class="plan"></span></header><nav class="popup-tabs" role="tablist" aria-label="Limit Live"><button id="overviewTab" role="tab" aria-controls="overview">${t.overview}</button><button id="settings" role="tab" aria-controls="prefsHolder">${UI.svg('gear')}${t.settings}</button></nav><div id="error" class="popup-error" role="status"></div><section id="overview" class="popup-view" role="tabpanel" aria-labelledby="overviewTab"><div id="meters"></div><div id="resets"></div><div id="additional" class="additional"></div><section class="display-controls"><div class="control-heading">${t.widget}</div><div class="segments mode" role="group" aria-label="${t.display}"><button id="modePanel">${t.panel}</button><button id="modeCompact">${t.compact}</button><button id="modeIcon">${t.iconOnly}</button></div>${UI.sizeControl()}<p id="modeHint" class="note mode-hint" hidden>${t.modeHint}</p></section><footer class="footer"><span id="status" class="status" role="status"></span><span id="checked" class="version"></span><a id="open" class="open-link" href="https://chatgpt.com/" target="_blank" rel="noreferrer noopener">${t.open}${UI.svg('arrow')}</a></footer><p id="pin" class="note pin-note" hidden>${t.pin}</p></section><section id="prefsHolder" class="popup-view" role="tabpanel" aria-labelledby="settings" hidden></section>`;
  q('prefsHolder').innerHTML=UI.controls({mode:false});
  bind();pendingScroll={view,top:scrollTop};
}
function setView(next){view=next;if(next==='overview')colorEditor?.close(false);render();}
function setSection(id){
  if(!groupIds.includes(id))return;
  if(id!==prefSection){colorEditor?.close(false);prefSection=id;pendingScroll={view:'settings',top:0};}
  render();
}
function render(){
  UI.setLanguage(cfg.language);if(mountedLanguage!==UI.language)mount();
  document.documentElement.lang=UI.language;document.documentElement.dataset.theme=cfg.theme;
  q('overview').hidden=view!=='overview';q('prefsHolder').hidden=view!=='settings';q('prefs').hidden=view!=='settings';
  for(const [id,selected] of [['overviewTab',view==='overview'],['settings',view==='settings']]){q(id).setAttribute('aria-selected',String(selected));q(id).setAttribute('tabindex',selected?'0':'-1');}
  q('settings').setAttribute('aria-expanded',String(view==='settings'));
  for(const id of groupIds){const selected=id===prefSection;q(id).hidden=!selected;q('pref_'+id).setAttribute('aria-selected',String(selected));q('pref_'+id).setAttribute('tabindex',selected?'0':'-1');}
  q('appearancePreview').hidden=view!=='settings'||!['geometryGroup','colorsGroup'].includes(prefSection);
  if(!q('appearancePreview').hidden)setHTML('appearancePreview',UI.previewHTML(state,cfg));
  const info=C.badge(state||{});q('plan').textContent=state?.usage?.plan||'';q('plan').hidden=!state?.usage?.plan;
  setHTML('meters',state?.usage?UI.meters(state.usage):`<p class="empty">${UI.esc(state?t[state.status]||t.loading:t.noTab)}</p>`);
  for(const [id,markup] of [['additional',state?.usage?.additional?.length?`<details><summary>${t.additional}</summary>${state.usage.additional.map(p=>`<h4>${UI.esc(p.name)}</h4>${UI.meters(p)}`).join('')}</details>`:''],['resets',state?.usage?UI.resetsHTML(state.usage.resets,info.stale):'']]){
    const open=q(id).querySelector('details')?.open,changed=setHTML(id,markup);if(changed&&open){const details=q(id).querySelector('details');if(details)details.open=true;}
  }
  q('status').textContent=state?.usage?(info.stale?t.stale:t.auto):(state?t[state.status]||t.loading:t.empty);q('status').dataset.stale=info.stale?'yes':'no';
  q('checked').textContent=state?.updatedAt?new Date(state.updatedAt).toLocaleTimeString(UI.language,{hour:'2-digit',minute:'2-digit'}):'—';
  q('checked').title=state?.updatedAt?`${t.source} · ${new Date(state.updatedAt).toLocaleString(UI.language)}`:'';
  UI.setControls(document,cfg);q('ringWidth').max=String(Math.min(12,Math.floor(cfg.diameter/4)/2));q('diameter').value=String(cfg.diameter);
  if(document.activeElement!==q('diameterNumber'))q('diameterNumber').value=String(cfg.diameter);q('diameterValue').textContent=cfg.diameter+' px';
  q('colorSaveStatus').textContent=saveState==='saving'?t.saving:saveState==='saved'?t.saved:saveState==='error'?t.notSaved:t.autosave;q('colorSaveStatus').dataset.state=saveState;colorEditor?.update();
  q('backupStatus').textContent=backupState?t[backupState]:'';q('undoImport').hidden=!undoSettings;q('exportSettings').disabled=importBusy;q('importSettings').disabled=importBusy;
  q('pin').hidden=isPinned;q('error').textContent=errorCode?t[errorCode]:errorMessage;
  q('modeHint').hidden=!cfg.hidden;
  if(pendingScroll){q(pendingScroll.view==='settings'?'prefsHolder':'overview').scrollTop=pendingScroll.top;pendingScroll=null;}
  const colors=UI.effectiveColors(cfg);q('contrastHint').textContent=((cfg.backgroundOpacity===100&&C.contrast(colors.percent,colors.background)<4.5)||C.contrast(colors.pillText,colors.pill)<4.5||C.contrast(colors.tooltipText,colors.tooltip)<4.5)?t.lowContrast:'';
}
function enqueue(desired,current){
  const write=async()=>{
    if(current!==revision)return false;
    saving++;
    try{await chrome.storage.local.set({limitLiveSettings:desired});savedCfg=desired;if(current===revision){setError();saveState='saved';}return true;}
    catch{if(current===revision){cfg=savedCfg;setError('','notSaved');saveState='error';}return false;}
    finally{saving--;render();}
  };
  writes=writes.then(write,write);return writes;
}
function flush(){if(saveTimer!==null){clearTimeout(saveTimer);saveTimer=null;return enqueue(cfg,revision);}return writes;}
function flushAll(){if(sizeTimer!==null){clearTimeout(sizeTimer);sizeTimer=null;return persist({diameter:cfg.diameter});}return flush();}
function persist(patch,delay=0){
  if(undoSettings){undoSettings=null;backupState='';}
  cfg=C.settings({...cfg,...patch});const current=++revision;saveState='saving';render();clearTimeout(saveTimer);saveTimer=null;
  if(delay){saveTimer=setTimeout(()=>{saveTimer=null;enqueue(cfg,current)},delay);return Promise.resolve();}
  return enqueue(cfg,current);
}
function numericChange(key,event){
  const spec=key==='diameter'?{min:32,max:150}:key==='ringWidth'?{min:1,max:Math.min(12,Math.floor(cfg.diameter/4)/2)}:UI.numericControls[key],raw=String(event.target.value),value=Number(raw);
  if(!raw.trim()||!Number.isFinite(value)||value<spec.min||value>spec.max){event.target.setAttribute?.('aria-invalid','true');setError(`${t.invalidValue}: ${spec.min}–${spec.max}`);return Promise.resolve(false);}
  event.target.setAttribute?.('aria-invalid','false');const result=persist({[key]:key==='numberScale'?value/100:value});event.target.value=String(key==='numberScale'?Math.round(cfg.numberScale*100):cfg[key]);return result;
}
async function exportFile(){
  let url;
  try{
    await flushAll();const json=JSON.stringify(C.exportSettings(cfg,version),null,2)+'\n';url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`ChatGPT-Limit-Live-settings${version?'-v'+version:''}.json`;document.body.appendChild(link);
    try{link.click()}finally{link.remove()}
    backupState='exported';
  }catch{setError('','transferError')}
  finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);render()}
}
async function importFile(event){
  const file=event.target.files?.[0];event.target.value='';if(!file||importBusy)return;
  importBusy=true;backupState='';render();
  try{
    if(file.size>65536)throw new Error('File too large');
    const imported=C.importSettings(await file.text()),previous=cfg;clearTimeout(sizeTimer);sizeTimer=null;
    if(await persist(imported)){undoSettings=previous;backupState='imported';}
  }catch{setError('','importInvalid')}
  finally{importBusy=false;render()}
}
function bind(){
  q('overviewTab').onclick=()=>setView('overview');q('settings').onclick=()=>setView('settings');
  for(const id of groupIds){
    const tab=q('pref_'+id);tab.onclick=()=>setSection(id);
    tab.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=groupIds.indexOf(id),next=e.key==='Home'?0:e.key==='End'?groupIds.length-1:(index+(e.key==='ArrowRight'?1:-1)+groupIds.length)%groupIds.length;setSection(groupIds[next]);q('pref_'+groupIds[next]).focus();};
  }
  for(const id of ['overviewTab','settings'])q(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const overview=['ArrowLeft','Home'].includes(e.key);setView(overview?'overview':'settings');q(overview?'overviewTab':'settings').focus();}};
  for(const mode of ['Panel','Compact','Icon'])q('mode'+mode).onclick=()=>persist({hidden:mode==='Icon',collapsed:mode==='Compact'});
  for(const key of ['language','theme','position'])q(key).onchange=e=>{const write=persist({[key]:e.target.value,...(key==='position'?{point:null}:{})});return key==='language'?write.then(result=>{q('language').focus({preventScroll:true});return result}):write;};
  for(const key of Object.keys(UI.numericControls))q(key).onchange=e=>numericChange(key,e);
  for(const key of ['decimals','fontWeight'])q(key).onchange=e=>persist({[key]:Number(e.target.value)});
  for(const key of UI.toggles)q(key).onchange=e=>persist({[key]:e.target.checked});
  colorEditor=new globalThis.LimitLiveColorEditor(document,()=>cfg,persist,flush,message=>setError(message));
  q('resetColors').onclick=()=>persist({colorOverrides:{}});q('presetDark').onclick=()=>persist({theme:'dark',colorOverrides:{}});q('presetLight').onclick=()=>persist({theme:'light',colorOverrides:{}});
  q('restore').onclick=()=>persist(C.resetAppearance(cfg));q('dock').onclick=()=>persist({point:null});
  q('diameter').oninput=e=>{cfg=C.settings({...cfg,diameter:Number(e.target.value)});q('diameterNumber').value=String(cfg.diameter);q('diameterValue').textContent=cfg.diameter+' px';clearTimeout(sizeTimer);sizeTimer=setTimeout(()=>{sizeTimer=null;persist({diameter:cfg.diameter})},120);};
  for(const id of ['diameter','diameterNumber'])q(id).onchange=e=>{clearTimeout(sizeTimer);sizeTimer=null;return numericChange('diameter',e)};
  q('exportSettings').onclick=exportFile;q('importSettings').onclick=()=>q('importFile').click();q('importFile').onchange=importFile;
  q('undoImport').onclick=async()=>{if(!undoSettings)return;if(await persist(undoSettings)){undoSettings=null;backupState='importUndone';render();}};
}
let isPinned=true;
globalThis.addEventListener?.('pagehide',flushAll);
async function refresh(){try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const data=await chrome.runtime.sendMessage({type:'limit-live-overview',activeTabId:tab?.id});state=data?.state||null;render();}catch{state=null;render();}}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.limitLiveSettings&&!saving&&saveTimer===null){cfg=C.settings(changes.limitLiveSettings.newValue);savedCfg=cfg;render()}});
(async()=>{try{cfg=C.settings((await chrome.storage.local.get('limitLiveSettings')).limitLiveSettings);savedCfg=cfg;}catch{}render();refresh();try{isPinned=!!(await chrome.action.getUserSettings()).isOnToolbar;render()}catch{}setInterval(refresh,3000)})();
