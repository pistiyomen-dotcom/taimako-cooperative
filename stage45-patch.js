const fs=require('fs');

let a=fs.readFileSync('server/routes/account.js','utf8');
if(!a.includes('Regular Savings withdrawal before the annual year-end')){
  const marker="  const type = String(source || '').toUpperCase();\n  if (!['TARGET','CONSTANT','WELFARE'].includes(type)) {";
  const repl="  const type = String(source || '').toUpperCase();\n  if (type === 'REGULAR') {\n    const feePercent = 20;\n    const feeAmount = Number((amount * feePercent / 100).toFixed(2));\n    const payoutAmount = Number((amount - feeAmount).toFixed(2));\n    return { feePercent, feeAmount, payoutAmount, ruleApplied:'Regular Savings withdrawal before the annual year-end: 20% charge applies. A 30-day notice period is required before approval.' };\n  }\n  if (!['TARGET','CONSTANT','WELFARE'].includes(type)) {";
  if(!a.includes(marker)){console.error('Stage 45 member withdrawal helper marker missing');process.exit(1);}
  a=a.replace(marker,repl);
}
fs.writeFileSync('server/routes/account.js',a);

let ad=fs.readFileSync('server/routes/admin.js','utf8');
if(!ad.includes('Regular Savings early withdrawal cannot be approved')){
  const marker="  const type = String(source || '').toUpperCase();\n  const result = await client.query(";
  const repl="  const type = String(source || '').toUpperCase();\n  if (type === 'REGULAR') {\n    const noticeDays = adminDaysBetween(new Date(), new Date(requestedAt));\n    if (noticeDays < 30) throw new Error('Regular Savings early withdrawal cannot be approved until the required 30-day notice period is completed.');\n    const feePercent = 20;\n    const feeAmount = Number((amount * feePercent / 100).toFixed(2));\n    const payoutAmount = Number((amount - feeAmount).toFixed(2));\n    return { feePercent, feeAmount, payoutAmount, ruleApplied:'Regular Savings withdrawal before the annual year-end: 20% charge applies after the required 30-day notice.' };\n  }\n  const result = await client.query(";
  if(!ad.includes(marker)){console.error('Stage 45 admin withdrawal helper marker missing');process.exit(1);}
  ad=ad.replace(marker,repl);

  const approvalMarker="    if (request.role === 'flexible' || request.source === 'FLEXIBLE') {";
  const approvalRepl="    if (request.source === 'REGULAR') {\n      const eligibility = await adminSavingsWithdrawalTerms(client, request.account_id, request.source, amount, balance, request.created_at);\n      feePercent = eligibility.feePercent;\n      feeAmount = eligibility.feeAmount;\n      payoutAmount = eligibility.payoutAmount;\n      ruleApplied = eligibility.ruleApplied;\n    } else if (request.role === 'flexible' || request.source === 'FLEXIBLE') {";
  if(!ad.includes(approvalMarker)){console.error('Stage 45 approval branch marker missing');process.exit(1);}
  ad=ad.replace(approvalMarker,approvalRepl);
}
fs.writeFileSync('server/routes/admin.js',ad);

console.log('TAIMAKO Stage 45 Regular early withdrawal rule applied.');