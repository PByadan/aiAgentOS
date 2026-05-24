/* ─── 静态版本 API（GitHub Pages 用） ─── */
const MOCK_USER = { id: 1, name: '演示用户', phone: '13800138000', role: 'citizen' };
const MOCK_TOKEN = 'mock-token-for-demo';

const API = {
  getToken() { return localStorage.getItem('gov_qa_token'); },
  setToken(token) { localStorage.setItem('gov_qa_token', token); },
  getUser() { const s = localStorage.getItem('gov_qa_user'); return s ? JSON.parse(s) : null; },
  setUser(u) { localStorage.setItem('gov_qa_user', JSON.stringify(u)); },
  clearAuth() { localStorage.removeItem('gov_qa_token'); localStorage.removeItem('gov_qa_user'); },

  async login(phone, password, role) {
    await new Promise(r => setTimeout(r, 500));
    this.setToken(MOCK_TOKEN);
    this.setUser({ ...MOCK_USER, phone, role: role || 'citizen' });
    return { success: true, token: MOCK_TOKEN, user: { ...MOCK_USER, phone, role: role || 'citizen' } };
  },

  async register(name, phone, password, role) {
    await new Promise(r => setTimeout(r, 500));
    this.setToken(MOCK_TOKEN);
    this.setUser({ ...MOCK_USER, name, phone, role: role || 'citizen' });
    return { success: true, token: MOCK_TOKEN, user: { ...MOCK_USER, name, phone, role: role || 'citizen' } };
  },

  async getMe() { return this.getUser() || MOCK_USER; },
  async updateProfile(p) { const u = { ...this.getUser(), ...p }; this.setUser(u); return { success: true, user: u }; },
  async updateSettings() { return { success: true }; },

  async getPolicies({ limit = 5, page = 1 } = {}) {
    const policies = [
      { id: 1, title: '关于推进政务服务标准化规范化便利化的指导意见', publishDate: '2026-05-20', status: '现行有效', category: '国务院文件' },
      { id: 2, title: '优化营商环境条例实施细则', publishDate: '2026-05-18', status: '现行有效', category: '行政法规' },
      { id: 3, title: '关于进一步加强数字政府建设的指导意见', publishDate: '2026-05-15', status: '征求意见', category: '国务院文件' },
      { id: 4, title: '政务服务"一网通办"管理办法', publishDate: '2026-05-10', status: '现行有效', category: '部门规章' },
      { id: 5, title: '关于加快推进电子证照扩大应用领域的意见', publishDate: '2026-05-08', status: '现行有效', category: '国务院文件' }
    ];
    return { success: true, policies: policies.slice(0, limit), total: policies.length, page, totalPages: 1 };
  },

  async getPolicyCategories() { return { success: true, categories: ['全部', '国务院文件', '行政法规', '部门规章', '地方性法规'] }; },
  async getPolicy(id) {
    return { success: true, policy: { id, title: '示例政策文件标题', content: '这里是政策文件的详细内容...', publishDate: '2026-05-20', status: '现行有效', category: '国务院文件', issuer: '国务院办公厅' } };
  },
  async addPolicy() { return { success: true }; },
  async updatePolicy() { return { success: true }; },
  async deletePolicy() { return { success: true }; },

  async submitComplaint() { return { success: true, complaint: { id: Date.now(), status: '待受理' } }; },
  async getMyComplaints() { return { success: true, complaints: [] }; },
  async getComplaint(id) { return { success: true, complaint: { id, title: '示例诉求', status: '处理中' } }; },
  async resolveComplaint() { return { success: true }; },
  async updateComplaintStatus() { return { success: true }; },
  async getAllComplaints() { return { success: true, complaints: [] }; },

  async submitApproval() { return { success: true, approval: { id: Date.now(), status: '待审批' } }; },
  async getMyApprovals() { return { success: true, approvals: [] }; },
  async getAllApprovals() { return { success: true, approvals: [] }; },
  async updateApprovalStatus() { return { success: true }; },

  async getMessages() { return { success: true, messages: [] }; },
  async markMessageRead() { return { success: true }; },

  async getDashboardStats(range) {
    const dailyCounts = range === 'today'
      ? Array.from({length: 24}, (_, i) => ({ date: i.toString().padStart(2,'0') + ':00', count: Math.floor(Math.random()*10) }))
      : range === 'year'
      ? Array.from({length: 12}, (_, i) => ({ date: (i+1) + '月', count: Math.floor(Math.random()*200) + 50 }))
      : Array.from({length: 30}, (_, i) => ({ date: `5/${i+1}`, count: Math.floor(Math.random()*50) + 10 }));
    return { success: true, stats: { totalItems: 12847, completionRate: '98.6%', monthlyComplaints: 3205, satisfactionRate: '96.2%' }, typeCounts: { infra: 40, env: 25, traffic: 20, other: 15 }, rankings: [{ title: '基础设施问题', count: 40 }, { title: '环境保护诉求', count: 25 }], dailyCounts };
  },

  async analyzePolicy() { return { success: true, analysis: { summary: '这是 AI 生成的政策解读摘要...', keyPoints: ['要点一', '要点二', '要点三'] } }; },
  async getAnalysisHistory() { return { success: true, history: [] }; }
};

// 页面通用逻辑
document.addEventListener("DOMContentLoaded", () => {
  const user = API.getUser();
  const navUser = document.querySelector(".nav-user");
  if (navUser) {
    const isSubDir = window.location.pathname.includes('/src/');
    if (user) {
      navUser.innerHTML = `
        <span style="font-family:var(--font-sans);font-size:var(--text-sm);color:var(--text-mute);margin-right:var(--space-3);">您好，${user.name}</span>
        <a href="${isSubDir ? 'profile.html' : 'src/profile.html'}" class="btn btn-ghost" style="font-size:var(--text-sm)">个人中心</a>
        <button id="logoutBtn" class="btn btn-primary" style="font-size:var(--text-sm);padding:var(--space-2) var(--space-4);margin-left:var(--space-2)">退出</button>
      `;
      document.getElementById("logoutBtn")?.addEventListener("click", () => {
        API.clearAuth();
        alert('已安全退出登录。');
        window.location.href = isSubDir ? '../index.html' : 'index.html';
      });
    } else {
      navUser.innerHTML = `
        <a href="${isSubDir ? 'profile.html' : 'src/profile.html'}" class="btn btn-ghost" style="font-size:var(--text-sm)">个人中心</a>
        <a href="${isSubDir ? 'login.html' : 'src/login.html'}" class="btn btn-primary" style="font-size:var(--text-sm)">登录</a>
      `;
    }
  }
});
