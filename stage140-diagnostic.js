const fs=require('fs');
const s=fs.readFileSync('www/app.js','utf8');
const term='async function openTransactionHistory';
const i=s.indexOf(term);
console.log('TX140 '+(i<0?'NOT_FOUND':s.slice(i,Math.min(s.length,i+5000)).replace(/\s+/g,' ')));
