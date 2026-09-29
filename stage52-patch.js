const fs=require('fs');

const page=`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TMCS Admin Setup</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f4f7f3;margin:0;padding:24px;color:#123}
    .card{max-width:520px;margin:30px auto;background:#fff;border-radius:22px;padding:24px;box-shadow:0 10px 30px #0002}
    h1{color:#075d32;margin-top:0}
    label{display:block;font-weight:700;margin:16px 0 6px}
    input{width:100%;box-sizing:border-box;padding:14px;border:1px solid #ccd5cf;border-radius:12px;font-size:18px}
    button{width:100%;margin-top:20px;padding:14px;border:0;border-radius:12px;background:#d8a80d;color:#17321f;font-size:18px;font-weight:800}
    .msg{margin-top:16px;font-weight:700}
    .err{color:#b3261e}.ok{color:#075d32}
    .note{color:#5f6f66;line-height:1.45}
  </style>
</head>
<body>
  <div class="card">
    <h1>One-Time Admin Setup</h1>
    <p class="note">Set the preferred administrator login. After successful setup, this page will no longer be able to change the Admin account.</p>
    <form id="f">
      <label>Setup Code</label><input id="code" required autocomplete="off">
      <label>Preferred Admin Username</label><input id="username" value="Shugaba" required>
      <label>Admin Full Name</label><input id="name" required>
      <label>Temporary Password</label><input id="password" type="password" required autocomplete="new-password">
      <button type="submit">COMPLETE ADMIN SETUP</button>
      <div id="msg" class="msg"></div>
    </form>
  </div>
  <script>
    const f=document.getElementById('f'),m=document.getElementById('msg');
    f.addEventListener('submit',async e=>{
      e.preventDefault();m.textContent='Working...';m.className='msg';
      try{
        const r=await fetch('/api/public/admin-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          setupCode:document.getElementById('code').value,
          username:document.getElementById('username').value,
          fullName:document.getElementById('name').value,
          password:document.getElementById('password').value
        })});
        const b=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(b.error||'Setup failed.');
        m.textContent='Admin setup completed. Username: '+b.user.username+'. Return to the main app and log in with the temporary password.';
        m.className='msg ok';
      }catch(err){m.textContent=err.message;m.className='msg err';}
    });
  </script>
</body>
</html>`;

fs.writeFileSync('www/admin-setup-v52.html',page);
console.log('TAIMAKO Stage 52 standalone Admin setup page applied.');
