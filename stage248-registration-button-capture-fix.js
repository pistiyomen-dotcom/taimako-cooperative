const fs=require('fs');
let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes('registrationButtonCaptureFixV248')){
 app += String.raw`
/* registrationButtonCaptureFixV248: capture clicks before modal/form handlers */
document.addEventListener('click',function registrationButtonCaptureFixV248(event){
 const target=event.target;
 const button=target&&target.closest?target.closest('#markExistingRegistrationV246'):null;
 if(!button)return;
 event.preventDefault();
 event.stopPropagation();
 if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
 const input=document.getElementById('adminCheckUsernameV239');
 const result=document.getElementById('markExistingRegistrationResultV246');
 const username=String(input&&input.value||'').trim().toUpperCase();
 const show=function(message,isError){
  if(result){result.textContent=message;result.style.display='block';result.style.visibility='visible';result.style.color=isError?'#b42318':'#145c36';}
 };
 if(!username){show('Enter the member username first.',true);if(input)input.focus();return;}
 if(button.dataset.registrationSaving==='yes')return;
 button.dataset.registrationSaving='yes';
 button.disabled=true;
 button.textContent='SAVING…';
 show('Sending request to save PAID status…',false);
 Promise.resolve().then(function(){
  if(typeof api!=='function')throw new Error('The app API helper is unavailable. Please refresh and try again.');
  return api('/api/admin/existing-registration-v245',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username})});
 }).then(function(saved){
  if(!saved||saved.saved!==true)throw new Error(saved&&saved.message?saved.message:'Server did not confirm the save.');
  show('PAID saved for '+username+'. Reopen the member account to refresh the tile.',false);
 }).catch(function(error){
  show('NOT SAVED: '+(error&&error.message?error.message:'Request failed.'),true);
 }).finally(function(){
  button.disabled=false;
  button.textContent='MARK REGISTRATION COMPLETED';
  delete button.dataset.registrationSaving;
 });
},true);
`;
}
let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=268').replace(/styles\.css\?v=\d+/g,'styles.css?v=268');
fs.writeFileSync('www/index.html',html);
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=268'");
fs.writeFileSync('www/app.js',app);
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v268';").replace(/app\.js\?v=\d+/g,'app.js?v=268').replace(/styles\.css\?v=\d+/g,'styles.css?v=268');
fs.writeFileSync('www/sw.js',sw);
console.log('Stage 248: capture-phase registration button handler and visible save/error feedback installed.');
