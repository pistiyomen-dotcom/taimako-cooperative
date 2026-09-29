const fs=require('fs');
const p='www/styles.css';
let s=fs.readFileSync(p,'utf8');
if(!s.includes('tmcs-member-layout-stage40')){
s+=`

/* tmcs-member-layout-stage40 */
#memberDashboard .tile-grid,
#memberDashboard .dashboard-grid,
#memberView .tile-grid,
#memberView .dashboard-grid {
  grid-template-columns: repeat(2,minmax(0,1fr));
}

#memberDashboard .action-grid,
#memberDashboard .dashboard-actions,
#memberView .action-grid,
#memberView .dashboard-actions {
  grid-template-columns: repeat(3,minmax(0,1fr));
}

#memberDashboard .tile-card > span:first-child,
#memberDashboard .dashboard-tile > span:first-child,
#memberView .tile-card > span:first-child,
#memberView .dashboard-tile > span:first-child {
  display:block;
  text-align:center;
  font-size:1.08rem;
  font-weight:700;
  line-height:1.2;
}

@media (max-width:560px){
  #memberDashboard .tile-grid,
  #memberDashboard .dashboard-grid,
  #memberView .tile-grid,
  #memberView .dashboard-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
  #memberDashboard .action-grid,
  #memberDashboard .dashboard-actions,
  #memberView .action-grid,
  #memberView .dashboard-actions {
    grid-template-columns: repeat(3,minmax(0,1fr));
    gap:8px;
  }
  #memberDashboard .action-grid button,
  #memberDashboard .dashboard-actions button,
  #memberView .action-grid button,
  #memberView .dashboard-actions button {
    min-width:0;
    padding:10px 6px;
    font-size:.78rem;
  }
}
`;
}
fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 40 member dashboard layout applied.');
