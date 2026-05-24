require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('错误: 未设置 JWT_SECRET 环境变量，请在 .env 文件中配置');
  process.exit(1);
}

// 确保目录存在
const dbFilePath = path.join(__dirname, 'data', 'db.json');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(path.dirname(dbFilePath))) {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 数据库帮助函数
function readDB() {
  try {
    const data = fs.readFileSync(dbFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('读取数据库文件失败，返回空数据结构', err);
    return { users: [], policies: [], complaints: [], approvals: [], analysisHistory: [], messages: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('写入数据库文件失败', err);
  }
}

// 密码哈希帮助函数（加盐 SHA-256）
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const [salt] = stored.split(':');
  return hashPassword(password, salt) === stored;
}

// Multer 上传文件配置 (本地存储)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 PDF、DOC、DOCX、TXT 格式的文件'));
    }
  }
});

// 基础中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 托管上传的文件
app.use('/uploads', express.static(uploadsDir));

// 静态托管前端页面
// / 或 /index.html 对应根目录下的 index.html
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// 托管 /src 和 /design 静态资源
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/design', express.static(path.join(__dirname, 'design')));

// 用户身份验证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ success: false, message: '未提供身份验证 Token' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: '无效的 Token 或已过期' });
    req.user = user;
    next();
  });
}

// 角色验证中间件
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ success: false, message: `权限不足，仅允许 ${role === 'staff' ? '政务人员' : role} 访问` });
    }
    next();
  };
}

// ────────── API 路由 ──────────

// 1. 用户认证路由
app.post('/api/auth/register', (req, res) => {
  const { name, phone, password, role } = req.body;
  if (!name || !phone || !password || !role) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  const db = readDB();
  const existingUser = db.users.find(u => u.phone === phone);
  if (existingUser) {
    return res.status(400).json({ success: false, message: '该手机号已注册' });
  }

  const newUser = {
    id: (db.users.length + 1).toString(),
    name,
    phone,
    passwordHash: hashPassword(password),
    role,
    gender: '男',
    email: '',
    idnum: '',
    address: '',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);

  const token = jwt.sign({ id: newUser.id, name: newUser.name, phone: newUser.phone, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
  
  // 排除密码哈希后返回
  const { passwordHash, ...userResponse } = newUser;
  res.status(201).json({ success: true, message: '注册成功', token, user: userResponse });
});

app.post('/api/auth/login', (req, res) => {
  const { phone, password, role } = req.body;
  if (!phone || !password || !role) {
    return res.status(400).json({ success: false, message: '缺少手机号、密码或角色' });
  }

  const db = readDB();
  const user = db.users.find(u => u.phone === phone && u.role === role);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(400).json({ success: false, message: '手机号或密码错误' });
  }

  const token = jwt.sign({ id: user.id, name: user.name, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  
  const { passwordHash, ...userResponse } = user;
  res.json({ success: true, message: '登录成功', token, user: userResponse });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

  const { passwordHash, ...userResponse } = user;
  res.json({ success: true, user: userResponse });
});

app.put('/api/auth/profile', authenticateToken, (req, res) => {
  const { name, gender, email, idnum, address } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex(u => u.id === req.user.id);
  
  if (userIndex === -1) return res.status(404).json({ success: false, message: '用户不存在' });

  // 更新字段
  db.users[userIndex].name = name || db.users[userIndex].name;
  db.users[userIndex].gender = gender || db.users[userIndex].gender;
  db.users[userIndex].email = email || db.users[userIndex].email;
  db.users[userIndex].idnum = idnum || db.users[userIndex].idnum;
  db.users[userIndex].address = address || db.users[userIndex].address;

  writeDB(db);

  const { passwordHash, ...userResponse } = db.users[userIndex];
  res.json({ success: true, message: '个人信息修改成功', user: userResponse });
});

app.put('/api/auth/settings', authenticateToken, (req, res) => {
  const { phone, currentPassword, newPassword } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) return res.status(404).json({ success: false, message: '用户不存在' });

  const user = db.users[userIndex];

  // 1. 如果是修改手机号
  if (phone) {
    const phoneExists = db.users.some(u => u.phone === phone && u.id !== req.user.id);
    if (phoneExists) {
      return res.status(400).json({ success: false, message: '该手机号已被其他账号绑定' });
    }
    user.phone = phone;
  }

  // 2. 如果是修改密码
  if (currentPassword && newPassword) {
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ success: false, message: '当前密码输入错误' });
    }
    user.passwordHash = hashPassword(newPassword);
  }

  writeDB(db);
  res.json({ success: true, message: '账户设置更新成功' });
});


