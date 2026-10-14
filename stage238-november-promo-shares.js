// Stage 238: Correct November promotion to allocate share counts, never cash.
const fs=require('fs');
const promoSql=fs.readFileSync('server/db/november-promo-v238.sql','utf8');
let schema=fs.readFileSync('server/db/schema.sql','utf8');
const start=schema.indexOf('-- TAIMAKO November promotion correction, stage 238.');
if(start>=0){
  const commitAt=schema.lastIndexOf('\nCOMMIT;');
  if(commitAt<start) throw Error('Stage 238 schema replacement boundary missing.');
  schema=schema.slice(0,start)+promoSql+'\n'+schema.slice(commitAt);
}else{
  if(!schema.includes('\nCOMMIT;')) throw Error('Stage 238 schema insertion point not found.');
  const commitAt=schema.lastIndexOf('\nCOMMIT;');
  schema=schema.slice(0,commitAt)+'\n'+promoSql+'\n'+schema.slice(commitAt);
}
fs.writeFileSync('server/db/schema.sql',schema);
console.log('TAIMAKO Stage 238 November promo share-unit correction applied.');
