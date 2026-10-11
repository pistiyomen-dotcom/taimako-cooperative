const fs=require('fs');
const p='server/routes/admin.js';
let s=fs.readFileSync(p,'utf8');
const marker="    await client.query('COMMIT');\n    res.json({ approved:true, reference:request.reference,";
if(!s.includes(marker))throw Error('Admin withdrawal commit marker not found');
s=s.replace(marker,`    if ((request.role === 'flexible' || request.source === 'FLEXIBLE') && Number(feeAmount)>0) {
      await client.query(
        'UPDATE cooperative_financials SET management_balance=management_balance+$1, updated_at=NOW() WHERE id=1',
        [feeAmount]
      );
    }
    await client.query('COMMIT');
    res.json({ approved:true, reference:request.reference,`);
fs.writeFileSync(p,s);
console.log('Flexible withdrawal approval atomically moves its 20% charge to Management Balance.');
