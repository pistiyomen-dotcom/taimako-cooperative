const fs=require('fs');
const AdmZip=require('adm-zip');
let data='';
for(let i=0;i<6;i++){data+=fs.readFileSync('bundle.part'+i,'utf8').trim();}
fs.writeFileSync('stage12.zip',Buffer.from(data,'base64'));
new AdmZip('stage12.zip').extractAllTo(process.cwd(),true);
fs.unlinkSync('stage12.zip');
require('./stage14-patch.js');
require('./stage15-patch.js');
require('./stage16-patch.js');
require('./stage17-patch.js');
require('./stage18-patch.js');
require('./stage19-patch.js');
require('./stage20-patch.js');
require('./stage21-patch.js');
require('./stage22-patch.js');
require('./stage23-patch.js');
require('./stage24-patch.js');
console.log('TAIMAKO source extracted with staged corrections.');
