const fs=require('fs');
const AdmZip=require('adm-zip');
const data=fs.readFileSync('bundle.b64','utf8').trim();
const zipPath='stage12.zip';
fs.writeFileSync(zipPath,Buffer.from(data,'base64'));
const zip=new AdmZip(zipPath);
zip.extractAllTo(process.cwd(),true);
fs.unlinkSync(zipPath);
console.log('TAIMAKO Stage 12 extracted.');
