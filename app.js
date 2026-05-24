require('dotenv').config();
const express = require('express');
const path = require('path');
const { EventBus, Store, AgentRegistry, middleware } = require('./core');
const createRoutes = require('./api/routes');
const builtInAgents = require('./agents');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'aiagentos-dev-secret';

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 初始化核心
const store = new Store();
const events = new EventBus();
const registry = new AgentRegistry(store, events);

// 请求日志
app.use(middleware.logger(store));

// 注册内置 Agent
builtInAgents.forEach(agent => registry.register(agent));

// 初始化管理员账号
if (store.all('users').length === 0) {
  const { hashPassword } = require('./services/auth');
  store.insert('users', {
    id: '1', username: 'admin', passwordHash: hashPassword('admin123'),
    role: 'admin', disabled: false, createdAt: new Date().toISOString()
  });
  store.insert('users', {
    id: '2', username: 'user', passwordHash: hashPassword('user123'),
    role: 'user', disabled: false, createdAt: new Date().toISOString()
  });
  console.log('[Init] Default users: admin/admin123, user/user123');
}

// 初始化默认角色和权限
if (store.all('roles').length === 0) {
  const defaultRoles = [
    { id: 'admin', name: '管理员', description: '拥有全部权限', createdAt: new Date().toISOString() },
    { id: 'editor', name: '编辑员', description: '可管理内容和数据', createdAt: new Date().toISOString() },
    { id: 'user', name: '普通用户', description: '基础查看权限', createdAt: new Date().toISOString() }
  ];
  defaultRoles.forEach(r => store.insert('roles', r));

  const defaultPerms = [
    { id: 'user:read', name: '查看用户', module: '用户管理' },
    { id: 'user:write', name: '管理用户', module: '用户管理' },
    { id: 'agent:read', name: '查看智能体', module: '智能体' },
    { id: 'agent:execute', name: '执行智能体', module: '智能体' },
    { id: 'log:read', name: '查看日志', module: '系统日志' },
    { id: 'data:export', name: '导出数据', module: '数据仓库' },
    { id: 'role:manage', name: '管理角色', module: '角色权限' },
    { id: 'perm:manage', name: '管理权限', module: '角色权限' }
  ];
  defaultPerms.forEach(p => store.insert('permissions', p));

  const allPermIds = defaultPerms.map(p => p.id);
  const rolePermMap = [
    { roleId: 'admin', permissionIds: allPermIds },
    { roleId: 'editor', permissionIds: ['user:read', 'agent:read', 'agent:execute', 'log:read', 'data:export'] },
    { roleId: 'user', permissionIds: ['user:read', 'agent:read', 'agent:execute'] }
  ];
  rolePermMap.forEach(rp => store.insert('rolePermissions', rp));

  console.log('[Init] Default roles: admin, editor, user');
  console.log('[Init] Default permissions:', defaultPerms.length, 'items');
}

// API 路由
app.use('/api', createRoutes(store, registry, events, SECRET));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动
app.listen(PORT, () => {
  console.log('');
  console.log('  █████╗ ██╗    ██████╗ ███████╗███╗   ██╗████████╗');
  console.log(' ██╔══██╗██║    ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝');
  console.log(' ███████║██║    ██████╔╝█████╗  ██╔██╗ ██║   ██║   ');
  console.log(' ██╔══██║██║    ██╔══██╗██╔══╝  ██║╚██╗██║   ██║   ');
  console.log(' ██║  ██║██║    ██████╔╝███████╗██║ ╚████║   ██║   ');
  console.log(' ╚═╝  ╚═╝╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ');
  console.log('                   O S  v1.0                        ');
  console.log('');
  console.log(`  System ready: http://localhost:${PORT}`);
  console.log(`  Agents loaded: ${registry.list().length}`);
  console.log('');
});

module.exports = app;
