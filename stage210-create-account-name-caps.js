const fs=require('fs');
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
const anchor="document.getElementById('newUsername').addEventListener('input',(e)=>{";
if(!app.includes(anchor))throw Error('CREATE ACCOUNT input section missing');
if(!app.includes("tmcsCreateAccountNameUpperV210")){
  const patch=`/* tmcsCreateAccountNameUpperV210 */
const createAccountFullNameV210=document.getElementById('newFullName');
if(createAccountFullNameV210){
  createAccountFullNameV210.style.textTransform='uppercase';
  createAccountFullNameV210.setAttribute('autocapitalize','characters');
  createAccountFullNameV210.addEventListener('input',()=>{
    const current=createAccountFullNameV210.value;
    const upper=current.toUpperCase();
    if(current!==upper){
      const start=createAccountFullNameV210.selectionStart;
      const end=createAccountFullNameV210.selectionEnd;
      createAccountFullNameV210.value=upper;
      try{createAccountFullNameV210.setSelectionRange(start,end);}catch(_){}
    }
  });
}

`;
  app=app.replace(anchor,patch+anchor);
}
fs.writeFileSync(appPath,app);
console.log('CREATE ACCOUNT Full Name now auto-capitalizes permanently while typing.');
