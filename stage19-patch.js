const fs = require('fs');

function insertBefore(path, marker, text) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(text.trim().slice(0, 80))) {
    if (!s.includes(marker)) throw new Error('Marker not found in ' + path + ': ' + marker);
    s = s.replace(marker, text + '\n' + marker);
    fs.writeFileSync(path, s);
  }
}

// Account-side product-aware withdrawal estimates and validation.
const accountPath = 'server/routes/account.js';
let account = fs.readFileSync(accountPath, 'utf8');
if (!account.includes('async function savingsWithdrawalTerms')) {
  const helper = `
function addMonths(dateValue, months) {
  const d = new Date(dateValue);
  d.setUTCMonth(d.getUTCMonth() + Number(months || 0));
  return d;
}
function daysBetween(later, earlier) { return Math.floor((later - earlier) / 86400000); }

async function savingsWithdrawalTerms(accountId, source, amount, balance, requestedAt = new Date()) {
  const type = String(source || '').toUpperCase();
  if (!['TARGET','CONSTANT','WELFARE'].includes(type)) {
    return { feePercent:null, feeAmount:null, payoutAmount:amount, ruleApplied:null };
  }
  const result = await pool.query(
    'SELECT plan_type,start_date,duration_months,minimum_balance,disbursement_months,status FROM savings_plans WHERE account_id=$1 AND plan_type=$2',
    [accountId, type]
  );
  const plan = result.rows[0];
  if (!plan || plan.status !== 'active') throw new Error(type + ' Savings plan is not configured as active. Ask Admin to set up the plan first.');

  const now = new Date();
  const start = new Date(plan.start_date);
  const end = addMonths(start, plan.duration_months);
  const noticeDays = daysBetween(now, new Date(requestedAt));
  let feePercent = 0, feeAmount = 0, payoutAmount = amount, ruleApplied = '';

  if (type === 'TARGET') {
    const early = now < end;
    feePercent = early ? 20 : 0;
    feeAmount = Number((amount * feePercent / 100).toFixed(2));
    payoutAmount = Number((amount - feeAmount).toFixed(2));
    ruleApplied = early
      ? 'Target withdrawal before the end of the target period: 20% charge applies.'
      : 'Target period completed: no early-withdrawal charge applies.';
  }

  if (type === 'WELFARE') {
    if (noticeDays < 30) throw new Error('Welfare withdrawal requires at least 30 days notice. This request can be approved after the notice period is completed.');
    feePercent = 20;
    feeAmount = Number((amount * 20 / 100).toFixed(2));
    payoutAmount = Number((amount - feeAmount).toFixed(2));
    ruleApplied = 'Welfare withdrawal during the savings/welfare period: 20% charge applies after the required 30-day notice.';
  }

  if (type === 'CONSTANT') {
    const fiveYearDate = addMonths(start, 60);
    const minimumBalance = Number(plan.minimum_balance || 300000);
    if (now < fiveYearDate) {
      if (balance > minimumBalance) {
        const excess = Number((balance - minimumBalance).toFixed(2));
        if (amount > excess) throw new Error('Before 5 years, only the excess above the protected minimum balance of ₦' + minimumBalance.toLocaleString('en-NG') + ' can be withdrawn without charge. Current excess: ₦' + excess.toLocaleString('en-NG',{minimumFractionDigits:2}) + '.');
        if (noticeDays < 30) throw new Error('Constant Savings excess withdrawal requires at least 30 days notice.');
        feePercent = 0; feeAmount = 0; payoutAmount = amount;
        ruleApplied = 'Constant Savings before 5 years: withdrawal is from excess above the protected minimum balance; no charge after 30 days notice.';
      } else {
        feePercent = 20;
        feeAmount = Number((amount * 20 / 100).toFixed(2));
        payoutAmount = Number((amount - feeAmount).toFixed(2));
        ruleApplied = 'Constant Savings withdrawal before 5 years without the required minimum balance: 20% charge applies.';
      }
    } else {
      if (balance < minimumBalance) {
        const shortfall = Number((minimumBalance - balance).toFixed(2));
        feeAmount = Number((shortfall * 5 / 100).toFixed(2));
        feePercent = null;
        payoutAmount = Number((amount - feeAmount).toFixed(2));
        if (payoutAmount < 0) throw new Error('The 5% charge on the Constant Savings shortfall is ₦' + feeAmount.toLocaleString('en-NG',{minimumFractionDigits:2}) + ', which exceeds this requested withdrawal. Increase the request amount or clear the charge first.');
        ruleApplied = 'Constant Savings after 5 years with minimum balance shortfall: 5% of the short-saved amount is charged before disbursement.';
      } else {
        feePercent = 0; feeAmount = 0; payoutAmount = amount;
        ruleApplied = 'Constant Savings five-year minimum and minimum-balance condition satisfied: no withdrawal charge applies.';
      }
    }
  }
  return { feePercent, feeAmount, payoutAmount, ruleApplied };
}
`;
  account = account.replace("router.post('/withdrawal-requests', requireAuth, async (req, res) => {", helper + "\nrouter.post('/withdrawal-requests', requireAuth, async (req, res) => {");
}
account = account.replace(
`  let feePercent = null, feeAmount = null, payoutAmount = null, ruleApplied = null;
  if (me.role === 'flexible') {
    const eligibility = await flexibleWithdrawalTerms(req.auth.sub, amount, me.flexible_start_date);
    feePercent = eligibility.feePercent;
    feeAmount = eligibility.feeAmount;
    payoutAmount = eligibility.payoutAmount;
    ruleApplied = eligibility.ruleApplied;
  }`,
`  let feePercent = null, feeAmount = null, payoutAmount = null, ruleApplied = null;
  if (me.role === 'flexible' || source === 'FLEXIBLE') {
    const eligibility = await flexibleWithdrawalTerms(req.auth.sub, amount, me.flexible_start_date);
    feePercent = eligibility.feePercent;
    feeAmount = eligibility.feeAmount;
    payoutAmount = eligibility.payoutAmount;
    ruleApplied = eligibility.ruleApplied;
  } else if (['TARGET','CONSTANT','WELFARE'].includes(source)) {
    const eligibility = await savingsWithdrawalTerms(req.auth.sub, source, amount, balance, new Date());
    feePercent = eligibility.feePercent;
    feeAmount = eligibility.feeAmount;
    payoutAmount = eligibility.payoutAmount;
    ruleApplied = eligibility.ruleApplied;
  }`
);
fs.writeFileSync(accountPath, account);

