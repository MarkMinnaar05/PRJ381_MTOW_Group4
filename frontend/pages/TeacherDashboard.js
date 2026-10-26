(function () {
  'use strict';

  async function init() {
    const status = document.getElementById('teacherStatus');
    const refresh = document.getElementById('refreshAnalytics');
    const report = document.getElementById('downloadReport');
    const rows = document.getElementById('teacherStudentRows');
    function message(text, error) {
      status.textContent = text;
      if (error?.status === 401) {
        const link = document.createElement('a');
        link.href = '/frontend/pages/Auth.html';
        link.textContent = ' Sign in again';
        status.appendChild(link);
      }
    }
    function emptyTable(text) {
      rows.replaceChildren();
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = text;
      row.appendChild(cell);
      rows.appendChild(row);
    }
    async function load() {
      refresh.disabled = true;
      message('Loading your class data…');
      try {
        const data = await MTOWApi.request('/analytics/dashboard?includeSample=false');
        const overview = data.overview;
        document.getElementById('teacherLearnerCount').textContent = overview.totalPlayers;
        document.getElementById('teacherQuestionCount').textContent = overview.totalQuestionsAnswered;
        document.getElementById('teacherAccuracy').textContent = overview.overallAccuracy + '%';
        document.getElementById('teacherSessionCount').textContent = overview.totalSessions;
        rows.replaceChildren();
        for (const learner of data.players) {
          const row = document.createElement('tr');
          for (const value of [learner.playerName, learner.questionsAnswered,
            learner.accuracy + '%', learner.sessionsPlayed]) {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
          }
          rows.appendChild(row);
        }
        if (!data.players.length) {
          emptyTable('No recorded activity yet. Give learners your class code and ask them to play a round.');
        }
        message('Class data loaded. Click Refresh analytics after learners play.');
      } catch (error) {
        for (const id of ['teacherLearnerCount', 'teacherQuestionCount', 'teacherAccuracy', 'teacherSessionCount']) {
          document.getElementById(id).textContent = '—';
        }
        emptyTable('Class data could not be loaded.');
        message(error.message, error);
      } finally { refresh.disabled = false; }
    }
    try {
      const user = await MTOWApi.currentUser();
      if (user.role !== 'teacher') {
        location.href = '/frontend/pages/Auth.html';
        return;
      }
      document.getElementById('teacherClassCode').textContent = user.classCode;
      document.getElementById('headerName').textContent = user.name;
      refresh.addEventListener('click', load);
      report.disabled = false;
      report.addEventListener('click', async () => {
        report.disabled = true;
        try {
          const response = await fetch(MTOWApi.base + '/api/analytics/report?format=html&includeSample=false', {
            headers: { Authorization: 'Bearer ' + localStorage.getItem('mtow.token') }
          });
          if (!response.ok) throw new Error('Could not download the report. Try refreshing or signing in again.');
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement('a');
          link.href = url;
          link.download = 'teacher-report.html';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          message('Teacher report downloaded.');
        } catch (error) { message(error.message); }
        finally { report.disabled = false; }
      });
      await load();
    } catch (error) {
      document.getElementById('teacherClassCode').textContent = 'Sign in to view your code';
      emptyTable('Sign in with your teacher account to view class activity.');
      message(error.message + ' Open the sign-in page to continue.', error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
