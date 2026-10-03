const fs=require('fs');
function around(path,terms){
  const s=fs.readFileSync(path,'utf8');
  for(const term of terms){
    const i=s.indexOf(term);
    console.log('CONTACT142 '+path+' '+term+' '+i);
    if(i>=0) console.log(JSON.stringify(s.slice(Math.max(0,i-500),Math.min(s.length,i+2600))));
  }
}
around('www/index.html',['Phone/Email','Contact Us','CONTACT US','contact']);
around('www/app.js',['Phone/Email','contactForm','contact']);
console.log('TAIMAKO Stage 142 contact form inspection complete.');
