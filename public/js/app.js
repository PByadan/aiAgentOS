// aiAgentOS Frontend SDK
const BASE = '/api';

function getToken() { return localStorage.getItem('aos_token'); }
function getUser() { try { return JSON.parse(localStorage.getItem('aos_user')); } catch { return null; } }

async function api(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE}${path}`, { ...opts, headers });
    return await res.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function logout() {
  localStorage.removeItem('aos_token');
  localStorage.removeItem('aos_user');
  location.href = '/pages/login.html';
}

// 渲染侧边栏
function renderSidebar(activePage) {
  const navItems = [
    { section: '系统' },
    { href: '/pages/dashboard.html', label: '控制台', id: 'dashboard' },
    { href: '/pages/agents.html', label: '智能体', id: 'agents' },
    { href: '/pages/chat.html', label: '对话', id: 'chat' },
    { section: '管理' },
    { href: '/pages/users.html', label: '用户管理', id: 'users' },
    { href: '/pages/logs.html', label: '系统日志', id: 'logs' },
    { section: '其他' },
    { href: '/', label: '首页', id: 'home' },
    { href: '#', label: '退出登录', id: 'logout', onclick: 'logout()' }
  ];

  let html = '';
  navItems.forEach(item => {
    if (item.section) {
      html += `<div class="nav-section">${item.section}</div>`;
    } else {
      const active = item.id === activePage ? ' class="active"' : '';
      const onclick = item.onclick ? ` onclick="${item.onclick}"` : '';
      html += `<a href="${item.href}"${active}${onclick}>${item.label}</a>`;
    }
  });

  document.querySelector('.sidebar nav').innerHTML = html;
}
