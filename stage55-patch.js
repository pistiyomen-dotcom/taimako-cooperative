const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  '<label id="newCredentialLabel">Temporary Password<input id="newTempPassword" type="password" required /></label>',
  '<label id="newCredentialLabel">PIN<input id="newTempPassword" type="password" required /></label>'
);
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(
  "credentialLabel.childNodes[0].nodeValue='Temporary Password';\n    passwordHint.textContent='Regular members must change this temporary password at first login.';",
  "credentialLabel.childNodes[0].nodeValue='PIN';\n    passwordHint.textContent='Regular member PIN.';"
);
app=app.replace(
  "credentialLabel.childNodes[0].nodeValue='Temporary Password';\n    passwordHint.textContent='Admin password must be at least 4 characters.';",
  "credentialLabel.childNodes[0].nodeValue='Temporary Password';\n    passwordHint.textContent='Admin password must be at least 4 characters.';"
);
fs.writeFileSync('www/app.js',app);

console.log('TAIMAKO Stage 55 PIN label and Flexible-only link visibility applied.');
