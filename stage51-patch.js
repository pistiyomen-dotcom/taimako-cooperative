const fs=require('fs');
const p='www/sw.js';
let s=fs.readFileSync(p,'utf8');
s=s.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v50';");
fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 51 cache bumped to v50.');

require('./stage52-patch.js');
