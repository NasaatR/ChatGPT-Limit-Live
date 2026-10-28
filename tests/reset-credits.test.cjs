const {test}=require('node:test');const assert=require('node:assert/strict');const C=require('../extension/core.js');
const usage=credits=>({plan_type:'business',rate_limit:{primary_window:{used_percent:42,limit_window_seconds:604800}},rate_limit_reset_credits:credits});
test('banked reset counts are independent from automatic window reset times',()=>{const n=C.normalize(usage({available_count:2}));assert.equal(n.resets.available,2);assert.equal(n.resets.detailsKnown,false);assert.equal(n.windows[0].remaining,58)});
test('missing or malformed reset metadata stays unknown instead of becoming zero',()=>{for(const value of [undefined,null,{}, {available_count:-1},{available_count:'2'},{available_count:1.5}])assert.equal(C.normalize(usage(value)).resets,null);assert.equal(C.normalize(usage({available_count:0})).resets.available,0)});
test('reset details only retain available credits and safe display fields',()=>{const n=C.resetCredits({available_count:2,credits:[{id:'private-credit-id',status:'available',reset_type:'codex_rate_limits',title:'Full reset',expires_at:'2026-11-01T12:00:00Z'},{status:'consumed',title:'Used'},{status:'available',expires_at:'invalid'}]});assert.equal(n.detailsKnown,true);assert.equal(n.details.length,2);assert.equal(n.details[0].expiresAt,Date.parse('2026-11-01T12:00:00Z'));assert.equal(n.details[1].expiresAt,null);assert.doesNotMatch(JSON.stringify(n),/private-credit-id|codex_rate_limits|Used/)});
test('background snapshots retain bounded reset data without raw credit IDs',()=>{const n=C.normalize(usage({available_count:1,credits:[{status:'available',title:'Full reset',expires_at:null}]}));const s=C.snapshot({status:'current',usage:n});assert.deepEqual(s.usage.resets,n.resets);assert.equal(C.snapshot({usage:{...n,resets:{available:-1}}}).usage.resets,null)});

const vm=require('node:vm'),fs=require('node:fs');
function ui(){const ctx=vm.createContext({LimitLiveCore:C,navigator:{language:'ru'},Intl,Date});vm.runInContext(fs.readFileSync(__dirname+'/../extension/ui.js','utf8'),ctx);return ctx.LimitLiveUI;}
test('reset UI distinguishes zero, missing data and stale availability',()=>{const u=ui();assert.match(u.resetsHTML(null),/did not return reset data/);assert.match(u.resetsHTML({available:0,detailsKnown:false,details:[]}),/No resets available/);assert.match(u.resetsHTML({available:2,detailsKnown:false,details:[]},true),/Last known data/);assert.match(u.resetsHTML({available:2,detailsKnown:false,details:[]}),/chatgpt.com\/settings\/usage/)});
test('server reset labels are escaped in the popup',()=>{assert.match(ui().resetsHTML({available:1,detailsKnown:true,details:[{title:'<script>alert(1)</script>',expiresAt:null}]}),/&lt;script&gt;/)});

test('reset title, expiration and direct usage link are visible without a disclosure',()=>{const html=ui().resetsHTML({available:1,detailsKnown:true,details:[{title:'Full reset (Weekly + 5 hr)',expiresAt:Date.parse('2027-02-14T12:30:00Z')}]});assert.match(html,/<details class="reset-help">/);assert.ok(html.indexOf('Full reset')<html.indexOf('<details'));assert.match(html,/Full reset \(Weekly \+ 5 hr\)/);assert.match(html,/2027/);assert.match(html,/Use by/);assert.match(html,/class="reset-credit"[^>]*href="https:\/\/chatgpt.com\/settings\/usage"/)});
test('track color is adjacent to the Show track switch instead of hidden in Colors',()=>{const html=ui().controls({mode:false}),geometry=html.slice(html.indexOf('id="geometryGroup"'),html.indexOf('id="colorsGroup"'));assert.match(geometry,/id="track"/);assert.match(geometry,/id="hex_track"/);assert.match(geometry,/Track color/);assert.equal((html.match(/id="hex_track"/g)||[]).length,1)});

