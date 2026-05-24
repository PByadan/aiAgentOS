module.exports = {
  id: 'data-agent',
  name: 'Data Agent',
  version: '1.0.0',
  description: '数据分析 Agent，提供统计分析、数据导出、趋势计算',
  category: 'data',

  async execute(input, context) {
    const { action, collection, format } = input;
    const { store } = context;

    if (action === 'stats') {
      const users = store.all('users');
      const agents = store.all('agents');
      const tasks = store.all('tasks');
      const logs = store.all('logs');

      return {
        users: { total: users.length, active: users.filter(u => !u.disabled).length },
        agents: { total: agents.length, enabled: agents.filter(a => a.enabled).length },
        tasks: {
          total: tasks.length,
          pending: tasks.filter(t => t.status === 'pending').length,
          completed: tasks.filter(t => t.status === 'completed').length
        },
        logs: { total: logs.length }
      };
    }

    if (action === 'export') {
      const data = store.all(collection || 'users');
      if (format === 'csv') {
        if (data.length === 0) return { csv: '' };
        const headers = [...new Set(data.flatMap(Object.keys))];
        const rows = data.map(r => headers.map(h => {
          const v = r[h] == null ? '' : String(r[h]);
          return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(','));
        return { csv: [headers.join(','), ...rows].join('\n'), count: data.length };
      }
      return { data, count: data.length };
    }

    if (action === 'trend') {
      const logs = store.all('logs');
      const now = new Date();
      const hours = {};
      logs.forEach(l => {
        const d = new Date(l.time);
        if (d.toDateString() === now.toDateString()) {
          const h = d.getHours().toString().padStart(2, '0') + ':00';
          hours[h] = (hours[h] || 0) + 1;
        }
      });
      const trend = Array.from({ length: 24 }, (_, i) => {
        const label = i.toString().padStart(2, '0') + ':00';
        return { hour: label, count: hours[label] || 0 };
      });
      return { trend, total: logs.length };
    }

    return { error: 'Unknown action. Use: stats, export, trend' };
  }
};
