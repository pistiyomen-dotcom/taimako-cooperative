const fs=require('fs');
const s=fs.readFileSync('server/db/schema.sql','utf8');
const i=s.indexOf('CREATE TABLE IF NOT EXISTS payment_requests');
console.log('PAYMENT_SCHEMA '+JSON.stringify(i<0?'NOT_FOUND':s.slice(i,i+2600)));
