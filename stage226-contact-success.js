const fs=require('fs');
const path='www/index.html';
let html=fs.readFileSync(path,'utf8');
if(!html.includes('</body>'))throw Error('Closing body tag missing');
if(html.includes('tmcs-contact-success-v226'))throw Error('Already applied');
const script=String.raw`<script id="tmcs-contact-success-v226">
(function(){
  const successPattern=/\b(message\s+(?:has\s+been\s+)?sent|sent\s+successfully|message\s+submitted|successfully\s+sent)\b/i;
  const contactWords=/contact\s*us|contact/i;
  function normalize(){
    const forms=Array.from(document.querySelectorAll('form'));
    const form=forms.find(f=>contactWords.test((f.id||'')+' '+(f.getAttribute('aria-label')||'')+' '+(f.closest('dialog,section,article')?.querySelector('h2,h3,h4')?.textContent||'')) && !/withdrawal|loan/i.test(f.id||''));
    if(!form)return;
    const scope=form.closest('dialog,section,article')||form.parentElement;
    if(!scope)return;
    scope.querySelectorAll('[id*="success" i],[class*="success" i],[id*="status" i],[id*="response" i],[class*="message" i]').forEach(el=>{
      if(el.children.length||!el.textContent.trim())return;
      if(successPattern.test(el.textContent)&&el.textContent.trim()!=='Message sent')el.textContent='Message sent';
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    normalize();
    const observer=new MutationObserver(()=>normalize());
    observer.observe(document.body,{childList:true,characterData:true,subtree:true});
  });
})();
</script>`;
html=html.replace('</body>',script+'</body>');
fs.writeFileSync(path,html);
console.log('Contact Us success displayed as Message sent only.');
