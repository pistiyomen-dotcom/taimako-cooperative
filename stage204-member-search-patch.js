const fs=require('fs');
let app=fs.readFileSync('www/app.js','utf8');
const key="memberLookupFreshGrid(a)+'<h4 style=\"margin:16px 0 8px\">ACCOUNT BALANCES</h4>'+memberLookupFreshGrid(bal)";
if(!app.includes(key))throw Error('Member Search report marker not found');
app=app.replace(key,"'<button type=\"button\" id=\"memberSearchOpen204\">OPEN MEMBER ACCOUNT</button>'");
const assign='const a=data?.account||{}; const bal=data?.balances||{};';
if(!app.includes(assign))throw Error('Member Search data marker not found');
app=app.replace(assign,assign+' window.memberSearchFound204={account:a,balances:bal};');
const spot='function memberLookupFreshLabel(';
if(!app.includes(spot))throw Error('Member Search helper missing');
const addition=[
 'function memberSearchOpen204(){',
 ' const found=window.memberSearchFound204;',
 ' if(!found||!found.account||state.user?.role!==\'admin\')return;',
 ' const a=found.account,b=found.balances||{};',
 ' const root=document.getElementById(\'memberLookupFreshResult\');',
 ' if(!root)return;',
 ' const types=String(a.role).toLowerCase()===\'flexible\'?[\'FLEXIBLE\']:[\'REGULAR\',\'TARGET\',\'CONSTANT\',\'WELFARE\'];',
 ' root.innerHTML=\'<h3>MEMBER ACCOUNT</h3><p>\'+escapeHTML(a.name||a.full_name||\'\')+\' — \'+escapeHTML(a.username)+\'</p><div class="mini-grid">\'+types.map(t=>\'<div><b>\'+t+\'</b><span>\'+escapeHTML(String(b[t.toLowerCase()]||0))+\'</span></div>\').join(\'\')+\'</div><p>Member activities are awaiting secure administrator attribution.</p><button type="button" id="memberSearchBack204">RETURN TO SEARCH</button>\';',
 '}',
 'document.addEventListener(\'click\',e=>{if(e.target?.id===\'memberSearchOpen204\'){e.preventDefault();memberSearchOpen204();}if(e.target?.id===\'memberSearchBack204\'){e.preventDefault();openMemberLookupFresh();}},true);',
 ];
app=app.replace(spot,addition.join('\n')+'\n'+spot);
fs.writeFileSync('www/app.js',app);
console.log('Member Search account view stage 204 applied (read-only until approved action attribution).');