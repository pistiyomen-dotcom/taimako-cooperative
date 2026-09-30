const fs=require('fs');

// Stage 80: enforce mandatory first-login password/PIN change for every newly created account.

let admin=fs.readFileSync('server/routes/admin.js','utf8');
admin=admin.replace(
  "      [username, fullName, role, hash, role === 'regular']",
  "      [username, fullName, role, hash, true]"
);
fs.writeFileSync('server/routes/admin.js',admin);

let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes('function configureMandatoryCredentialDialog')){
  app=app.replace(
    "loginBtn.addEventListener('click', () => { loginError.textContent = ''; loginForm.reset(); loginDialog.showModal(); });",
    `function configureMandatoryCredentialDialog(){
  const role=String(state.user?.role||'').toLowerCase();
  const isPin=role==='regular'||role==='flexible';
  const heading=passwordDialog.querySelector('h3');
  const helper=passwordDialog.querySelector('.helper');
  const labels=passwordDialog.querySelectorAll('label');
  const submit=passwordForm.querySelector('button[type="submit"],button.primary');
  if(heading) heading.textContent=isPin?'Change Temporary PIN':'Change Temporary Password';
  if(helper) helper.textContent=isPin?'You must replace the temporary PIN before using this account.':'You must replace the temporary password before using this account.';
  if(labels[0]) labels[0].childNodes[0].nodeValue=isPin?'New PIN ':'New Password ';
  if(labels[1]) labels[1].childNodes[0].nodeValue=isPin?'Confirm New PIN ':'Confirm New Password ';
  if(submit) submit.textContent=isPin?'SAVE NEW PIN':'SAVE NEW PASSWORD';
}

function openMandatoryCredentialDialog(){
  if(!state.user?.mustChangePassword) return;
  configureMandatoryCredentialDialog();
  passwordForm.reset();
  passwordError.textContent='';
  if(!passwordDialog.open) passwordDialog.showModal();
}

loginBtn.addEventListener('click', () => { loginError.textContent = ''; loginForm.reset(); loginDialog.showModal(); });`
  );
}

app=app.replace(
  "    await refreshAccount(); renderApp();\n    if (state.user.role === 'regular' && state.user.mustChangePassword) { passwordForm.reset(); passwordError.textContent = ''; passwordDialog.showModal(); }",
  "    await refreshAccount(); renderApp();\n    if (state.user.mustChangePassword) openMandatoryCredentialDialog();"
);

app=app.replace(
  "  if (loggedIn) renderDashboard();",
  "  if (loggedIn && !state.user.mustChangePassword) renderDashboard();\n  if (loggedIn && state.user.mustChangePassword) { dashboardContent.innerHTML=''; queueMicrotask(openMandatoryCredentialDialog); }"
);

app=app.replace(
  "  if (next.length < 4) return passwordError.textContent = 'Use at least 4 characters.';",
  "  const role=String(state.user?.role||'').toLowerCase();\n  const isPin=role==='regular'||role==='flexible';\n  if (isPin && !/^\\d{4}$/.test(next)) return passwordError.textContent = 'PIN must be exactly 4 digits.';\n  if (!isPin && next.length < 4) return passwordError.textContent = 'Use at least 4 characters.';"
);
app=app.replace(
  "    state.user = result.user; saveSession(); passwordDialog.close(); renderApp(); alert('Password changed successfully.');",
  "    state.user = result.user; saveSession(); passwordDialog.close(); renderApp(); alert((role==='regular'||role==='flexible')?'PIN changed successfully.':'Password changed successfully.');"
);

if(!app.includes("passwordDialog.addEventListener('cancel'")){
  app += `\npasswordDialog.addEventListener('cancel',(e)=>{ if(state.user?.mustChangePassword) e.preventDefault(); });\n`;
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=80'");
fs.writeFileSync('www/app.js',app);

let auth=fs.readFileSync('server/routes/auth.js','utf8');
auth=auth.replace(
  "  const nextPassword = String(req.body?.newPassword || '');\n  if (nextPassword.length < 4) return res.status(400).json({ error: 'Use at least 4 characters.' });",
  "  const nextPassword = String(req.body?.newPassword || '');\n  const accountRole=(await pool.query('SELECT role FROM accounts WHERE id=$1',[req.auth.sub])).rows[0]?.role;\n  if (['regular','flexible'].includes(accountRole) && !/^\\d{4}$/.test(nextPassword)) return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });\n  if (!['regular','flexible'].includes(accountRole) && nextPassword.length < 4) return res.status(400).json({ error: 'Use at least 4 characters.' });"
);
fs.writeFileSync('server/routes/auth.js',auth);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=80');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=80');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=80');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v80';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 80 mandatory first-login credential change applied.');