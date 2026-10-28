/* Only account-context headers and request lifecycle signals cross this bridge.
   No Authorization headers, request bodies, prompts, response bodies or session tokens. */
(()=>{
  'use strict';
  if(window.__limitLiveBridge)return;window.__limitLiveBridge=true;
  const original=window.fetch;let account=null,lastActivity=0,lastReset=0;
  const emit=(type,value)=>window.postMessage({source:'limit-live-v1',type,value},location.origin);
  window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.source==='limit-live-query-v1')emit('context',account);});
  window.fetch=function(input,init){
    let url,context=null,activity=false,session=false,reset=false;
    try {
      url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
      if(url.origin===location.origin&&url.pathname.startsWith('/backend-api/')){
        const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
        context=headers.get('chatgpt-account-id');
        if(context&&/^[\w-]{1,128}$/.test(context)&&context!==account){account=context;emit('context',account);}
        const method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
        activity=method==='POST'&&/\/conversation(?:\/|$)|\/codex\//.test(url.pathname);
        reset=method==='POST'&&url.pathname==='/backend-api/wham/rate-limit-reset-credits/consume';
      }
      session=url.origin===location.origin&&url.pathname==='/api/auth/session';
    } catch {}
    // Preserve the original promise and streaming response without cloning/reading it.
    const result=Reflect.apply(original,this,[input,init]);
    if(activity||session||reset)result.then(response=>{
      if(reset&&response.ok&&Date.now()-lastReset>3000){lastReset=Date.now();emit('reset');}
      if(session){emit('session');return;}
      if(activity&&Date.now()-lastActivity>3000){lastActivity=Date.now();emit('activity');}
    },()=>{});
    return result;
  };
})();
