const fs=require('fs');
let html=fs.readFileSync('www/index.html','utf8');
const inputPattern=/<input\b(?=[^>]*\bid=["']loanGuarantorV94["'])[^>]*>/i;
const match=html.match(inputPattern);
if(!match)throw new Error('Stage 241: loan guarantor input not found.');
let input=match[0].replace(/\sdisabled(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/ig,'').replace(/\sreadonly(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/ig,'');
if(!/\btype\s*=\s*["']text["']/i.test(input))input=input.replace('<input','<input type="text"');
html=html.replace(inputPattern,input).replace(/app\.js\?v=\d+/g,'app.js?v=253').replace(/styles\.css\?v=\d+/g,'styles.css?v=253').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=253');
fs.writeFileSync('www/index.html',html);
let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=253'");
fs.writeFileSync('www/app.js',app);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v253';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 241 removed the hard-disabled/read-only state from the guarantor username input.');

const orderPatch = String.raw`
/* TAIMAKO_ADMIN_TILE_ORDER_V252 */
(function(){
  const priority=['CASH CREDIT','CHECK','ADVANCE CASH CREDIT','LOANS','BALANCES','PENDING APPROVALS','CONTACT REQUESTS','CREATE ACCOUNT','SETUP','SUMMARY REPORT'];
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toUpperCase();
  function arrange(){
    const all=Array.from(document.querySelectorAll('body *'));
    const matches={};
    priority.forEach(label=>{matches[label]=all.filter(el=>!el.children.length&&norm(el.textContent)===label);});
    if(priority.some(label=>!matches[label].length)) return false;
    let best=null;
    for(const label of priority){
      for(const node of matches[label]){
        let child=node;
        for(let depth=0;depth<10&&child&&child.parentElement;depth++,child=child.parentElement){
          const parent=child.parentElement;
          if(!parent) continue;
          const children=Array.from(parent.children);
          if(children.length<priority.length) continue;
          const mapped=priority.map(name=>matches[name].map(el=>{let c=el;while(c&&c.parentElement!==parent)c=c.parentElement;return c&&c.parentElement===parent?c:null;}).find(Boolean));
          if(mapped.every(Boolean)&&new Set(mapped).size===priority.length){
            const score=children.length;
            if(!best||score<best.score) best={parent,children,mapped,score};
          }
        }
      }
    }
    if(!best) return false;
    const desired=best.mapped.concat(best.children.filter(c=>!best.mapped.includes(c)));
    if(desired.every((el,i)=>best.children[i]===el)) return true;
    desired.forEach(el=>best.parent.appendChild(el));
    return true;
  }
  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;arrange();});}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(schedule,500);setTimeout(schedule,1500);setTimeout(schedule,3500);
})();
`; // Reorder whole Admin tile cards after the dashboard renders.

let app242=fs.readFileSync('www/app.js','utf8');
app242=app242.replace(/\/\* TAIMAKO_ADMIN_TILE_ORDER_V242 \*\/[\s\S]*?\}\)\(\);\s*/g,'');
if(!app242.includes('TAIMAKO_ADMIN_TILE_ORDER_V252')) app242 += '\n' + orderPatch + '\n';
app242=app242.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=253'");
fs.writeFileSync('www/app.js',app242);
html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=253').replace(/styles\.css\?v=\d+/g,'styles.css?v=253').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=253');
fs.writeFileSync('www/index.html',html);
sw=fs.readFileSync('www/sw.js','utf8').replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v253';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 243 improved Admin dashboard tile ordering and refreshed caches.');
