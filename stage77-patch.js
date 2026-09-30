const fs=require('fs');

// Stage 77: remove TMCS LTD/Wellcome and apply Aclonica to full organization name.

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('fonts.googleapis.com/css2?family=Aclonica')){
  html=html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Aclonica&display=swap" rel="stylesheet">\n  <link rel="stylesheet" href="styles.css" />'
  );
}

// Remove small TMCS LTD and Wellcome labels if present.
html=html.replace(/<[^>]*class=["'][^"']*brand-mark[^"']*["'][^>]*>\s*TMCS LTD\s*<\/[^>]+>/i,'');
html=html.replace(/<[^>]*class=["'][^"']*eyebrow[^"']*["'][^>]*>\s*Wellcome\s*<\/[^>]+>/i,'');
html=html.replace(/<[^>]*class=["'][^"']*eyebrow[^"']*["'][^>]*>\s*Welcome\s*<\/[^>]+>/i,'');

// Mark the full organization name for Aclonica wherever it appears in the home hero.
html=html.replace(
  /<(h1|h2)([^>]*)>\s*TAIMAKO MULTIPURPOSE COOPERATIVE SOCIETY LTD\s*<\/\1>/i,
  '<$1$2 class="home-org-name">TAIMAKO MULTIPURPOSE COOPERATIVE SOCIETY LTD</$1>'
);

html=html.replace(/app\.js\?v=\d+/g,'app.js?v=77');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=77');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=77');
fs.writeFileSync('www/index.html',html);

let css=fs.readFileSync('www/styles.css','utf8');
if(!css.includes('tmcs-home-org-aclonica-stage77')){
  css += '\n/* tmcs-home-org-aclonica-stage77 */\n.home-org-name{font-family:"Aclonica",sans-serif!important;}\n';
}
fs.writeFileSync('www/styles.css',css);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=77'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v77';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 77 home organization name update applied.');