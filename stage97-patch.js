const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

app=app.replace(
`function freshLoanTotalSavingsV94(){
  const b=state.balances||{};
  if(Number.isFinite(Number(b.totalSavings))) return Number(b.totalSavings||0);
  return Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0)+Number(b.flexible||0);
}`,
`function freshLoanTotalSavingsV94(){
  const b=state.balances||{};
  return Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0)+Number(b.flexible||0);
}`
);

app=app.replace(
`    const b=state.balances||{};
    const total=Number.isFinite(Number(b.totalSavings))
      ? Number(b.totalSavings||0)
      : Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0)+Number(b.flexible||0);`,
`    const b=state.balances||{};
    const total=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0)+Number(b.flexible||0);`
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=97'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=97');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=97');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=97');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v97';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 97 loan form now uses accumulated savings balances.');