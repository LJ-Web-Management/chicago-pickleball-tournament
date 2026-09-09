const Api = (() => {
  const BASE = window.APP_CONFIG.apiBase;

  function getToken() {
    return localStorage.getItem('token');
  }
  function setToken(t) {
    localStorage.setItem('token', t);
  }
  function getAdminToken() {
    return localStorage.getItem('adminToken');
  }
  function setAdminToken(t) {
    localStorage.setItem('adminToken', t);
  }
  function clearAll() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }
  function setUser(u) {
    localStorage.setItem('user', JSON.stringify(u));
  }

  async function request(path, { method = 'GET', body, admin = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = admin ? getAdminToken() : getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      // no body
    }
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  return {
    get: (path, opts) => request(path, { ...opts, method: 'GET' }),
    post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
    put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
    getToken,
    setToken,
    getAdminToken,
    setAdminToken,
    clearAll,
    getUser,
    setUser,
  };
})();
