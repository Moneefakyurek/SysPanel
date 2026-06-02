// ══════════════════════════════════════════════════════════════
//  SysPanel — app.js
// ══════════════════════════════════════════════════════════════

function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

const pageTitles = {
  dashboard:'Dashboard', users:'المستخدمون', services:'الخدمات',
  logs:'السجلات', monitor:'المراقبة', terminal:'Terminal', settings:'الإعدادات'
};

function nav(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('active'));
  document.getElementById('pg-' + name).classList.add('active');
  el.classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[name] || name;
  document.getElementById('notif-panel').style.display = 'none';
  if (name === 'users')    loadUsers();
  if (name === 'logs')     loadLogs();
  if (name === 'services') loadServices();
  if (name === 'settings') loadSettings();
}

function toggleNotif() {
  const p = document.getElementById('notif-panel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', e => {
  if (!e.target.closest('#notif-panel') && !e.target.closest('#notif-trigger'))
    document.getElementById('notif-panel').style.display = 'none';
});

// ── Stats ──────────────────────────────────────────────────────
const cpuHistory = [], ramHistory = [];

async function loadStats() {
  try {
    const d = await (await fetch('/api/stats')).json();
    setValue('s-cpu', d.cpu+'%'); setValue('s-ram', d.ram+'%');
    setValue('s-disk', d.disk+'%'); setValue('s-net', d.net_sent+' MB');
    setValue('s-cpu-sub','معالج النظام');
    setValue('s-ram-sub', d.ram_used+' GB / '+d.ram_total+' GB');
    setValue('s-disk-sub', d.disk_used+' GB / '+d.disk_total+' GB');
    setValue('s-net-sub','↑ '+d.net_sent+' | ↓ '+d.net_recv+' MB');
    setValue('s-os', d.os); setValue('s-host', d.hostname);
    setBar('f-cpu',d.cpu,'b-cpu'); setBar('f-ram',d.ram,'b-ram'); setBar('f-disk',d.disk,'b-disk');
    setValue('m-cpu',d.cpu+'%'); setValue('m-ram',d.ram+'%');
    setValue('m-disk',d.disk+'%'); setValue('m-net-s',d.net_sent+' MB');
    setValue('m-ram-sub',d.ram_used+' GB / '+d.ram_total+' GB');
    setValue('mi-sent',d.net_sent+' MB'); setValue('mi-recv',d.net_recv+' MB');
    setValue('mi-os',d.os); setValue('mi-host',d.hostname);
    setValue('mi-dused',d.disk_used+' GB');
    setValue('mi-dfree',(d.disk_total-d.disk_used).toFixed(1)+' GB');
    setValue('mi-dtotal',d.disk_total+' GB');
    cpuHistory.push(d.cpu); if(cpuHistory.length>12) cpuHistory.shift();
    ramHistory.push(d.ram); if(ramHistory.length>12) ramHistory.shift();
    drawBars('cpu-chart', cpuHistory, '#3b82f6');
    drawBars('ram-chart', ramHistory, '#f59e0b');
  } catch(e) {}
}

function setValue(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function setBar(fid, pct, lid) {
  const f=document.getElementById(fid), l=document.getElementById(lid);
  if(f) f.style.width=pct+'%'; if(l) l.textContent=pct+'%';
}
function drawBars(cid, data, color) {
  const el=document.getElementById(cid); if(!el) return;
  const max=Math.max(...data,1);
  el.innerHTML=data.map(v=>`<div class="mon-bar" style="height:${(v/max*100)}%;background:${color};opacity:${0.4+(v/max)*0.6}"></div>`).join('');
}

loadStats();
setInterval(loadStats, 4000);

// ── Dashboard logs ─────────────────────────────────────────────
async function loadDashLogs() {
  try {
    const logs = await (await fetch('/api/logs')).json();
    const el = document.getElementById('dash-logs');
    if (!el) return;
    el.innerHTML = logs.slice(0,5).map(l => logRowHTML(l)).join('');
  } catch(e) {}
}
loadDashLogs();

// ── Users ──────────────────────────────────────────────────────
async function loadUsers() {
  try {
    const users = await (await fetch('/api/users')).json();
    setValue('users-count', users.length);
    const online = users.filter(u=>u.status==='online').length;
    setValue('online-count', online);
    setValue('total-users', users.length);
    const tbody = document.getElementById('users-body');
    if (!tbody) return;
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:7px">
          <div style="width:24px;height:24px;border-radius:50%;background:#0f2040;color:#60a5fa;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;flex-shrink:0">${u.name.substring(0,2).toUpperCase()}</div>
          ${u.name}</div></td>
        <td style="color:#4a5568">${u.username}</td>
        <td><span class="tbl-badge ${u.role==='admin'?'tb-admin':'tb-user'}">${u.role}</span></td>
        <td><span class="tbl-badge ${u.status==='online'?'tb-online':'tb-offline'}">${u.status==='online'?'متصل':'غير متصل'}</span></td>
        <td style="font-size:10px;color:#374151">${u.last_login||'—'}</td>
        <td><button class="btn-red" style="font-size:10px;padding:2px 7px" onclick="deleteUser(${u.id})">حذف</button></td>
      </tr>`).join('');
  } catch(e) {}
}

async function deleteUser(id) {
  if (!confirm('هل تريد حذف هذا المستخدم؟')) return;
  await fetch('/api/users/delete/'+id, {method:'DELETE'});
  loadUsers();
}

function openModal(name) { document.getElementById('modal-bg').style.display='flex'; }
function closeModal(e) {
  if (!e || e.target.id==='modal-bg') {
    document.getElementById('modal-bg').style.display='none';
    ['f-name','f-username','f-pass'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  }
}

async function submitAddUser() {
  const name=document.getElementById('f-name').value.trim();
  const username=document.getElementById('f-username').value.trim();
  const password=document.getElementById('f-pass').value.trim();
  const role=document.getElementById('f-role').value;
  if (!name||!username||!password) { alert('جميع الحقول مطلوبة'); return; }
  const data = await (await fetch('/api/users/add',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({name,username,password,role})
  })).json();
  if (data.ok) { closeModal(); loadUsers(); }
  else alert('خطأ: '+data.msg);
}

// ── Services ───────────────────────────────────────────────────
async function loadServices() {
  try {
    const svcs = await (await fetch('/api/services')).json();
    const running = svcs.filter(s=>s.status==='running').length;
    setValue('svc-summary', running+' / '+svcs.length);
    const tbody = document.getElementById('svc-body');
    if (!tbody) return;
    tbody.innerHTML = svcs.map(s => `
      <tr>
        <td style="font-weight:500;color:#e6edf3">${s.name}</td>
        <td style="font-size:11px;color:#374151">${s.port}</td>
        <td><span class="${s.status==='running'?'svc-running':'svc-stopped'}">
          <span class="svc-dot" style="background:${s.status==='running'?'#22c55e':'#ef4444'}"></span>
          ${s.status==='running'?'يعمل':'متوقف'}</span></td>
        <td style="font-size:10px;color:#374151">${s.last_active||'—'}</td>
        <td><div class="toggle ${s.status==='running'?'on':'off'}" onclick="toggleService(this,${s.id})"></div></td>
      </tr>`).join('');
  } catch(e) {}
}

async function toggleService(el, id) {
  const data = await (await fetch('/api/services/toggle/'+id,{method:'POST'})).json();
  el.classList.toggle('on'); el.classList.toggle('off');
  const row=el.closest('tr'), badge=row.querySelector('.svc-running,.svc-stopped');
  if (badge) {
    const r=data.status==='running';
    badge.className=r?'svc-running':'svc-stopped';
    badge.innerHTML=`<span class="svc-dot" style="background:${r?'#22c55e':'#ef4444'}"></span>${r?'يعمل':'متوقف'}`;
  }
}

// ── Logs ───────────────────────────────────────────────────────
let allLogs=[], currentFilter='all';

async function loadLogs() {
  try {
    allLogs = await (await fetch('/api/logs')).json();
    setValue('logs-count', allLogs.length);
    renderLogs();
  } catch(e) {}
}

function renderLogs() {
  const el=document.getElementById('logs-body'); if(!el) return;
  const filtered = currentFilter==='all' ? allLogs : allLogs.filter(l=>l.type===currentFilter);
  el.innerHTML = filtered.length ? filtered.map(l=>logRowHTML(l)).join('') : '<div class="loading-txt">لا توجد سجلات</div>';
}

function logRowHTML(l) {
  const colors={ok:'#22c55e',warn:'#f59e0b',error:'#ef4444',info:'#3b82f6'};
  const badges={ok:'lb-ok',warn:'lb-warn',error:'lb-error',info:'lb-info'};
  const labels={ok:'ناجح',warn:'تحذير',error:'خطأ',info:'معلومة'};
  const t=l.type||'info';
  return `<div class="log-row">
    <div class="log-dot" style="background:${colors[t]||'#6e7f94'}"></div>
    <span class="log-badge ${badges[t]||'lb-info'}">${labels[t]||t}</span>
    <div class="log-msg">${l.message}</div>
    <div class="log-user">${l.user||'—'}</div>
    <div class="log-time">${l.timestamp||'—'}</div>
  </div>`;
}

function filterLogs(el) {
  document.querySelectorAll('.filt').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  currentFilter=el.dataset.f;
  renderLogs();
}

async function clearLogs() {
  if (!confirm('هل تريد مسح جميع السجلات؟')) return;
  await fetch('/api/logs/clear',{method:'DELETE'});
  loadLogs();
}

// ── Settings ───────────────────────────────────────────────────
const settingsMeta = [
  {key:'firewall',icon:'🛡',label:'جدار الحماية',desc:'حماية من الاتصالات غير المصرّح بها',cls:'si-blue'},
  {key:'auto_update',icon:'🔄',label:'التحديثات التلقائية',desc:'تثبيت تحديثات الأمان تلقائياً',cls:'si-green'},
  {key:'notifications',icon:'🔔',label:'التنبيهات',desc:'إشعارات عند ارتفاع استخدام الموارد',cls:'si-amber'},
  {key:'ssh_password',icon:'🔐',label:'SSH بكلمة مرور',desc:'السماح بالدخول عبر SSH بكلمة مرور',cls:'si-red'},
  {key:'save_logs',icon:'📋',label:'حفظ السجلات',desc:'الاحتفاظ بالسجلات لمدة 30 يوم',cls:'si-purple'},
];

async function loadSettings() {
  try {
    const data = await (await fetch('/api/settings')).json();
    const el = document.getElementById('security-settings'); if(!el) return;
    setValue('info-servername', data.server_name||'munif-server');
    el.innerHTML = settingsMeta.map(s=>`
      <div class="setting-item">
        <div class="setting-icon ${s.cls}">${s.icon}</div>
        <div style="flex:1">
          <div class="setting-label">${s.label}</div>
          <div class="setting-desc">${s.desc}</div>
        </div>
        <div class="toggle ${data[s.key]==='on'?'on':'off'}" id="tog-${s.key}"
             onclick="this.classList.toggle('on');this.classList.toggle('off')"></div>
      </div>`).join('');
  } catch(e) {}
}

async function saveSettings() {
  const updates={};
  settingsMeta.forEach(s=>{
    const el=document.getElementById('tog-'+s.key);
    if(el) updates[s.key]=el.classList.contains('on')?'on':'off';
  });
  await fetch('/api/settings/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(updates)});
  alert('تم حفظ الإعدادات ✓');
}

// ── Terminal ───────────────────────────────────────────────────
const CMDS = {
  help:'الأوامر المتاحة:\n  ls, pwd, whoami, date, uptime, df, free, ps, clear, sysinfo',
  ls:'Documents/  Projects/  Backups/  Logs/\nreport.pdf  notes.txt  setup.sh  config.yml',
  pwd:'/home/munif',
  whoami:'munif (Administrator)',
  date:()=>new Date().toLocaleString('ar-SA'),
  uptime:'up 14:32, 2 users, load: 0.45',
  df:'Filesystem  Size  Used  Avail  Use%\n/dev/sda1   500G  210G   290G   42%',
  free:'       total   used   free\nMem:   16384  10700   5684',
  ps:'PID   CMD\n1234  nginx\n1235  mysqld\n1236  sshd\n1240  flask',
  sysinfo:'OS: Ubuntu 24.04 LTS\nHostname: munif-server\nIP: 192.168.1.10\nKernel: 6.8.0',
};

function termKey(e) {
  if (e.key!=='Enter') return;
  const input=document.getElementById('term-input');
  const cmd=input.value.trim().toLowerCase();
  if (!cmd) return;
  const out=document.getElementById('term-out');
  const pl=document.createElement('div');
  pl.className='term-line prompt-line';
  pl.innerHTML=`<span style="color:#4a5568">munif@syspanel:~$</span> ${cmd}`;
  out.appendChild(pl);
  if (cmd==='clear'){out.innerHTML='';input.value='';return;}
  const rl=document.createElement('div');
  const resp=CMDS[cmd];
  if (resp){ rl.className='term-line result'; rl.textContent=typeof resp==='function'?resp():resp; }
  else { rl.className='term-line error-line'; rl.textContent=`bash: ${cmd}: command not found`; }
  out.appendChild(rl);
  input.value='';
  out.scrollTop=out.scrollHeight;
}