// Admin-side recalculation at approval time.
const adminPath = 'server/routes/admin.js';
let admin = fs.readFileSync(adminPath, 'utf8');
if (!admin.includes('async function adminSavingsWithdrawalTerms')) {
  const helper = `
function adminAddMonths(dateValue, months) {
  const d = new Date(dateValue);
  d.setUTCMonth(d.getUTCMonth() + Number(months || 0));
  return d;
}
function adminDaysBetween(later, earlier) { return Math.floor((later - earlier) / 86400000); }
async function adminSavingsWithdrawalTerms(client, accountId, source, amount, balance, requestedAt) {
  const type = String(source || '').toUpperCase();
  const result = await client.query(
    'SELECT plan_type,start_date,duration_months,minimum_balance,disbursement_months,status FROM savings_plans WHERE account_id=$1 AND plan_type=$2 FOR UPDATE',
    [accountId, type]
  );
  const plan = result.rows[0];
  if (!plan || plan.status !== 'active') throw new Error(type + ' Savings plan is not configured as active. Configure the plan before approving this withdrawal.');
  const now = new Date();
  const start = new Date(plan.start_date);
  const end = adminAddMonths(start, plan.duration_months);
  const noticeDays = adminDaysBetween(now, new Date(requestedAt));
  let feePercent = 0, feeAmount = 0, payoutAmount = amount, ruleApplied = '';

  if (type === 'TARGET') {
    const early = now < end;
    feePercent = early ? 20 : 0;
    feeAmount = Number((amount * feePercent / 100).toFixed(2));
    payoutAmount = Number((amount - feeAmount).toFixed(2));
    ruleApplied = early ? 'Target withdrawal before the end of the target period: 20% charge applies.' : 'Target period completed: no early-withdrawal charge applies.';
  }
  if (type === 'WELFARE') {
    if (noticeDays < 30) throw new Error('Welfare withdrawal cannot be approved until the required 30-day notice period is completed.');
    feePercent = 20;
    feeAmount = Number((amount * 20 / 100).toFixed(2));
    payoutAmount = Number((amount - feeAmount).toFixed(2));
    ruleApplied = 'Welfare withdrawal during the savings/welfare period: 20% charge applies after the required 30-day notice.';
  }
  if (type === 'CONSTANT') {
    const fiveYearDate = adminAddMonths(start, 60);
    const minimumBalance = Number(plan.minimum_balance || 300000);
    if (now < fiveYearDate) {
      if (balance > minimumBalance) {
        const excess = Number((balance - minimumBalance).toFixed(2));
        if (amount > excess) throw new Error('Before 5 years, approval is limited to the excess above the protected minimum balance. Current excess: ₦' + excess.toLocaleString('en-NG',{minimumFractionDigits:2}) + '.');
        if (noticeDays < 30) throw new Error('Constant Savings excess withdrawal cannot be approved until the required 30-day notice period is completed.');
        feePercent = 0; feeAmount = 0; payoutAmount = amount;
        ruleApplied = 'Constant Savings before 5 years: withdrawal is from excess above the protected minimum balance; no charge after 30 days notice.';
      } else {
        feePercent = 20;
        feeAmount = Number((amount * 20 / 100).toFixed(2));
        payoutAmount = Number((amount - feeAmount).toFixed(2));
        ruleApplied = 'Constant Savings withdrawal before 5 years without the required minimum balance: 20% charge applies.';
      }
    } else if (balance < minimumBalance) {
      const shortfall = Number((minimumBalance - balance).toFixed(2));
      feeAmount = Number((shortfall * 5 / 100).toFixed(2));
      feePercent = null;
      payoutAmount = Number((amount - feeAmount).toFixed(2));
      if (payoutAmount < 0) throw new Error('The 5% charge on the Constant Savings shortfall exceeds this requested withdrawal.');
      ruleApplied = 'Constant Savings after 5 years with minimum balance shortfall: 5% of the short-saved amount is charged before disbursement.';
    } else {
      feePercent = 0; feeAmount = 0; payoutAmount = amount;
      ruleApplied = 'Constant Savings five-year minimum and minimum-balance condition satisfied: no withdrawal charge applies.';
    }
  }
  return { feePercent, feeAmount, payoutAmount, ruleApplied };
}
`;
  admin = admin.replace("router.get('/withdrawal-requests', async (req, res) => {", helper + "\nrouter.get('/withdrawal-requests', async (req, res) => {");
}
admin = admin.replace(
`    let feePercent = null, feeAmount = null, payoutAmount = amount, ruleApplied = null;
    if (request.role === 'flexible') {`,
`    let feePercent = null, feeAmount = null, payoutAmount = amount, ruleApplied = null;
    if (request.role === 'flexible' || request.source === 'FLEXIBLE') {`
);
admin = admin.replace(
`      payoutAmount = Number((amount - feeAmount).toFixed(2));
    }

    await client.query(\`UPDATE member_balances SET \${column}=\${column}-$1, updated_at=NOW() WHERE account_id=$2\`, [amount, request.account_id]);`,
`      payoutAmount = Number((amount - feeAmount).toFixed(2));
    } else if (['TARGET','CONSTANT','WELFARE'].includes(request.source)) {
      const eligibility = await adminSavingsWithdrawalTerms(client, request.account_id, request.source, amount, balance, request.created_at);
      feePercent = eligibility.feePercent;
      feeAmount = eligibility.feeAmount;
      payoutAmount = eligibility.payoutAmount;
      ruleApplied = eligibility.ruleApplied;
    }

    await client.query(\`UPDATE member_balances SET \${column}=\${column}-$1, updated_at=NOW() WHERE account_id=$2\`, [amount, request.account_id]);`
);
fs.writeFileSync(adminPath, admin);

