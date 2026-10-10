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
 'let memberSearchAdmin204=null;',
 'function memberSearchReturn204(){',
 ' if(!memberSearchAdmin204)return;',
 ' state.user=memberSearchAdmin204.user;state.balances=memberSearchAdmin204.balances;',
 ' memberSearchAdmin204=null;renderApp();',
 '}',
 'function memberSearchOpen204(){',
 ' const found=window.memberSearchFound204;',
 ' if(!found?.account||state.user?.role!==\'admin\'||found.account.is_active===false)return;',
 ' if(![\'regular\',\'flexible\'].includes(String(found.account.role).toLowerCase()))return;',
 ' memberSearchAdmin204={user:state.user,balances:state.balances};',
 ' state.user={...found.account,name:found.account.name||found.account.full_name,role:String(found.account.role).toLowerCase(),mustChangePassword:false};',
 ' state.balances=found.balances||{};',
 ' const dialog=document.getElementById(\'memberLookupFreshDialog\');if(dialog?.open)dialog.close();',
 ' renderDashboard();',
 ' const bar=document.createElement(\'section\');bar.id=\'memberSearchAssistanceBar204\';',
 ' bar.style.cssText=\'padding:12px;margin-bottom:12px;border:1px solid #b7a368;border-radius:8px\';',
 ' bar.textContent=\'MEMBER ACCOUNT — \'+state.user.name+\' (\'+state.user.username+\'). Actions unavailable pending administrator audit integration. \';',
 ' const back=document.createElement(\'button\');back.type=\'button\';back.textContent=\'RETURN TO ADMIN\';back.onclick=memberSearchReturn204;bar.append(back);',
 ' dashboardContent.prepend(bar);',
 '}',
 'document.addEventListener(\'click\',e=>{if(e.target?.id===\'memberSearchOpen204\'){e.preventDefault();e.stopImmediatePropagation();memberSearchOpen204();return;}if(memberSearchAdmin204&&e.target.closest?.(\'#dashboardContent\')&&!e.target.closest?.(\'#memberSearchAssistanceBar204\')){e.preventDefault();e.stopImmediatePropagation();}},true);',
 'document.addEventListener(\'submit\',e=>{if(memberSearchAdmin204){e.preventDefault();e.stopImmediatePropagation();}},true);',
 ];
app=app.replace(spot,addition.join('\n')+'\n'+spot);
fs.writeFileSync('www/app.js',app);
console.log('Member Search account view stage 204 applied (read-only until approved action attribution).');