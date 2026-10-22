const fs=require('fs');
/* Stage 251: remove remaining registration status marks and bank-transfer destinations. */
const clientScript = String.raw`(()=>{'use strict';
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const upper=s=>clean(s).toUpperCase();
const marks=/^[✓✔☑✅✓✔️☑️]+$/u;
function removeRegistrationOptions(){
 document.querySelectorAll('select option').forEach(o=>{
  const v=upper(o.value),t=upper(o.textContent);
  if(v.includes('REGISTRATION')||t.includes('REGISTRATION'))o.remove();
 });
 /* Some payment forms render destinations as buttons or custom list items. */
 document.querySelectorAll('[role="option"],li,button,label,a,[data-value],[data-destination]').forEach(el=>{
  if(el.closest('select'))return;
  const v=upper(el.getAttribute('data-value')||el.getAttribute('data-destination'));
  const t=upper(el.textContent);
  if((v.includes('REGISTRATION')||/^REGISTRATION(?:\s+PAYMENT)?$/.test(t))&&
     !/HISTOR|AUDIT|TRANSACTION|REPORT/.test(t)){
   if(el.matches('[role="option"],li,button,[data-value],[data-destination]'))el.remove();
  }
 });
}
function removeRegistrationMarks(){
 document.querySelectorAll('body *').forEach(el=>{
  if(el.children.length!==0)return;
  const t=clean(el.textContent);
  if(marks.test(t)||/^(?:REGISTRATION\s*)?[✓✔☑✅✓✔️☑️]+(?:\s*REGISTRATION)?$/u.test(t))el.remove();
 });
 /* Remove any residual check-only text nodes in registration-labelled cards. */
 document.querySelectorAll('body *').forEach(label=>{
  if(label.children.length||!upper(label.textContent).includes('REGISTRATION'))return;
  let card=label;
  for(let i=0;i<5&&card.parentElement;i++)card=card.parentElement;
  card.querySelectorAll('*').forEach(el=>{
   if(el.children.length===0&&marks.test(clean(el.textContent)))el.remove();
  });
 });
}
function apply(){try{removeRegistrationOptions();removeRegistrationMarks();}catch(e){console.warn('Registration cleanup:',e&&e.message||e);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
const observer=new MutationObserver(apply);
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
/* Keep guarding dynamically rendered bank-transfer fields for the life of the page. */
})();`;
fs.writeFileSync('www/registration-removal-v250.js',clientScript);
let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/registration-removal-v250\.js\?v=\d+/g,'registration-removal-v250.js?v=271');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=271').replace(/styles\.css\?v=\d+/g,'styles.css?v=271');
if(!html.includes('registration-removal-v250.js'))html=html.replace('</body>','<script src="./registration-removal-v250.js?v=271"></script>\n</body>');
fs.writeFileSync('www/index.html',html);
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v271';").replace(/registration-removal-v250\.js(?:\?v=\d+)?/g,'registration-removal-v250.js?v=271').replace(/app\.js\?v=\d+/g,'app.js?v=271').replace(/styles\.css\?v=\d+/g,'styles.css?v=271');
if(!sw.includes("'./registration-removal-v250.js?v=271'"))sw=sw.replace("'./registration-removal-v250.js'","'./registration-removal-v250.js?v=271'");
fs.writeFileSync('www/sw.js',sw);
let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=271'");
fs.writeFileSync('www/app.js',app);
console.log('Stage 251: registration status marks and transfer destinations cleanup refreshed at v271.');
