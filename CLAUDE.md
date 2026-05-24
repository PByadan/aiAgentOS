# 政务系统 — CLAUDE.md

## 项目总体目标

开展政务智能问答系统全流程开发实践。项目紧扣 AI 大模型在政务服务领域的应用需求，围绕政策智能解读、民生诉求处理、政务流程自动化等真实场景，融合大模型调用、多模态数据处理、低代码开发、前后端分离开发、数据安全与云端部署等技术，让学生完成从需求分析、系统设计、编码开发到集成部署、成果验收的企业级项目流程，掌握 AI 大模型与政务场景结合的工程化落地能力，提升团队协作、需求转化与项目交付素养。

## 项目概述

政务信息管理系统，面向政府机构内部及公众用户，提供政策发布、行政审批、数据看板等功能。

## 设计系统

**主基调: monochrome-print-gov**
源自 `garden-skills/skills/web-video-presentation/themes/monochrome-print`，迁移并适配政务场景。

### 核心设计原则

1. **严肃克制** — 不使用花哨动效、渐变背景、毛玻璃、装饰性图形
2. **信息优先** — 层级靠字号 + 字重 + 留白区分，不靠颜色堆叠
3. **印刷质感** — 衬线字体为主，1px hairline，4px 圆角，纯净表面
4. **色彩极简** — 全局仅黑/白/灰 + 单一政务蓝 `#1a3a8c` 作为强调色
5. **状态色彩克制** — 绿(通过)、橙(待处理)、红(驳回) 仅用于状态标签，不做大面积铺色

### 设计令牌文件

所有 CSS 变量定义在 `design/tokens.css`，包括：

- 调色板 (palette)
- 字体栈 (fonts)
- 字号阶梯 (type scale)
- 间距系统 (spacing)
- 动效时长 (motion)
- 圆角/阴影/边框 (identity)

### 配色速查

| Token              | 色值        | 用途           |
| ------------------ | --------- | ------------ |
| `--surface`        | `#fbf9f4` | 页面底色         |
| `--surface-2`      | `#ffffff` | 卡片/输入框底色     |
| `--surface-3`      | `#f0ebde` | 次级表面/hover 态 |
| `--text`           | `#0e1418` | 主文字          |
| `--text-2`         | `#1f2a32` | 标题/强调文字      |
| `--text-mute`      | `#6b7178` | 辅助说明         |
| `--text-faint`     | `#a8aeb4` | 占位符/禁用态      |
| `--rule`           | `#c9c5b8` | 边框/分割线       |
| `--accent`         | `#1a3a8c` | 主强调色 (政务蓝)   |
| `--accent-hover`   | `#15306e` | 强调色 hover 态  |
| `--status-success` | `#166534` | 已办结/通过       |
| `--status-warning` | `#92400e` | 待处理/提醒       |
| `--status-error`   | `#991b1b` | 驳回/错误        |

### 字体栈

- **中文标题**: Noto Serif SC → Source Han Serif SC → Songti SC → serif
- **英文标题**: Source Serif 4 → EB Garamond → Times New Roman → serif
- **正文**: Source Serif 4 → Noto Serif SC → Songti SC → serif
- **界面元素**: Inter → Noto Sans SC → PingFang SC → sans-serif
- **等宽**: JetBrains Mono → SF Mono → monospace

### 组件规范

已预定义组件样式，直接使用 class：

- **按钮**: `.btn` / `.btn-primary` / `.btn-ghost`
- **表单**: `input` / `select` / `textarea` / `label` (原生标签已预设样式)
- **卡片**: `.card`
- **表格**: `table` / `th` / `td` (原生标签已预设样式)
- **徽标**: `.badge` / `.badge-success` / `.badge-warning` / `.badge-error` / `.badge-info`
- **分割线**: `.divider`
- **容器**: `.page-container` (max-width: 1200px, 居中)
- **无障碍**: `.sr-only` (视觉隐藏)

## 项目结构

```
政务系统/
├── CLAUDE.md           ← 本文件
├── index.html          ← 首页（系统入口）
├── design/
│   ├── tokens.css      ← 设计令牌 + 基础组件样式
│   └── theme.json      ← 主题元数据
├── src/
│   ├── styles/
│   │   └── common.css  ← 公共组件样式（导航/卡片/表格等）
│   ├── scripts/
│   │   └── common.js   ← 公共脚本（导航/Tab切换等）
│   ├── login.html          ← 登录/注册页
│   ├── policy-analysis.html ← 政策智能解读页（AI驱动）
│   ├── complaint.html      ← 民生诉求处理页
│   ├── policies.html       ← 政策列表页
│   ├── policy-detail.html  ← 政策详情页
│   ├── approval.html       ← 行政审批页
│   ├── dashboard.html      ← 数据看板页
│   └── profile.html        ← 个人中心页
└── assets/
    └── images/         ← 图片资源
```

## 编码规范

### HTML

- 语义化标签优先: `<header>` `<nav>` `<main>` `<section>` `<article>` `<aside>` `<footer>`
- 所有交互元素必须可键盘访问 (Tab/Enter/Escape)
- 图片必须有 `alt` 属性
- 表单控件必须关联 `<label>`
- 使用中文 `lang="zh-CN"`

### CSS

- 所有颜色/间距/字号必须使用 `design/tokens.css` 中的 CSS 变量
- 禁止硬编码色值、字号、间距
- 布局优先使用 Flexbox / Grid
- 响应式断点: 768px (平板) / 1024px (桌面)
- 必须支持 `prefers-reduced-motion` 和 `prefers-color-scheme: dark` (如需暗色模式)

### JavaScript

- 纯原生 JS，不使用框架 (除非性能/复杂度要求
- 事件委托优先
- 所有异步操作需处理错误状态
- 禁止 `innerHTML` 拼接用户输入 (防 XSS)

## 适配政务场景的特殊规则

1. **字号偏大** — 政务用户年龄跨度大，正文不小于 16px
2. **对比度** — 所有文字/背景对比度 ≥ 4.5:1 (WCAG AA)
3. **操作确认** — 破坏性操作 (删除/驳回/提交) 需二次确认
4. **状态可见** — 表单提交后必须有明确的成功/失败反馈
5. **面包屑** — 多层级页面必须有面包屑导航
6. **返回路径** — 每个页面必须有清晰的返回/上级入口
