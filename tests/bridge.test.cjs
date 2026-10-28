const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('page bridge preserves the fetch promise and streaming response, exports no credentials or body',async()=>{
 const messages=[];const response=new Response('private response');const promise=Promise.resolve(response);const listeners={};
 const c=vm.createContext({URL,Request,Headers,location:{href:'https://chatgpt.com/',origin:'https://chatgpt.com'},Date,fetch:()=>promise,postMessage:d=>messages.push(d),addEventListener:(n,f)=>listeners[n]=f});c.window=c;
 vm.runInContext(fs.readFileSync(__dirname+'/../extension/bridge.js','utf8'),c);
 const result=c.fetch('/backend-api/conversation',{method:'POST',headers:{authorization:'Bearer SECRET','chatgpt-account-id':'workspace-a'},body:'private prompt'});
 assert.equal(result,promise);assert.equal(await (await result).text(),'private response');await new Promise(r=>setImmediate(r));
 assert.ok(messages.some(m=>m.type==='context'&&m.value==='workspace-a'));assert.ok(messages.some(m=>m.type==='activity'));assert.doesNotMatch(JSON.stringify(messages),/SECRET|private prompt|private response/);
});
test('page bridge ignores unrelated origins',async()=>{const messages=[];const c=vm.createContext({URL,Request,Headers,location:{href:'https://chatgpt.com/',origin:'https://chatgpt.com'},Date,fetch:()=>Promise.resolve(new Response('ok')),postMessage:d=>messages.push(d),addEventListener(){}});c.window=c;vm.runInContext(fs.readFileSync(__dirname+'/../extension/bridge.js','utf8'),c);await c.fetch('https://example.com/backend-api/conversation',{method:'POST',headers:{'chatgpt-account-id':'other'}});assert.equal(messages.length,0)});

test('native reset completion emits a bounded hint without cloning or reading the response',async()=>{
 const messages=[];let status=200,reads=0;const response={get ok(){return status===200},clone(){reads++;throw Error('must not clone')},json(){reads++;throw Error('must not read')}};
 const c=vm.createContext({URL,Request,Headers,Date,location:{href:'https://chatgpt.com/',origin:'https://chatgpt.com'},fetch:()=>Promise.resolve(response),postMessage:d=>messages.push(d),addEventListener(){}});c.window=c;vm.runInContext(fs.readFileSync(__dirname+'/../extension/bridge.js','utf8'),c);
 const path='/backend-api/wham/rate-limit-reset-credits/consume';
 await c.fetch(path);await c.fetch('https://example.com'+path,{method:'POST'});status=503;await c.fetch(path,{method:'POST'});assert.equal(messages.length,0);
 status=200;for(let i=0;i<8;i++)await c.fetch(path,{method:'POST',body:'private-credit-id'});
 assert.equal(messages.filter(m=>m.type==='reset').length,1);assert.equal(reads,0);assert.doesNotMatch(JSON.stringify(messages),/private-credit-id/);
});
