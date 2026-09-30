const fs=require('fs');
const p='www/sw.js';
let s=fs.readFileSync(p,'utf8');
s=s.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v50';");
fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 51 cache bumped to v50.');

require('./stage52-patch.js');

require('./stage54-patch.js');

require('./stage55-patch.js');

require('./stage56-patch.js');

require('./stage57-patch.js');

require('./stage58-patch.js');

require('./stage59-patch.js');

require('./stage60-patch.js');

require('./stage61-patch.js');

require('./stage62-patch.js');

require('./stage63-patch.js');

require('./stage64-patch.js');

require('./stage65-patch.js');

require('./stage66-patch.js');

require('./stage67-patch.js');
