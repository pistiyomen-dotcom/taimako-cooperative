// Rebuild Android assets after latest FAQ and welcome-page changes.
require('./stage224-faq-menu.js');
const fs=require('fs');
const page='www/index.html';
let html=fs.readFileSync(page,'utf8');
html=html.replace(/app\\.js\\?v=\\d+/g,'app.js?v=225');
html=html.replace(/styles\\.css\\?v=\\d+/g,'styles.css?v=225');
fs.writeFileSync(page,html);
const sw='www/sw.js';
let cache=fs.readFileSync(sw,'utf8');
cache=cache.replace(/const CACHE = 'taimako-v\\d+';/,"const CACHE = 'taimako-v225';");
fs.writeFileSync(sw,cache);
console.log('Stage 225 latest web UI included in Android assets.');