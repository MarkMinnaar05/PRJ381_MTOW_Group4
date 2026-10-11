(function () {
  'use strict';
  const base = window.MTOW_API_BASE || (location.port === '3000' ? location.origin : location.protocol + '//' + location.hostname + ':3000');
  let creatingGuest;
  async function request(path, options = {}) {
    const token = localStorage.getItem('mtow.token');
    const response = await fetch(base + '/api' + path, { ...options, headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers
    } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.message || 'Request failed');
    return data;
  }
  function saveAuth(data) {
    localStorage.setItem('mtow.token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('mtow.playerId', data.user.playerId);
    return data.user;
  }
  async function ensureGuest(name = 'Player') {
    if (creatingGuest) return creatingGuest;
    creatingGuest = (async () => {
      if (localStorage.getItem('mtow.token')) {
        try { const data = await request('/auth/me'); localStorage.setItem('user', JSON.stringify(data.user)); return data.user; }
        catch (error) { if (!/Sign in again/.test(error.message)) throw error; }
      }
      return saveAuth(await request('/auth/guest', { method: 'POST', body: JSON.stringify({ name }) }));
    })();
    try { return await creatingGuest; } finally { creatingGuest = null; }
  }
  window.MTOWApi = { base, request, saveAuth, ensureGuest,
    async logout() {
      try { await request('/auth/logout', { method: 'POST' }); }
      finally { localStorage.removeItem('mtow.token'); localStorage.removeItem('user'); localStorage.removeItem('mtow.playerId'); }
    }
  };
})();
