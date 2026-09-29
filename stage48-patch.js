const fs=require('fs');
const p='www/app.js';
let s=fs.readFileSync(p,'utf8');

if(!s.includes('<h4>Group Loan</h4><p>A group loan requires at least three people.')){
  const marker='<h4>Non-member Loan</h4><p>Non-members may apply with a guarantor who is a TMCS LTD member, or with acceptable collateral. The stated term is 30 days at 8% interest.</p><p><button class="primary inline-action" data-public-action="contact">APPLY</button></p>';
  const replacement='<h4>Non-member Loan</h4><p>Non-members may apply with a guarantor who is a TMCS LTD member, or with acceptable collateral. The stated term is 30 days at 8% interest.</p><h4>Group Loan</h4><p>A group loan requires at least three people. The application form is non-refundable. The group provides a 10% deposit of the loan amount as collateral and a guarantor preferably from TMCS LTD. Group members are jointly responsible for the loan.</p><p><button class="primary inline-action" data-public-action="contact">APPLY</button></p>';
  if(!s.includes(marker)){console.error('Stage 48 LOAN public content marker missing');process.exit(1);}
  s=s.replace(marker,replacement);
}

fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 48 Group Loan public information applied.');