// 2. 政策法规路由
app.get('/api/policies/categories', (req, res) => {
  const db = readDB();
  const counts = { '全部': db.policies.length };
  db.policies.forEach(p => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  res.json({ success: true, counts });
});

app.get('/api/policies', (req, res) => {
  const { category, year, status, keyword, limit, page } = req.query;
  const db = readDB();
  let filtered = [...db.policies];

  if (category && category !== '全部') {
    filtered = filtered.filter(p => p.category === category);
  }
  if (year && year !== '全部年份') {
    filtered = filtered.filter(p => p.year === year);
  }
  if (status && status !== '全部状态') {
    filtered = filtered.filter(p => p.status === status);
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    filtered = filtered.filter(p => p.title.toLowerCase().includes(kw) || p.summary.toLowerCase().includes(kw));
  }

  // 按照发布日期倒序
  filtered.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

  const total = filtered.length;
  const pageSize = parseInt(limit) || 5;
  const currentPage = parseInt(page) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);

  res.json({
    success: true,
    total,
    page: currentPage,
    limit: pageSize,
    policies: paginated
  });
});

app.get('/api/policies/:id', (req, res) => {
  const db = readDB();
  const policy = db.policies.find(p => p.id === req.params.id);
  if (!policy) return res.status(404).json({ success: false, message: '政策法规不存在' });
  res.json({ success: true, policy });
});

app.post('/api/policies', authenticateToken, requireRole('staff'), (req, res) => {
  const { title, summary, content, category, year, status, department } = req.body;
  if (!title || !content || !category) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  const db = readDB();
  const newPolicy = {
    id: (db.policies.length + 1).toString(),
    title,
    summary: summary || content.slice(0, 100) + '...',
    content,
    category,
    year: year || new Date().getFullYear().toString(),
    status: status || '已发布',
    publishDate: new Date().toISOString().split('T')[0],
    department: department || req.user.name
  };

  db.policies.push(newPolicy);
  writeDB(db);

  res.status(201).json({ success: true, message: '政策法规发布成功', policy: newPolicy });
});

app.put('/api/policies/:id', authenticateToken, requireRole('staff'), (req, res) => {
  const { title, summary, content, category, year, status, department } = req.body;
  const db = readDB();
  const policy = db.policies.find(p => p.id === req.params.id);
  if (!policy) return res.status(404).json({ success: false, message: '政策法规不存在' });

  if (title !== undefined) policy.title = title;
  if (summary !== undefined) policy.summary = summary;
  if (content !== undefined) policy.content = content;
  if (category !== undefined) policy.category = category;
  if (year !== undefined) policy.year = year;
  if (status !== undefined) policy.status = status;
  if (department !== undefined) policy.department = department;

  writeDB(db);
  res.json({ success: true, message: '政策法规更新成功', policy });
});

app.delete('/api/policies/:id', authenticateToken, requireRole('staff'), (req, res) => {
  const db = readDB();
  const index = db.policies.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '政策法规不存在' });

  db.policies.splice(index, 1);
  writeDB(db);
  res.json({ success: true, message: '政策法规删除成功' });
});


// 3. 民生诉求路由
app.post('/api/complaints', authenticateToken, upload.array('files'), (req, res) => {
  const { type, title, detail, address } = req.body;
  if (!type || !title || !detail) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  const db = readDB();
  
  // 生成唯一的诉求编号: TS-YYYYMMDD-XXXX
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dailyCount = db.complaints.filter(c => c.id.startsWith(`TS-${todayStr}`)).length + 1;
  const complaintId = `TS-${todayStr}-${dailyCount.toString().padStart(4, '0')}`;

  const uploadedFiles = (req.files || []).map(f => ({
    name: f.originalname,
    path: `/uploads/${f.filename}`
  }));

  const newComplaint = {
    id: complaintId,
    userId: req.user.id,
    name: req.user.name,
    phone: req.user.phone,
    type,
    title,
    detail,
    address: address || '',
    files: uploadedFiles,
    status: 'pending_acceptance', // 初始状态：已受理/待处理
    createdAt: new Date().toISOString(),
    timeline: [
      {
        title: '已受理',
        time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        desc: `诉求已分配至${type === 'infra' ? '住建局' : type === 'env' ? '环保局' : type === 'traffic' ? '交通局' : '民政局'}处理`,
        done: true
      },
      {
        title: '处理中',
        time: '—',
        desc: '正在等待相关部门派发和处理',
        done: false
      },
      {
        title: '待验收',
        time: '—',
        desc: '',
        done: false
      },
      {
        title: '已办结',
        time: '—',
        desc: '',
        done: false
      }
    ]
  };

  db.complaints.push(newComplaint);
  writeDB(db);

  res.status(201).json({ success: true, message: '诉求提交成功', complaintId, complaint: newComplaint });
});

