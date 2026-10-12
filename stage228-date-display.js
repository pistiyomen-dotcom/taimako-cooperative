const fs=require('fs');
const p='www/index.html';
let html=fs.readFileSync(p,'utf8');
if(!html.includes('</body>'))throw Error('Missing body end');
if(html.includes('tmcsDateDisplayV228'))throw Error('Date display already installed');
const snippet=String.raw`<script id="tmcsDateDisplayV228">
(function(){
 'use strict';
 const iso=/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?=\b|T)/g;
 const dated=/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g;
 const skip='script,style,textarea,pre,code,option,input,select,[contenteditable="true"]';
 function reformat(value){
   return value.replace(dated,match=>{
     const year=match.slice(0,4),month=match.slice(5,7),day=match.slice(8,10);
     return day+'/'+month+'/'+year+' '+match.slice(11,16);
   }).replace(iso,(_,y,m,d)=>d+'/'+m+'/'+y);
 }
 function visit(root){
   if(!root || root.nodeType!==1 || root.closest(skip))return;
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   const nodes=[];
   while(walker.nextNode())nodes.push(walker.currentNode);
   for(const node of nodes){
     if(node.parentElement?.closest(skip))continue;
     const original=node.nodeValue;
     if(original && /20\d{2}-\d\d-\d\d/.test(original)){
       const updated=reformat(original);
       if(updated!==original)node.nodeValue=updated;
     }
   }
 }
 let queued=false;
 function schedule(){
   if(queued)return;
   queued=true;
   queueMicrotask(()=>{queued=false;visit(document.body);});
 }
 function start(){
   visit(document.body);
   new MutationObserver(schedule).observe(document.body,{childList:true,characterData:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
</script>`;
html=html.replace('</body>',snippet+'</body>');
fs.writeFileSync(p,html);
console.log('Stage 228: ISO dates in visible text display as dd/mm/yyyy; native inputs and stored values unchanged.');
