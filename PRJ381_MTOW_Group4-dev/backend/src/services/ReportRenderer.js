// src/services/ReportRenderer.js
// Turns the analytics report (AnalyticsService.buildReport) into a printable
// HTML page for teachers. Open  GET /api/analytics/report?format=html  in a
// browser and use Print -> Save as PDF to get a PDF copy.
//
// No libraries: charts are plain inline SVG so the report works offline.

const OP_NAMES = { '+': 'Addition', '-': 'Subtraction', '×': 'Multiplication', '÷': 'Division' };

function renderReportHtml(report) {
    const o = report.overview;
    const sample = o.dataSource === 'sample' || o.dataSource === 'mixed';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Class Performance Report</title>
<style>
:root{
  --page:#f9f9f7; --surface:#fcfcfb; --ink:#0b0b0b; --ink-2:#52514e; --muted:#898781;
  --grid:#e1e0d9; --axis:#c3c2b7; --border:rgba(11,11,11,.10);
  --series:#2a78d6; --series-soft:#86b6ef;
  --good:#0ca30c; --good-text:#006300; --warning:#fab219; --serious:#ec835a; --critical:#d03b3b;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --page:#0d0d0d; --surface:#1a1a19; --ink:#fff; --ink-2:#c3c2b7; --muted:#898781;
    --grid:#2c2c2a; --axis:#383835; --border:rgba(255,255,255,.10);
    --series:#3987e5; --series-soft:#184f95; --good-text:#0ca30c;
  }
}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1000px;margin:0 auto;padding:32px 16px 48px}
h1{font-size:26px;margin:0 0 4px}
h2{font-size:18px;margin:0 0 12px}
.meta{color:var(--ink-2);font-size:14px}
.banner{margin:16px 0;padding:10px 14px;border-radius:8px;border:1px solid var(--warning);background:color-mix(in srgb,var(--warning) 14%,transparent);font-size:14px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-top:20px;break-inside:avoid}
.summary p{margin:0 0 6px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:20px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.kpi .label{color:var(--ink-2);font-size:13px}
.kpi .value{font-size:28px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.2}
.kpi .sub{color:var(--muted);font-size:12px}
.insight{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;padding:12px 0;border-top:1px solid var(--grid)}
.insight:first-of-type{border-top:0;padding-top:0}
.insight .title{font-weight:600}
.insight .detail,.insight .rec{grid-column:2;font-size:14px;color:var(--ink-2)}
.insight .rec strong{color:var(--ink)}
.pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid var(--border);white-space:nowrap;height:fit-content}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media (max-width:760px){.two{grid-template-columns:1fr}}
.two .card{margin-top:0;min-width:0}
.grid-row{margin-top:20px}
svg{display:block;width:100%;height:auto;overflow:visible;min-width:400px}
svg.wide{min-width:620px}
.chart{overflow-x:auto;overflow-y:hidden;padding-bottom:4px}
svg text{fill:var(--ink-2);font:12px system-ui,-apple-system,"Segoe UI",sans-serif}
svg .val{fill:var(--ink);font-weight:600}
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
th{text-align:left;color:var(--ink-2);font-weight:600;font-size:12px;padding:6px 8px;border-bottom:1px solid var(--axis);white-space:nowrap}
td{padding:7px 8px;border-bottom:1px solid var(--grid);white-space:nowrap}
td.num,th.num{text-align:right}
.note{color:var(--muted);font-size:12px;margin-top:10px}
.top{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.top ol{margin:6px 0 0;padding-left:20px;font-size:14px}
.top h3{font-size:14px;margin:0;color:var(--ink-2)}
.up{color:var(--good-text)} .down{color:var(--critical)}
footer{margin-top:24px;color:var(--muted);font-size:12px}
.actions{margin-top:12px}
.actions a,.actions button{font:inherit;font-size:13px;color:var(--series);background:none;border:1px solid var(--border);border-radius:8px;padding:5px 10px;cursor:pointer;text-decoration:none;margin-right:6px}
@media print{
  :root{--page:#fff;--surface:#fff}
  .actions{display:none}
  main{padding:0}
  .card,.kpi{border-color:#ccc}
}
</style>
</head>
<body>
<main>
  <h1>${esc(report.title)}</h1>
  <div class="meta">
    Period: ${fmtDate(report.period.from)} – ${fmtDate(report.period.to)} ·
    Generated ${fmtDateTime(report.generatedAt)}
  </div>
  <div class="actions">
    <button onclick="window.print()">Print / Save as PDF</button>
    <a href="export.csv${queryString(report.filters)}">Download raw data (CSV)</a>
    <a href="report${queryString(report.filters)}">View as JSON</a>
  </div>
  ${sample ? `<div class="banner"><strong>Sample data.</strong> This report ${o.dataSource === 'mixed' ? 'includes' : 'uses'} made-up learners and games so the dashboard can be built and tested. Real results replace it once classes start playing.</div>` : ''}

  <section class="card summary">
    <h2>Summary</h2>
    ${report.summary.map(s => `<p>${esc(s)}</p>`).join('')}
  </section>

  <section class="kpis">
    ${kpi('Learners', o.totalPlayers)}
    ${kpi('Games played', o.totalSessions, `${o.completedGames} finished`)}
    ${kpi('Questions answered', o.totalQuestionsAnswered.toLocaleString('en-ZA'))}
    ${kpi('Accuracy', `${o.overallAccuracy}%`, `${o.correctAnswers.toLocaleString('en-ZA')} correct`)}
    ${kpi('Avg answer time', `${(o.averageResponseTimeMs / 1000).toFixed(1)}s`)}
    ${kpi('Games won', `${o.winRate}%`, `${o.wins} won · ${o.losses} lost`)}
  </section>

  <section class="card">
    <h2>Key findings</h2>
    ${report.insights.map(renderInsight).join('')}
  </section>

  <div class="two grid-row">
    <section class="card">
      <h2>Accuracy by operation</h2>
      <div class="chart">${operationChart(report.operations)}</div>
      <p class="note">Dashed lines: 60% (developing) and 80% (strong).</p>
    </section>
    <section class="card">
      <h2>Average answer time by operation</h2>
      <div class="chart">${barChart(report.operations.map(x => ({ label: x.name, value: x.averageResponseTimeMs / 1000, tip: `${x.name}: ${(x.averageResponseTimeMs / 1000).toFixed(1)}s average (${x.answered} answers)` })), v => `${v.toFixed(1)}s`)}</div>
    </section>
  </div>

  <section class="card">
    <h2>Daily accuracy</h2>
    <div class="chart">${lineChart(report.trend)}</div>
    <p class="note">Days with no games are left blank.</p>
  </section>

  <div class="two grid-row">
    <section class="card">
      <h2>Questions answered per day</h2>
      <div class="chart">${columnChart(report.trend)}</div>
    </section>
    <section class="card">
      <h2>How fast learners answer</h2>
      <div class="chart">${barChart(report.responseTimes.map(b => ({ label: b.label, value: b.percentage, tip: `${b.label}: ${b.count} answers (${b.percentage}%)` })), v => `${v}%`)}</div>
    </section>
  </div>

  <section class="card">
    <h2>Learners</h2>
    <div class="tbl-wrap">
    <table>
      <thead><tr>
        <th>Learner</th><th class="num">Games</th><th class="num">Questions</th><th class="num">Accuracy</th>
        <th class="num">Avg time</th><th class="num">Won / lost</th><th>Weakest</th><th>Trend</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${[...report.players].sort((a, b) => a.accuracy - b.accuracy).map(renderPlayerRow).join('')}
      </tbody>
    </table>
    </div>
    <p class="note">Sorted with the learners who need the most help first. Trend compares the first half of a learner's answers with the second half.</p>
  </section>

  <section class="card">
    <h2>Top performers</h2>
    <div class="top">
      ${topList('Highest accuracy', report.topPerformers.highestAccuracy, v => `${v}%`)}</div>
      ${topList('Most improved', report.topPerformers.mostImproved, v => `${v > 0 ? '+' : ''}${v} pts`)}
      ${topList('Longest streak', report.topPerformers.longestStreak, v => `${v} in a row`)}
      ${topList('Highest score', report.topPerformers.highestScore, v => `${v}`)}
    </div>
  </section>

  <section class="card">
    <h2>Accuracy by difficulty level</h2>
    <div class="tbl-wrap">
    <table>
      <thead><tr><th>Level</th><th class="num">Questions</th><th class="num">Accuracy</th><th class="num">Avg time</th></tr></thead>
      <tbody>
        ${report.difficulty.map(d => `<tr><td>Level ${d.difficulty}</td><td class="num">${d.answered}</td><td class="num">${d.answered ? d.accuracy + '%' : '–'}</td><td class="num">${d.answered ? (d.averageResponseTimeMs / 1000).toFixed(1) + 's' : '–'}</td></tr>`).join('')}
      </tbody>
    </table>
    </div>
  </section>

  <footer>
    Strong = ${report.thresholds.strongAccuracy}%+ correct · Developing = ${report.thresholds.developingAccuracy}–${report.thresholds.strongAccuracy - 1}% ·
    Needs support = below ${report.thresholds.developingAccuracy}% (only shown once a learner has ${report.thresholds.minAnswersForLabel}+ answers).
    Learner data is for classroom use only (POPIA).
  </footer>
</main>
</body>
</html>`;
}

// ---------- pieces ----------

function kpi(label, value, sub = '') {
    return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${esc(String(value))}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
}

const SEVERITY = {
    high: { label: 'Act now', color: 'var(--critical)', icon: '!' },
    medium: { label: 'Watch', color: 'var(--serious)', icon: '▲' },
    info: { label: 'Good to know', color: 'var(--series)', icon: 'i' }
};

function renderInsight(i) {
    const s = SEVERITY[i.severity] || SEVERITY.info;
    return `<div class="insight">
      <span class="pill"><span class="dot" style="background:${s.color}"></span>${s.label}</span>
      <div class="title">${esc(i.title)}</div>
      <div class="detail">${esc(i.detail)}</div>
      <div class="rec"><strong>What to do:</strong> ${esc(i.recommendation)}</div>
    </div>`;
}

function statusPill(p) {
    if (p.masteryLevel === 'Not enough data') return `<span class="pill">Not enough data</span>`;
    const map = {
        'Strong': 'var(--good)',
        'Developing': 'var(--warning)',
        'Needs support': 'var(--critical)'
    };
    return `<span class="pill"><span class="dot" style="background:${map[p.masteryLevel]}"></span>${p.masteryLevel}</span>`;
}

function renderPlayerRow(p) {
    const trend = {
        improving: `<span class="up">▲ ${p.accuracyChange > 0 ? '+' : ''}${p.accuracyChange}</span>`,
        declining: `<span class="down">▼ ${p.accuracyChange}</span>`,
        steady: `<span>– steady</span>`,
        not_enough_data: `<span style="color:var(--muted)">–</span>`
    }[p.trend];
    return `<tr>
      <td>${esc(p.playerName)}</td>
      <td class="num">${p.sessionsPlayed}</td>
      <td class="num">${p.questionsAnswered}</td>
      <td class="num">${p.accuracy}%</td>
      <td class="num">${(p.averageResponseTimeMs / 1000).toFixed(1)}s</td>
      <td class="num">${p.wins} / ${p.losses}</td>
      <td>${p.weakestOperation ? OP_NAMES[p.weakestOperation] : '–'}</td>
      <td>${trend}</td>
      <td>${statusPill(p)}</td>
    </tr>`;
}

function topList(title, items, fmt) {
    if (!items.length) return `<div><h3>${esc(title)}</h3><p class="note">Not enough data yet.</p></div>`;
    return `<div><h3>${esc(title)}</h3><ol>${items.map(i => `<li>${esc(i.playerName)} — ${esc(fmt(i.value))}</li>`).join('')}</ol></div>`;
}

// ---------- charts (inline SVG) ----------

// Horizontal bars, 0–100%, with 60% / 80% reference lines
function operationChart(ops) {
    const W = 460, rowH = 40, left = 110, right = 50, top = 8;
    const H = top + ops.length * rowH + 20;
    const x = v => left + (v / 100) * (W - left - right);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Accuracy by operation">`;
    [0, 20, 40, 60, 80, 100].forEach(t => {
        svg += `<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${H - 20}" stroke="var(--grid)" stroke-width="1"/>`;
        svg += `<text x="${x(t)}" y="${H - 4}" text-anchor="middle">${t}%</text>`;
    });
    [60, 80].forEach(t => {
        svg += `<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${H - 20}" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="4 3"/>`;
    });
    ops.forEach((o, i) => {
        const y = top + i * rowH + 10;
        const w = Math.max(0, x(o.accuracy) - left);
        svg += `<g><title>${esc(o.name)}: ${o.accuracy}% correct (${o.correct} of ${o.answered}) — ${o.masteryLevel}</title>
          <rect x="${left - 110}" y="${y - 8}" width="${W}" height="${rowH - 4}" fill="transparent"/>
          <text x="${left - 10}" y="${y + 14}" text-anchor="end">${esc(o.name)}</text>
          <rect x="${left}" y="${y}" width="${w}" height="20" rx="4" fill="var(--series)"/>
          <text class="val" x="${left + w + 6}" y="${y + 14}">${o.answered ? o.accuracy + '%' : '–'}</text></g>`;
    });
    return svg + `</svg>`;
}

// Generic horizontal bar chart (single series)
function barChart(items, fmt) {
    const W = 460, rowH = 34, left = 110, right = 56, top = 4;
    const H = top + items.length * rowH;
    const max = Math.max(...items.map(i => i.value), 0.0001);
    const x = v => (v / max) * (W - left - right);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
    svg += `<line x1="${left}" x2="${left}" y1="0" y2="${H}" stroke="var(--axis)"/>`;
    items.forEach((it, i) => {
        const y = top + i * rowH + 6;
        svg += `<g><title>${esc(it.tip)}</title>
          <rect x="0" y="${y - 6}" width="${W}" height="${rowH}" fill="transparent"/>
          <text x="${left - 10}" y="${y + 13}" text-anchor="end">${esc(it.label)}</text>
          <rect x="${left}" y="${y}" width="${Math.max(0, x(it.value))}" height="18" rx="4" fill="var(--series)"/>
          <text class="val" x="${left + x(it.value) + 6}" y="${y + 13}">${esc(fmt(it.value))}</text></g>`;
    });
    return svg + `</svg>`;
}

// Daily accuracy line, with gaps on days without games
function lineChart(trend) {
    const W = 900, H = 240, left = 44, right = 32, top = 16, bottom = 30;
    const n = trend.length;
    const x = i => left + (n === 1 ? 0 : (i / (n - 1)) * (W - left - right));
    const y = v => top + (1 - v / 100) * (H - top - bottom);
    let svg = `<svg class="wide" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily accuracy">`;
    [0, 25, 50, 75, 100].forEach(t => {
        svg += `<line x1="${left}" x2="${W - right}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)"/>`;
        svg += `<text x="${left - 8}" y="${y(t) + 4}" text-anchor="end">${t}%</text>`;
    });
    // Line segments only between consecutive days that both have data
    let path = '';
    let pen = false;
    trend.forEach((d, i) => {
        if (d.accuracy === null) { pen = false; return; }
        path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.accuracy).toFixed(1)} `;
        pen = true;
    });
    // Dotted connectors across empty days so the trend is still readable
    const pts = trend.map((d, i) => ({ d, i })).filter(p => p.d.accuracy !== null);
    for (let k = 1; k < pts.length; k++) {
        if (pts[k].i - pts[k - 1].i > 1) {
            svg += `<line x1="${x(pts[k - 1].i)}" y1="${y(pts[k - 1].d.accuracy)}" x2="${x(pts[k].i)}" y2="${y(pts[k].d.accuracy)}" stroke="var(--series)" stroke-width="1.5" stroke-dasharray="2 4" opacity=".6"/>`;
        }
    }
    svg += `<path d="${path}" fill="none" stroke="var(--series)" stroke-width="2" stroke-linejoin="round"/>`;
    trend.forEach((d, i) => {
        const label = shortDay(d.date);
        if (n <= 16 || i % Math.ceil(n / 14) === 0) {
            svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${label}</text>`;
        }
        if (d.accuracy !== null) {
            svg += `<g><title>${label}: ${d.accuracy}% correct · ${d.questionsAnswered} questions · ${d.activePlayers} learners</title>
              <circle cx="${x(i)}" cy="${y(d.accuracy)}" r="14" fill="transparent"/>
              <circle cx="${x(i)}" cy="${y(d.accuracy)}" r="4" fill="var(--series)" stroke="var(--surface)" stroke-width="2"/></g>`;
        }
    });
    // Label the last point
    const last = pts[pts.length - 1];
    if (last) {
        svg += `<text class="val" x="${x(last.i) - 8}" y="${y(last.d.accuracy) - 10}" text-anchor="end">${last.d.accuracy}%</text>`;
    }
    return svg + `</svg>`;
}

