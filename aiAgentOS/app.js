require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const { Database, EventBus, Registry, Context, middleware } = require('./core');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('错误: 未设置 JWT_SECRET 环境变量，请在 .env 文件中配置');
  process.exit(1);
}

// ────────── 基础中间件 ──────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ────────── 文件上传配置 ──────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
const fs = require('fs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('仅支持 PDF、DOC、DOCX、TXT 格式的文件'));
  }
});

// 托管上传文件
app.use('/uploads', express.static(uploadsDir));

// ────────── 前端静态文件 ──────────
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
app.use('/src', express.static(path.join(__dirname, '..', 'src')));
app.use('/design', express.static(path.join(__dirname, '..', 'design')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ────────── 初始化框架核心 ──────────
const db = new Database();
const events = new EventBus();
const registry = new Registry();

// 确保 db.json 包含新集合
const data = db.read();
if (!data.logs) data.logs = [];
if (!data.roles) {
  data.roles = [
    { id: 'r1', name: 'citizen', label: '个人用户', system: true },
    { id: 'r2', name: 'enterprise', label: '企业用户', system: true },
    { id: 'r3', name: 'staff', label: '政务人员', system: true }
  ];
}
if (!data.permissions) {
  data.permissions = [
    { id: 'policy:read', label: '查看政策', module: 'policy' },
    { id: 'policy:write', label: '编辑政策', module: 'policy' },
    { id: 'complaint:read', label: '查看诉求', module: 'complaint' },
    { id: 'complaint:write', label: '处理诉求', module: 'complaint' },
    { id: 'approval:read', label: '查看审批', module: 'approval' },
    { id: 'approval:write', label: '处理审批', module: 'approval' },
    { id: 'user:read', label: '查看用户', module: 'user-management' },
    { id: 'user:write', label: '管理用户', module: 'user-management' },
    { id: 'dashboard:read', label: '查看数据看板', module: 'dashboard' },
    { id: 'warehouse:read', label: '查看数据仓库', module: 'data-warehouse' },
    { id: 'warehouse:export', label: '导出数据', module: 'data-warehouse' },
    { id: 'log:read', label: '查看系统日志', module: 'data-warehouse' },
    { id: 'role:read', label: '查看角色', module: 'role-permission' },
    { id: 'role:write', label: '管理角色权限', module: 'role-permission' }
  ];
}
if (!data.rolePermissions) {
  data.rolePermissions = {
    staff: data.permissions.map(p => p.id),
    citizen: ['policy:read', 'complaint:read', 'approval:read', 'dashboard:read'],
    enterprise: ['policy:read', 'complaint:read', 'approval:read', 'dashboard:read']
  };
}
// 确保用户有 disabled 字段
data.users = data.users.map(u => ({ disabled: false, ...u }));
db.write(data);

// 创建共享上下文
const context = new Context({
  db,
  events,
  config: {
    JWT_SECRET,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
    DASHSCOPE_BASE_URL: process.env.DASHSCOPE_BASE_URL,
    PORT
  },
  jwt,
  multer: upload,
  middleware: {
    authenticateToken: middleware.authenticateToken(JWT_SECRET),
    requireRole: middleware.requireRole
  }
});

// 注册请求日志中间件
app.use(middleware.requestLogger(db));

// ────────── 注册业务模块 ──────────
console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║              aiAgentOS Framework v1.0            ║');
console.log('║          AI Agent Operating System               ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');

registry.register(require('./modules/auth'));
registry.register(require('./modules/policy'));
registry.register(require('./modules/complaint'));
registry.register(require('./modules/approval'));
registry.register(require('./modules/message'));
registry.register(require('./modules/dashboard'));
registry.register(require('./modules/ai-agent'));
registry.register(require('./modules/user-management'));
registry.register(require('./modules/role-permission'));
registry.register(require('./modules/data-warehouse'));

// 初始化所有模块
registry.initAll(app, context);

// ────────── 管理 API：获取模块列表 ──────────
app.get('/api/admin/modules', middleware.authenticateToken(JWT_SECRET), (req, res) => {
  res.json({ success: true, modules: registry.listModules() });
});

// ────────── 启动服务器 ──────────
app.listen(PORT, () => {
  console.log('');
  console.log(`[aiAgentOS] 系统启动成功!`);
  console.log(`[aiAgentOS] 服务运行在: http://localhost:${PORT}`);
  console.log(`[aiAgentOS] 后台管理: http://localhost:${PORT}/admin/index.html`);
  console.log(`[aiAgentOS] 已注册 ${registry.listModules().length} 个模块`);
  console.log('');
});

module.exports = app;
