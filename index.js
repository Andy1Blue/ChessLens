'use strict';

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DEFAULT_USER = 'yournickname';

function fetchJSON(apiUrl) {
  return new Promise((resolve, reject) => {
    const opts = new URL(apiUrl);
    const req = https.request(
      { hostname: opts.hostname, path: opts.pathname + opts.search, method: 'GET',
        headers: { 'User-Agent': 'ChessStatsViewer/1.0 (personal dashboard)' } },
      res => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          if (res.statusCode === 404) return reject(new Error('Player not found'));
          if (res.statusCode !== 200) return reject(new Error(`API error ${res.statusCode}`));
          try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function winPct(w, l, d) {
  const total = (w || 0) + (l || 0) + (d || 0);
  if (!total) return null;
  return Math.round(((w || 0) / total) * 100);
}

function normalizeUsername(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidUsername(username) {
  return /^[a-z0-9_-]{1,50}$/i.test(username);
}

function formatCompareMetric(modeStats) {
  if (!modeStats) return '—';
  const rating = modeStats.rating ? `${modeStats.rating}` : '—';
  const pct = modeStats.winPercent !== null ? `${modeStats.winPercent}%` : '—';
  return `${rating} (${pct})`;
}

function getModeSnapshot(stats, key) {
  const mode = stats?.[key];
  if (!mode) return null;
  const record = mode.record || {};
  const win = record.win || 0;
  const loss = record.loss || 0;
  const draw = record.draw || 0;
  return {
    rating: mode.last?.rating || null,
    winPercent: winPct(win, loss, draw),
  };
}

function gameCard(label, icon, data) {
  if (!data) return '';
  const r = data.record || {};
  const last = data.last || {};
  const best = data.best || {};
  const w = r.win || 0, l = r.loss || 0, d = r.draw || 0;
  const total = w + l + d;
  const pct = winPct(w, l, d);
  const barW = pct !== null ? pct : 0;
  const barL = total ? Math.round((l / total) * 100) : 0;
  const barD = total ? 100 - barW - barL : 0;

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-icon">${icon}</span>
        <span class="card-title">${esc(label)}</span>
        ${last.rating ? `<span class="rating-badge">${esc(last.rating)}</span>` : ''}
      </div>
      <div class="card-body">
        ${best.rating ? `
        <div class="stat-row">
          <span class="stat-label">Best rating</span>
          <span class="stat-value best">${esc(best.rating)}
            ${best.date ? `<small>${fmtDate(best.date)}</small>` : ''}
          </span>
        </div>` : ''}
        ${total ? `
        <div class="stat-row">
          <span class="stat-label">Games played</span>
          <span class="stat-value">${total.toLocaleString()}</span>
        </div>
        <div class="wld-row">
          <span class="wld win" title="Wins">W ${w.toLocaleString()}</span>
          <span class="wld draw" title="Draws">D ${d.toLocaleString()}</span>
          <span class="wld loss" title="Losses">L ${l.toLocaleString()}</span>
        </div>
        <div class="bar-wrap" title="${barW}% wins">
          <div class="bar-win" style="width:${barW}%"></div>
          <div class="bar-draw" style="width:${barD}%"></div>
          <div class="bar-loss" style="width:${barL}%"></div>
        </div>
        ${pct !== null ? `<div class="win-pct">${pct}% win rate</div>` : ''}
        ` : '<div class="no-games">No games yet</div>'}
      </div>
    </div>`;
}

function buildPage({
  username,
  stats,
  error,
  compareUsername,
  compareStats,
  compareError,
}) {
  const gameTypes = [
    { key: 'chess_bullet',  label: 'Bullet',  icon: '⚡' },
    { key: 'chess_blitz',   label: 'Blitz',   icon: '🔥' },
    { key: 'chess_rapid',   label: 'Rapid',   icon: '⏱' },
    { key: 'chess_daily',   label: 'Daily',   icon: '📅' },
  ];
  const hasComparisonRequest = Boolean(compareUsername);
  const hasComparisonData = Boolean(compareUsername && compareStats);
  const pageErrors = [error, compareError].filter(Boolean);

  const cards = gameTypes.map(({ key, label, icon }) =>
    gameCard(label, icon, stats?.[key])
  ).join('');

  const tactics = stats?.tactics;
  const puzzleRush = stats?.puzzle_rush;

  const extrasHtml = (tactics?.highest?.rating || puzzleRush?.best?.score) ? `
    <div class="extras-grid">
      ${tactics?.highest?.rating ? `
      <div class="extra-card">
        <div class="extra-icon">♟</div>
        <div class="extra-label">Tactics Best</div>
        <div class="extra-val">${esc(tactics.highest.rating)}</div>
        ${tactics.highest.date ? `<div class="extra-date">${fmtDate(tactics.highest.date)}</div>` : ''}
      </div>` : ''}
      ${puzzleRush?.best?.score ? `
      <div class="extra-card">
        <div class="extra-icon">🧩</div>
        <div class="extra-label">Puzzle Rush</div>
        <div class="extra-val">${esc(puzzleRush.best.score)}</div>
        <div class="extra-date">${esc(puzzleRush.best.total_attempts || '')} attempts</div>
      </div>` : ''}
    </div>` : '';

  const comparisonRows = hasComparisonData
    ? gameTypes.map(({ key, label }) => {
      const left = formatCompareMetric(getModeSnapshot(stats, key));
      const right = formatCompareMetric(getModeSnapshot(compareStats, key));
      return `
        <tr>
          <td>${esc(label)}</td>
          <td>${esc(left)}</td>
          <td>${esc(right)}</td>
        </tr>`;
    }).join('')
    : '';

  const comparisonHtml = hasComparisonData ? `
    <div class="section-title">Player Comparison</div>
    <div class="compare-card">
      <div class="compare-head">Current rating (Win rate)</div>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th>Mode</th>
              <th>${esc(username)}</th>
              <th>${esc(compareUsername)}</th>
            </tr>
          </thead>
          <tbody>${comparisonRows}</tbody>
        </table>
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chess Stats${username ? ' — ' + esc(username) : ''}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:      #0d0d0f;
      --surface: #16161a;
      --card:    #1e1e24;
      --border:  #2a2a35;
      --green:   #81b64c;
      --gold:    #e8c96a;
      --red:     #c0392b;
      --draw:    #7f8c8d;
      --text:    #e8e8ec;
      --muted:   #888899;
      --radius:  14px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 0 0 40px;
    }

    header {
      background: linear-gradient(135deg, #1a1a22 0%, #111116 100%);
      border-bottom: 1px solid var(--border);
      padding: 24px 20px 20px;
      text-align: center;
    }

    .logo { font-size: 2rem; line-height: 1; margin-bottom: 6px; }

    h1 {
      font-size: clamp(1.3rem, 4vw, 1.8rem);
      font-weight: 700;
      letter-spacing: -0.5px;
      color: var(--text);
    }

    h1 span { color: var(--gold); }

    .subtitle { color: var(--muted); font-size: 0.85rem; margin-top: 4px; }

    .search-form {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 18px;
      flex-wrap: wrap;
    }

    .search-form input {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 1rem;
      width: min(260px, 100%);
      outline: none;
      transition: border-color .2s;
    }
    .search-form input:focus { border-color: var(--gold); }
    .search-form input::placeholder { color: var(--muted); }

    .search-form button {
      background: var(--gold);
      color: #111;
      border: none;
      border-radius: 8px;
      padding: 10px 22px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: opacity .2s;
    }
    .search-form button:hover { opacity: .85; }

    .container { max-width: 960px; margin: 0 auto; padding: 28px 16px 0; }

    .error-box {
      background: #2a0d0d; border: 1px solid #6b2020;
      color: #e87a7a; border-radius: var(--radius); padding: 18px 24px;
      text-align: center; font-size: 1rem;
    }

    .player-hero {
      display: flex; align-items: center; gap: 16px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px 24px; margin-bottom: 24px;
    }
    .player-avatar {
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--border); display: flex; align-items: center;
      justify-content: center; font-size: 1.6rem; flex-shrink: 0;
    }
    .player-name { font-size: 1.3rem; font-weight: 700; }
    .player-link { font-size: 0.8rem; color: var(--muted); margin-top: 2px; }
    .player-link a { color: var(--gold); text-decoration: none; }
    .player-link a:hover { text-decoration: underline; }

    .section-title {
      font-size: 0.75rem; font-weight: 700; letter-spacing: 1.5px;
      text-transform: uppercase; color: var(--muted); margin-bottom: 14px;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 14px;
      margin-bottom: 28px;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      transition: transform .15s, border-color .15s;
    }
    .card:hover { transform: translateY(-2px); border-color: #3a3a4a; }

    .card-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border);
    }
    .card-icon { font-size: 1.1rem; }
    .card-title { font-weight: 700; font-size: 0.95rem; flex: 1; }
    .rating-badge {
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 6px; padding: 2px 8px;
      font-size: 0.9rem; font-weight: 700; color: var(--gold);
    }

    .card-body { padding: 14px 16px; }

    .stat-row {
      display: flex; justify-content: space-between; align-items: baseline;
      margin-bottom: 8px; gap: 8px;
    }
    .stat-label { font-size: 0.78rem; color: var(--muted); }
    .stat-value { font-size: 0.9rem; font-weight: 600; text-align: right; }
    .stat-value.best { color: var(--gold); }
    .stat-value small { display: block; font-size: 0.68rem; color: var(--muted); font-weight: 400; margin-top: 1px; }

    .wld-row {
      display: flex; gap: 6px; margin-bottom: 8px; font-size: 0.8rem; font-weight: 700;
    }
    .wld { padding: 2px 8px; border-radius: 5px; }
    .wld.win  { background: rgba(129,182,76,.15); color: var(--green); }
    .wld.draw { background: rgba(127,140,141,.12); color: var(--draw); }
    .wld.loss { background: rgba(192,57,43,.15); color: var(--red); }

    .bar-wrap {
      display: flex; border-radius: 4px; overflow: hidden; height: 6px;
      background: var(--border); margin-bottom: 6px;
    }
    .bar-win  { background: var(--green); transition: width .4s; }
    .bar-draw { background: var(--draw);  transition: width .4s; }
    .bar-loss { background: var(--red);   transition: width .4s; }

    .win-pct { font-size: 0.72rem; color: var(--muted); text-align: right; }
    .no-games { font-size: 0.82rem; color: var(--muted); font-style: italic; }

    .extras-grid {
      display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 28px;
    }
    .extra-card {
      flex: 1 1 160px; min-width: 140px;
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 18px 20px; text-align: center;
    }
    .extra-icon { font-size: 1.6rem; margin-bottom: 6px; }
    .extra-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); }
    .extra-val { font-size: 1.5rem; font-weight: 800; color: var(--gold); margin: 4px 0 2px; }
    .extra-date { font-size: 0.75rem; color: var(--muted); }

    .compare-card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 16px; margin-bottom: 28px;
    }
    .compare-head { color: var(--muted); font-size: 0.8rem; margin-bottom: 10px; }
    .compare-table-wrap { overflow-x: auto; }
    .compare-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .compare-table th, .compare-table td {
      border-bottom: 1px solid var(--border); padding: 10px 8px; text-align: left;
    }
    .compare-table th { color: var(--muted); font-weight: 700; }
    .compare-table td:first-child { font-weight: 700; }

    .footer {
      text-align: center; color: var(--muted); font-size: 0.75rem;
      margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border);
    }
    .footer a { color: var(--gold); text-decoration: none; }

    .home-hint {
      text-align: center; color: var(--muted); padding: 60px 20px;
      font-size: 1rem; line-height: 1.7;
    }
    .home-hint .big { font-size: 3rem; margin-bottom: 16px; }
    .home-hint code {
      background: var(--card); border: 1px solid var(--border);
      border-radius: 6px; padding: 2px 8px; font-size: 0.9rem; color: var(--gold);
    }

    @media (max-width: 480px) {
      .cards-grid { grid-template-columns: 1fr 1fr; }
      .player-hero { padding: 16px; }
    }
    @media (max-width: 340px) {
      .cards-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">♟</div>
    <h1>Chess <span>Stats</span></h1>
    <div class="subtitle">chess.com profile viewer</div>
    <form class="search-form" method="GET" action="/">
      <input name="u" type="text" placeholder="Player 1 username…" value="${esc(username || '')}" autocomplete="off" spellcheck="false" />
      <input name="v" type="text" placeholder="Player 2 username (optional)..." value="${esc(compareUsername || '')}" autocomplete="off" spellcheck="false" />
      <button type="submit">Search</button>
    </form>
  </header>

  <div class="container">
    ${pageErrors.map(msg => `<div class="error-box">⚠ ${esc(msg)}</div>`).join('')}

    ${stats && username ? `
    <div class="player-hero">
      <div class="player-avatar">♟</div>
      <div>
        <div class="player-name">${esc(username)}</div>
        <div class="player-link">
          <a href="https://www.chess.com/member/${encodeURIComponent(username)}" target="_blank" rel="noopener noreferrer">
            chess.com/member/${esc(username)} ↗
          </a>
        </div>
      </div>
    </div>

    <div class="section-title">Game Ratings &amp; Records</div>
    <div class="cards-grid">${cards}</div>

    ${extrasHtml}
    ${comparisonHtml}
    ` : ''}

    ${!username && !hasComparisonRequest && !pageErrors.length ? `
    <div class="home-hint">
      <div class="big">♟</div>
      Enter a chess.com username above<br/>
      or open <code>/?u=playerone&amp;v=playertwo</code>
    </div>` : ''}

    <div class="footer">
      Data via <a href="https://www.chess.com/news/view/published-data-api" target="_blank" rel="noopener noreferrer">chess.com Public API</a>
    </div>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname !== '/') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }

  let username = normalizeUsername(parsed.query.u);
  let compareUsername = normalizeUsername(parsed.query.v);

  if (!username && compareUsername) {
    username = compareUsername;
    compareUsername = '';
  }

  if (!username) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(buildPage({
      username: '',
      stats: null,
      error: null,
      compareUsername: '',
      compareStats: null,
      compareError: null,
    }));
  }

  if (!isValidUsername(username)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(buildPage({
      username,
      stats: null,
      error: 'Invalid username format.',
      compareUsername,
      compareStats: null,
      compareError: null,
    }));
  }

  if (compareUsername && !isValidUsername(compareUsername)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(buildPage({
      username,
      stats: null,
      error: null,
      compareUsername,
      compareStats: null,
      compareError: 'Invalid comparison username format.',
    }));
  }

  const urls = [
    `https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`,
  ];
  if (compareUsername) {
    urls.push(`https://api.chess.com/pub/player/${encodeURIComponent(compareUsername)}/stats`);
  }

  const [primaryResult, compareResult] = await Promise.allSettled(urls.map(fetchJSON));

  const stats = primaryResult.status === 'fulfilled' ? primaryResult.value : null;
  const error = primaryResult.status === 'rejected' ? primaryResult.reason.message : null;
  const compareStats = compareUsername && compareResult?.status === 'fulfilled' ? compareResult.value : null;
  const compareError = compareUsername && compareResult?.status === 'rejected' ? compareResult.reason.message : null;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(buildPage({
    username,
    stats,
    error,
    compareUsername,
    compareStats,
    compareError,
  }));
});

server.listen(PORT, () => {
  console.log(`\n♟  Chess Stats running at http://localhost:${PORT}`);
  console.log(`   Try: http://localhost:${PORT}/?u=${DEFAULT_USER}&v=opponentname\n`);
});
