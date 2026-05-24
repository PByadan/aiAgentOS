module.exports = {
  name: 'policy',
  version: '1.0.0',
  description: '政策法规模块 — 发布、查询、编辑、删除政策',

  init(app, context) {
    const { db, middleware } = context;
    const { authenticateToken, requireRole } = middleware;

    // 获取政策分类统计
    app.get('/api/policies/categories', (req, res) => {
      const policies = db.getCollection('policies');
      const counts = { '全部': policies.length };
      policies.forEach(p => {
        counts[p.category] = (counts[p.category] || 0) + 1;
      });
      res.json({ success: true, counts });
    });

    // 获取政策列表（支持筛选、分页）
    app.get('/api/policies', (req, res) => {
      const { category, year, status, keyword, limit, page } = req.query;
      let filtered = [...db.getCollection('policies')];

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
        filtered = filtered.filter(p =>
          p.title.toLowerCase().includes(kw) || p.summary.toLowerCase().includes(kw)
        );
      }

      filtered.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

      const total = filtered.length;
      const pageSize = parseInt(limit) || 5;
      const currentPage = parseInt(page) || 1;
      const startIndex = (currentPage - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);

      res.json({ success: true, total, page: currentPage, limit: pageSize, policies: paginated });
    });

    // 获取单条政策
    app.get('/api/policies/:id', (req, res) => {
      const policy = db.findById('policies', req.params.id);
      if (!policy) return res.status(404).json({ success: false, message: '政策法规不存在' });
      res.json({ success: true, policy });
    });

    // 创建政策（仅政务人员）
    app.post('/api/policies', authenticateToken, requireRole('staff'), (req, res) => {
      const { title, summary, content, category, year, status, department } = req.body;
      if (!title || !content || !category) {
        return res.status(400).json({ success: false, message: '缺少必填字段' });
      }

      const newPolicy = {
        id: db.getNextId('policies'),
        title,
        summary: summary || content.slice(0, 100) + '...',
        content,
        category,
        year: year || new Date().getFullYear().toString(),
        status: status || '已发布',
        publishDate: new Date().toISOString().split('T')[0],
        department: department || req.user.name
      };

      db.addToCollection('policies', newPolicy);
      context.events.emit('policy:created', { policy: newPolicy });
      res.status(201).json({ success: true, message: '政策法规发布成功', policy: newPolicy });
    });

    // 更新政策
    app.put('/api/policies/:id', authenticateToken, requireRole('staff'), (req, res) => {
      const { title, summary, content, category, year, status, department } = req.body;
      const existing = db.findById('policies', req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: '政策法规不存在' });

      const updated = db.updateInCollection('policies', req.params.id, {
        ...(title !== undefined && { title }),
        ...(summary !== undefined && { summary }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(year !== undefined && { year }),
        ...(status !== undefined && { status }),
        ...(department !== undefined && { department })
      });

      context.events.emit('policy:updated', { policy: updated });
      res.json({ success: true, message: '政策法规更新成功', policy: updated });
    });

    // 删除政策
    app.delete('/api/policies/:id', authenticateToken, requireRole('staff'), (req, res) => {
      const deleted = db.deleteFromCollection('policies', req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: '政策法规不存在' });

      context.events.emit('policy:deleted', { policyId: req.params.id });
      res.json({ success: true, message: '政策法规删除成功' });
    });
  },

  getRoutes() {
    return [
      { method: 'GET', path: '/api/policies/categories', auth: false },
      { method: 'GET', path: '/api/policies', auth: false },
      { method: 'GET', path: '/api/policies/:id', auth: false },
      { method: 'POST', path: '/api/policies', auth: true, role: 'staff' },
      { method: 'PUT', path: '/api/policies/:id', auth: true, role: 'staff' },
      { method: 'DELETE', path: '/api/policies/:id', auth: true, role: 'staff' }
    ];
  },

  getMetadata() {
    return { category: '业务', icon: 'file-text' };
  }
};
