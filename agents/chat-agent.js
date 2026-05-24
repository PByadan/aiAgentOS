module.exports = {
  id: 'chat-agent',
  name: 'Chat Agent',
  version: '1.0.0',
  description: '对话式 AI Agent，支持多轮对话和上下文记忆',
  category: 'ai',

  async execute(input, context) {
    const { message, conversationId } = input;
    const { store, events } = context;

    // 获取或创建对话历史
    let conv = conversationId ? store.find('conversations', conversationId) : null;
    if (!conv) {
      conv = {
        id: store.nextId('conversations'),
        messages: [],
        createdAt: new Date().toISOString()
      };
      store.insert('conversations', conv);
    }

    // 添加用户消息
    conv.messages.push({ role: 'user', content: message, time: new Date().toISOString() });

    // 调用 AI（支持 DashScope 或本地回复）
    let reply;
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (apiKey) {
      try {
        const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'qwen-turbo',
            messages: conv.messages.map(m => ({ role: m.role, content: m.content }))
          })
        });
        const data = await resp.json();
        reply = data.choices?.[0]?.message?.content || '抱歉，无法生成回复。';
      } catch { reply = localReply(message); }
    } else {
      reply = localReply(message);
    }

    conv.messages.push({ role: 'assistant', content: reply, time: new Date().toISOString() });
    store.update('conversations', conv.id, { messages: conv.messages, updatedAt: new Date().toISOString() });

    events.emit('chat:reply', { conversationId: conv.id, message: reply });
    return { conversationId: conv.id, reply, messageCount: conv.messages.length };
  }
};

function localReply(msg) {
  const m = msg.toLowerCase();
  if (m.includes('你好') || m.includes('hello') || m.includes('hi')) return '你好！我是 aiAgentOS 内置的 Chat Agent，有什么可以帮助你的？';
  if (m.includes('帮助') || m.includes('help')) return '我可以帮你：\n- 回答问题\n- 分析数据\n- 执行任务\n\n你可以直接输入你的需求。';
  if (m.includes('模块') || m.includes('agent')) return 'aiAgentOS 内置了多个 Agent：\n- Chat Agent：对话交互\n- Task Agent：任务执行\n- Data Agent：数据分析\n\n所有 Agent 都通过注册中心统一管理。';
  return `收到你的消息："${msg}"。这是一个本地模拟回复。配置 DASHSCOPE_API_KEY 后将使用通义千问大模型进行智能回复。`;
}
