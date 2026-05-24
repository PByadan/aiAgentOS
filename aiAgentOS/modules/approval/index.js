module.exports = {
  name: 'approval',
  version: '1.0.0',
  description: '行政审批模块 — 提交申请、审批管理',

  init(app, context) {
    const { db, middleware } = context;
    const { authenticateToken, requireRole } = middleware;
    const upload = context.multer;

    const typeNames = {
      'biz-license': '营业执照办理',
      'build-permit': '建设工程规划许可',
      'env-impact': '环境影响评价审批',
      'fire-check': '消防设计审查',
      'land-use': '建设用地规划许可',
      'food-permit': '食品经营许可',
      'other': '其他事项'
    };

    // 提交审批
    app.post('/api/approvals', authenticateToken, upload.fields([
      { name: 'bizLicense' }, { name: 'idCard' }
    ]), (req, res) => {
      const { type, applicant, contact, phone, idnum, desc } = req.body;
      if (!type || !applicant || !contact || !phone || !idnum || !desc) {
        return res.status(400).json({ success: false, message: '缺少必填字段' });
      }

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const existingToday = db.query('approvals', a => a.id.startsWith(`SP-${todayStr}`));
      const dailyCount = existingToday.length + 1;
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
        status: 'processing',
        createdAt: new Date().toISOString()
      };

      db.addToCollection('approvals', newApproval);
      context.events.emit('approval:submitted', { approval: newApproval });
      res.status(201).json({ success: true, message: '行政审批申请提交成功', approvalId, approval: newApproval });
    });

    // 当前用户的审批列表
    app.get('/api/approvals/my', authenticateToken, (req, res) => {
      const myApprovals = db.query('approvals', a => a.userId === req.user.id);
      res.json({ success: true, approvals: myApprovals });
    });

    // 政务人员获取所有审批
    app.get('/api/approvals', authenticateToken, requireRole('staff'), (req, res) => {
      res.json({ success: true, approvals: db.getCollection('approvals') });
    });

    // 更新审批状态
    app.put('/api/approvals/:id/status', authenticateToken, requireRole('staff'), (req, res) => {
      const { status } = req.body;
      if (!status) return res.status(400).json({ success: false, message: '缺少状态参数' });

      const approval = db.findById('approvals', req.params.id);
      if (!approval) return res.status(404).json({ success: false, message: '审批件不存在' });

      db.updateInCollection('approvals', req.params.id, { status });

      const statusNames = {
        'approved': '已通过',
        'rejected': '已驳回',
        'material_needed': '待补充材料',
        'processing': '审核中'
      };

      context.events.emit('approval:status-changed', {
        approvalId: req.params.id,
        userId: approval.userId,
        typeName: approval.typeName,
        status,
        statusName: statusNames[status] || status
      });

      const updated = db.findById('approvals', req.params.id);
      res.json({ success: true, message: '更新审批状态成功', approval: updated });
    });
  },

  getRoutes() {
    return [
      { method: 'POST', path: '/api/approvals', auth: true },
      { method: 'GET', path: '/api/approvals/my', auth: true },
      { method: 'GET', path: '/api/approvals', auth: true, role: 'staff' },
      { method: 'PUT', path: '/api/approvals/:id/status', auth: true, role: 'staff' }
    ];
  },

  getMetadata() {
    return { category: '业务', icon: 'check-square' };
  }
};
