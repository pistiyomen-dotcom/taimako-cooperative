const fs=require('fs');
/* Stage 252: complete retirement of the registration feature. */
const js=String.raw`(()=>{'use strict';
const u=s=>String(s||'').replace(/\s+/g,' ').trim().toUpperCase();
const r=/\bREGISTRATION(?:\s+(?:PAYMENT|BALANCE|COMPLETED))?\b/;
function apply(){
 document.querySelectorAll('select option').forEach(e=>{if(r.test(u(e.value+' '+e.textContent)))e.remove();});
 document.querySelectorAll('[role="option"],[data-value],[data-destination],li,button').forEach(e=>{
  if(e.closest('select'))return;
  const t=u(e.textContent),v=u((e.getAttribute('data-value')||'')+' '+(e.getAttribute('data-destination')||''));
  if((r.test(v)||/^(REGISTRATION|REGISTRATION PAYMENT|REGISTRATION BALANCE)$/.test(t))&&!/HISTOR|AUDIT|TRANSACTION|REPORT/.test(t))e.remove();
 });
 const labels=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&r.test(u(e.textContent)));
 for(const e of labels){
  if(e.closest('table,.audit-log,.transaction-history'))continue;
  let node=e,candidate=null;
  for(let depth=0;depth<8&&node.parentElement&&node.parentElement!==document.body;depth++){
   node=node.parentElement;
   const cls=String(node.className||'').toLowerCase();
   if(/menu-card|dashboard-tile|admin-tile|dashboard-card|menu-item|dashboard-item|action-item|quick-link|(^|\s)tile(\s|$)|(^|\s)card(\s|$)/.test(cls)||node.getAttribute('role')==='button'){candidate=node;break;}
  }
  if(candidate)candidate.remove();
  else {let fallback=e;for(let i=0;i<3&&fallback.parentElement&&fallback.parentElement!==document.body;i++)fallback=fallback.parentElement;if(fallback!==document.body)fallback.remove();}
 }
 /* A previous cleanup may have removed the REGISTRATION heading but left its figures/check.
    Remove only a title-less dashboard card whose visible contents are figures and check glyphs. */
 const glyph=/^[✓✔☑✅✔️✓️]+$/u, numeric=/^[₦N$€£]?\s*[\d,.]+\s*(?:%|₦|N)?$/i;
 const selector='.menu-card,.dashboard-tile,.admin-tile,.dashboard-card,.menu-item,.dashboard-item,.action-item,.quick-link,.tile,.card,[role="button"]';
 for(const card of [...document.querySelectorAll(selector)]){
  if(card.closest('table,.audit-log,.transaction-history'))continue;
  if(r.test(u(card.textContent)))continue;
  const leaves=[...card.querySelectorAll('*')].filter(x=>x.children.length===0&&String(x.textContent||'').trim());
  if(!leaves.length)continue;
  const vals=leaves.map(x=>String(x.textContent||'').trim());
  if(!vals.some(v=>glyph.test(v))||!vals.every(v=>glyph.test(v)||numeric.test(v)))continue;
  const parent=card.parentElement;
  const siblings=parent?[...parent.children].filter(x=>x.matches(selector)):[];
  if(siblings.length>1)card.remove();
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();`;
fs.writeFileSync('www/registration-removal-v250.js',js);
let h=fs.readFileSync('www/index.html','utf8').replace(/registration-removal-v250\.js\?v=\d+/g,'registration-removal-v250.js?v=272').replace(/app\.js\?v=\d+/g,'app.js?v=272').replace(/styles\.css\?v=\d+/g,'styles.css?v=272');
if(!h.includes('registration-removal-v250.js'))h=h.replace('</body>','<script src="./registration-removal-v250.js?v=272"></script>\n</body>');
fs.writeFileSync('www/index.html',h);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v\d+/g,'taimako-v272').replace(/registration-removal-v250\.js(?:\?v=\d+)?/g,'registration-removal-v250.js?v=272').replace(/app\.js\?v=\d+/g,'app.js?v=272').replace(/styles\.css\?v=\d+/g,'styles.css?v=272');
fs.writeFileSync('www/sw.js',sw);
let app=fs.readFileSync('www/app.js','utf8').replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=272'");
fs.writeFileSync('www/app.js',app);
console.log('Stage 252: registration UI removed and static assets versioned.');
