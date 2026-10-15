const fs=require('fs');
let html=fs.readFileSync('www/index.html','utf8');
const inputPattern=/<input\b(?=[^>]*\bid=["']loanGuarantorV94["'])[^>]*>/i;
const match=html.match(inputPattern);
if(!match)throw new Error('Stage 241: loan guarantor input not found.');
let input=match[0].replace(/\sdisabled(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/ig,'').replace(/\sreadonly(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/ig,'');
if(!/\btype\s*=\s*["']text["']/i.test(input))input=input.replace('<input','<input type="text"');
html=html.replace(inputPattern,input).replace(/app\.js\?v=\d+/g,'app.js?v=241').replace(/styles\.css\?v=\d+/g,'styles.css?v=241').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=241');
fs.writeFileSync('www/index.html',html);
let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=241'");
fs.writeFileSync('www/app.js',app);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v241';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 241 removed the hard-disabled/read-only state from the guarantor username input.');

/* Stage 242: order Admin dashboard tiles as requested, leaving all other tiles after them. */
let app242=fs.readFileSync('www/app.js','utf8');
if(!app242.includes('TAIMAKO_ADMIN_TILE_ORDER_V242')){
  const ordering=String.raw\`
/* TAIMAKO_ADMIN_TILE_ORDER_V242 */
(function(){
 const wanted=['CASH CREDIT','CHECK','ADVANCE CASH CREDIT','LOAN','BALANCES','PENDING APPROVAL','CONTACT REQUEST','CREATE ACCOUNT','SETUP','SUMMARY REPORT'];
 const norm=s=>String(s||'').replace(/\\s+/g,' ').trim().toUpperCase();
 function run(){
  const all=[...document.querySelectorAll('body *')];
  const titles=all.filter(el=>el.children.length===0&&wanted.includes(norm(el.textContent)));
  let best=null,bestCount=0;
  for(const title of titles){
   let parent=title.parentElement;
   for(let depth=0;parent&&depth<8;depth++,parent=parent.parentElement){
    const children=[...parent.children];
    const matches=children.filter(child=>wanted.some(label=>[child,...child.querySelectorAll('*')].some(node=>norm(node.textContent)===label)));
    if(matches.length>bestCount){best=parent;bestCount=matches.length;}
   }
  }
  if(!best||bestCount<3)return;
  const children=[...best.children];
  const tileLabel=child=>{
   for(const node of [child,...child.querySelectorAll('*')]){
    const value=norm(node.textContent);
    if(wanted.includes(value))return value;
   }
   return '';
  };
  const matched=children.filter(child=>tileLabel(child));
  if(matched.length<3)return;
  const others=children.filter(child=>!tileLabel(child));
  matched.sort((a,b)=>wanted.indexOf(tileLabel(a))-wanted.indexOf(tileLabel(b)));
  for(const child of [...matched,...others])best.appendChild(child);
 }
 let queued=false;
 const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run();});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
})();
\`;
  app242 += '\\n' + ordering + '\\n';
}
app242=app242.replace(/serviceWorker\\.register\\(['"]\\.\\/sw\\.js\\?v=\\d+['"]/g,"serviceWorker.register('./sw.js?v=242'");
fs.writeFileSync('www/app.js',app242);
html=html.replace(/app\\.js\\?v=\\d+/g,'app.js?v=242').replace(/styles\\.css\\?v=\\d+/g,'styles.css?v=242').replace(/cash-credit-v66\\.js\\?v=\\d+/g,'cash-credit-v66.js?v=242');
fs.writeFileSync('www/index.html',html);
sw=fs.readFileSync('www/sw.js','utf8').replace(/const CACHE = 'taimako-v\\d+';/,"const CACHE = 'taimako-v242';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 242 Admin dashboard tile order applied.');
