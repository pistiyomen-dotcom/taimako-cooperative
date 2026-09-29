const fs = require('fs');
const path = 'www/app.js';
let s = fs.readFileSync(path, 'utf8');
const replacements = [
  ['APPLY / CONTACT US', 'APPLY'],
  ['<h4>Agriculture</h4><p>Agriculture is one of the cooperative service areas. No detailed agriculture product rules have yet been supplied for this build, so no rates, duration or conditions are being invented.</p>', '<p><em>Coming soon.</em></p>'],
  ['REGISTER / CONTACT', 'REGISTER'],
  ['<h4>Membership</h4><p>Public self-registration is not enabled. New Regular member accounts are created by an Administrator. A Regular member receives a 5-digit username and a temporary password, then must change that password at first login.</p><p>', '<p>']
];
for (const [from, to] of replacements) {
  if (!s.includes(from)) { console.error('Stage 14 patch target not found:', from); process.exit(1); }
  s = s.replaceAll(from, to);
}
fs.writeFileSync(path, s);
console.log('TAIMAKO Stage 14 public-menu corrections applied.');