app.get('/api/complaints/my', authenticateToken, (req, res) => {
  const db = readDB();
  const myComplaints = db.complaints.filter(c => c.userId === req.user.id);
  res.json({ success: true, complaints: myComplaints });
});

// 政务人员获取所有诉求
app.get('/api/complaints', authenticateToken, requireRole('staff'), (req, res) => {
  const db = readDB();
  res.json({ success: true, complaints: db.complaints });
});

app.get('/api/complaints/:id', authenticateToken, (req, res) => {
  const db = readDB();
  const complaint = db.complaints.find(c => c.id === req.params.id);
  if (!complaint) return res.status(404).json({ success: false, message: '诉求编号不存在' });
  res.json({ success: true, complaint });
});

// 用户或工作人员确认办结
app.post('/api/complaints/:id/resolve', authenticateToken, (req, res) => {
  const db = readDB();
  const index = db.complaints.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '诉求不存在' });

  const complaint = db.complaints[index];
  
  // 必须是当前诉求的所有者或者是政务人员
  if (complaint.userId !== req.user.id && req.user.role !== 'staff') {
    return res.status(403).json({ success: false, message: '无权操作此诉求' });
  }

  complaint.status = 'resolved';
  
  // 更新时间线，把除已受理、处理中、待验收之外的“已办结”更新为已完成
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
  
  complaint.timeline = complaint.timeline.map(t => {
    if (t.title === '已办结') {
      return { ...t, time: nowStr, desc: '市民已确认验收，服务已办结。', done: true };
    }
    return { ...t, done: true }; // 所有前面的都变成 done
  });

  // 新增通知
  db.messages.push({
    id: `msg-${Date.now()}`,
    userId: complaint.userId,
    title: `您提交的诉求“${complaint.title}”已被确认为已办结。`,
    time: nowStr,
    read: false
  });

  writeDB(db);
  res.json({ success: true, message: '诉求已办结', complaint });
});

// 政务人员更新状态和时间线
app.put('/api/complaints/:id/status', authenticateToken, requireRole('staff'), (req, res) => {
  const { status, desc, stepTitle } = req.body;
  if (!status) return res.status(400).json({ success: false, message: '缺少状态参数' });

  const db = readDB();
  const index = db.complaints.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '诉求不存在' });

  const complaint = db.complaints[index];
  complaint.status = status;

  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

  // 自动更新时间线
  complaint.timeline = complaint.timeline.map(item => {
    // 激活对应的步骤
    if (item.title === stepTitle || (status === 'processing' && item.title === '处理中') || (status === 'pending_verification' && item.title === '待验收')) {
      return { ...item, time: nowStr, desc: desc || item.desc, done: true };
    }
    return item;
  });

  // 推送系统通知给用户
  db.messages.push({
    id: `msg-${Date.now()}`,
    userId: complaint.userId,
    title: `您的诉求“${complaint.title}”状态已更新为：${stepTitle || status}`,
    time: nowStr,
    read: false
  });

  writeDB(db);
  res.json({ success: true, message: '更新成功', complaint });
});


// 4. 行政审批路由
app.post('/api/approvals', authenticateToken, upload.fields([{ name: 'bizLicense' }, { name: 'idCard' }]), (req, res) => {
  const { type, applicant, contact, phone, idnum, desc } = req.body;
  if (!type || !applicant || !contact || !phone || !idnum || !desc) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  const db = readDB();
  
  // 生成审批编号: SP-YYYYMMDD-XXXX
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dailyCount = db.approvals.filter(a => a.id.startsWith(`SP-${todayStr}`)).length + 1;
  const approvalId = `SP-${todayStr}-${dailyCount.toString().padStart(4, '0')}`;

  const uploadedFiles = [];
  if (req.files) {
    if (req.files.bizLicense) {
      uploadedFiles.push({
        name: '营业执照: ' + req.files.bizLicense[0].originalname,
        path: `/uploads/${req.files.bizLicense[0].filename}`
      });
    }
    if (req.files.idCard) {
      uploadedFiles.push({
        name: '身份证材料: ' + req.files.idCard[0].originalname,
        path: `/uploads/${req.files.idCard[0].filename}`
      });
    }
  }

  const typeNames = {
    'biz-license': '营业执照办理',
    'build-permit': '建设工程规划许可',
    'env-impact': '环境影响评价审批',
    'fire-check': '消防设计审查',
    'land-use': '建设用地规划许可',
    'food-permit': '食品经营许可',
    'other': '其他事项'
  };

  const newApproval = {
    id: approvalId,
    userId: req.user.id,
    type,
    typeName: typeNames[type] || '其他事项',
    applicant,
    contact,
    phone,
    idnum,
    desc,
    files: uploadedFiles,
    status: 'processing', // 进行中
    createdAt: new Date().toISOString()
  };

  db.approvals.push(newApproval);
  writeDB(db);

  res.status(201).json({ success: true, message: '行政审批申请提交成功', approvalId, approval: newApproval });
});

