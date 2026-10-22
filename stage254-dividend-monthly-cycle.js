const fs=require('fs');

/* Stage 254: activate the approved monthly dividend process and make member
   credits idempotent. Stage 186 supplies the schema, snapshot, calculation,
   savings-type breakdown, scheduler, and admin summary. */
require('./stage186-patch.js');

const servicePath='server/services-dividend-v186.js';
let service=fs.readFileSync(servicePath,'utf8');
if(!service.includes('DIVIDEND_V254_IDEMPOTENT_MEMBER_CREDIT')){
  const start=service.indexOf('    for(const [accountId,total] of memberTotals.entries()){');
  const end=service.indexOf("\n\n    await client.query('UPDATE dividend_summaries SET distributed_at=NOW() WHERE period_month=$1',[periodMonth]);",start);
  if(start<0||end<0) throw Error('Stage 254: member dividend credit block was not found.');
  const replacement=[
    '    for(const [accountId,total] of memberTotals.entries()){',
    "      const reference='DIV-'+String(periodMonth).slice(0,7).replace('-','')+'-'+accountId;",
    '      // DIVIDEND_V254_IDEMPOTENT_MEMBER_CREDIT: insert the unique ledger row first.',
    '      // Only update the aggregate dividend balance when this run inserted it.',
    '      const ledger=await client.query(',
    "        `INSERT INTO transactions(reference,account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,'dividend_credit','DIVIDEND',$3,'completed',$4,NOW()) ON CONFLICT(reference) DO NOTHING RETURNING account_id`,",
    "        [reference,accountId,total,'Monthly dividend for '+String(periodMonth).slice(0,7)]",
    '      );',
    '      if(ledger.rowCount){',
    '        const balance=await client.query(',
    "          'UPDATE member_balances SET dividend=dividend+$1,updated_at=NOW() WHERE account_id=$2',",
    '          [total,accountId]',
    '        );',
    "        if(!balance.rowCount) throw new Error('Member balance row not found for dividend account '+accountId);",
    '      }',
    '    }'
  ].join('\n');
  service=service.slice(0,start)+replacement+service.slice(end);
}
fs.writeFileSync(servicePath,service);

// Bump client asset versions so browsers do not retain stale dividend UI.
let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\\.register\\('\\.\\/sw\\.js\\?v=\\d+'/, "serviceWorker.register('./sw.js?v=254'");
fs.writeFileSync('www/app.js',app);
let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\\.js\\?v=\\d+/g,'app.js?v=254');
html=html.replace(/styles\\.css\\?v=\\d+/g,'styles.css?v=254');
html=html.replace(/bank-transfer-v129\\.js\\?v=\\d+/g,'bank-transfer-v129.js?v=254');
fs.writeFileSync('www/index.html',html);
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\\d+';/,"const CACHE = 'taimako-v254';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 254 monthly dividend process and duplicate-credit safeguard applied.');