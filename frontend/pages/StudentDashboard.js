document.addEventListener('DOMContentLoaded', function() {
  // Redirect teachers away from this page
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.role === 'teacher') {
    window.location.href = '/frontend/pages/TeacherDashboard.html';
    return;
  }

  const defaultUser = {
    name: 'Player',
    avatar: '',
    role: 'student',
    classCode: 'SUN-3B'
  };
  const currentUser = user || defaultUser;

  const nameInput = document.getElementById('dashName');
  const avatarDisplay = document.getElementById('dashAvatar');
  const headerAvatar = document.getElementById('headerAvatar');
  const headerName = document.getElementById('headerName');
  const classInput = document.querySelector('.class-input input');
  const dashNameDisplay = document.getElementById('dashNameDisplay');

  if (nameInput) nameInput.value = currentUser.name || 'Player';
  if (avatarDisplay) avatarDisplay.textContent = currentUser.avatar || '';
  if (headerAvatar) headerAvatar.textContent = currentUser.avatar || '';
  if (headerName) headerName.textContent = currentUser.name || 'Player';
  if (classInput) classInput.value = currentUser.classCode || '';

  /* Avatar */
  const avatarPicker = document.querySelector('.avatar-picker');
  if (avatarPicker) {
    // Highlight the currently selected avatar
    avatarPicker.querySelectorAll('button').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.avatar === currentUser.avatar) {
        btn.classList.add('active');
      }
    });

    avatarPicker.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', function() {
        avatarPicker.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const newAvatar = this.dataset.avatar;
        if (avatarDisplay) avatarDisplay.textContent = newAvatar;
        if (headerAvatar) headerAvatar.textContent = newAvatar;

        // Save to localStorage
        const updatedUser = JSON.parse(localStorage.getItem('user')) || defaultUser;
        updatedUser.avatar = newAvatar;
        localStorage.setItem('user', JSON.stringify(updatedUser));
      });
    });
  }

  /* Name Input */
  if (nameInput) {
    nameInput.addEventListener('input', function() {
      const newName = this.value || 'Player';
      if (headerName) headerName.textContent = newName;
      if (dashNameDisplay) dashNameDisplay.textContent = newName;

      // Save to localStorage
      const updatedUser = JSON.parse(localStorage.getItem('user')) || defaultUser;
      updatedUser.name = newName;
      localStorage.setItem('user', JSON.stringify(updatedUser));
    });
  }


  /* Class Code */
  if (classInput) {
    classInput.addEventListener('change', function() {
      const updatedUser = JSON.parse(localStorage.getItem('user')) || defaultUser;
      updatedUser.classCode = this.value;
      localStorage.setItem('user', JSON.stringify(updatedUser));
    });
    // Load saved class code if it exists
    if (currentUser.classCode) {
      classInput.value = currentUser.classCode;
    }
  }

});