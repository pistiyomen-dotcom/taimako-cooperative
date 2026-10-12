const fs=require('fs');
const path='www/index.html';
let html=fs.readFileSync(path,'utf8');
const old='<h2>Wellcome to TMCS LTD a cooperative movement for achieving financial independence.</h2>';
if(!html.includes(old))throw new Error('Public welcome message not found: refusing unrelated changes');
const updated='<h2 class="tmcs-welcome-title-v206"><span class="tmcs-welcome-ornate-v206">Welcome</span><span class="tmcs-welcome-to-v206">to</span><span class="tmcs-welcome-name-v206">TMCS LTD</span><span class="tmcs-welcome-caption-v206">a cooperative movement</span><span class="tmcs-welcome-caption-v206">for achieving</span><span class="tmcs-welcome-caption-v206">financial independence</span></h2>';
html=html.replace(old,updated);
const css=`<style>
@import url('https://fonts.googleapis.com/css2?family=Aclonica&display=swap');
@import url('https://fonts.cdnfonts.com/css/kingthings-petrock');
.hero .tmcs-welcome-title-v206{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;width:100%;max-width:none;margin:0 auto;color:#191919;gap:0;line-height:1.03;}
.tmcs-welcome-title-v206 span{display:block;text-align:center;width:100%;}
.tmcs-welcome-title-v206 .tmcs-welcome-ornate-v206{font-family:'Kingthings Petrock',Georgia,serif;font-weight:400;font-size:clamp(3.1rem,11vw,5.4rem);letter-spacing:.02em;line-height:1.16;}
.tmcs-welcome-title-v206 .tmcs-welcome-to-v206{font-family:'Kingthings Petrock',Georgia,serif;font-size:clamp(3.1rem,11vw,5.4rem);font-weight:400;line-height:.95;}
.tmcs-welcome-title-v206 .tmcs-welcome-name-v206{font-family:'Aclonica',sans-serif;font-size:clamp(2.8rem,10.5vw,5.6rem);font-weight:400;letter-spacing:-.025em;white-space:nowrap;line-height:1.18;margin-bottom:.12em;}
.tmcs-welcome-title-v206 .tmcs-welcome-caption-v206{font-family:'Kingthings Petrock','Trebuchet MS',serif;font-size:clamp(1.9rem,7.3vw,3.35rem);font-weight:400;line-height:1.22;letter-spacing:-.015em;}
@media(max-width:390px){.tmcs-welcome-title-v206 .tmcs-welcome-name-v206{font-size:clamp(2.4rem,9vw,4rem)}}

/* Welcome-only visual refresh: leaves application controls and member services unchanged. */
.hero .tmcs-welcome-title-v206{
  box-sizing:border-box;
  max-width:980px;
  margin:clamp(18px,4vw,46px) auto;
  padding:clamp(28px,6vw,72px) clamp(18px,5vw,56px);
  border-radius:clamp(18px,3vw,32px);
  background:linear-gradient(145deg,#ffffff 4%,#f7fbf5 62%,#fff9e9 100%);
  border:1px solid rgba(177,136,47,.24);
  box-shadow:0 18px 46px rgba(27,77,49,.10);
}
.hero .tmcs-welcome-title-v206 .tmcs-welcome-ornate-v206{
  color:#146238;
  font-size:clamp(2.8rem,8vw,5.1rem);
  line-height:1.1;
}
.hero .tmcs-welcome-title-v206 .tmcs-welcome-to-v206{
  color:#ae8128;
  font-size:clamp(1.8rem,5vw,3.4rem);
  line-height:1.15;
}
.hero .tmcs-welcome-title-v206 .tmcs-welcome-name-v206{
  color:#11522f;
  font-size:clamp(2rem,7vw,4.4rem);
  letter-spacing:-.025em;
  white-space:normal;
  overflow-wrap:break-word;
  line-height:1.2;
}
.hero .tmcs-welcome-title-v206 .tmcs-welcome-caption-v206{
  color:#47564b;
  font-size:clamp(1.35rem,4.7vw,2.5rem);
  line-height:1.28;
}
.hero .tmcs-welcome-title-v206 .tmcs-welcome-caption-v206:last-child{
  color:#996e17;
}
@media(max-width:480px){
  .hero .tmcs-welcome-title-v206{margin:12px auto;padding:27px 14px;border-radius:19px}
  .hero .tmcs-welcome-title-v206 .tmcs-welcome-name-v206{font-size:clamp(1.65rem,8.3vw,2.5rem)}
}
/* Larger welcome lettering, fitted closely to the available panel area. */
.hero .tmcs-welcome-title-v206{
  max-width:1100px;
  padding:clamp(14px,2.5vw,26px) clamp(10px,2.2vw,24px);
  gap:clamp(2px,.35vw,5px);
}
.hero .tmcs-welcome-title-v206 .tmcs-welcome-ornate-v206{
  font-size:clamp(3.7rem,10vw,7.4rem);
  line-height:1.02;
}
.hero .tmcs-welcome-title-v206 .tmcs-welcome-to-v206{
  font-size:clamp(2.9rem,7vw,5.2rem);
  line-height:1.01;
}
.hero .tmcs-welcome-title-v206 .tmcs-welcome-name-v206{
  font-size:clamp(2.6rem,8.8vw,6.5rem);
  line-height:1.07;
}
.hero .tmcs-welcome-title-v206 .tmcs-welcome-caption-v206{
  font-size:clamp(2rem,5.9vw,4.15rem);
  line-height:1.11;
}
@media(max-width:480px){
 .hero .tmcs-welcome-title-v206{padding:17px 9px}
 .hero .tmcs-welcome-title-v206 .tmcs-welcome-ornate-v206{font-size:clamp(3.2rem,14vw,5rem)}
 .hero .tmcs-welcome-title-v206 .tmcs-welcome-to-v206{font-size:clamp(2.6rem,11vw,4rem)}
 .hero .tmcs-welcome-title-v206 .tmcs-welcome-name-v206{font-size:clamp(2.1rem,10vw,3.5rem)}
 .hero .tmcs-welcome-title-v206 .tmcs-welcome-caption-v206{font-size:clamp(1.75rem,7.8vw,2.7rem)}
}

</style>
`;
if(!html.includes('</head>'))throw Error('Head tag missing');
html=html.replace('</head>',css+'</head>');
fs.writeFileSync(path,html);
console.log('Public welcome message matches user supplied typographic arrangement.');
