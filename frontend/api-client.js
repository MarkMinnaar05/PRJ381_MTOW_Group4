(function () {
  'use strict';
  // The backend serves both the website and API. This also works on a custom
  // port or HTTPS host. Separate frontend hosting can set MTOW_API_BASE first.
  const base = (window.MTOW_API_BASE || location.origin).replace(/\/$/, '');
  let creatingGuest;
  function clearAuth() {
    for (const key of ['mtow.token', 'user', 'mtow.playerId']) localStorage.removeItem(key);
  }
  function signInError() {
    const error = new Error('Your session has expired or you are signed out. Sign in again with your teacher account or class code.');
    error.status = 401;
    return error;
  }
  async function request(path, options = {}) {
    const token = localStorage.getItem('mtow.token');
    let response;
    try {
      response = await fetch(base + '/api' + path, { ...options, headers: {
        'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers
      } });
    } catch (_) {
      throw new Error('Cannot reach the backend. Start it and open the website from its address, for example http://localhost:3000/frontend/index.html.');
    }
    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error('This address did not return the MTOW API. Open the website through the running backend, not Live Server or a downloaded HTML file.'); }
    if (!response.ok) {
      const error = new Error(data.error || data.message || 'Request failed');
      error.status = response.status;
      if (response.status === 401 && !['/auth/login', '/auth/register', '/auth/guest'].includes(path)) {
        clearAuth();
        throw signInError();
      }
      throw error;
    }
    return data;
  }
  async function currentUser() {
    if (!localStorage.getItem('mtow.token')) throw signInError();
    const data = await request('/auth/me');
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
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
        // An expired class identity must never silently become a PUBLIC guest.
        return currentUser();
      }
      return saveAuth(await request('/auth/guest', { method: 'POST', body: JSON.stringify({ name }) }));
    })();
    try { return await creatingGuest; } finally { creatingGuest = null; }
  }
  window.MTOWApi = { base, request, saveAuth, currentUser, ensureGuest,
    async logout() {
      try { await request('/auth/logout', { method: 'POST' }); }
      finally { clearAuth(); }
    }
  };
})();