const withResets=resets=>({status:'current',updatedAt:Date.now(),usage:{plan:'business',windows:[{kind:'weekly',remaining:58,resetAt:Date.now()+86400000}],additional:[],resets}});
test('all reset navigation uses the current official Usage route with a manual fallback',()=>{
 const u=ui(),html=u.resetsHTML({available:1,detailsKnown:true,details:[{title:'Full reset',expiresAt:null}]});
 assert.equal(u.usageURL,'https://chatgpt.com/settings/usage');
 assert.equal((html.match(/href="https:\/\/chatgpt.com\/settings\/usage"/g)||[]).length,2);
 assert.doesNotMatch(html,/codex\/settings\/usage|Limits &amp; resets/);
 assert.match(html,/ChatGPT → Settings → Usage/);assert.match(html,/account and workspace/);
});
test('hover includes full banked reset expiration separately from the next allowance refresh',()=>{
 const at=Date.now()+86400000,u=ui(),html=u.tooltipHTML(withResets({available:1,detailsKnown:true,details:[{title:'Full reset',expiresAt:at}]}));
 assert.match(html,/Refreshes in/);assert.match(html,/Saved resets/);assert.match(html,/Full reset/);assert.match(html,/Expires in/);
 assert.ok(html.includes(`datetime="${new Date(at).toISOString()}"`));assert.match(html,new RegExp(String(new Date(at).getFullYear())));
 assert.doesNotMatch(html,/<a|<button|<details/);
 u.setLanguage('ru');const ru=u.tooltipHTML(withResets({available:1,detailsKnown:true,details:[{title:'Full reset',expiresAt:at}]}));assert.match(ru,/Срок истечёт через/);assert.doesNotMatch(ru,/Последний сброс аккаунта/);
});
test('identical reset offers share a row and earliest expiry is shown first without mutating data',()=>{
 const sooner={title:'Sooner',expiresAt:Date.now()+3600000},later={title:'Later',expiresAt:Date.now()+86400000};
 const resets={available:3,detailsKnown:true,details:[later,sooner,{...sooner}]},before=JSON.stringify(resets),u=ui();
 for(const html of [u.resetsHTML(resets),u.tooltipHTML(withResets(resets))]){assert.ok(html.indexOf('Sooner')<html.indexOf('Later'));assert.equal((html.match(/Sooner/g)||[]).length,1);assert.match(html,/×2/);}
 assert.equal(JSON.stringify(resets),before);
});
test('hover marks expired credits explicitly and does not present missing dates as deadlines',()=>{
 const u=ui(),at=Date.now()-1000,html=u.tooltipHTML(withResets({available:2,detailsKnown:true,details:[{title:'Expired credit',expiresAt:at},{title:'No date',expiresAt:null}]}));
 assert.match(html,/data-tone="expired"/);assert.match(html,/No expiration returned/);
 const unknown=u.tooltipHTML(withResets({available:1,detailsKnown:false,details:[]}));assert.match(unknown,/Expiration details unavailable/);
 assert.match(u.tooltipHTML(withResets(null)),/service did not return reset data/);
});
test('last account reset is explicitly unavailable rather than inferred from a credit grant or next reset',()=>{
 const granted='2026-10-01T09:12:00Z',r=C.resetCredits({available_count:1,credits:[{status:'available',granted_at:granted,title:'Full reset'}]}),u=ui();
 const popup=u.resetsHTML(r),hover=u.tooltipHTML(withResets(r));assert.match(popup,/Last account reset/);assert.match(popup,/Not provided/);assert.ok(popup.indexOf('Last account reset')>popup.indexOf('<details'));assert.doesNotMatch(hover,/Last account reset/);for(const html of [popup,hover])assert.doesNotMatch(html,/Oct 1|09:12|2026-10-01/);
 assert.match(u.resetsHTML(r),/Usage & billing → History/);
});
test('hover escapes reset titles and indicates incomplete expiration details',()=>{
 const html=ui().tooltipHTML(withResets({available:2,detailsKnown:true,details:[{title:'<img src=x onerror=alert(1)>',expiresAt:null}]}));
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/Some expiration details are unavailable/);
});
