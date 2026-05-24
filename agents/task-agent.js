module.exports = {
  id: 'task-agent',
  name: 'Task Agent',
  version: '1.0.0',
  description: '任务调度 Agent，支持创建、执行、跟踪异步任务',
  category: 'system',

  async execute(input, context) {
    const { action, taskName, taskData } = input;
    const { store, events } = context;

    if (action === 'create') {
      const task = {
        id: store.nextId('tasks'),
        name: taskName || 'unnamed-task',
        data: taskData || {},
        status: 'pending',
        result: null,
        createdAt: new Date().toISOString()
      };
      store.insert('tasks', task);
      events.emit('task:created', { taskId: task.id, name: task.name });

      // 模拟异步执行
      setTimeout(() => {
        store.update('tasks', task.id, {
          status: 'completed',
          result: { message: `Task "${task.name}" completed successfully` },
          completedAt: new Date().toISOString()
        });
        events.emit('task:completed', { taskId: task.id, name: task.name });
      }, 2000);

      return { taskId: task.id, status: 'pending', message: `Task "${task.name}" created and queued` };
    }

    if (action === 'list') {
      const tasks = store.all('tasks');
      return { tasks, total: tasks.length };
    }

    if (action === 'status') {
      const task = store.find('tasks', taskData?.taskId);
      if (!task) return { error: 'Task not found' };
      return task;
    }

    return { error: 'Unknown action. Use: create, list, status' };
  }
};