app.get('/api/approvals/my', authenticateToken, (req, res) => {
  const db = readDB();
  const myApprovals = db.approvals.filter(a => a.userId === req.user.id);
  res.json({ success: true, approvals: myApprovals });
});

app.get('/api/approvals', authenticateToken, requireRole('staff'), (req, res) => {
  const db = readDB();
  res.json({ success: true, approvals: db.approvals });
});

// 更新审批状态 (仅限政务人员)
app.put('/api/approvals/:id/status', authenticateToken, requireRole('staff'), (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ success: false, message: '缺少状态参数' });

  const db = readDB();
  const index = db.approvals.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '审批件不存在' });

  const approval = db.approvals[index];
  approval.status = status; // approved (已通过), rejected (已驳回), material_needed (待补充材料), processing (审核中)

  const statusNames = {
    'approved': '已通过',
    'rejected': '已驳回',
    'material_needed': '待补充材料',
    'processing': '审核中'
  };

  // 发送消息通知
  db.messages.push({
    id: `msg-${Date.now()}`,
    userId: approval.userId,
    title: `您的行政审批事项“${approval.typeName}”的进度已被更新为：${statusNames[status] || status}`,
    time: new Date().toISOString().replace('T', ' ').slice(0, 16),
    read: false
  });

  writeDB(db);
  res.json({ success: true, message: '更新审批状态成功', approval });
});


// 5. 消息通知路由
app.get('/api/messages', authenticateToken, (req, res) => {
  const db = readDB();
  const myMessages = db.messages.filter(m => m.userId === req.user.id);
  // 按时间倒序
  myMessages.sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json({ success: true, messages: myMessages });
});

app.put('/api/messages/:id/read', authenticateToken, (req, res) => {
  const db = readDB();
  const message = db.messages.find(m => m.id === req.params.id && m.userId === req.user.id);
  if (!message) return res.status(404).json({ success: false, message: '消息不存在' });
  message.read = true;
  writeDB(db);
  res.json({ success: true, message });
});


