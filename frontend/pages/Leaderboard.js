document.addEventListener('DOMContentLoaded', async () => {
  const box = document.getElementById('liveLeaderboard');
  try {
    await MTOWApi.ensureGuest();
    const data = await MTOWApi.request('/leaderboard');
    box.textContent = '';
    if (!data.players.length) { box.textContent = 'No scores yet. Finish a game to earn XP.'; return; }
    const list = document.createElement('ol');
    for (const p of data.players) {
      const item = document.createElement('li'); item.textContent = p.nickname + ' — ' + p.totalXp + ' XP'; list.appendChild(item);
    }
    box.appendChild(list);
  } catch (error) { box.textContent = error.message; }
});
