const fs=require('fs');
const path='www/index.html';
let html=fs.readFileSync(path,'utf8');
const old='<h2>Wellcome to TMCS LTD a cooperative movement for achieving financial independence.</h2>';
if(!html.includes(old))throw new Error('Public welcome message not found: refusing unrelated changes');
const updated='<h2 class="tmcs-welcome-title-v206"><span class="tmcs-welcome-ornate-v206">WELCOME</span><span class="tmcs-welcome-to-v206">to</span><span class="tmcs-welcome-name-v206">TMCS LTD</span><span class="tmcs-welcome-caption-v206">a cooperative movement</span><span class="tmcs-welcome-caption-v206">for achieving</span><span class="tmcs-welcome-caption-v206">financial independence</span></h2>';
html=html.replace(old,updated);
const css=`<style>
@import url('https://fonts.googleapis.com/css2?family=Aclonica&display=swap');
@import url('https://fonts.cdnfonts.com/css/kingthings-petrock');
.hero .tmcs-welcome-title-v206{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;width:100%;max-width:none;margin:0 auto;color:#191919;gap:0;line-height:1.03;}
.tmcs-welcome-title-v206 span{display:block;text-align:center;width:100%;}
.tmcs-welcome-title-v206 .tmcs-welcome-ornate-v206{font-family:'Kingthings Petrock',Georgia,serif;font-weight:400;font-size:clamp(2rem,7.5vw,3.7rem);letter-spacing:.02em;line-height:1.16;}
.tmcs-welcome-title-v206 .tmcs-welcome-to-v206{font-family:'Kingthings Petrock',Georgia,serif;font-size:clamp(2.1rem,8vw,3.7rem);font-weight:400;line-height:.95;}
.tmcs-welcome-title-v206 .tmcs-welcome-name-v206{font-family:'Aclonica',sans-serif;font-size:clamp(2.2rem,8.6vw,4.3rem);font-weight:400;letter-spacing:-.025em;white-space:nowrap;line-height:1.18;margin-bottom:.12em;}
.tmcs-welcome-title-v206 .tmcs-welcome-caption-v206{font-family:'Kingthings Petrock','Trebuchet MS',serif;font-size:clamp(1.15rem,4.9vw,2.1rem);font-weight:400;line-height:1.22;letter-spacing:-.015em;}
@media(max-width:390px){.tmcs-welcome-title-v206 .tmcs-welcome-name-v206{font-size:clamp(2rem,8vw,3.2rem)}}
</style>
`;
if(!html.includes('</head>'))throw Error('Head tag missing');
html=html.replace('</head>',css+'</head>');
fs.writeFileSync(path,html);
console.log('Public welcome message matches user supplied typographic arrangement.');