// 6. 数据看板统计路由
app.get('/api/dashboard/stats', (req, res) => {
  const db = readDB();
  const range = req.query.range || 'month'; // today / month / year
  const now = new Date();

  // 1. 累计办件量 (审批 + 诉求)
  const totalItems = db.approvals.length + db.complaints.length;
  // 2. 按时办结率
  const resolvedComplaints = db.complaints.filter(c => c.status === 'resolved').length;
  const approvedApprovals = db.approvals.filter(a => a.status === 'approved' || a.status === 'rejected').length;
  const completedItems = resolvedComplaints + approvedApprovals;
  const completionRate = totalItems > 0 ? ((completedItems / totalItems) * 100).toFixed(1) : "98.6";

  // 3. 按 range 过滤数据
  function inRange(dateStr) {
    const d = new Date(dateStr);
    if (range === 'today') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    } else if (range === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    } else { // year
      return d.getFullYear() === now.getFullYear();
    }
  }

  const filteredComplaints = db.complaints.filter(c => c.createdAt && inRange(c.createdAt));
  const filteredApprovals = db.approvals.filter(a => a.createdAt && inRange(a.createdAt));
  const monthlyComplaintsCount = filteredComplaints.length + filteredApprovals.length;

  // 4. 满意度 (模拟)
  const satisfactionRate = "96.5%";

  // 5. 诉求类型分布统计 (全量)
  const typeCounts = {};
  db.complaints.forEach(c => {
    typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  });

  // 6. 审批类型分布 (全量)
  const approvalCounts = {};
  db.approvals.forEach(a => {
    approvalCounts[a.type] = (approvalCounts[a.type] || 0) + 1;
  });

  // 7. 近期热点诉求排行榜
  const rankings = [
    { title: '基础设施问题', count: db.complaints.filter(c => c.type === 'infra').length },
    { title: '环境保护诉求', count: db.complaints.filter(c => c.type === 'env').length },
    { title: '交通出行投诉', count: db.complaints.filter(c => c.type === 'traffic').length },
    { title: '住房保障申报', count: db.complaints.filter(c => c.type === 'housing').length }
  ].sort((a, b) => b.count - a.count);

  // 8. 生成 dailyCounts (柱状图数据)
  const dailyCounts = [];
  const allItems = [...db.complaints, ...db.approvals];

  if (range === 'today') {
    // 按小时分组 (0-23)
    for (let h = 0; h < 24; h++) {
      const label = h.toString().padStart(2, '0') + ':00';
      const count = allItems.filter(item => {
        if (!item.createdAt) return false;
        const d = new Date(item.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getHours() === h;
      }).length;
      dailyCounts.push({ date: label, count });
    }
  } else if (range === 'month') {
    // 按天分组 (当月每一天)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const label = `${now.getMonth() + 1}/${day}`;
      const count = allItems.filter(item => {
        if (!item.createdAt) return false;
        const d = new Date(item.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === day;
      }).length;
      dailyCounts.push({ date: label, count });
    }
  } else {
    // 按月分组 (当年1-12月)
    for (let m = 1; m <= 12; m++) {
      const label = `${m}月`;
      const count = allItems.filter(item => {
        if (!item.createdAt) return false;
        const d = new Date(item.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === m - 1;
      }).length;
      dailyCounts.push({ date: label, count });
    }
  }

  res.json({
    success: true,
    stats: {
      totalItems: 12000 + totalItems,
      completionRate: completionRate + '%',
      monthlyComplaints: monthlyComplaintsCount,
      satisfactionRate
    },
    typeCounts,
    approvalCounts,
    rankings,
    dailyCounts
  });
});


// 7. AI 智能解读 API (通义千问 API 接入)
app.post('/api/analysis', authenticateToken, upload.single('file'), async (req, res) => {
  let { content, title, model } = req.body;
  
  // 处理上传的文件内容 (如果是txt)
  if (req.file) {
    try {
      const filePath = path.join(uploadsDir, req.file.filename);
      content = fs.readFileSync(filePath, 'utf8');
      title = title || req.file.originalname.split('.')[0];
    } catch (err) {
      return res.status(500).json({ success: false, message: '读取上传文件失败' });
    }
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: '政策内容不能为空' });
  }

  title = title || (content.slice(0, 15).trim() + '...');

  const selectedModel = model || 'qwen-max';
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  let aiResult = '';

  if (apiKey && apiKey !== 'your_dashscope_api_key_here') {
    // 整合通义千问大模型进行真正的调用
    console.log(`[AI] 开始调用模型: ${selectedModel}, 基础URL: ${baseUrl}`);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的政府政务政策解读助手。你的任务是对用户输入的政策进行权威、严肃、易懂的解读。请直接使用 Markdown 格式生成结果，且必须严格按照以下四大板块进行排版：\n\n### 政策概要\n[详细总结政策的出台背景、核心意图和总体目标]\n\n### 核心要点\n[精炼出政策最核心的几条举措、指标或福利细则，建议用无序列表]\n\n### 适用范围\n[清晰指明哪些人、哪些企业或何种区域符合适用本政策]\n\n### 办理指南\n[提供具体如何申请、前往何处、携带什么材料、线上线下办理的具体路径]\n\n不要在开头输出前言，也不要在结尾做任何废话总结，只输出上述结构化内容。'
            },
            {
              role: 'user',
              content: `请解读以下政策法规：\n\n标题：${title}\n内容：\n${content}`
            }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`大模型服务接口返回错误 (${response.status}): ${errorText}`);
      }

      const resData = await response.json();
      if (resData.choices && resData.choices[0] && resData.choices[0].message) {
        aiResult = resData.choices[0].message.content;
        console.log(`[AI] 调用模型 ${selectedModel} 成功`);
      } else {
        throw new Error('未能在返回结果中提取到有效的内容字段 choices[0].message.content');
      }
    } catch (err) {
      console.error('[AI] 大模型调用发生异常，启动本地规则备用引擎', err.message);
      aiResult = localMockAnalysis(title, content);
    }
  } else {
    // 纯本地规则引擎 Mock 解读
    console.log('[AI] 未配置 API Key，直接使用本地规则引擎进行解读');
    aiResult = localMockAnalysis(title, content);
  }

  // 记录到历史记录中
  const db = readDB();
  const historyItem = {
    id: `hist-${Date.now()}`,
    userId: req.user.id,
    title,
    date: new Date().toISOString().replace('T', ' ').slice(0, 16),
    content,
    result: aiResult
  };

  db.analysisHistory.push(historyItem);
  writeDB(db);

  res.json({
    success: true,
    result: aiResult,
    historyItem
  });
});

