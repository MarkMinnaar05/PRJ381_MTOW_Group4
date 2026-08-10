document.addEventListener('DOMContentLoaded', function() {
  // Redirect students away from this page
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.role === 'student') {
    window.location.href = '/frontend/pages/StudentDashboard.html';
    return;
  }
});

document.querySelectorAll('.teacher-tabs button').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.teacher-tabs button').forEach(b => b.classList.remove('active'));
    this.classList.add('active');

    // Show/hide sections
    const tab = this.dataset.ttab;
    document.getElementById('teacherStudents').style.display = tab === 'students' ? 'block' : 'none';
    document.getElementById('teacherGames').style.display = tab === 'games' ? 'block' : 'none';
    document.getElementById('teacherAnalytics').style.display = tab === 'analytics' ? 'block' : 'none';
  });
});

document.querySelectorAll('.class-tabs button:not(.add)').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.class-tabs button').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});