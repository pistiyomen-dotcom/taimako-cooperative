const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const helperMarker="function naira(value) { return `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }";
const helpers=`
function tmcsMonthName(offset=0){
  const d=new Date();
  d.setDate(1);
  d.setMonth(d.getMonth()+offset);
  return d.toLocaleString('en-US',{month:'long'}).toUpperCase();
}
function tmcsFormatDMY(value){
  if(!value) return '—';
  const s=String(value).slice(0,10);
  const p=s.split('-');
  if(p.length===3) return p[2]+'/'+p[1]+'/'+p[0];
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return '—';
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
`;
if(!app.includes('function tmcsMonthName(')){
  if(!app.includes(helperMarker)){console.error('Stage 99 helper marker missing');process.exit(1);}
  app=app.replace(helperMarker,helperMarker+helpers);
}

const oldCards=`  return [
    ['REGISTRATION', naira(b.registration)], ['REGULAR', naira(b.regular)], ['TARGET', naira(b.target)],
    ['CONSTANT', naira(b.constant)], ['WELFARE', naira(b.welfare)], ['FLEXIBLE', naira(b.flexible)],
    ['TOTAL SAVINGS', naira(b.totalSavings)], ['NUMBER OF SHARES', String(b.numberOfShares ?? 0)],
    ['DIVIDEND', 'Not calculated yet'], ['ACTIVE LOAN', b.loanPrincipal ? naira(b.loanPrincipal) : 'None'],
    ['PAYMENT DUE DATE', b.loanDueDate || '—'], ['LOAN INTEREST', naira(b.loanInterest)]
  ];`;

const newCards=`  const accumulatedLoanSavings=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);
  const activeLoanText=Number(b.loanPrincipal||0)>0
    ? naira(b.loanPrincipal)+'\\nDUE on '+tmcsFormatDMY(b.loanDueDate)
    : 'None';
  return [
    ['REGISTRATION', naira(b.registration)], ['REGULAR', naira(b.regular)], ['TARGET', naira(b.target)],
    ['CONSTANT', naira(b.constant)], ['WELFARE', naira(b.welfare)], ['FLEXIBLE', naira(b.flexible)],
    ['TOTAL SAVINGS', naira(accumulatedLoanSavings)], ['NUMBER OF SHARES', String(b.numberOfShares ?? 0)],
    [tmcsMonthName(-1)+' DIVIDEND', 'Not calculated yet'], ['ACTIVE LOAN', activeLoanText],
    [tmcsMonthName(0)+' SAVINGS', naira(b.totalSavings)], ['LOAN INTEREST', naira(b.loanInterest)]
  ];`;

if(!app.includes(oldCards)){console.error('Stage 99 member dashboard card block missing');process.exit(1);}
app=app.replace(oldCards,newCards);

const appendMarker="card.append(h,p);";
if(!app.includes("title === 'ACTIVE LOAN'")){
  app=app.replace(appendMarker,appendMarker+"\n    if(title === 'ACTIVE LOAN') p.style.whiteSpace='pre-line';");
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=99'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=99');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=99');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=99');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v99';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 99 member dashboard totals, month labels and loan due display applied.');