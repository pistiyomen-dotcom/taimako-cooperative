const fs=require('fs');
const p='server/routes/account.js';
let s=fs.readFileSync(p,'utf8');

if(!s.includes('currentMonthSavingsResult')){
  const marker="  const row = result.rows[0];";
  const add=`  const row = result.rows[0];
  const currentMonthSavingsResult = await pool.query(
    "SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE account_id=$1 AND status IN ('approved','completed') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND destination IN ('REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE') AND COALESCE(approved_at,created_at) >= date_trunc('month',CURRENT_DATE) AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_DATE)+INTERVAL '1 month'",
    [req.auth.sub]
  );
  const currentMonthSavings = money(currentMonthSavingsResult.rows[0]?.total);
`;
  if(!s.includes(marker)){console.error('Stage 38 account row marker not found');process.exit(1);}
  s=s.replace(marker,add);
}

s=s.replace(
  "totalSavings: savings, numberOfShares: Math.floor(savings / 5000),",
  "totalSavings: currentMonthSavings, numberOfShares: Math.floor(currentMonthSavings / 5000),"
);

fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 38 current-month savings and shares applied.');
