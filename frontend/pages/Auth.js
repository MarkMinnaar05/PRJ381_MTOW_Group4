(function() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const roleBtns = document.querySelectorAll('.role-btn');
    const teacherSection = document.getElementById('teacherAuth');
    const studentSection = document.getElementById('studentAuth');

    if (roleBtns.length && teacherSection && studentSection) {
      roleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          roleBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');

          // Show/hide sections based on role
          const role = this.dataset.role;
          if (role === 'teacher') {
            teacherSection.style.display = 'block';
            studentSection.style.display = 'none';
          } else {
            teacherSection.style.display = 'none';
            studentSection.style.display = 'block';
          }
        });
      });
      teacherSection.style.display = 'block';
      studentSection.style.display = 'none';
    }

    /* Teacher Tab */
    const teacherTabs = document.getElementById('teacherTabs');
    const loginFormContainer = document.getElementById('teacherLoginForm');
    const signupFormContainer = document.getElementById('teacherSignupForm');

    if (teacherTabs && loginFormContainer && signupFormContainer) {
      const tabs = teacherTabs.querySelectorAll('[data-tab]');
      tabs.forEach(tab => {
        tab.addEventListener('click', function() {
          tabs.forEach(t => t.classList.remove('active'));
          this.classList.add('active');

          const tabName = this.dataset.tab;
          if (tabName === 'login') {
            loginFormContainer.style.display = 'block';
            signupFormContainer.style.display = 'none';
          } else {
            loginFormContainer.style.display = 'none';
            signupFormContainer.style.display = 'block';
          }
        });
      });
      const firstTab = teacherTabs.querySelector('[data-tab="login"]');
      if (firstTab) firstTab.click();
    }



    function bind(id, path, body, target) {
      const form = document.getElementById(id);
      if (!form) return;
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      form.appendChild(message);
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        try {
          const data = await MTOWApi.request(path, { method: 'POST', body: JSON.stringify(body(form)) });
          MTOWApi.saveAuth(data);
          location.href = target;
        } catch (error) { message.textContent = error.message; }
        finally { if (button) button.disabled = false; }
      });
    }
    bind('teacherLogin', '/auth/login', form => ({ email: form.querySelector('input[type="email"]').value,
      password: form.querySelector('input[type="password"]').value }), '/frontend/pages/TeacherDashboard.html');
    bind('teacherSignup', '/auth/register', form => ({ name: form.querySelector('input[type="text"]').value,
      email: form.querySelector('input[type="email"]').value, password: form.querySelector('input[type="password"]').value }), '/frontend/pages/TeacherDashboard.html');
    const student = document.getElementById('studentCodeForm');
    if (student) {
      const label = document.createElement('label');
      label.textContent = 'Your display name';
      const name = document.createElement('input');
      name.id = 'studentDisplayName'; name.type = 'text'; name.required = true; name.maxLength = 24; name.placeholder = 'e.g. Mahlatse';
      label.appendChild(name); student.prepend(label);
    }
    bind('studentCodeForm', '/auth/guest', form => ({ name: document.getElementById('studentDisplayName').value,
      classCode: form.querySelector('input[placeholder="e.g. 7X9K2L"]').value }), '/frontend/pages/StudentDashboard.html');
  }
})();