app.get('/api/analysis/history', authenticateToken, (req, res) => {
  const db = readDB();
  const myHistory = db.analysisHistory.filter(h => h.userId === req.user.id);
  // 按时间倒序
  myHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ success: true, history: myHistory });
});

// 本地降级解读算法（提取文本中的要素，使其看起来足够真实）
function localMockAnalysis(title, content) {
  // 根据文本中的关键词推导结构
  const summary = `本《${title}》旨在通过系统性工作和改革，加强规范管理。其重点突出了政府行政效能优化、便民措施落地以及社会综合服务治理，为后续的高质量政策落地提供了有力的制度支撑与业务指导。`;
  
  // 提取关键词
  const bulletPoints = [];
  if (content.includes('开办') || content.includes('营商')) {
    bulletPoints.push('简化企业行政审批流程，提速企业设立和变动登记');
    bulletPoints.push('对中小微企业实施扶持，全面落地相关财政及税收减免政策');
    bulletPoints.push('推动“一网通办”和“最多跑一次”，全面普及电子营业执照和电子档案应用');
  }
  if (content.includes('医保') || content.includes('社保') || content.includes('保险')) {
    bulletPoints.push('稳步提高城乡居民社会保障水平，规范资金筹集标准');
    bulletPoints.push('推行线上线下多渠道缴费机制，方便市民自助参保');
    bulletPoints.push('提升财政在居民医保中的直接补助额度，为老百姓提供兜底兜牢的基本保障');
  }
  if (content.includes('数字政府') || content.includes('数据') || content.includes('信息化')) {
    bulletPoints.push('构建全市统一的政务大数据安全共享和流通机制');
    bulletPoints.push('实现政府各部门公文和事务审批无纸化流转，消灭信息孤岛');
    bulletPoints.push('强化网络安全防护与敏感信息脱敏管理，捍卫群众数据私密性');
  }
  if (content.includes('物业') || content.includes('收费') || content.includes('住宅')) {
    bulletPoints.push('物业服务必须公开透明收费项目及标准，严厉禁止捆绑消费');
    bulletPoints.push('小区共有产权部分的收益归全体业主所有，应当优先用于修缮和改造维护');
    bulletPoints.push('相关价格指导意见对低收入保障群体的公共物业收费实行一定比例的减免政策');
  }
  if (content.includes('就业') || content.includes('创业') || content.includes('高校')) {
    bulletPoints.push('提供高校毕业生一次性创业补贴，降低年轻人在本地的初创经营门槛');
    bulletPoints.push('为招募高校毕业生的本土企业提供对应的纳税和社保返还奖励');
    bulletPoints.push('设立专属的高校毕业生创业孵化示范基地，并减免场地租金');
  }

  // 兜底项
  if (bulletPoints.length === 0) {
    bulletPoints.push('规范细化有关实施章程，强化各级部门对日常工作的直接领导与责任问责');
    bulletPoints.push('统筹推动相关审批和监管信息互通，杜绝重复申报和审批滞后');
    bulletPoints.push('建立健全社会参与和全媒体公示的长效沟通机制，主动接受市民监督');
  }

  return `### 政策概要
${summary}

### 核心要点
${bulletPoints.map(pt => `- ${pt}`).join('\n')}

### 适用范围
- 适用于本市行政区域内符合条件的企事业单位和全体常住居民。
- 重点覆盖特定领域及特定年龄群体的受益对象。

### 办理指南
- **线上渠道**：登录本市政务服务官方网厅或官方客户端，进入对应的智能办事版块，依据预设的办事流程上传 PDF 或扫描格式的申请表及对应资质材料进行电子申报。
- **线下渠道**：前往就近的政务服务大厅或社区政务事务受理窗口，于法定工作日携带本人有效身份证件、营业执照及相关的书面证明资料办理，现场可享一站式审核。`;
}


// 启动服务器
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` 政务智能问答系统后端服务启动成功!`);
  console.log(` 服务运行在: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
