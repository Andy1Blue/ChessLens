const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

function safeText(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case "'":
        return '&#39;';
      case '"':
        return '&quot;';
      default:
        return char;
    }
  });
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'ChessLens/1.0 (+https://github.com/Andy1Blue/ChessLens)',
            Accept: 'application/json'
          }
        },
        (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`Chess.com API returned ${res.statusCode}`));
              return;
            }

            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error('Invalid JSON response from Chess.com API'));
            }
          });
        }
      )
      .on('error', (error) => {
        reject(new Error(`Unable to reach Chess.com API: ${error.message}`));
      });
  });
}

function extractMode(stats, key) {
  const section = stats[key] || {};
  const record = section.record || {};
  const win = Number(record.win || 0);
  const loss = Number(record.loss || 0);
  const draw = Number(record.draw || 0);
  const total = win + loss + draw;
  const winRate = total > 0 ? Math.round((win / total) * 100) : 0;

  return {
    rating: section.last && section.last.rating ? section.last.rating : '—',
    win,
    draw,
    loss,
    winRate
  };
}

function renderDashboard(username, stats, errorMessage) {
  const cleanUser = safeText(username || '');
  const modes = {
    Bullet: extractMode(stats || {}, 'chess_bullet'),
    Blitz: extractMode(stats || {}, 'chess_blitz'),
    Rapid: extractMode(stats || {}, 'chess_rapid'),
    Daily: extractMode(stats || {}, 'chess_daily')
  };

  const tactics = stats && stats.tactics && stats.tactics.highest ? stats.tactics.highest.rating : '—';
  const puzzleRush = stats && stats.puzzle_rush && stats.puzzle_rush.best ? stats.puzzle_rush.best.score : '—';

  const cards = Object.entries(modes)
    .map(
      ([label, mode]) => `
        <section class="card">
          <h3>${label}</h3>
          <div class="rating">${safeText(mode.rating)}</div>
          <p class="record">W/D/L: ${mode.win}/${mode.draw}/${mode.loss}</p>
          <div class="progress-wrap" role="img" aria-label="${label} win rate ${mode.winRate}%">
            <div class="progress" style="width:${mode.winRate}%"></div>
          </div>
          <p class="win-rate">Win Rate: ${mode.winRate}%</p>
        </section>
      `
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ChessLens</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0c111b;
      --panel: #141b2a;
      --panel-border: #24324f;
      --text: #e7edf9;
      --muted: #94a5c7;
      --accent: #53b4ff;
      --accent-strong: #2f93e7;
      --danger: #f36b7f;
      --bar-bg: #202a40;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, Segoe UI, Roboto, system-ui, sans-serif;
      background: radial-gradient(circle at top, #18223a, var(--bg) 45%);
      color: var(--text);
      padding: 1rem;
    }

    .container {
      max-width: 980px;
      margin: 0 auto;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.7rem, 4vw, 2.2rem);
      letter-spacing: 0.03em;
    }

    .sub {
      margin: 0.3rem 0 1rem;
      color: var(--muted);
    }

    form {
      display: flex;
      gap: 0.5rem;
      margin: 1rem 0 1.25rem;
      flex-wrap: wrap;
    }

    input {
      flex: 1 1 220px;
      border: 1px solid var(--panel-border);
      background: #0f1523;
      color: var(--text);
      padding: 0.65rem 0.8rem;
      border-radius: 10px;
      font-size: 1rem;
    }

    button {
      border: 0;
      border-radius: 10px;
      padding: 0.65rem 1rem;
      background: linear-gradient(130deg, var(--accent), var(--accent-strong));
      color: #fff;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
    }

    .error {
      margin: 0.25rem 0 1rem;
      color: var(--danger);
    }

    .meta-grid,
    .cards {
      display: grid;
      gap: 0.9rem;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    }

    .cards {
      margin-top: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .card {
      background: linear-gradient(170deg, #171f31, var(--panel));
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      padding: 1rem;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
    }

    h2, h3 {
      margin: 0 0 0.35rem;
      font-size: 1rem;
      color: #dce8ff;
      font-weight: 600;
    }

    .rating {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.35rem;
    }

    .record,
    .win-rate,
    .hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.93rem;
    }

    .progress-wrap {
      margin: 0.6rem 0 0.4rem;
      height: 10px;
      border-radius: 999px;
      background: var(--bar-bg);
      overflow: hidden;
      border: 1px solid #2f3c5c;
    }

    .progress {
      height: 100%;
      background: linear-gradient(90deg, #4ecb83, #47b86f);
      border-radius: 999px;
    }
  </style>
</head>
<body>
  <main class="container">
    <h1>ChessLens</h1>
    <p class="sub">Live chess.com stats dashboard</p>

    <form method="get" action="/">
      <input name="u" value="${cleanUser}" placeholder="Enter chess.com username" required>
      <button type="submit">Load Stats</button>
    </form>

    ${errorMessage ? `<p class="error">${safeText(errorMessage)}</p>` : ''}

    ${username ? `
      <section class="meta-grid">
        <article class="card">
          <h2>Player</h2>
          <div class="rating">${cleanUser}</div>
          <p class="hint">Data source: chess.com public API</p>
        </article>
        <article class="card">
          <h2>Tactics Best</h2>
          <div class="rating">${safeText(tactics)}</div>
        </article>
        <article class="card">
          <h2>Puzzle Rush Best</h2>
          <div class="rating">${safeText(puzzleRush)}</div>
        </article>
      </section>
      <section class="cards">${cards}</section>
    ` : '<p class="hint">Pass a username via <code>?u=&lt;nick&gt;</code> or use the input above.</p>'}
  </main>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const username = (requestUrl.searchParams.get('u') || '').trim();

  let stats = null;
  let errorMessage = '';

  if (username) {
    try {
      stats = await requestJson(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`);
    } catch (error) {
      errorMessage = error.message;
    }
  }

  const html = renderDashboard(username, stats, errorMessage);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`ChessLens running on http://localhost:${PORT}`);
});
