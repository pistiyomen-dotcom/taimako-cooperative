const fs=require('fs');

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v58';");
fs.writeFileSync('www/sw.js',sw);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=58'");
fs.writeFileSync('www/app.js',app);

console.log('TAIMAKO Stage 58 forced browser cache refresh applied.');
