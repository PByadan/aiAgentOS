# aiAgentOS — AI Agent Operating System

政务智能问答系统的 AI Agent 框架，基于 Node.js + Express 构建的模块化 AI Agent 操作系统。

## 框架架构

```
aiAgentOS/
├── core/                    ← 框架核心层
│   ├── database.js          ← 数据库抽象层
│   ├── event-bus.js         ← 事件总线（模块间通信）
│   ├── middleware.js        ← 中间件（认证、角色、日志）
│   ├── registry.js          ← 模块注册中心
│   ├── context.js           ← 共享上下文
│   └── index.js             ← 统一导出
├── modules/                 ← 业务模块
│   ├── auth/                ← 用户认证
│   ├── policy/              ← 政策管理
│   ├── complaint/           ← 民生诉求
│   ├── approval/            ← 行政审批
│   ├── message/             ← 消息通知
│   ├── dashboard/           ← 数据看板
│   ├── ai-agent/            ← AI 智能解读 Agent
│   ├── user-management/     ← 用户管理
│   ├── role-permission/     ← 角色权限
│   └── data-warehouse/      ← 数据仓库
├── admin/                   ← 后台管理前端
│   ├── index.html           ← 仪表盘
│   ├── users.html           ← 用户管理
│   ├── roles.html           ← 角色管理
│   ├── permissions.html     ← 权限管理
│   ├── logs.html            ← 系统日志
│   ├── data-warehouse.html  ← 数据仓库
│   └── settings.html        ← 系统设置
└── app.js                   ← 应用入口
```

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 JWT_SECRET

# 启动系统
npm start

# 开发模式（自动重启）
npm run dev
```

## 访问地址

- 前台首页: http://localhost:3000
- 后台管理: http://localhost:3000/admin/index.html

## 模块接口标准

每个模块需实现以下接口：

```javascript
module.exports = {
  name: 'module-name',
  version: '1.0.0',
  description: '模块描述',
  init(app, context) { /* 注册路由 */ },
  getRoutes() { return []; },
  getMetadata() { return {}; }
};
```

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生 HTML/CSS/JS
- **数据库**: JSON 文件存储
- **AI 引擎**: 通义千问 (DashScope) + 本地规则引擎
- **认证**: JWT (JSON Web Token)
