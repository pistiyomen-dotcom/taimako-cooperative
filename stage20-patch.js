const fs = require('fs');
const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8');

const oldBtn='<button value="cancel" class="icon-btn" aria-label="Close">×</button>';
const newBtn='<button type="button" class="icon-btn" data-close="loginDialog" aria-label="Close">×</button>';
if(!index.includes(oldBtn)){
  console.error('Stage 20 login close button target not found');
  process.exit(1);
}
index=index.replace(oldBtn,newBtn);

// Bump browser cache so the corrected login dialog is fetched immediately.
index=index.replace(/app\.js\?v=19/g,'app.js?v=20').replace(/styles\.css\?v=19/g,'styles.css?v=20');
fs.writeFileSync(indexPath,index);

let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v19/g,'taimako-v20');
fs.writeFileSync('www/sw.js',sw);

let app=fs.readFileSync('www/app.js','utf8').replace(/sw\.js\?v=19/g,'sw.js?v=20');
fs.writeFileSync('www/app.js',app);

console.log('TAIMAKO Stage 20 login close button fix applied.');
