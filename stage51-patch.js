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

require('./stage68-patch.js');

require('./stage69-patch.js');

require('./stage70-patch.js');

require('./stage71-patch.js');

require('./stage72-patch.js');

require('./stage73-patch.js');

require('./stage74-patch.js');

require('./stage75-patch.js');

require('./stage76-patch.js');

require('./stage77-patch.js');

require('./stage78-patch.js');

require('./stage79-patch.js');

require('./stage80-patch.js');

require('./stage81-patch.js');

require('./stage82-patch.js');

require('./stage83-patch.js');


require('./stage85-patch.js');

require('./stage86-patch.js');

require('./stage87-patch.js');

require('./stage88-patch.js');

require('./stage89-patch.js');

require('./stage90-patch.js');

require('./stage93-patch.js');
require('./stage94-patch.js');
require('./stage95-patch.js');
require('./stage96-patch.js');
require('./stage97-patch.js');
