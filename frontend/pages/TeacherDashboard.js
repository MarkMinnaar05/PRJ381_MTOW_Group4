document.addEventListener(
  'DOMContentLoaded',
  function () {
    const user = JSON.parse(
      localStorage.getItem('user')
    );

    if (
      user &&
      user.role === 'student'
    ) {
      window.location.href =
        '/frontend/pages/StudentDashboard.html';

      return;
    }

    const apiBase = getApiBase();

    loadDashboard(apiBase);

    document
      .querySelectorAll(
        '.teacher-tabs button'
      )
      .forEach(function (button) {
        button.addEventListener(
          'click',
          function () {
            document
              .querySelectorAll(
                '.teacher-tabs button'
              )
              .forEach(function (item) {
                item.classList.remove(
                  'active'
                );
              });

            button.classList.add(
              'active'
            );
          }
        );
      });

    document
      .querySelectorAll(
        '.class-tabs button:not(.add)'
      )
      .forEach(function (button) {
        button.addEventListener(
          'click',
          function () {
            document
              .querySelectorAll(
                '.class-tabs button'
              )
              .forEach(function (item) {
                item.classList.remove(
                  'active'
                );
              });

            button.classList.add(
              'active'
            );
          }
        );
      });
  }
);

function getApiBase() {
  const parameters =
    new URLSearchParams(
      window.location.search
    );

  const configuredServer =
    parameters.get('server');

  if (configuredServer) {
    return configuredServer.replace(
      /\/$/,
      ''
    );
  }

  if (
    window.location.protocol ===
    'file:'
  ) {
    return 'http://localhost:3000';
  }

  if (
    window.location.port === '3000'
  ) {
    return '';
  }

  const hostname =
    window.location.hostname ||
    'localhost';

  return (
    `${window.location.protocol}//` +
    `${hostname}:3000`
  );
}

async function loadDashboard(apiBase) {
  setMessage('Loading analytics…');

  try {
    const response = await fetch(
      `${apiBase}/api/analytics/dashboard`
    );

    if (!response.ok) {
      throw new Error(
        `Request failed (${response.status})`
      );
    }

    const dashboard =
      await response.json();

    if (!dashboard.success) {
      throw new Error(
        dashboard.message ||
        'Analytics request failed'
      );
    }

    renderOverview(
      dashboard.overview || {}
    );

    renderPlayers(
      dashboard.players || []
    );

    setMessage(
      'Analytics loaded.'
    );
  } catch (error) {
    showError(error);
  }
}

function renderOverview(overview) {
  document.getElementById(
    'metricPlayers'
  ).textContent = formatNumber(
    overview.totalPlayers
  );

  document.getElementById(
    'metricGames'
  ).textContent = formatNumber(
    overview.completedGames
  );

  document.getElementById(
    'metricAccuracy'
  ).textContent =
    `${formatNumber(
      overview.overallAccuracy
    )}%`;

  const milliseconds =
    Number(
      overview.averageResponseTimeMs
    ) || 0;

  document.getElementById(
    'metricResponse'
  ).textContent =
    `${(
      milliseconds / 1000
    ).toFixed(1)}s`;
}

function renderPlayers(players) {
  const tableBody =
    document.getElementById(
      'analyticsPlayers'
    );

  if (!players.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">
          No learner results are
          available yet.
        </td>
      </tr>
    `;

    return;
  }

  const avatars = [
    '🦊',
    '🐯',
    '🐵',
    '🐸',
    '🦁',
    '🐼'
  ];

  tableBody.innerHTML = players
    .map(function (player, index) {
      const performance =
        player.masteryLevel ||
        'Not enough data';

      let colour = '#94a3b8';

      if (
        performance === 'Strong'
      ) {
        colour = '#0a8f4a';
      } else if (
        performance === 'Developing'
      ) {
        colour = '#d49a00';
      } else if (
        performance ===
        'Needs support'
      ) {
        colour = '#D4070F';
      }

      const avatar =
        avatars[
          index % avatars.length
        ];

      return `
        <tr>
          <td>
            <div class="student">
              <span class="avatar">
                ${avatar}
              </span>

              <div>
                <span class="name">
                  ${escapeHtml(
                    player.playerName ||
                    'Learner'
                  )}
                </span>

                <div class="grade">
                  ${formatNumber(
                    player.questionsAnswered
                  )}
                  questions answered
                </div>
              </div>
            </div>
          </td>

          <td>
            <span
              class="status"
              style="background:${colour};"
            >
              <span class="dot"></span>

              ${escapeHtml(
                performance
              )}
            </span>
          </td>

          <td class="text-right xp">
            ${formatNumber(
              player.highScore
            )}
          </td>

          <td class="text-right wins">
            ${formatNumber(
              player.wins
            )}
          </td>

          <td class="text-right acc">
            ${formatNumber(
              player.accuracy
            )}%
          </td>

          <td class="text-right streak">
            🔥
            ${formatNumber(
              player.bestStreak
            )}
          </td>
        </tr>
      `;
    })
    .join('');
}

function setMessage(message) {
  const element =
    document.getElementById(
      'analyticsMessage'
    );

  element.textContent = message;

  element.style.color =
    'var(--slate-600)';
}

function showError(error) {
  const element =
    document.getElementById(
      'analyticsMessage'
    );

  element.textContent =
    'Could not load analytics. ' +
    'Make sure the backend is ' +
    'running on port 3000. ' +
    error.message;

  element.style.color =
    'var(--red)';

  document.getElementById(
    'analyticsPlayers'
  ).innerHTML = `
    <tr>
      <td colspan="6">
        Analytics are currently
        unavailable.
      </td>
    </tr>
  `;
}

function formatNumber(value) {
  return Number(
    value || 0
  ).toLocaleString(
    'en-ZA',
    {
      maximumFractionDigits: 1
    }
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}