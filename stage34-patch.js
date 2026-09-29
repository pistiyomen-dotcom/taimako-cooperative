const fs=require('fs');

// Stage 34: persist new payment receipts in PostgreSQL instead of Render ephemeral disk.
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('receipt_data BYTEA')){
  const alter=`

ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS receipt_data BYTEA;
ALTER TABLE payment_requests ALTER COLUMN receipt_path DROP NOT NULL;
`;
  schema=schema.replace('\nCOMMIT;',alter+'\nCOMMIT;');
}
fs.writeFileSync(schemaPath,schema);

const accountPath='server/routes/account.js';
let account=fs.readFileSync(accountPath,'utf8');

// Switch multer from disk storage to memory storage for durable database persistence.
if(!account.includes('multer.memoryStorage()')){
  const diskStart=account.indexOf('const storage = multer.diskStorage({');
  const uploadStart=account.indexOf('const upload = multer({',diskStart);
  if(diskStart<0 || uploadStart<0){ console.error('Stage 34 multer storage target not found'); process.exit(1); }
  account=account.slice(0,diskStart)+"const storage = multer.memoryStorage();\n"+account.slice(uploadStart);
}

// Remove filesystem cleanup calls: memory uploads have no path.
account=account.replace(/\s*if \(req\.file\) fs\.unlink\(req\.file\.path, \(\) => \{\}\);/g,'');

// Replace payment-request INSERT so receipt bytes are stored in PostgreSQL.
if(!account.includes('receipt_data, receipt_original_name')){
  const fields='receipt_path, receipt_original_name, receipt_mime_type, note';
  const fieldsNew='receipt_path, receipt_data, receipt_original_name, receipt_mime_type, note';
  if(!account.includes(fields)){ console.error('Stage 34 payment fields target not found'); process.exit(1); }
  account=account.replace(fields,fieldsNew);

  const values='VALUES($1,$2,$3,$4,$5,$6,$7,$8)';
  const valuesNew='VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8)';
  if(!account.includes(values)){ console.error('Stage 34 payment values target not found'); process.exit(1); }
  account=account.replace(values,valuesNew);

  account=account.replace(/path\.resolve\(req\.file\.path\)/g,'req.file.buffer');
  account=account.replace(/req\.file\.path/g,'req.file.buffer');
}
fs.writeFileSync(accountPath,account);

const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes('receipt_data, receipt_path, receipt_original_name')){
  const oldSelect="'SELECT receipt_path, receipt_original_name, receipt_mime_type FROM payment_requests WHERE id=$1', [id]";
  const newSelect="'SELECT receipt_data, receipt_path, receipt_original_name, receipt_mime_type FROM payment_requests WHERE id=$1', [id]";
  if(!admin.includes(oldSelect)){ console.error('Stage 34 receipt select target not found'); process.exit(1); }
  admin=admin.replace(oldSelect,newSelect);

  const oldSend=`
  res.type(row.receipt_mime_type);
  res.setHeader('Content-Disposition', \`inline; filename="\${String(row.receipt_original_name).replace(/["\\\\]/g, '')}"\`);
  res.sendFile(row.receipt_path);
`;
  const newSend=`
  res.type(row.receipt_mime_type);
  res.setHeader('Content-Disposition', \`inline; filename="\${String(row.receipt_original_name).replace(/["\\\\]/g, '')}"\`);
  if (row.receipt_data) return res.send(row.receipt_data);
  if (row.receipt_path) return res.sendFile(row.receipt_path);
  return res.status(404).json({ error: 'Receipt file is unavailable.' });
`;
  if(!admin.includes(oldSend)){ console.error('Stage 34 receipt send target not found'); process.exit(1); }
  admin=admin.replace(oldSend,newSend);
}
fs.writeFileSync(adminPath,admin);

console.log('TAIMAKO Stage 34 persistent database receipt storage applied.');
