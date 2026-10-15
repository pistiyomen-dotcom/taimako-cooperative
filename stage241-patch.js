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

const orderPatch = "/* TAIMAKO_ADMIN_TILE_ORDER_V242 */\n(function(){\n const wanted=['CASH CREDIT','CHECK','ADVANCE CASH CREDIT','LOAN','BALANCES','PENDING APPROVAL','CONTACT REQUEST','CREATE ACCOUNT','SETUP','SUMMARY REPORT'];\n const norm=s=>String(s||'').replace(/\\s+/g,' ').trim().toUpperCase();\n function run(){\n  const all=[...document.querySelectorAll('body *')];\n  const titles=all.filter(el=>el.children.length===0&&wanted.includes(norm(el.textContent)));\n  let best=null,bestCount=0;\n  for(const title of titles){\n   let parent=title.parentElement;\n   for(let depth=0;parent&&depth<8;depth++,parent=parent.parentElement){\n    const matches=[...parent.children].filter(child=>wanted.some(label=>[child,...child.querySelectorAll('*')].some(node=>norm(node.textContent)===label)));\n    if(matches.length>bestCount){best=parent;bestCount=matches.length;}\n   }\n  }\n  if(!best||bestCount<3)return;\n  const children=[...best.children];\n  const labelOf=child=>{for(const node of [child,...child.querySelectorAll('*')]){const v=norm(node.textContent);if(wanted.includes(v))return v;}return '';};\n  const matched=children.filter(child=>labelOf(child));\n  if(matched.length<3)return;\n  const others=children.filter(child=>!labelOf(child));\n  matched.sort((a,b)=>wanted.indexOf(labelOf(a))-wanted.indexOf(labelOf(b)));\n  const desired=[...matched,...others];\n  if(desired.every((child,index)=>child===children[index]))return;\n  desired.forEach(child=>best.appendChild(child));\n }\n let queued=false;\n const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run();});};\n if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();\n new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});\n})();";
let app242=fs.readFileSync('www/app.js','utf8');
if(!app242.includes('TAIMAKO_ADMIN_TILE_ORDER_V242')){
 app242 += '\n' + orderPatch + '\n';
}
app242=app242.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=242'");
fs.writeFileSync('www/app.js',app242);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=242').replace(/styles\.css\?v=\d+/g,'styles.css?v=242').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=242');
fs.writeFileSync('www/index.html',html);
sw=fs.readFileSync('www/sw.js','utf8').replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v242';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 242 Admin dashboard tile order applied.');

require('./stage242-patch.js');
