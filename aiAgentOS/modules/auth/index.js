const crypto = require('crypto');

// 密码哈希工具（加盐 SHA-256）
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const [salt] = stored.split(':');
  return hashPassword(password, salt) === stored;
}

module.exports = {
  name: 'auth',
  version: '1.0.0',
  description: '用户认证模块 — 注册、登录、个人信息管理',

  init(app, context) {
    const { db, config, middleware } = context;
    const { authenticateToken } = middleware;
    const jwt = context.jwt;

    // 注册
    app.post('/api/auth/register', (req, res) => {
      const { name, phone, password, role } = req.body;
      if (!name || !phone || !password || !role) {
        return res.status(400).json({ success: false, message: '缺少必填字段' });
      }

      const allUsers = db.getCollection('users');
      const existingUser = allUsers.find(u => u.phone === phone);
      if (existingUser) {
        return res.status(400).json({ success: false, message: '该手机号已注册' });
      }

      const newUser = {
        id: db.getNextId('users'),
        name,
        phone,
        passwordHash: hashPassword(password),
        role,
        gender: '男',
        email: '',
        idnum: '',
        address: '',
        disabled: false,
        createdAt: new Date().toISOString()
      };

      db.addToCollection('users', newUser);

      const token = jwt.sign(
        { id: newUser.id, name: newUser.name, phone: newUser.phone, role: newUser.role },
        config.JWT_SECRET,
        { expiresIn: '7d' }
      );

      context.events.emit('auth:register', { user: newUser });

      const { passwordHash, ...userResponse } = newUser;
      res.status(201).json({ success: true, message: '注册成功', token, user: userResponse });
    });

    // 登录
    app.post('/api/auth/login', (req, res) => {
      const { phone, password, role } = req.body;
      if (!phone || !password || !role) {
        return res.status(400).json({ success: false, message: '缺少手机号、密码或角色' });
      }

      const user = db.getCollection('users').find(u => u.phone === phone && u.role === role);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(400).json({ success: false, message: '手机号或密码错误' });
      }

      if (user.disabled) {
        return res.status(403).json({ success: false, message: '该账号已被禁用' });
      }

      const token = jwt.sign(
        { id: user.id, name: user.name, phone: user.phone, role: user.role },
        config.JWT_SECRET,
        { expiresIn: '7d' }
      );

      context.events.emit('auth:login', { user: { id: user.id, name: user.name } });

      const { passwordHash, ...userResponse } = user;
      res.json({ success: true, message: '登录成功', token, user: userResponse });
    });

    // 获取当前用户
    app.get('/api/auth/me', authenticateToken, (req, res) => {
      const user = db.findById('users', req.user.id);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

      const { passwordHash, ...userResponse } = user;
      res.json({ success: true, user: userResponse });
    });

    // 修改个人信息
    app.put('/api/auth/profile', authenticateToken, (req, res) => {
      const { name, gender, email, idnum, address } = req.body;
      const updated = db.updateInCollection('users', req.user.id, {
        ...(name && { name }),
        ...(gender && { gender }),
        ...(email !== undefined && { email }),
        ...(idnum !== undefined && { idnum }),
        ...(address !== undefined && { address })
      });

      if (!updated) return res.status(404).json({ success: false, message: '用户不存在' });

      const { passwordHash, ...userResponse } = updated;
      res.json({ success: true, message: '个人信息修改成功', user: userResponse });
    });

    // 修改账户设置（手机号、密码）
    app.put('/api/auth/settings', authenticateToken, (req, res) => {
      const { phone, currentPassword, newPassword } = req.body;
      const user = db.findById('users', req.user.id);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

      if (phone) {
        const phoneExists = db.getCollection('users').some(u => u.phone === phone && u.id !== req.user.id);
        if (phoneExists) {
          return res.status(400).json({ success: false, message: '该手机号已被其他账号绑定' });
        }
        db.updateInCollection('users', req.user.id, { phone });
      }

      if (currentPassword && newPassword) {
        if (!verifyPassword(currentPassword, user.passwordHash)) {
          return res.status(400).json({ success: false, message: '当前密码输入错误' });
        }
        db.updateInCollection('users', req.user.id, { passwordHash: hashPassword(newPassword) });
      }

      res.json({ success: true, message: '账户设置更新成功' });
    });
  },

  getRoutes() {
    return [
      { method: 'POST', path: '/api/auth/register', auth: false },
      { method: 'POST', path: '/api/auth/login', auth: false },
      { method: 'GET', path: '/api/auth/me', auth: true },
      { method: 'PUT', path: '/api/auth/profile', auth: true },
      { method: 'PUT', path: '/api/auth/settings', auth: true }
    ];
  },

  getMetadata() {
    return { category: '认证', icon: 'lock' };
  }
};

// 导出工具函数供其他模块使用
module.exports.hashPassword = hashPassword;
module.exports.verifyPassword = verifyPassword;
