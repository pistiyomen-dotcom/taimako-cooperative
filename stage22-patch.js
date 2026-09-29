const fs = require('fs');

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');

const oldMarkup = "  b.innerHTML = `${name}<span>Open</span>`;";
const newMarkup = "  b.textContent = name;";
if(!app.includes(oldMarkup)){
  console.error('Stage 22 home tile markup target not found');
  process.exit(1);
}
app=app.replace(oldMarkup,newMarkup);
fs.writeFileSync(appPath,app);

const cssPath='www/styles.css';
let css=fs.readFileSync(cssPath,'utf8');

css=css.replace(
`  padding: 22px 16px;
  min-height: 110px;
  font-weight: 800;
  color: var(--green-dark);
  cursor: pointer;
  text-align: left;
}
.menu-card span { display:block; color: var(--gold); font-size: 13px; margin-top: 10px; font-weight: 700; }`,
`  padding: 13px 14px;
  min-height: 72px;
  font-size: 18px;
  line-height: 1.15;
  font-weight: 800;
  color: var(--green-dark);
  cursor: pointer;
  text-align: left;
}`
);

css=css.replace(
"  .menu-card { min-height:96px; padding:16px 12px; font-size:14px; }",
"  .menu-card { min-height:68px; padding:12px 10px; font-size:16px; line-height:1.15; }"
);

fs.writeFileSync(cssPath,css);

let index=fs.readFileSync('www/index.html','utf8')
  .replace(/app\.js\?v=21/g,'app.js?v=22')
  .replace(/styles\.css\?v=21/g,'styles.css?v=22');
fs.writeFileSync('www/index.html',index);

let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v21/g,'taimako-v22');
fs.writeFileSync('www/sw.js',sw);

app=fs.readFileSync(appPath,'utf8').replace(/sw\.js\?v=21/g,'sw.js?v=22');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 22 direct home tile markup and sizing applied.');
