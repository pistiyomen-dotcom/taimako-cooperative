const fs=require('fs');

// Stage 76: Home-page TMCS LTD and Welcome font/color update.

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('fonts.googleapis.com/css2?family=Aclonica')){
  html=html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Aclonica&display=swap" rel="stylesheet">\n  <link rel="stylesheet" href="styles.css" />'
  );
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=76');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=76');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=76');
fs.writeFileSync('www/index.html',html);

let css=fs.readFileSync('www/styles.css','utf8');
css=css.replace(
  '.brand-mark { color: #f4d36b; font-weight: 800; letter-spacing: .08em; }',
  '.brand-mark { color: #ffffff; font-family: "Aclonica", sans-serif; font-weight: 400; letter-spacing: .04em; }'
);
css=css.replace(
  '.eyebrow { color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }',
  '.eyebrow { color: var(--green-dark); font-family: "Aclonica", sans-serif; font-weight: 400; text-transform: none; letter-spacing: .04em; }'
);
fs.writeFileSync('www/styles.css',css);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=76'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v76';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 76 home-page Aclonica and non-gold heading colors applied.');