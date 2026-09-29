const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=59');
fs.writeFileSync('www/index.html',html);

let server=fs.readFileSync('server/index.js','utf8');
server=server.replace(
  "app.use(express.static(webRoot));",
  "app.use(express.static(webRoot,{setHeaders:(res,filePath)=>{ if(/\\.(html|js|css)$/.test(filePath) || filePath.endsWith('sw.js')) res.setHeader('Cache-Control','no-store, no-cache, must-revalidate'); }}));"
);
fs.writeFileSync('server/index.js',server);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v59';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 59 frontend delivery refresh applied.');
