const fs=require('fs');
let html=fs.readFileSync('www/index.html','utf8');
const buttonId='markExistingRegistrationV246';
if(html.includes('id="'+buttonId+'"')){
 html=html.replace(/<button([^>]*id="markExistingRegistrationV246"[^>]*)>/,function(full,attrs){
  attrs=attrs.replace(/\s+onclick="[^"]*"/g,'');
  return '<button'+attrs+' onclick="window.markExistingRegistrationCompletedV247(event)">';
 });
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=267');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=267');
fs.writeFileSync('www/index.html',html);
let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes('function markExistingRegistrationCompletedV247')){
 app += String.raw`
window.markExistingRegistrationCompletedV247=async function(event){
 if(event){event.preventDefault();event.stopPropagation();}
 const button=document.getElementById('markExistingRegistrationV246');
 const input=document.getElementById('adminCheckUsernameV239');
 const result=document.getElementById('markExistingRegistrationResultV246');
 const username=String(input&&input.value||'').trim().toUpperCase();
 const show=function(message){if(result){result.textContent=message;result.style.display='block';result.style.color='#145c36';}};
 if(!username){show('Enter the member username first.');if(input)input.focus();return false;}
 if(button){button.disabled=true;button.textContent='SAVING…';}
 show('Saving registration status…');
 try{
  const saved=await api('/api/admin/existing-registration-v245',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username})});
  if(!saved||saved.saved!==true)throw new Error(saved&&saved.message?saved.message:'The server did not confirm that registration was saved.');
  show('PAID saved successfully for '+username+'. Reopen the member account to refresh the registration tile.');
 }catch(error){
  if(result){result.textContent='NOT SAVED: '+(error&&error.message?error.message:'Request failed. Please try again.');result.style.display='block';result.style.color='#b42318';}
 }finally{
  if(button){button.disabled=false;button.textContent='MARK REGISTRATION COMPLETED';}
 }
 return false;
};
`;
}
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=267'");
fs.writeFileSync('www/app.js',app);
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v267';").replace(/app\.js\?v=\d+/g,'app.js?v=267').replace(/styles\.css\?v=\d+/g,'styles.css?v=267');
fs.writeFileSync('www/sw.js',sw);
console.log('Stage 247: bind the registration completion button directly and report server response.');
