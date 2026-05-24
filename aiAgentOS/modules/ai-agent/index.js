const fs = require('fs');
const path = require('path');

// 本地降级解读引擎
function localMockAnalysis(title, content) {
  const summary = `本《${title}》旨在通过系统性工作和改革，加强规范管理。其重点突出了政府行政效能优化、便民措施落地以及社会综合服务治理，为后续的高质量政策落地提供了有力的制度支撑与业务指导。`;

  const bulletPoints = [];
  if (content.includes('开办') || content.includes('营商')) {
    bulletPoints.push('简化企业行政审批流程，提速企业设立和变动登记');
    bulletPoints.push('对中小微企业实施扶持，全面落地相关财政及税收减免政策');
    bulletPoints.push('推动"一网通办"和"最多跑一次"，全面普及电子营业执照和电子档案应用');
  }
  if (content.includes('医保') || content.includes('社保') || content.includes('保险')) {
    bulletPoints.push('稳步提高城乡居民社会保障水平，规范资金筹集标准');
    bulletPoints.push('推行线上线下多渠道缴费机制，方便市民自助参保');
    bulletPoints.push('提升财政在居民医保中的直接补助额度，为老百姓提供兜底兜牢的基本保障');
  }
  if (content.includes('数字政府') || content.includes('数据') || content.includes('信息化')) {
    bulletPoints.push('构建全市统一的政务大数据安全共享和流通机制');
    bulletPoints.push('实现政府各部门公文和事务审批无纸化流转，消灭信息孤岛');
    bulletPoints.push('强化网络安全防护与敏感信息脱敏管理，捍卫群众数据私密性');
  }
  if (content.includes('物业') || content.includes('收费') || content.includes('住宅')) {
    bulletPoints.push('物业服务必须公开透明收费项目及标准，严厉禁止捆绑消费');
    bulletPoints.push('小区共有产权部分的收益归全体业主所有，应当优先用于修缮和改造维护');
    bulletPoints.push('相关价格指导意见对低收入保障群体的公共物业收费实行一定比例的减免政策');
  }
  if (content.includes('就业') || content.includes('创业') || content.includes('高校')) {
    bulletPoints.push('提供高校毕业生一次性创业补贴，降低年轻人在本地的初创经营门槛');
    bulletPoints.push('为招募高校毕业生的本土企业提供对应的纳税和社保返还奖励');
    bulletPoints.push('设立专属的高校毕业生创业孵化示范基地，并减免场地租金');
  }

  if (bulletPoints.length === 0) {
    bulletPoints.push('规范细化有关实施章程，强化各级部门对日常工作的直接领导与责任问责');
    bulletPoints.push('统筹推动相关审批和监管信息互通，杜绝重复申报和审批滞后');
    bulletPoints.push('建立健全社会参与和全媒体公示的长效沟通机制，主动接受市民监督');
  }

  return `### 政策概要\n${summary}\n\n### 核心要点\n${bulletPoints.map(pt => `- ${pt}`).join('\n')}\n\n### 适用范围\n- 适用于本市行政区域内符合条件的企事业单位和全体常住居民。\n- 重点覆盖特定领域及特定年龄群体的受益对象。\n\n### 办理指南\n- **线上渠道**：登录本市政务服务官方网厅或官方客户端，进入对应的智能办事版块，依据预设的办事流程上传 PDF 或扫描格式的申请表及对应资质材料进行电子申报。\n- **线下渠道**：前往就近的政务服务大厅或社区政务事务受理窗口，于法定工作日携带本人有效身份证件、营业执照及相关的书面证明资料办理，现场可享一站式审核。`;
}

module.exports = {
  name: 'ai-agent',
  version: '1.0.0',
  description: 'AI 智能解读 Agent — 基于通义千问大模型的政策智能解读',

  init(app, context) {
    const { db, config, middleware } = context;
    const { authenticateToken } = middleware;
    const upload = context.multer;

    // Agent 核心处理方法
    const agent = {
      name: 'PolicyAnalysisAgent',
      version: '1.0.0',
      async process(input) {
        const { content, title, model } = input;
        const selectedModel = model || 'qwen-max';
        const apiKey = config.DASHSCOPE_API_KEY;
        const baseUrl = config.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

        if (apiKey && apiKey !== 'your_dashscope_api_key_here') {
          console.log(`[AI Agent] 调用模型: ${selectedModel}`);
          try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: selectedModel,
                messages: [
                  {
                    role: 'system',
                    content: '你是一个专业的政府政务政策解读助手。你的任务是对用户输入的政策进行权威、严肃、易懂的解读。请直接使用 Markdown 格式生成结果，且必须严格按照以下四大板块进行排版：\n\n### 政策概要\n[详细总结政策的出台背景、核心意图和总体目标]\n\n### 核心要点\n[精炼出政策最核心的几条举措、指标或福利细则，建议用无序列表]\n\n### 适用范围\n[清晰指明哪些人、哪些企业或何种区域符合适用本政策]\n\n### 办理指南\n[提供具体如何申请、前往何处、携带什么材料、线上线下办理的具体路径]\n\n不要在开头输出前言，也不要在结尾做任何废话总结，只输出上述结构化内容。'
                  },
                  { role: 'user', content: `请解读以下政策法规：\n\n标题：${title}\n内容：\n${content}` }
                ],
                temperature: 0.3
              })
            });

            if (!response.ok) throw new Error(`大模型服务接口返回错误 (${response.status})`);

            const resData = await response.json();
            if (resData.choices && resData.choices[0] && resData.choices[0].message) {
              return resData.choices[0].message.content;
            }
            throw new Error('未获取到有效内容');
          } catch (err) {
            console.error('[AI Agent] 大模型调用失败，使用本地引擎:', err.message);
            return localMockAnalysis(title, content);
          }
        } else {
          console.log('[AI Agent] 未配置 API Key，使用本地规则引擎');
          return localMockAnalysis(title, content);
        }
      }
    };

    // 将 agent 注册到 context 供其他模块使用
    context.agent = agent;

    // 政策解读 API
    app.post('/api/analysis', authenticateToken, upload.single('file'), async (req, res) => {
      let { content, title, model } = req.body;

      // 处理上传的文件
      if (req.file) {
        try {
          const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads');
          const filePath = path.join(uploadsDir, req.file.filename);
          content = fs.readFileSync(filePath, 'utf8');
          title = title || req.file.originalname.split('.')[0];
        } catch (err) {
          return res.status(500).json({ success: false, message: '读取上传文件失败' });
        }
      }

      if (!content || !content.trim()) {
        return res.status(400).json({ success: false, message: '政策内容不能为空' });
      }

      title = title || (content.slice(0, 15).trim() + '...');

      // 通过 Agent 处理
      const aiResult = await agent.process({ content, title, model });

      // 记录历史
      const historyItem = {
        id: `hist-${Date.now()}`,
        userId: req.user.id,
        title,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        content,
        result: aiResult
      };
      db.addToCollection('analysisHistory', historyItem);

      res.json({ success: true, result: aiResult, historyItem });
    });

    // 获取解读历史
    app.get('/api/analysis/history', authenticateToken, (req, res) => {
      const myHistory = db.query('analysisHistory', h => h.userId === req.user.id);
      myHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
      res.json({ success: true, history: myHistory });
    });
  },

  getRoutes() {
    return [
      { method: 'POST', path: '/api/analysis', auth: true },
      { method: 'GET', path: '/api/analysis/history', auth: true }
    ];
  },

  getMetadata() {
    return { category: 'AI', icon: 'cpu' };
  }
};
