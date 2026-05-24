/* ─── aiAgentOS 后台管理 API 客户端 ─── */

const AdminAPI = {
  // 用户管理
  getUsers(params) {
    const qs = new URLSearchParams(params).toString();
    return API.request(`/admin/users?${qs}`);
  },
  getUser(id) {
    return API.request(`/admin/users/${id}`);
  },
  updateUser(id, data) {
    return API.request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  toggleUser(id) {
    return API.request(`/admin/users/${id}/toggle`, { method: 'PUT' });
  },
  resetPassword(id) {
    return API.request(`/admin/users/${id}/reset-password`, { method: 'POST' });
  },
  assignRole(id, role) {
    return API.request(`/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  // 角色管理
  getRoles() {
    return API.request('/admin/roles');
  },
  createRole(data) {
    return API.request('/admin/roles', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  updateRole(name, data) {
    return API.request(`/admin/roles/${name}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  deleteRole(name) {
    return API.request(`/admin/roles/${name}`, { method: 'DELETE' });
  },

  // 权限管理
  getPermissions() {
    return API.request('/admin/permissions');
  },
  getRolePermissions(role) {
    return API.request(`/admin/roles/${role}/permissions`);
  },
  setRolePermissions(role, permissions) {
    return API.request(`/admin/roles/${role}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions })
    });
  },

  // 数据仓库
  getWarehouseOverview() {
    return API.request('/admin/data-warehouse/overview');
  },
  getTrends(range) {
    return API.request(`/admin/data-warehouse/trends?range=${range || 'month'}`);
  },
  getLogs(params) {
    const qs = new URLSearchParams(params).toString();
    return API.request(`/admin/data-warehouse/logs?${qs}`);
  },
  getExportUrl(type) {
    return `/api/admin/data-warehouse/export?type=${type}`;
  },

  // 模块列表
  getModules() {
    return API.request('/admin/modules');
  }
};
