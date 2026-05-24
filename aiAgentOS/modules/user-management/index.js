const { hashPassword } = require('../auth');

module.exports = {
  name: 'user-management',
  version: '1.0.0',
  description: '用户管理模块 — 后台用户增删改查、角色分配、密码重置',

  init(app, context) {
    const { db, middleware } = context;
    const { authenticateToken, requireRole } = middleware;

    // 获取所有用户（分页、筛选）
    app.get('/api/admin/users', authenticateToken, requireRole('staff'), (req, res) => {
      const { keyword, role, page, limit } = req.query;
      let users = db.getCollection('users');

      if (role && role !== 'all') {
        users = users.filter(u => u.role === role);
      }
      if (keyword) {
        const kw = keyword.toLowerCase();
        users = users.filter(u =>
          (u.name && u.name.toLowerCase().includes(kw)) ||
          (u.phone && u.phone.includes(kw))
        );
      }

      const total = users.length;
      const pageSize = parseInt(limit) || 10;
      const currentPage = parseInt(page) || 1;
      const startIndex = (currentPage - 1) * pageSize;
      const paginated = users.slice(startIndex, startIndex + pageSize).map(u => {
        const { passwordHash, ...rest } = u;
        return rest;
      });

      res.json({ success: true, total, page: currentPage, limit: pageSize, users: paginated });
    });

    // 获取单个用户
    app.get('/api/admin/users/:id', authenticateToken, requireRole('staff'), (req, res) => {
      const user = db.findById('users', req.params.id);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
      const { passwordHash, ...rest } = user;
      res.json({ success: true, user: rest });
    });

    // 更新用户信息
    app.put('/api/admin/users/:id', authenticateToken, requireRole('staff'), (req, res) => {
      const { name, gender, email, idnum, address, role, disabled } = req.body;
      const user = db.findById('users', req.params.id);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

      const updated = db.updateInCollection('users', req.params.id, {
        ...(name !== undefined && { name }),
        ...(gender !== undefined && { gender }),
        ...(email !== undefined && { email }),
        ...(idnum !== undefined && { idnum }),
        ...(address !== undefined && { address }),
        ...(role !== undefined && { role }),
        ...(disabled !== undefined && { disabled })
      });

      const { passwordHash, ...rest } = updated;
      res.json({ success: true, message: '用户信息更新成功', user: rest });
    });

    // 禁用/启用用户
    app.put('/api/admin/users/:id/toggle', authenticateToken, requireRole('staff'), (req, res) => {
      const user = db.findById('users', req.params.id);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

      const newDisabled = !user.disabled;
      db.updateInCollection('users', req.params.id, { disabled: newDisabled });

      res.json({
        success: true,
        message: newDisabled ? '用户已禁用' : '用户已启用',
        disabled: newDisabled
      });
    });

    // 重置密码
    app.post('/api/admin/users/:id/reset-password', authenticateToken, requireRole('staff'), (req, res) => {
      const user = db.findById('users', req.params.id);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

      const tempPassword = Math.random().toString(36).slice(-8);
      db.updateInCollection('users', req.params.id, {
        passwordHash: hashPassword(tempPassword)
      });

      res.json({ success: true, message: '密码重置成功', tempPassword });
    });

    // 分配角色
    app.put('/api/admin/users/:id/role', authenticateToken, requireRole('staff'), (req, res) => {
      const { role } = req.body;
      if (!role) return res.status(400).json({ success: false, message: '缺少角色参数' });

      const validRoles = db.getCollection('roles').map(r => r.name);
      if (validRoles.length > 0 && !validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: '无效的角色' });
      }

      const user = db.findById('users', req.params.id);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

      db.updateInCollection('users', req.params.id, { role });
      res.json({ success: true, message: '角色分配成功' });
    });
  },

  getRoutes() {
    return [
      { method: 'GET', path: '/api/admin/users', auth: true, role: 'staff' },
      { method: 'GET', path: '/api/admin/users/:id', auth: true, role: 'staff' },
      { method: 'PUT', path: '/api/admin/users/:id', auth: true, role: 'staff' },
      { method: 'PUT', path: '/api/admin/users/:id/toggle', auth: true, role: 'staff' },
      { method: 'POST', path: '/api/admin/users/:id/reset-password', auth: true, role: 'staff' },
      { method: 'PUT', path: '/api/admin/users/:id/role', auth: true, role: 'staff' }
    ];
  },

  getMetadata() {
    return { category: '管理', icon: 'users' };
  }
};
