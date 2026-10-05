const fs=require('fs');
const app=fs.readFileSync('www/app.js','utf8');
const i=app.indexOf('function dashboardCards(role)');
console.log('SAV163 DASH',JSON.stringify(app.slice(i,i+7000)));
console.log('TAIMAKO Stage 163 focused member dashboard inspection complete.');
