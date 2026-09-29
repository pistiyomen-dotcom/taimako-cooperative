const fs = require('fs');

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');

if(!app.includes('function compactHomeActionTiles')) {
  app += `

function compactHomeActionTiles() {
  document.querySelectorAll('button, a').forEach((el) => {
    const label=(el.textContent||'').replace(/\\s+/g,' ').trim();
    if(!/\\bOPEN$/i.test(label)) return;

    const title=label.replace(/\\s*OPEN$/i,'').trim();
    if(!title) return;

    const openParts=[...el.querySelectorAll('span,small,b,strong')].filter(
      node => (node.textContent||'').trim().toUpperCase()==='OPEN'
    );
    if(openParts.length){
      openParts.forEach(node=>node.remove());
    } else {
      el.textContent=title;
    }
    el.classList.add('home-title-only-action');
    el.setAttribute('aria-label',title);
  });
}

window.addEventListener('DOMContentLoaded', compactHomeActionTiles);
const homeTileObserver=new MutationObserver(compactHomeActionTiles);
homeTileObserver.observe(document.documentElement,{childList:true,subtree:true});
`;
}

fs.writeFileSync(appPath,app);

const cssPath='www/styles.css';
let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('.home-title-only-action')) {
  css += `

.home-title-only-action {
  font-size: 1.08rem !important;
  font-weight: 800 !important;
  line-height: 1.15 !important;
  min-height: 0 !important;
  padding: 0.55rem 0.7rem !important;
  gap: 0 !important;
}
.home-title-only-action span,
.home-title-only-action small {
  margin: 0 !important;
}
`;
}
fs.writeFileSync(cssPath,css);

// Cache bump.
let index=fs.readFileSync('www/index.html','utf8')
  .replace(/app\\.js\\?v=20/g,'app.js?v=21')
  .replace(/styles\\.css\\?v=20/g,'styles.css?v=21');
fs.writeFileSync('www/index.html',index);

let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v20/g,'taimako-v21');
fs.writeFileSync('www/sw.js',sw);

app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=20/g,'sw.js?v=21');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 21 compact home action tiles applied.');
