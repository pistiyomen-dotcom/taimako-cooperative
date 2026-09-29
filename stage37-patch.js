const fs=require('fs');
let a=fs.readFileSync('server/routes/admin.js','utf8');
if(!a.includes("router.get('/summary-report'")){
const r="
router.get('/summary-report',requireAdminPermission('view_reports'),async(_req,res)=>{ const q=await pool.query(\"SELECT COUNT(*) FILTER(WHERE role='regular' AND is_active) regular_active,COUNT(*) FILTER(WHERE role='flexible' AND is_active) flexible_active FROM accounts\"); res.json({accounts:q.rows[0]}); });
";
a=a.replace('\nmodule.exports = router;',r+'\nmodule.exports = router;');
}
fs.writeFileSync('server/routes/admin.js',a);
console.log('TAIMAKO Stage 37 summary endpoint applied.');