// Questions per day as columns
function columnChart(trend) {
    const W = 460, H = 200, left = 36, right = 8, top = 12, bottom = 30;
    const n = trend.length;
    const max = Math.max(...trend.map(d => d.questionsAnswered), 1);
    const niceMax = Math.ceil(max / 50) * 50 || 50;
    const slot = (W - left - right) / n;
    const bw = Math.max(4, slot - 4);
    const y = v => top + (1 - v / niceMax) * (H - top - bottom);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Questions answered per day">`;
    [0, niceMax / 2, niceMax].forEach(t => {
        svg += `<line x1="${left}" x2="${W - right}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)"/>`;
        svg += `<text x="${left - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
    });
    trend.forEach((d, i) => {
        const bx = left + i * slot + 2;
        const h = (H - top - bottom) - (y(d.questionsAnswered) - top);
        svg += `<g><title>${shortDay(d.date)}: ${d.questionsAnswered} questions · ${d.sessions} games</title>
          <rect x="${bx - 2}" y="${top}" width="${slot}" height="${H - top - bottom}" fill="transparent"/>
          ${d.questionsAnswered ? `<rect x="${bx}" y="${y(d.questionsAnswered)}" width="${bw}" height="${h}" rx="3" fill="var(--series)"/>` : ''}</g>`;
        if (i % 2 === (n - 1) % 2) {
            svg += `<text x="${bx + bw / 2}" y="${H - 8}" text-anchor="middle">${shortDay(d.date).split(' ')[0]}</text>`;
        }
    });
    return svg + `</svg>`;
}

// ---------- formatting ----------

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(iso) {
    if (!iso) return '–';
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' });
}

function fmtDateTime(iso) {
    return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });
}

function shortDay(yyyyMmDd) {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[m - 1]}`;
}

function queryString(filters = {}) {
    const keep = Object.entries(filters).filter(([k]) => k !== 'format');
    if (!keep.length) return '';
    return '?' + keep.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

module.exports = { renderReportHtml };
