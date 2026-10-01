const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  '<button type="button" class="primary" id="saveAdminSettings">SAVE SETTINGS</button>',
  '<button type="button" class="primary" id="saveAdminSettings" onclick="return window.saveAdminSettingsV103(event)">SAVE SETTINGS</button>'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=103');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=103');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=103');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

// Remove the previous event-listener save block so only one save path remains.
const oldStart=app.indexOf("document.getElementById('saveAdminSettings')?.addEventListener('click'");
const oldEnd=app.indexOf("\nasync function api(path, options = {})",oldStart);
if(oldStart>=0 && oldEnd>oldStart){
  app=app.slice(0,oldStart)+app.slice(oldEnd);
}

const directFn=`
window.saveAdminSettingsV103=async function(event){
  if(event){event.preventDefault();event.stopImmediatePropagation();}
  const btn=document.getElementById('saveAdminSettings');
  const error=document.getElementById('adminSettingsError');
  const success=document.getElementById('adminSettingsSuccess');
  const minEl=document.getElementById('minimumShareSetting');
  const regEl=document.getElementById('registrationFeeSetting');
  if(!btn||!error||!success||!minEl||!regEl) return false;

  error.textContent='';
  success.textContent='SAVING SETTINGS…';
  btn.disabled=true;

  try{
    const minimumSharePerMonth=Number(minEl.value);
    const totalRegistrationFee=Number(regEl.value);

    if(!Number.isFinite(minimumSharePerMonth)||minimumSharePerMonth<=0)
      throw new Error('Enter a valid minimum share amount.');
    if(!Number.isFinite(totalRegistrationFee)||totalRegistrationFee<=0)
      throw new Error('Enter a valid total registration fee.');

    const data=await api('/api/admin/settings',{
      method:'PUT',
      cache:'no-store',
      body:JSON.stringify({minimumSharePerMonth,totalRegistrationFee})
    });

    if(Number(data.minimumSharePerMonth)!==minimumSharePerMonth ||
       Number(data.totalRegistrationFee)!==totalRegistrationFee){
      throw new Error('Saved values could not be verified from storage.');
    }

    const confirm=await api('/api/admin/settings?verify='+Date.now(),{cache:'no-store'});
    minEl.value=Number(confirm.minimumSharePerMonth);
    regEl.value=Number(confirm.totalRegistrationFee);

    success.textContent='SETTINGS SAVED SUCCESSFULLY';
  }catch(err){
    success.textContent='';
    error.textContent='SETTINGS NOT SAVED: '+(err?.message||String(err));
  }finally{
    btn.disabled=false;
  }
  return false;
};

`;

const marker="async function openAdminSettingsV101(){";
if(!app.includes('window.saveAdminSettingsV103')){
  if(!app.includes(marker)){console.error('Stage 103 settings opener marker missing');process.exit(1);}
  app=app.replace(marker,directFn+marker);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=103'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v103';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 103 direct settings save button applied.');