// Browser guidance and estimates for all product-aware sources.
const appPath = 'www/app.js';
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace(
"    : 'Submit the source and amount for Admin review. The balance changes only after approval.';",
"    : 'Target: 20% before target end. Constant: five-year/minimum-balance rules apply. Welfare: 20% and minimum 30-day notice. Final terms are recalculated when Admin approves.';"
);
app = app.replace(
"      const estimate = request.role === 'flexible' && request.fee_percent !== null\n        ? `<span>Current estimate: ${escapeHTML(request.fee_percent)}% charge • payout ${naira(request.payout_amount)}</span>` : '';",
"      const estimate = request.fee_amount !== null && request.fee_amount !== undefined\n        ? `<span>Current estimate: ${request.fee_percent === null ? 'rule charge' : escapeHTML(request.fee_percent) + '% charge'} • fee ${naira(request.fee_amount)} • payout ${naira(request.payout_amount)}</span>` : '';"
);
app = app.replace(
"    const feeText = data.feePercent === null ? '' : ` Charge: ${data.feePercent}% (${naira(data.feeAmount)}). Payout: ${naira(data.payoutAmount)}.`;",
"    const feeText = data.feeAmount === null || data.feeAmount === undefined ? '' : ` Charge: ${data.feePercent === null ? 'rule-based' : data.feePercent + '%'} (${naira(data.feeAmount)}). Payout: ${naira(data.payoutAmount)}.`;"
);
fs.writeFileSync(appPath, app);

// Cache bump.
let sw = fs.readFileSync('www/sw.js','utf8').replace(/taimako-v18/g,'taimako-v19');
fs.writeFileSync('www/sw.js', sw);
let index = fs.readFileSync('www/index.html','utf8').replace(/app\.js\?v=18/g,'app.js?v=19').replace(/styles\.css\?v=18/g,'styles.css?v=19');
fs.writeFileSync('www/index.html', index);
app = fs.readFileSync(appPath,'utf8').replace(/sw\.js\?v=18/g,'sw.js?v=19');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 19 product-aware withdrawal enforcement applied.');
