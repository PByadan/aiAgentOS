module.exports = {
  name: 'role-permission',
  version: '1.0.0',
  description: '角色权限管理模块 — 角色CRUD、权限定义、权限分配',

  init(app, context) {
    const { db, middleware } = context;
    const { authenticateToken, requireRole } = middleware;

    // 获取所有角色
    app.get('/api/admin/roles', authenticateToken, requireRole('staff'), (req, res) => {
      const roles = db.getCollection('roles');
      const users = db.getCollection('users');

      const rolesWithCount = roles.map(r => ({
        ...r,
        userCount: users.filter(u => u.role === r.name).length
      }));

      res.json({ success: true, roles: rolesWithCount });
    });

    // 创建角色
    app.post('/api/admin/roles', authenticateToken, requireRole('staff'), (req, res) => {
      const { name, label } = req.body;
      if (!name || !label) {
        return res.status(400).json({ success: false, message: '缺少角色名称或标签' });
      }

      const roles = db.getCollection('roles');
      if (roles.find(r => r.name === name)) {
        return res.status(400).json({ success: false, message: '角色已存在' });
      }

      const newRole = { name, label, system: false };
      db.addToCollection('roles', newRole);

      // 初始化空权限
      const data = db.read();
      if (!data.rolePermissions) data.rolePermissions = {};
      data.rolePermissions[name] = [];
      db.write(data);

      res.status(201).json({ success: true, message: '角色创建成功', role: newRole });
    });

    // 更新角色
    app.put('/api/admin/roles/:name', authenticateToken, requireRole('staff'), (req, res) => {
      const { label } = req.body;
      const roles = db.getCollection('roles');
      const roleIndex = roles.findIndex(r => r.name === req.params.name);
      if (roleIndex === -1) return res.status(404).json({ success: false, message: '角色不存在' });

      if (roles[roleIndex].system) {
        return res.status(400).json({ success: false, message: '系统角色不可修改' });
      }

      if (label) {
        db.updateInCollection('roles', roles[roleIndex].id, { label });
      }

      res.json({ success: true, message: '角色更新成功' });
    });

    // 删除角色
    app.delete('/api/admin/roles/:name', authenticateToken, requireRole('staff'), (req, res) => {
      const roles = db.getCollection('roles');
      const role = roles.find(r => r.name === req.params.name);
      if (!role) return res.status(404).json({ success: false, message: '角色不存在' });

      if (role.system) {
        return res.status(400).json({ success: false, message: '系统角色不可删除' });
      }

      // 检查是否有用户使用该角色
      const usersWithRole = db.query('users', u => u.role === req.params.name);
      if (usersWithRole.length > 0) {
        return res.status(400).json({ success: false, message: `还有 ${usersWithRole.length} 个用户使用此角色` });
      }

      db.deleteFromCollection('roles', role.id);

      const data = db.read();
      delete data.rolePermissions[req.params.name];
      db.write(data);

      res.json({ success: true, message: '角色删除成功' });
    });

    // 获取所有权限定义
    app.get('/api/admin/permissions', authenticateToken, requireRole('staff'), (req, res) => {
      const permissions = db.getCollection('permissions');
      const rolePermissions = db.read().rolePermissions || {};
      res.json({ success: true, permissions, rolePermissions });
    });

    // 获取指定角色的权限
    app.get('/api/admin/roles/:name/permissions', authenticateToken, requireRole('staff'), (req, res) => {
      const data = db.read();
      const perms = (data.rolePermissions || {})[req.params.name] || [];
      res.json({ success: true, role: req.params.name, permissions: perms });
    });

    // 设置角色权限
    app.put('/api/admin/roles/:name/permissions', authenticateToken, requireRole('staff'), (req, res) => {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: 'permissions 必须是数组' });
      }

      const data = db.read();
      if (!data.rolePermissions) data.rolePermissions = {};
      data.rolePermissions[req.params.name] = permissions;
      db.write(data);

      res.json({ success: true, message: '权限更新成功' });
    });
  },

  getRoutes() {
    return [
      { method: 'GET', path: '/api/admin/roles', auth: true, role: 'staff' },
      { method: 'POST', path: '/api/admin/roles', auth: true, role: 'staff' },
      { method: 'PUT', path: '/api/admin/roles/:name', auth: true, role: 'staff' },
      { method: 'DELETE', path: '/api/admin/roles/:name', auth: true, role: 'staff' },
      { method: 'GET', path: '/api/admin/permissions', auth: true, role: 'staff' },
      { method: 'GET', path: '/api/admin/roles/:name/permissions', auth: true, role: 'staff' },
      { method: 'PUT', path: '/api/admin/roles/:name/permissions', auth: true, role: 'staff' }
    ];
  },

  getMetadata() {
    return { category: '管理', icon: 'shield' };
  }
};
