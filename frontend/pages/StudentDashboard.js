document.addEventListener('DOMContentLoaded', async () => {
  try {
    const user = await MTOWApi.ensureGuest();
    if (user.role === 'teacher') { location.href = '/frontend/pages/TeacherDashboard.html'; return; }
    const data = await MTOWApi.request('/players/me');
    const profile = data.player;
    const [statsData, historyData] = await Promise.all([MTOWApi.request('/players/me/stats'), MTOWApi.request('/players/me/history')]);
    document.querySelector('.level-badge').textContent = 'Level ' + profile.level;
    document.querySelector('.xp-display').textContent = profile.totalXp + ' XP';
    const remaining = Math.max(0, profile.nextLevelXp - profile.totalXp);
    document.querySelector('.xp-to-next').textContent = remaining ? remaining + ' XP to level ' + (profile.level + 1) : 'Highest configured level';
    const span = profile.nextLevelXp - profile.levelStartXp;
    document.querySelector('.xp-bar .fill').style.width = Math.min(100, span > 0 ? (profile.totalXp - profile.levelStartXp) * 100 / span : 100) + '%';
    const values = document.querySelectorAll('.stats-grid .value');
    [statsData.stats.games, statsData.stats.wins, statsData.stats.winRate + '%', statsData.stats.accuracy + '%'].forEach((value, index) => { values[index].textContent = value; });
    const history = document.getElementById('savedMatchHistory'); history.textContent = '';
    if (!historyData.matches.length) history.textContent = 'No completed games yet. Play a round and finish it to save your result.';
    for (const game of historyData.matches) { const row = document.createElement('p'); row.textContent = game.mode + ' · ' + game.result + ' · ' + game.score + ' points · ' + new Date(game.endedAt).toLocaleString(); history.appendChild(row); }
    const name = document.getElementById('dashName');
    const classInput = document.querySelector('.class-input input');
    const display = () => {
      for (const id of ['headerName', 'dashNameDisplay']) { const el = document.getElementById(id); if (el) el.textContent = profile.nickname; }
      for (const id of ['headerAvatar', 'dashAvatar']) { const el = document.getElementById(id); if (el) el.textContent = profile.avatarId; }
    };
    if (name) name.value = profile.nickname;
    if (classInput) { classInput.value = user.classCode; classInput.readOnly = true; classInput.title = 'Join another class from the sign-in page'; }
    display();
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    document.querySelector('main').prepend(status);
    status.textContent = 'Saved progress: level ' + profile.level + ' · ' + profile.totalXp + ' XP';
    let pending = Promise.resolve();
    function save(changes) {
      pending = pending.then(async () => {
        const result = await MTOWApi.request('/players/me', { method: 'PATCH', body: JSON.stringify(changes) });
        Object.assign(profile, result.player); display();
        const saved = { ...user, name: profile.nickname, avatar: profile.avatarId };
        localStorage.setItem('user', JSON.stringify(saved));
        status.textContent = 'Profile saved · ' + profile.totalXp + ' XP';
      }).catch(error => { status.textContent = error.message; });
    }
    if (name) name.addEventListener('change', () => save({ nickname: name.value }));
    document.querySelectorAll('.avatar-picker button').forEach(button => button.addEventListener('click', () => save({ avatarId: button.dataset.avatar })));
  } catch (error) { alert(error.message); location.href = '/frontend/pages/Auth.html'; }
});
