function myFunction() {
  var header = document.querySelector('.app-header');
  if (header) {
    header.classList.toggle('responsive');
  }
}

/* Authentication Check */
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('user'));
  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const userBadge = document.getElementById('userBadge');
  const headerName = document.getElementById('headerName');
  const headerAvatar = document.getElementById('headerAvatar');
  const teacherLinks = document.querySelectorAll('.teacher-link');
  const studentLinks = document.querySelectorAll('.student-link');

  if (user) {
    if (signInBtn) signInBtn.style.display = 'none';
    if (signOutBtn) signOutBtn.style.display = 'inline-block';
    if (userBadge) userBadge.style.display = 'flex';

    // Populate user info
    if (headerName) headerName.textContent = user.name || 'Player';
    if (headerAvatar) headerAvatar.textContent = user.avatar || '';

    // Show/hide Teacher link based on role
    teacherLinks.forEach(link => {
      if (user.role === 'teacher') {
        link.style.display = 'inline-block';
      } else {
        link.style.display = 'none';
      }
    });

    // Show/hide Student Dashboard link based on role
    studentLinks.forEach(link => {
      if (user.role === 'student') {
        link.style.display = 'inline-block';
      } else {
        link.style.display = 'none';
      }
    });
  } else {
    if (signInBtn) signInBtn.style.display = 'inline-block';
    if (signOutBtn) signOutBtn.style.display = 'none';
    if (userBadge) userBadge.style.display = 'none';

    // Hide both role-specific links for signed-out users
    teacherLinks.forEach(link => link.style.display = 'none');
    studentLinks.forEach(link => link.style.display = 'inline-block'); // show by default
  }
}

/* Sign Out */
document.addEventListener('click', function(e) {
  if (e.target && e.target.id === 'signOutBtn') {
    localStorage.removeItem('user');
    window.location.href = '/frontend/index.html';
  }
});

/* Confetti Animation */
function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#D4070F', '#FFDA13', '#0066E7']; 
  const pieces = [];

  for (let i = 0; i < 600; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 4 + 2, 
      vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * 360,
      rv: (Math.random() - 0.5) * 4,
    });
  }
  let animationId = null;

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    for (let p of pieces) {
      p.y += p.vy;
      p.x += p.vx;
      p.rot += p.rv;

      if (p.y < canvas.height + 20) alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (alive) {
      animationId = requestAnimationFrame(animate);
    }
  }

  animate();
}

/* Background Animation */
function createFloatingSymbols() {
  const container = document.querySelector('.hero');
  if (!container) return;

  const symbols = [
    '&#10133;', '&#10134;', '&times;', '&#10135;',
    '&#120812;', '&#120814;', '&#120816;', '&#120818;', '&#120820;'
  ];

  for (let i = 0; i < 20; i++) {
    const span = document.createElement('span');
    span.className = 'float-symbol';
    span.innerHTML = symbols[Math.floor(Math.random() * symbols.length)];

    span.style.left = Math.random() * 100 + '%';

    const direction = Math.random() > 0.5 ? 'up' : 'down';
    span.classList.add(direction);

    const delay = Math.random() * 10;
    span.style.animationDelay = delay + 's';
    const size = Math.random() * 3 + 1.8;
    span.style.fontSize = size + 'rem';

    container.appendChild(span);
  }
}

/* Start when page runs */
document.addEventListener('DOMContentLoaded', function() {
  checkAuth();
  startConfetti();
  createFloatingSymbols();
});