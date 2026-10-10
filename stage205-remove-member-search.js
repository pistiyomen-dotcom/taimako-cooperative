const fs=require('fs');
let app=fs.readFileSync('www/app.js','utf8');
let html=fs.readFileSync('www/index.html','utf8');
let admin=fs.readFileSync('server/routes/admin.js','utf8');
// Remove all dedicated Member Search UI created by the prior stage.
// Remove legacy Member Search without recreating Stage 200.
const mark=app.indexOf('/* tmcsMemberSearchFreshV203 */');
if(mark>=0)app=app.slice(0,mark);
app=app.replace(/^.*\['MEMBER SEARCH',[^\n]*\n/gm,'');
app=app.replace(/^.*if \(title === 'MEMBER SEARCH'\) \{[^\n]*\n/gm,'');
app=app.replace(/^.*const memberSearch(?:Dialog|Form|Error|Result) = document\.getElementById\([^\n]*\n/gm,'');
app=app.replace(/^.*memberSearchForm\.addEventListener\('submit',[\s\S]*?\n\}\);\n/gm,'');
html=html.replace(/<dialog\b[^>]*id=["']memberLookupFreshDialog["'][\s\S]*?<\/dialog>/gi,'');
html=html.replace(/<dialog\b[^>]*id=["']memberSearchDialog["'][\s\S]*?<\/dialog>/gi,'');
const routeStart=admin.indexOf("router.get('/members/search'");
if(routeStart<0)throw Error('Member Search backend route missing');
const routeEnd=admin.indexOf("\nrouter.",routeStart+10);
if(routeEnd<0)throw Error('Cannot isolate Member Search backend route');
admin=admin.slice(0,routeStart)+admin.slice(routeEnd+1);
if(app.includes("['MEMBER SEARCH'")||app.includes("title === 'MEMBER SEARCH'")||app.includes('memberLookupFresh'))throw Error('Member Search UI remains');
if(admin.includes("router.get('/members/search'"))throw Error('Member Search backend remains');
fs.writeFileSync('www/app.js',app);
fs.writeFileSync('www/index.html',html.replace(/app\.js\?v=\d+/g,'app.js?v=205'));
fs.writeFileSync('server/routes/admin.js',admin);
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v205';");
fs.writeFileSync('www/sw.js',sw);
console.log('Stage 205: MEMBER SEARCH tile, dialogs, handlers and backend search route removed.');
