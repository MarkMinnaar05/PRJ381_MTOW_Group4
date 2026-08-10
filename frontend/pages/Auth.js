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

    /* Teacher */
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


    /* Login */
    const teacherLoginForm = document.getElementById('teacherLogin');
    if (teacherLoginForm) {
      teacherLoginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Integrate hashing and mongoose here
        const user = {
          name: 'Teacher',
          avatar: '', 
          role: 'teacher',
        };
        localStorage.setItem('user', JSON.stringify(user));

        window.location.href = '/frontend/pages/TeacherDashboard.html';
      });
    }

    /* Sign Up */
    const teacherSignupForm = document.getElementById('teacherSignup');
    if (teacherSignupForm) {
      teacherSignupForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Integrate hashing and mongoose here
        const user = {
          name: 'Teacher',
          avatar: '', 
          role: 'teacher',
        };
        localStorage.setItem('user', JSON.stringify(user));

        window.location.href = '/frontend/pages/TeacherDashboard.html';
      });
    }

    /* Student */
    const studentCodeForm = document.getElementById('studentCodeForm');
    if (studentCodeForm) {
      studentCodeForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Integrate hashing and mongoose here
        const user = {
          name: 'Student',
          avatar: '',
          role: 'student',
        };
        localStorage.setItem('user', JSON.stringify(user));

        window.location.href = '/frontend/pages/StudentDashboard.html';
      });
    }
  } 
})();