// Stage 235: Admin CREATE ACCOUNT referral field (UI-only until secure registration binding).
const fs=require('fs');
const file='www/index.html';
let html=fs.readFileSync(file,'utf8');
if(!html.includes('id="newUsername"'))throw Error('CREATE ACCOUNT username field not found');
if(!html.includes('id="newReferredByV235"')){
  const field='<label for="newReferredByV235">REFERRED BY (Regular member username, optional)</label>\n<input id="newReferredByV235" name="referredBy" type="text" maxlength="5" inputmode="numeric" pattern="[0-9]{1,5}" autocomplete="off" placeholder="Enter referring member username" />';
  // Position next to account username, without changing existing form elements.
  const input=/<input\b(?=[^>]*\bid="newUsername")[^>]*>/;
  if(!input.test(html))throw Error('CREATE ACCOUNT username input markup not found');
  html=html.replace(input,m=>m+'\n'+field);
  fs.writeFileSync(file,html);
}
console.log('Admin CREATE ACCOUNT referral input prepared. Do not deploy until server validation and atomic referral persistence are wired.');
