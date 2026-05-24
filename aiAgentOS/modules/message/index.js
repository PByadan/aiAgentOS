module.exports = {
  name: 'message',
  version: '1.0.0',
  description: '消息通知模块 — 站内消息推送与管理',

  init(app, context) {
    const { db, events, middleware } = context;
    const { authenticateToken } = middleware;

    // 获取当前用户消息
    app.get('/api/messages', authenticateToken, (req, res) => {
      const myMessages = db.query('messages', m => m.userId === req.user.id);
      myMessages.sort((a, b) => new Date(b.time) - new Date(a.time));
      res.json({ success: true, messages: myMessages });
    });

    // 标记消息已读
    app.put('/api/messages/:id/read', authenticateToken, (req, res) => {
      const message = db.findById('messages', req.params.id);
      if (!message || message.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: '消息不存在' });
      }
      db.updateInCollection('messages', req.params.id, { read: true });
      res.json({ success: true, message: db.findById('messages', req.params.id) });
    });

    // 通过事件总线自动生成消息通知
    events.on('complaint:status-changed', (data) => {
      db.addToCollection('messages', {
        id: `msg-${Date.now()}`,
        userId: data.userId,
        title: `您的诉求"${data.title}"状态已更新为：${data.stepTitle || data.status}`,
        time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        read: false
      });
    });

    events.on('complaint:resolved', (data) => {
      db.addToCollection('messages', {
        id: `msg-${Date.now()}`,
        userId: data.userId,
        title: `您提交的诉求"${data.title}"已被确认为已办结。`,
        time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        read: false
      });
    });

    events.on('approval:status-changed', (data) => {
      db.addToCollection('messages', {
        id: `msg-${Date.now()}`,
        userId: data.userId,
        title: `您的行政审批事项"${data.typeName}"的进度已被更新为：${data.statusName}`,
        time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        read: false
      });
    });
  },

  getRoutes() {
    return [
      { method: 'GET', path: '/api/messages', auth: true },
      { method: 'PUT', path: '/api/messages/:id/read', auth: true }
    ];
  },

  getMetadata() {
    return { category: '通信', icon: 'bell' };
  }
};
