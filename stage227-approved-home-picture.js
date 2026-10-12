const fs=require('fs');
const path=require('path');
const original='taimako_cooperative_group_portrait.png';
const destination='www/images/taimako_cooperative_group_portrait.png';
if(!fs.existsSync(original))throw Error('Approved uploaded homepage image missing; refusing substitution');
if(!fs.existsSync('www/index.html'))throw Error('Home page missing; refusing unrelated edits');
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.copyFileSync(original,destination);
const source=fs.readFileSync(original);
const copied=fs.readFileSync(destination);
if(!source.equals(copied))throw Error('Image copy is not identical to approved upload');
let html=fs.readFileSync('www/index.html','utf8');
if(html.includes('tmcsApprovedPictureV227'))throw Error('Homepage picture already inserted');
if(!html.includes('</head>')||!html.includes('</body>'))throw Error('HTML anchors missing');
const css=`<style id="tmcsApprovedPictureStyleV227">
#tmcsApprovedPictureV227{display:block;box-sizing:border-box;width:min(100%,1100px);margin:14px auto 24px;padding:0 8px}
#tmcsApprovedPictureV227 .tmcs-approved-picture-frame{overflow:hidden;border:3px solid #d5aa35;border-radius:20px;background:#fff;box-shadow:0 8px 18px rgba(13,63,33,.12)}
#tmcsApprovedPictureV227 img{display:block;width:100%;height:auto;object-fit:contain}
@media(max-width:600px){#tmcsApprovedPictureV227{margin:12px auto 18px;padding:0 6px}#tmcsApprovedPictureV227 .tmcs-approved-picture-frame{border-width:2px;border-radius:16px}}
</style>`;
const script=`<script id="tmcsApprovedPictureLoaderV227">
(function(){
 function install(){
  if(document.getElementById('tmcsApprovedPictureV227'))return;
  const welcome=document.querySelector('.tmcs-welcome-title-v206');
  if(!welcome)return;
  const picture=document.createElement('section');
  picture.id='tmcsApprovedPictureV227';
  picture.setAttribute('aria-label','TAIMAKO Cooperative approved home picture');
  picture.innerHTML='<div class="tmcs-approved-picture-frame"><img src="./images/taimako_cooperative_group_portrait.png" alt="TAIMAKO cooperative approved group picture" decoding="async" loading="eager"></div>';
  welcome.insertAdjacentElement('afterend',picture);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})();
</script>`;
html=html.replace('</head>',css+'</head>').replace('</body>',script+'</body>');
html=html.replace(/app\\.js\\?v=\\d+/g,'app.js?v=228');
html=html.replace(/styles\\.css\\?v=\\d+/g,'styles.css?v=228');
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\\d+';/,"const CACHE = 'taimako-v228';");
fs.writeFileSync('www/sw.js',sw);
fs.writeFileSync('www/index.html',html);
console.log('Stage 227: exact approved image placed immediately after welcome text, with cache refreshed and all other sections preserved.');
