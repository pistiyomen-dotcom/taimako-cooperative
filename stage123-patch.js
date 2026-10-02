const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace('/BANK\\\\s*TRANSFER/i','/BANK\\s*TRANSFER/i');

if(!app.includes('paymentForm.noValidate=true')){
  const marker="paymentForm.addEventListener('submit', async (e) => {";
  if(!app.includes(marker)){console.error('Stage 123 payment handler marker missing');process.exit(1);}
  app=app.replace(marker,"paymentForm.noValidate=true;\n"+marker);
}

if(!app.includes('payment-submit-click-feedback-v123')){
  const marker='paymentForm.noValidate=true;';
  const extra="\n/* payment-submit-click-feedback-v123 */\npaymentForm.querySelector('button[type=\\\"submit\\\"]')?.addEventListener('click',()=>{\n  paymentError.textContent='';\n  paymentSuccess.textContent='Processing bank-transfer submission…';\n});\n";
  app=app.replace(marker,marker+extra);
}

app=app.replace(/serviceWorker\\.register\\('\\.\\/sw\\.js\\?v=\\d+'/, "serviceWorker.register('./sw.js?v=123'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\\.js\\?v=\\d+/g,'app.js?v=123');
html=html.replace(/styles\\.css\\?v=\\d+/g,'styles.css?v=123');
html=html.replace(/cash-credit-v66\\.js\\?v=\\d+/g,'cash-credit-v66.js?v=123');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\\d+';/,"const CACHE = 'taimako-v123';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 123 bank details matcher and Android submit feedback fixed.');