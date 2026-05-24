/* ─── 前端公共 API 请求与全局状态脚本 ─── */

const BASE_URL = '/api';

// XSS 防护：转义 HTML 特殊字符
function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const API = {
  // ─── 认证相关的本地存储管理 ───
  getToken() {
    try { return localStorage.getItem('gov_qa_token'); } catch { return null; }
  },
  setToken(token) {
    try { localStorage.setItem('gov_qa_token', token); } catch {}
  },
  getUser() {
    try {
      const userStr = localStorage.getItem('gov_qa_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch { return null; }
  },
  setUser(user) {
    try { localStorage.setItem('gov_qa_user', JSON.stringify(user)); } catch {}
  },
  clearAuth() {
    try {
      localStorage.removeItem('gov_qa_token');
      localStorage.removeItem('gov_qa_user');
    } catch {}
  },

  // ─── 底层请求封装 ───
  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };

    // 如果不是 FormData，则默认使用 JSON
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      
      // 校验 HTTP 错误状态
      if (response.status === 401 || response.status === 403) {
        // Token 失效或过期，清空登录态并跳转至登录页（排除已经在登录页的情况）
        if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('register.html')) {
          this.clearAuth();
          alert('登录状态已失效，请重新登录。');
          // 处理路径深度差异
          const prefix = window.location.pathname.includes('/src/') ? '' : 'src/';
          window.location.href = `${window.location.origin}/${prefix}login.html`;
        }
      }

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || '请求失败，请稍后重试');
      }
      return resData;
    } catch (err) {
      console.error(`API 请求出错 [${endpoint}]:`, err);
      throw err;
    }
  },

  // ─── 用户 API ───
  async login(phone, password, role) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password, role })
    });
    if (data.success) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async register(name, phone, password, role) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, phone, password, role })
    });
    if (data.success) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async getMe() {
    const data = await this.request('/auth/me');
    if (data.success) {
      this.setUser(data.user);
    }
    return data.user;
  },

  async updateProfile(profile) {
    const data = await this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profile)
    });
    if (data.success) {
      this.setUser(data.user);
    }
    return data;
  },

  async updateSettings(settings) {
    return this.request('/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },

  // ─── 政策法规 API ───
  async getPolicies({ category = '全部', year = '全部年份', status = '全部状态', keyword = '', limit = 5, page = 1 } = {}) {
    const query = new URLSearchParams({ category, year, status, keyword, limit, page }).toString();
    return this.request(`/policies?${query}`);
  },

  async getPolicyCategories() {
    return this.request('/policies/categories');
  },

  async getPolicy(id) {
    return this.request(`/policies/${id}`);
  },

  async addPolicy(policy) {
    return this.request('/policies', {
      method: 'POST',
      body: JSON.stringify(policy)
    });
  },

  async updatePolicy(id, policy) {
    return this.request(`/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(policy)
    });
  },

  async deletePolicy(id) {
    return this.request(`/policies/${id}`, {
      method: 'DELETE'
    });
  },

  // ─── 诉求 API ───
  async submitComplaint(formData) {
    return this.request('/complaints', {
      method: 'POST',
      body: formData // 应当是 FormData 实例
    });
  },

  async getMyComplaints() {
    return this.request('/complaints/my');
  },

  async getComplaint(id) {
    return this.request(`/complaints/${id}`);
  },

  async resolveComplaint(id) {
    return this.request(`/complaints/${id}/resolve`, {
      method: 'POST'
    });
  },

  async updateComplaintStatus(id, data) {
    return this.request(`/complaints/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getAllComplaints() {
    return this.request('/complaints');
  },

  // ─── 行政审批 API ───
  async submitApproval(formData) {
    return this.request('/approvals', {
      method: 'POST',
      body: formData // 应当是 FormData 实例
    });
  },

  async getMyApprovals() {
    return this.request('/approvals/my');
  },

  async getAllApprovals() {
    return this.request('/approvals');
  },

  async updateApprovalStatus(id, status) {
    return this.request(`/approvals/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // ─── 消息通知 API ───
  async getMessages() {
    return this.request('/messages');
  },

  async markMessageRead(id) {
    return this.request(`/messages/${id}/read`, {
      method: 'PUT'
    });
  },

  // ─── 看板 API ───
  async getDashboardStats(range = 'month') {
    return this.request(`/dashboard/stats?range=${range}`);
  },

  // ─── AI 解读 API ───
  async analyzePolicy(formData) {
    return this.request('/analysis', {
      method: 'POST',
      body: formData // FormData 实例，含 content, title, model, 选填 file
    });
  },

  async getAnalysisHistory() {
    return this.request('/analysis/history');
  }
};

// ────────── 页面通用逻辑自动处理 ──────────
document.addEventListener("DOMContentLoaded", () => {
  // 1. 自动调整导航栏上的登录状态
  const user = API.getUser();
  const navUser = document.querySelector(".nav-user");
  
  if (navUser) {
    // 检查页面路径前缀
    const isSubDir = window.location.pathname.includes('/src/');
    const pathPrefix = isSubDir ? '' : 'src/';

    if (user) {
      // 已登录状态：替换右上角为 个人中心(姓名) 和 退出 按钮
      navUser.innerHTML = `
        <span style="font-family: var(--font-sans); font-size: var(--text-sm); color: var(--text-mute); margin-right: var(--space-3);">
          您好，${escapeHTML(user.name)} (${user.role === 'staff' ? '政务人员' : user.role === 'enterprise' ? '企业用户' : '市民'})
        </span>
        <a href="${isSubDir ? 'profile.html' : 'src/profile.html'}" class="btn btn-ghost" style="font-size:var(--text-sm)">个人中心</a>
        <button id="logoutBtn" class="btn btn-primary" style="font-size:var(--text-sm); padding:var(--space-2) var(--space-4); margin-left:var(--space-2)">退出</button>
      `;

      // 政务人员：在导航栏添加管理入口
      if (user.role === 'staff') {
        const mainNav = document.getElementById("mainNav");
        if (mainNav && !mainNav.querySelector('[data-staff-link]')) {
          const prefix = isSubDir ? '' : 'src/';
          mainNav.insertAdjacentHTML('beforeend', `
            <a href="${prefix}staff-manage.html" data-staff-link>员工管理</a>
            <a href="${prefix}policy-manage.html" data-staff-link>政策管理</a>
          `);
        }
      }

      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          API.clearAuth();
          alert('已安全退出登录。');
          window.location.href = isSubDir ? '../index.html' : 'index.html';
        });
      }
    } else {
      // 未登录状态
      navUser.innerHTML = `
        <a href="${isSubDir ? 'profile.html' : 'src/profile.html'}" class="btn btn-ghost" style="font-size:var(--text-sm)">个人中心</a>
        <a href="${isSubDir ? 'login.html' : 'src/login.html'}" class="btn btn-primary" style="font-size:var(--text-sm)">登录</a>
      `;
    }
  }
});
