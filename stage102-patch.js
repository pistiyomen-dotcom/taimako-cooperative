const fs=require('fs');

let admin=fs.readFileSync('server/routes/admin.js','utf8');

const oldResponse="    await client.query('COMMIT');\n    res.json({minimumSharePerMonth,totalRegistrationFee});";
const newResponse=`    await client.query('COMMIT');
    const verify=await pool.query("SELECT setting_key,numeric_value FROM cooperative_settings WHERE setting_key IN ('minimum_share_per_month','total_registration_fee')");
    const map=Object.fromEntries(verify.rows.map(r=>[r.setting_key,money(r.numeric_value)]));
    const storedMinimum=map.minimum_share_per_month ?? 0;
    const storedRegistration=map.total_registration_fee ?? 0;
    console.log('SETTINGS_SAVED_CONFIRMED',storedMinimum,storedRegistration);
    res.json({minimumSharePerMonth:storedMinimum,totalRegistrationFee:storedRegistration});`;
if(!admin.includes(oldResponse)){console.error('Stage 102 settings response marker missing');process.exit(1);}
admin=admin.replace(oldResponse,newResponse);

admin=admin.replace(
  "  res.json({\n    minimumSharePerMonth: map.minimum_share_per_month ?? 5000,\n    totalRegistrationFee: map.total_registration_fee ?? 0\n  });",
  "  const minimumSharePerMonth=map.minimum_share_per_month ?? 5000;\n  const totalRegistrationFee=map.total_registration_fee ?? 0;\n  console.log('SETTINGS_READ_CONFIRMED',minimumSharePerMonth,totalRegistrationFee);\n  res.json({minimumSharePerMonth,totalRegistrationFee});"
);

fs.writeFileSync('server/routes/admin.js',admin);

let app=fs.readFileSync('www/app.js','utf8');

const oldSave=`    const data=await api('/api/admin/settings',{
      method:'PUT',
      body:JSON.stringify({minimumSharePerMonth,totalRegistrationFee})
    });
    success.textContent='SETTINGS SAVED SUCCESSFULLY';`;

const newSave=`    const data=await api('/api/admin/settings',{
      method:'PUT',
      cache:'no-store',
      body:JSON.stringify({minimumSharePerMonth,totalRegistrationFee})
    });
    if(Number(data.minimumSharePerMonth)!==minimumSharePerMonth || Number(data.totalRegistrationFee)!==totalRegistrationFee){
      throw new Error('Saved values could not be verified from storage.');
    }
    document.getElementById('minimumShareSetting').value=Number(data.minimumSharePerMonth);
    document.getElementById('registrationFeeSetting').value=Number(data.totalRegistrationFee);
    success.textContent='SETTINGS SAVED SUCCESSFULLY';

    const confirm=await api('/api/admin/settings?verify='+Date.now(),{cache:'no-store'});
    document.getElementById('minimumShareSetting').value=Number(confirm.minimumSharePerMonth);
    document.getElementById('registrationFeeSetting').value=Number(confirm.totalRegistrationFee); `;

if(!app.includes(oldSave)){console.error('Stage 102 frontend settings marker missing');process.exit(1);}
app=app.replace(oldSave,newSave);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=102'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=102');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=102');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=102');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v102';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 102 settings save now verifies database persistence.');