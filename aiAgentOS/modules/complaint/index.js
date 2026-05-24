module.exports = {
  name: 'complaint',
  version: '1.0.0',
  description: '民生诉求模块 — 提交、查询、处理、办结诉求',

  init(app, context) {
    const { db, middleware } = context;
    const { authenticateToken, requireRole } = middleware;
    const upload = context.multer;

    // 提交诉求
    app.post('/api/complaints', authenticateToken, upload.array('files'), (req, res) => {
      const { type, title, detail, address } = req.body;
      if (!type || !title || !detail) {
        return res.status(400).json({ success: false, message: '缺少必填字段' });
      }

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const existingToday = db.query('complaints', c => c.id.startsWith(`TS-${todayStr}`));
      const dailyCount = existingToday.length + 1;
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
        status: 'pending_acceptance',
        createdAt: new Date().toISOString(),
        timeline: [
          {
            title: '已受理',
            time: new Date().toISOString().replace('T', ' ').slice(0, 16),
            desc: `诉求已分配至${type === 'infra' ? '住建局' : type === 'env' ? '环保局' : type === 'traffic' ? '交通局' : '民政局'}处理`,
            done: true
          },
          { title: '处理中', time: '—', desc: '正在等待相关部门派发和处理', done: false },
          { title: '待验收', time: '—', desc: '', done: false },
          { title: '已办结', time: '—', desc: '', done: false }
        ]
      };

      db.addToCollection('complaints', newComplaint);
      context.events.emit('complaint:created', { complaint: newComplaint });
      res.status(201).json({ success: true, message: '诉求提交成功', complaintId, complaint: newComplaint });
    });

    // 当前用户的诉求列表
    app.get('/api/complaints/my', authenticateToken, (req, res) => {
      const myComplaints = db.query('complaints', c => c.userId === req.user.id);
      res.json({ success: true, complaints: myComplaints });
    });

    // 政务人员获取所有诉求
    app.get('/api/complaints', authenticateToken, requireRole('staff'), (req, res) => {
      res.json({ success: true, complaints: db.getCollection('complaints') });
    });

    // 获取单条诉求详情
    app.get('/api/complaints/:id', authenticateToken, (req, res) => {
      const complaint = db.findById('complaints', req.params.id);
      if (!complaint) return res.status(404).json({ success: false, message: '诉求编号不存在' });
      res.json({ success: true, complaint });
    });

    // 确认办结
    app.post('/api/complaints/:id/resolve', authenticateToken, (req, res) => {
      const complaint = db.findById('complaints', req.params.id);
      if (!complaint) return res.status(404).json({ success: false, message: '诉求不存在' });

      if (complaint.userId !== req.user.id && req.user.role !== 'staff') {
        return res.status(403).json({ success: false, message: '无权操作此诉求' });
      }

      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
      const updatedTimeline = complaint.timeline.map(t => {
        if (t.title === '已办结') {
          return { ...t, time: nowStr, desc: '市民已确认验收，服务已办结。', done: true };
        }
        return { ...t, done: true };
      });

      db.updateInCollection('complaints', req.params.id, {
        status: 'resolved',
        timeline: updatedTimeline
      });

      context.events.emit('complaint:resolved', {
        complaintId: req.params.id,
        userId: complaint.userId,
        title: complaint.title
      });

      const updated = db.findById('complaints', req.params.id);
      res.json({ success: true, message: '诉求已办结', complaint: updated });
    });

    // 政务人员更新状态
    app.put('/api/complaints/:id/status', authenticateToken, requireRole('staff'), (req, res) => {
      const { status, desc, stepTitle } = req.body;
      if (!status) return res.status(400).json({ success: false, message: '缺少状态参数' });

      const complaint = db.findById('complaints', req.params.id);
      if (!complaint) return res.status(404).json({ success: false, message: '诉求不存在' });

      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const updatedTimeline = complaint.timeline.map(item => {
        if (item.title === stepTitle ||
            (status === 'processing' && item.title === '处理中') ||
            (status === 'pending_verification' && item.title === '待验收')) {
          return { ...item, time: nowStr, desc: desc || item.desc, done: true };
        }
        return item;
      });

      db.updateInCollection('complaints', req.params.id, {
        status,
        timeline: updatedTimeline
      });

      context.events.emit('complaint:status-changed', {
        complaintId: req.params.id,
        userId: complaint.userId,
        title: complaint.title,
        status,
        stepTitle
      });

      const updated = db.findById('complaints', req.params.id);
      res.json({ success: true, message: '更新成功', complaint: updated });
    });
  },

  getRoutes() {
    return [
      { method: 'POST', path: '/api/complaints', auth: true },
      { method: 'GET', path: '/api/complaints/my', auth: true },
      { method: 'GET', path: '/api/complaints', auth: true, role: 'staff' },
      { method: 'GET', path: '/api/complaints/:id', auth: true },
      { method: 'POST', path: '/api/complaints/:id/resolve', auth: true },
      { method: 'PUT', path: '/api/complaints/:id/status', auth: true, role: 'staff' }
    ];
  },

  getMetadata() {
    return { category: '业务', icon: 'message-square' };
  }
};
