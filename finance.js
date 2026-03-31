/**
 * SaintSal™ Labs — Finance & Real Estate Intelligence
 * Handles both #page-finance and #page-realestate
 * Saint Vision Technologies LLC | US Patent #10,290,222 (HACP™)
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const SAL_KEY = 'saintvision_gateway_2025';
const API = '';  // Same origin

// ── State ─────────────────────────────────────────────────────────────────────
let _marketTickerInterval = null;
let _financeChatHistory = [];
let _reSearchResults = [];

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

async function _apiGet(path) {
  const res = await fetch(API + path, {
    headers: { 'x-sal-key': SAL_KEY },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function _apiPost(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sal-key': SAL_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * SSE streaming helper. Calls onChunk with each text piece, onDone when done.
 */
async function _streamPost(path, body, onChunk, onDone) {
  const response = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sal-key': SAL_KEY },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { onDone?.(); break; }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.type === 'chunk' && d.content) onChunk(d.content);
          if (d.type === 'done' || d.type === 'complete') { onDone?.(d); return; }
          if (d.type === 'error') { onDone?.({ error: d.message }); return; }
        } catch (_) { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function _fmt(n, decimals = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function _fmtDollar(n) {
  if (n === null || n === undefined) return '—';
  return '$' + _fmt(n, 0);
}

function _fmtPct(n) {
  if (n === null || n === undefined) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '') + _fmt(v, 2) + '%';
}

function _dirColor(direction, val) {
  if (direction === 'up' || (typeof val === 'number' && val >= 0)) return 'var(--green)';
  return 'var(--coral)';
}

function _renderMarkdown(text) {
  // Minimal markdown: bold, headers, bullets, code blocks
  return text
    .replace(/```[\s\S]*?```/g, m => `<pre style="background:var(--bg2);padding:12px;border-radius:8px;font-family:var(--mono);font-size:12px;overflow-x:auto;margin:8px 0">${m.replace(/```\w*/g,'').trim()}</pre>`)
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg2);padding:2px 6px;border-radius:4px;font-family:var(--mono);font-size:12px">$1</code>')
    .replace(/^#### (.+)$/gm, '<h4 style="color:var(--gold);margin:12px 0 6px;font-size:13px">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="color:var(--t1);margin:16px 0 8px;font-size:15px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:var(--gold);margin:20px 0 10px;font-size:17px;border-bottom:1px solid var(--brd);padding-bottom:6px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:var(--t1);margin:24px 0 12px;font-size:20px;font-weight:700">$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--t1)">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="margin:8px 0;padding-left:20px;list-style:disc">${m}</ul>`)
    .replace(/\n\n/g, '</p><p style="margin:8px 0">')
    .replace(/^(.+)$/gm, (m) => m.startsWith('<') ? m : m);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * loadFinance() — entry point, called by app.js navigate()
 */
async function loadFinance() {
  const container = document.getElementById('finance-content');
  if (!container) return;

  container.innerHTML = _financeShell();
  _attachFinanceListeners();

  // Kick off data loads
  _loadMarketTicker();
  _loadPortfolioWidget();

  // Auto-refresh ticker every 60 seconds
  if (_marketTickerInterval) clearInterval(_marketTickerInterval);
  _marketTickerInterval = setInterval(_loadMarketTicker, 60000);
}

function _financeShell() {
  return `
<div style="display:flex;flex-direction:column;gap:24px;padding:0 0 40px">

  <!-- Market Ticker Bar -->
  <div id="finance-ticker-wrap" style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:16px 20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0">Market Overview</h3>
        <span id="finance-market-updated" style="font-size:11px;color:var(--t3)">Loading...</span>
      </div>
      <button onclick="_loadMarketTicker()" style="background:transparent;border:1px solid var(--brd);color:var(--t2);padding:4px 10px;border-radius:var(--r8);font-size:11px;cursor:pointer">Refresh</button>
    </div>
    <div id="finance-ticker-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
      ${_tickerSkeleton()}
    </div>
  </div>

  <!-- Two-column: Movers + Portfolio -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

    <!-- Market Movers -->
    <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:20px">
      <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0 0 14px">Today's Movers</h3>
      <div id="finance-movers">
        <div style="color:var(--t3);font-size:13px">Loading movers...</div>
      </div>
    </div>

    <!-- Portfolio Widget -->
    <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:20px">
      <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0 0 14px">Alpaca Portfolio</h3>
      <div id="finance-portfolio-widget">
        <div style="color:var(--t3);font-size:13px">Loading portfolio...</div>
      </div>
    </div>

  </div>

  <!-- AI Finance Chat -->
  <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:20px">
    <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0 0 16px">SAL Finance Intelligence</h3>

    <!-- Starter prompts -->
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      ${[
        'Analyze NVDA',
        'What is the Fed doing?',
        'DCF on Apple',
        'Market outlook Q2 2026',
        'Best dividend stocks',
        'Crypto thesis 2026',
      ].map(p => `<button class="finance-prompt-chip" onclick="_financePromptClick(this)" data-prompt="${p}" style="background:var(--bg3);border:1px solid var(--brd);color:var(--t2);padding:6px 12px;border-radius:20px;font-size:12px;cursor:pointer;transition:all 0.15s">${p}</button>`).join('')}
    </div>

    <!-- Chat history -->
    <div id="finance-chat-history" style="min-height:80px;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;margin-bottom:16px"></div>

    <!-- Input -->
    <div style="display:flex;gap:10px">
      <textarea id="finance-chat-input" placeholder="Ask SAL about any stock, crypto, macro, or strategy..." rows="2"
        style="flex:1;background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);color:var(--t1);padding:10px 14px;font-size:13px;resize:none;outline:none;font-family:var(--font)"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_financeChat()}"
      ></textarea>
      <button id="finance-chat-send" onclick="_financeChat()" style="background:var(--gold);color:#000;border:none;border-radius:var(--r8);padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;align-self:flex-end;white-space:nowrap">Send</button>
    </div>
  </div>

  <!-- DCF Calculator -->
  <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:20px">
    <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0 0 4px">DCF Valuation Calculator</h3>
    <p style="color:var(--t3);font-size:12px;margin:0 0 16px">Discounted Cash Flow model — enterprise value range in seconds</p>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px">
      ${_dcfInputField('dcf-company', 'Company Name', 'text', 'Apple', '')}
      ${_dcfInputField('dcf-revenue', 'Revenue ($M)', 'number', '400000', '400000')}
      ${_dcfInputField('dcf-growth', 'Revenue Growth %', 'number', '8', '8')}
      ${_dcfInputField('dcf-ebitda', 'EBITDA Margin %', 'number', '32', '32')}
      ${_dcfInputField('dcf-wacc', 'Discount Rate % (WACC)', 'number', '10', '10')}
      ${_dcfInputField('dcf-multiple', 'Terminal EV/EBITDA', 'number', '16', '16')}
      ${_dcfInputField('dcf-years', 'Projection Years', 'number', '5', '5')}
      ${_dcfInputField('dcf-capex', 'CapEx % of Revenue', 'number', '5', '5')}
    </div>

    <button onclick="_runDCF()" style="background:var(--gold);color:#000;border:none;border-radius:var(--r8);padding:10px 24px;font-size:13px;font-weight:700;cursor:pointer">Calculate DCF</button>

    <div id="dcf-result" style="margin-top:16px"></div>
  </div>

</div>`;
}

function _dcfInputField(id, label, type, placeholder, defaultVal) {
  return `
  <div>
    <label style="display:block;font-size:11px;color:var(--t3);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${label}</label>
    <input id="${id}" type="${type}" placeholder="${placeholder}" value="${defaultVal}"
      style="width:100%;background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);color:var(--t1);padding:8px 10px;font-size:13px;box-sizing:border-box;outline:none" />
  </div>`;
}

function _tickerSkeleton() {
  return Array(7).fill(0).map(() => `
    <div style="background:var(--bg3);border-radius:var(--r8);padding:12px;border:1px solid var(--brd)">
      <div style="height:10px;width:40px;background:var(--brd);border-radius:4px;margin-bottom:8px"></div>
      <div style="height:18px;width:70px;background:var(--brd);border-radius:4px;margin-bottom:4px"></div>
      <div style="height:10px;width:50px;background:var(--brd);border-radius:4px"></div>
    </div>
  `).join('');
}

// ── Market Ticker ─────────────────────────────────────────────────────────────

async function _loadMarketTicker() {
  try {
    const data = await _apiGet('/api/finance/markets');
    const instruments = data.instruments || [];
    const grid = document.getElementById('finance-ticker-grid');
    const updated = document.getElementById('finance-market-updated');
    if (!grid) return;

    grid.innerHTML = instruments.map(inst => {
      const changeColor = inst.direction === 'up' ? 'var(--green)' : 'var(--coral)';
      const arrow = inst.direction === 'up' ? '▲' : '▼';
      const priceStr = inst.category === 'crypto'
        ? (inst.price >= 1000 ? `$${(inst.price / 1000).toFixed(1)}k` : `$${_fmt(inst.price, 2)}`)
        : `$${_fmt(inst.price, 2)}`;
      return `
      <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);padding:12px;transition:border-color 0.2s"
           onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--brd)'">
        <div style="font-size:11px;font-weight:700;color:var(--t3);margin-bottom:4px;letter-spacing:0.5px">${inst.symbol}</div>
        <div style="font-size:17px;font-weight:700;color:var(--t1);margin-bottom:2px">${priceStr}</div>
        <div style="font-size:12px;font-weight:600;color:${changeColor}">${arrow} ${_fmtPct(inst.change_pct)}</div>
        <div style="font-size:10px;color:var(--t3);margin-top:2px">${inst.name}</div>
      </div>`;
    }).join('');

    if (updated) {
      const src = data.api_live ? 'Live' : 'Cached';
      updated.textContent = `${src} · Updated ${new Date().toLocaleTimeString()}`;
    }

    // Also load movers
    _loadMovers();
  } catch (e) {
    const grid = document.getElementById('finance-ticker-grid');
    if (grid) grid.innerHTML = `<div style="color:var(--coral);font-size:13px">Could not load market data.</div>`;
  }
}

async function _loadMovers() {
  const el = document.getElementById('finance-movers');
  if (!el) return;
  try {
    const data = await _apiGet('/api/finance/movers');
    const gainers = data.gainers || [];
    const losers = data.losers || [];

    if (!gainers.length && !losers.length) {
      // Show web context snippets if available
      const ctx = data.web_context || [];
      if (ctx.length) {
        el.innerHTML = `
          <div style="font-size:11px;color:var(--t3);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Web Intelligence</div>
          ${ctx.slice(0, 4).map(c => `
            <div style="padding:8px 0;border-bottom:1px solid var(--brd)">
              <a href="${c.url}" target="_blank" style="color:var(--blue);font-size:12px;font-weight:600;text-decoration:none">${c.title}</a>
              <p style="color:var(--t3);font-size:11px;margin:3px 0 0">${c.content}</p>
            </div>`).join('')}`;
        return;
      }
      el.innerHTML = `<div style="color:var(--t3);font-size:13px">Movers data unavailable.</div>`;
      return;
    }

    const renderMover = (m, isGainer) => {
      const chg = parseFloat(m.change_percent || m.percent_change || 0);
      const color = isGainer ? 'var(--green)' : 'var(--coral)';
      return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd)">
        <div>
          <span style="font-size:13px;font-weight:700;color:var(--t1)">${m.symbol || m.ticker || ''}</span>
          <span style="font-size:11px;color:var(--t3);margin-left:6px">${m.name || ''}</span>
        </div>
        <span style="font-size:13px;font-weight:700;color:${color}">${_fmtPct(chg)}</span>
      </div>`;
    };

    el.innerHTML = `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;color:var(--green);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Top Gainers</div>
        ${gainers.slice(0, 5).map(m => renderMover(m, true)).join('')}
      </div>
      ${losers.length ? `
      <div>
        <div style="font-size:11px;color:var(--coral);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Top Losers</div>
        ${losers.slice(0, 5).map(m => renderMover(m, false)).join('')}
      </div>` : ''}`;
  } catch (e) {
    if (el) el.innerHTML = `<div style="color:var(--t3);font-size:13px">Could not load movers.</div>`;
  }
}

async function _loadPortfolioWidget() {
  const el = document.getElementById('finance-portfolio-widget');
  if (!el) return;
  try {
    const data = await _apiGet('/api/alpaca/portfolio');
    if (!data.ok) {
      el.innerHTML = `
        <div style="color:var(--t3);font-size:13px;text-align:center;padding:20px 0">
          <div style="font-size:24px;margin-bottom:8px">📊</div>
          <div>Connect Alpaca to view portfolio</div>
          <div style="font-size:11px;margin-top:4px">Add ALPACA_API_KEY + ALPACA_SECRET_KEY to backend env</div>
        </div>`;
      return;
    }

    const dayColor = data.day_pl >= 0 ? 'var(--green)' : 'var(--coral)';
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="background:var(--bg3);border-radius:var(--r8);padding:12px;border:1px solid var(--brd)">
          <div style="font-size:11px;color:var(--t3);margin-bottom:4px">Portfolio Value</div>
          <div style="font-size:20px;font-weight:700;color:var(--t1)">${_fmtDollar(data.portfolio_value || data.equity)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:var(--r8);padding:12px;border:1px solid var(--brd)">
          <div style="font-size:11px;color:var(--t3);margin-bottom:4px">Day P&L</div>
          <div style="font-size:20px;font-weight:700;color:${dayColor}">${data.day_pl >= 0 ? '+' : ''}${_fmtDollar(data.day_pl)} <span style="font-size:13px">(${_fmtPct(data.day_pl_pct)})</span></div>
        </div>
        <div style="background:var(--bg3);border-radius:var(--r8);padding:12px;border:1px solid var(--brd)">
          <div style="font-size:11px;color:var(--t3);margin-bottom:4px">Cash</div>
          <div style="font-size:16px;font-weight:600;color:var(--t1)">${_fmtDollar(data.cash)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:var(--r8);padding:12px;border:1px solid var(--brd)">
          <div style="font-size:11px;color:var(--t3);margin-bottom:4px">Buying Power</div>
          <div style="font-size:16px;font-weight:600;color:var(--t1)">${_fmtDollar(data.buying_power)}</div>
        </div>
      </div>

      ${data.positions && data.positions.length ? `
      <div style="font-size:11px;color:var(--t3);font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Positions</div>
      ${data.positions.slice(0, 8).map(p => {
        const plColor = p.unrealized_pl >= 0 ? 'var(--green)' : 'var(--coral)';
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--brd)">
          <div>
            <span style="font-size:13px;font-weight:700;color:var(--t1)">${p.symbol}</span>
            <span style="font-size:11px;color:var(--t3);margin-left:6px">${_fmt(p.qty, 4)} shares</span>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;font-weight:600;color:var(--t1)">${_fmtDollar(p.market_value)}</div>
            <div style="font-size:11px;color:${plColor}">${p.unrealized_pl >= 0 ? '+' : ''}${_fmtDollar(p.unrealized_pl)}</div>
          </div>
        </div>`;
      }).join('')}` : `<div style="color:var(--t3);font-size:13px">No open positions.</div>`}`;
  } catch (e) {
    if (el) el.innerHTML = `<div style="color:var(--t3);font-size:13px">Could not load portfolio.</div>`;
  }
}

// ── Finance Chat ──────────────────────────────────────────────────────────────

function _financePromptClick(btn) {
  const input = document.getElementById('finance-chat-input');
  if (input) {
    input.value = btn.dataset.prompt;
    input.focus();
    _financeChat();
  }
}

async function _financeChat() {
  const input = document.getElementById('finance-chat-input');
  const history = document.getElementById('finance-chat-history');
  const sendBtn = document.getElementById('finance-chat-send');
  if (!input || !history) return;

  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }

  // User bubble
  history.insertAdjacentHTML('beforeend', `
    <div style="display:flex;justify-content:flex-end">
      <div style="background:var(--gold);color:#000;padding:10px 14px;border-radius:var(--r12) var(--r12) 4px var(--r12);max-width:80%;font-size:13px;font-weight:500">${msg}</div>
    </div>`);
  history.scrollTop = history.scrollHeight;

  _financeChatHistory.push({ role: 'user', content: msg });

  // AI bubble
  const msgId = 'fc-' + Date.now();
  history.insertAdjacentHTML('beforeend', `
    <div style="display:flex;gap:8px;align-items:flex-start">
      <div style="width:28px;height:28px;background:var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#000;flex-shrink:0">SAL</div>
      <div id="${msgId}" style="background:var(--bg3);border:1px solid var(--brd);padding:12px 14px;border-radius:4px var(--r12) var(--r12) var(--r12);max-width:85%;font-size:13px;line-height:1.6;color:var(--t1)">
        <span style="color:var(--t3)">Analyzing...</span>
      </div>
    </div>`);
  history.scrollTop = history.scrollHeight;

  let fullResponse = '';
  const bubble = document.getElementById(msgId);

  try {
    await _streamPost(
      '/api/finance/analyze',
      { message: msg, model: 'claude-opus-4-6' },
      (chunk) => {
        fullResponse += chunk;
        if (bubble) {
          bubble.innerHTML = `<p style="margin:0">${_renderMarkdown(fullResponse)}</p>`;
          history.scrollTop = history.scrollHeight;
        }
      },
      () => {
        _financeChatHistory.push({ role: 'assistant', content: fullResponse });
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
      },
    );
  } catch (e) {
    if (bubble) bubble.innerHTML = `<span style="color:var(--coral)">Analysis failed: ${e.message}</span>`;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
  }
}

// ── DCF Calculator ────────────────────────────────────────────────────────────

async function _runDCF() {
  const get = id => document.getElementById(id)?.value;
  const resultEl = document.getElementById('dcf-result');
  if (!resultEl) return;

  const company = get('dcf-company') || '';
  const revenue = parseFloat(get('dcf-revenue')) || 0;
  const growth = parseFloat(get('dcf-growth')) || 0;
  const ebitda = parseFloat(get('dcf-ebitda')) || 0;
  const wacc = parseFloat(get('dcf-wacc')) || 10;
  const multiple = parseFloat(get('dcf-multiple')) || 12;
  const years = parseInt(get('dcf-years')) || 5;
  const capex = parseFloat(get('dcf-capex')) || 5;

  if (!revenue || !growth || !ebitda) {
    resultEl.innerHTML = `<div style="color:var(--coral);font-size:13px">Please fill in Revenue, Growth, and EBITDA Margin.</div>`;
    return;
  }

  resultEl.innerHTML = `<div style="color:var(--t3);font-size:13px">Running DCF model...</div>`;

  try {
    const data = await _apiPost('/api/finance/dcf', {
      company_name: company,
      revenue, revenue_growth: growth, ebitda_margin: ebitda,
      discount_rate: wacc, terminal_multiple: multiple, years, capex_pct: capex,
    });

    const v = data.valuation || {};
    const fmtB = n => `$${(n / 1000).toFixed(1)}B`;

    resultEl.innerHTML = `
      <div style="margin-top:16px">
        <div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:12px">DCF Results — ${data.company}</div>

        <!-- EV Range Bar -->
        <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r12);padding:16px;margin-bottom:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
            <div>
              <div style="font-size:11px;color:var(--coral);font-weight:700;margin-bottom:4px;text-transform:uppercase">Bear Case</div>
              <div style="font-size:22px;font-weight:700;color:var(--t1)">${fmtB(v.enterprise_value_bear)}</div>
              <div style="font-size:11px;color:var(--coral)">${_fmtPct(v.downside_pct_from_base)} vs base</div>
            </div>
            <div style="border-left:1px solid var(--brd);border-right:1px solid var(--brd)">
              <div style="font-size:11px;color:var(--gold);font-weight:700;margin-bottom:4px;text-transform:uppercase">Base Case</div>
              <div style="font-size:22px;font-weight:700;color:var(--gold)">${fmtB(v.enterprise_value_base)}</div>
              <div style="font-size:11px;color:var(--t3)">Enterprise Value</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--green);font-weight:700;margin-bottom:4px;text-transform:uppercase">Bull Case</div>
              <div style="font-size:22px;font-weight:700;color:var(--t1)">${fmtB(v.enterprise_value_bull)}</div>
              <div style="font-size:11px;color:var(--green)">+${_fmtPct(v.upside_pct_from_base)} vs base</div>
            </div>
          </div>
        </div>

        <!-- Key metrics -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:12px">
          <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);padding:10px">
            <div style="font-size:10px;color:var(--t3);margin-bottom:3px">PV of FCFs</div>
            <div style="font-size:15px;font-weight:700;color:var(--t1)">${fmtB(data.pv_fcf_sum)}</div>
          </div>
          <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);padding:10px">
            <div style="font-size:10px;color:var(--t3);margin-bottom:3px">Terminal Value (PV)</div>
            <div style="font-size:15px;font-weight:700;color:var(--t1)">${fmtB(data.pv_terminal_value)}</div>
          </div>
        </div>

        <!-- Year-by-year table -->
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="border-bottom:1px solid var(--brd)">
                ${['Year','Revenue','EBITDA','FCF','PV FCF'].map(h => `<th style="text-align:right;padding:6px 10px;color:var(--t3);font-size:11px;font-weight:600;text-transform:uppercase">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${(data.projections || []).map(row => `
                <tr style="border-bottom:1px solid var(--brd)">
                  <td style="text-align:right;padding:7px 10px;color:var(--gold);font-weight:600">Y${row.year}</td>
                  <td style="text-align:right;padding:7px 10px;color:var(--t1)">${fmtB(row.revenue)}</td>
                  <td style="text-align:right;padding:7px 10px;color:var(--t1)">${fmtB(row.ebitda)}</td>
                  <td style="text-align:right;padding:7px 10px;color:var(--t1)">${fmtB(row.fcf)}</td>
                  <td style="text-align:right;padding:7px 10px;color:var(--t2)">${fmtB(row.pv_fcf)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top:10px;font-size:11px;color:var(--t3)">${data.methodology}</div>
        <div style="margin-top:4px;font-size:10px;color:var(--t3);font-style:italic">${data.disclaimer}</div>
      </div>`;
  } catch (e) {
    resultEl.innerHTML = `<div style="color:var(--coral);font-size:13px">DCF failed: ${e.message}</div>`;
  }
}

function _attachFinanceListeners() {
  // Hover effects for prompt chips
  document.querySelectorAll('.finance-prompt-chip').forEach(btn => {
    btn.addEventListener('mouseover', () => {
      btn.style.borderColor = 'var(--gold)';
      btn.style.color = 'var(--gold)';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.borderColor = 'var(--brd)';
      btn.style.color = 'var(--t2)';
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL ESTATE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * loadRealEstate() — entry point, called by app.js navigate()
 */
async function loadRealEstate() {
  const container = document.getElementById('realestate-content');
  if (!container) return;
  container.innerHTML = _realEstateShell();
  _attachREListeners();
}

// Alias for app.js compatibility
const initRealestate = loadRealEstate;

function _realEstateShell() {
  return `
<div style="display:flex;flex-direction:column;gap:24px;padding:0 0 40px">

  <!-- Property Search -->
  <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:20px">
    <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0 0 4px">Property Search</h3>
    <p style="color:var(--t3);font-size:12px;margin:0 0 16px">Search active listings via RentCast — filter by type, beds, price</p>

    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-bottom:10px">
      <input id="re-search-city" placeholder="City (e.g. Dallas)" style="${_inputCss()}" />
      <input id="re-search-state" placeholder="State (e.g. TX)" style="${_inputCss()}" />
      <input id="re-search-zip" placeholder="Zip Code" style="${_inputCss()}" />
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px">
      <select id="re-search-type" style="${_inputCss()}">
        <option value="">All Types</option>
        <option value="Single Family">Single Family</option>
        <option value="Multi-Family">Multi-Family</option>
        <option value="Condo">Condo</option>
        <option value="Townhouse">Townhouse</option>
        <option value="Land">Land</option>
        <option value="Commercial">Commercial</option>
      </select>
      <input id="re-search-beds" type="number" placeholder="Beds Min" style="${_inputCss()}" />
      <input id="re-search-baths" type="number" placeholder="Baths Min" step="0.5" style="${_inputCss()}" />
      <input id="re-search-price-min" type="number" placeholder="Price Min $" style="${_inputCss()}" />
      <input id="re-search-price-max" type="number" placeholder="Price Max $" style="${_inputCss()}" />
    </div>
    <button onclick="_reSearch()" style="${_btnCss('gold')}">Search Properties</button>

    <div id="re-search-results" style="margin-top:16px"></div>
  </div>

  <!-- Deal Analyzer -->
  <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:20px">
    <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0 0 4px">Deal Analyzer</h3>
    <p style="color:var(--t3);font-size:12px;margin:0 0 16px">Full investment math: NOI, Cap Rate, Cash-on-Cash, IRR + AI narrative</p>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:14px">
      ${_reInput('da-address', 'Property Address', 'text', '123 Main St, Dallas TX 75201')}
      ${_reInput('da-price', 'Purchase Price ($)', 'number', '350000')}
      ${_reInput('da-down', 'Down Payment %', 'number', '25')}
      ${_reInput('da-rent', 'Monthly Rent ($)', 'number', '2800')}
      ${_reInput('da-rate', 'Interest Rate %', 'number', '6.87')}
      ${_reInput('da-taxes', 'Annual Taxes ($)', 'number', '4200')}
      ${_reInput('da-insurance', 'Annual Insurance ($)', 'number', '1800')}
      ${_reInput('da-vacancy', 'Vacancy Rate %', 'number', '8')}
      ${_reInput('da-mgmt', 'Mgmt Fee %', 'number', '10')}
      ${_reInput('da-maintenance', 'Maintenance %', 'number', '5')}
    </div>
    <button onclick="_runDealAnalyzer()" style="${_btnCss('gold')}">Analyze Deal</button>

    <div id="deal-result" style="margin-top:18px"></div>
  </div>

  <!-- Two column: Distressed Leads + Market Report -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

    <!-- Distressed Leads -->
    <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:20px">
      <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0 0 4px">Distressed Leads</h3>
      <p style="color:var(--t3);font-size:12px;margin:0 0 14px">Foreclosures, pre-foreclosures, off-market, and more</p>

      <select id="re-distressed-category" style="${_inputCss()} margin-bottom:10px;display:block;width:100%">
        <option value="foreclosure">Foreclosure</option>
        <option value="pre-foreclosure">Pre-Foreclosure</option>
        <option value="nod">Notice of Default (NOD)</option>
        <option value="tax-lien">Tax Lien</option>
        <option value="bankruptcy">Bankruptcy / REO</option>
        <option value="off-market">Off-Market</option>
        <option value="cash-buyer">Cash Buyer Opportunities</option>
        <option value="notes-due">Notes Coming Due</option>
      </select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <input id="re-distressed-city" placeholder="City" style="${_inputCss()}" />
        <input id="re-distressed-state" placeholder="State" style="${_inputCss()}" />
      </div>
      <button onclick="_searchDistressed()" style="${_btnCss('gold')} width:100%">Search Leads</button>

      <div id="re-distressed-results" style="margin-top:14px"></div>
    </div>

    <!-- Market Report -->
    <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:20px">
      <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0 0 4px">Market Report</h3>
      <p style="color:var(--t3);font-size:12px;margin:0 0 14px">AI-generated local market report with RentCast data</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input id="re-report-city" placeholder="City" style="${_inputCss()}" />
        <input id="re-report-state" placeholder="State (TX)" style="${_inputCss()}" />
      </div>
      <input id="re-report-zip" placeholder="Zip code (optional)" style="${_inputCss()} display:block;width:100%;margin-bottom:12px;box-sizing:border-box" />
      <button onclick="_generateMarketReport()" style="${_btnCss('gold')} width:100%">Generate Report</button>

      <div id="re-market-report" style="margin-top:14px;max-height:460px;overflow-y:auto"></div>
    </div>

  </div>

  <!-- Portfolio -->
  <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div>
        <h3 style="font-size:14px;font-weight:700;color:var(--t1);margin:0">My Portfolio</h3>
        <p style="color:var(--t3);font-size:12px;margin:4px 0 0">Saved properties from your deal research</p>
      </div>
      <button onclick="_loadREPortfolio()" style="background:transparent;border:1px solid var(--brd);color:var(--t2);padding:6px 12px;border-radius:var(--r8);font-size:12px;cursor:pointer">Refresh</button>
    </div>
    <div id="re-portfolio-list">
      <div style="color:var(--t3);font-size:13px">Loading portfolio...</div>
    </div>
  </div>

</div>`;
}

function _inputCss() {
  return 'background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);color:var(--t1);padding:9px 12px;font-size:13px;width:100%;box-sizing:border-box;outline:none;font-family:var(--font)';
}

function _btnCss(variant = 'gold') {
  const bg = variant === 'gold' ? 'var(--gold)' : variant === 'ghost' ? 'transparent' : 'var(--blue)';
  const color = variant === 'gold' ? '#000' : 'var(--t1)';
  const border = variant === 'ghost' ? '1px solid var(--brd)' : 'none';
  return `background:${bg};color:${color};border:${border};border-radius:var(--r8);padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;`;
}

function _reInput(id, label, type, placeholder) {
  return `
  <div>
    <label style="display:block;font-size:11px;color:var(--t3);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${label}</label>
    <input id="${id}" type="${type}" placeholder="${placeholder}"
      style="${_inputCss()}" />
  </div>`;
}

// ── Property Search ───────────────────────────────────────────────────────────

async function _reSearch() {
  const el = document.getElementById('re-search-results');
  if (!el) return;

  const city = document.getElementById('re-search-city')?.value.trim() || '';
  const state = document.getElementById('re-search-state')?.value.trim() || '';
  const zip = document.getElementById('re-search-zip')?.value.trim() || '';
  const type = document.getElementById('re-search-type')?.value || '';
  const beds = document.getElementById('re-search-beds')?.value || '';
  const baths = document.getElementById('re-search-baths')?.value || '';
  const priceMin = document.getElementById('re-search-price-min')?.value || '';
  const priceMax = document.getElementById('re-search-price-max')?.value || '';

  if (!city && !zip) {
    el.innerHTML = `<div style="color:var(--coral);font-size:13px">Enter a city or zip code to search.</div>`;
    return;
  }

  el.innerHTML = `<div style="color:var(--t3);font-size:13px">Searching listings...</div>`;

  try {
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (zip) params.set('zipcode', zip);
    if (type) params.set('property_type', type);
    if (beds) params.set('beds_min', beds);
    if (baths) params.set('baths_min', baths);
    if (priceMin) params.set('price_min', priceMin);
    if (priceMax) params.set('price_max', priceMax);
    params.set('limit', '20');

    const data = await _apiGet('/api/realestate/search?' + params.toString());
    const results = data.results || [];
    _reSearchResults = results;

    if (!results.length) {
      el.innerHTML = `<div style="color:var(--t3);font-size:13px">No properties found. Try a different city or zip.</div>`;
      return;
    }

    el.innerHTML = `
      <div style="font-size:12px;color:var(--t3);margin-bottom:12px">${results.length} properties found · Source: ${data.source || 'RentCast'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
        ${results.map((prop, i) => _renderPropertyCard(prop, i)).join('')}
      </div>`;
  } catch (e) {
    el.innerHTML = `<div style="color:var(--coral);font-size:13px">Search failed: ${e.message}</div>`;
  }
}

function _renderPropertyCard(prop, idx) {
  const price = prop.price || prop.listPrice || prop.salePrice || 0;
  const rent = prop.rentEstimate || prop.monthlyRent || 0;
  const beds = prop.bedrooms || prop.beds || '—';
  const baths = prop.bathrooms || prop.baths || '—';
  const sqft = prop.squareFootage || prop.sqft || '—';
  const addr = prop.formattedAddress || prop.address || prop.streetAddress || 'Address unavailable';
  const type = prop.propertyType || prop.type || 'Residential';

  // Quick cap rate estimate: assume 60% expense ratio for NOI
  let capRateStr = '—';
  let capRateColor = 'var(--t3)';
  if (price > 0 && rent > 0) {
    const noi = rent * 12 * 0.60;
    const capRate = (noi / price) * 100;
    capRateStr = capRate.toFixed(1) + '%';
    capRateColor = capRate >= 7 ? 'var(--green)' : capRate >= 5 ? 'var(--amber)' : 'var(--coral)';
  }

  const daysOnMarket = prop.daysOnMarket || prop.dom || '—';
  const source = prop._source || 'RentCast';

  return `
  <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r12);padding:16px;display:flex;flex-direction:column;gap:8px;transition:border-color 0.2s"
       onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--brd)'">

    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="font-size:13px;font-weight:600;color:var(--t1);line-height:1.3">${addr}</div>
      <span style="font-size:10px;background:var(--bg2);color:var(--t3);padding:2px 8px;border-radius:12px;white-space:nowrap;flex-shrink:0">${type}</span>
    </div>

    <div style="font-size:22px;font-weight:700;color:var(--gold)">${price ? _fmtDollar(price) : 'Price N/A'}</div>

    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--t2)">${beds} bd</span>
      <span style="font-size:12px;color:var(--t2)">${baths} ba</span>
      ${sqft !== '—' ? `<span style="font-size:12px;color:var(--t2)">${Number(sqft).toLocaleString()} sqft</span>` : ''}
      ${daysOnMarket !== '—' ? `<span style="font-size:12px;color:var(--t3)">${daysOnMarket} DOM</span>` : ''}
    </div>

    <div style="display:flex;gap:10px;align-items:center">
      <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:6px 10px;flex:1;text-align:center">
        <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Est. Cap Rate</div>
        <div style="font-size:16px;font-weight:700;color:${capRateColor}">${capRateStr}</div>
      </div>
      ${rent ? `
      <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:6px 10px;flex:1;text-align:center">
        <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Rent Est.</div>
        <div style="font-size:16px;font-weight:700;color:var(--t1)">${_fmtDollar(rent)}/mo</div>
      </div>` : ''}
    </div>

    <button onclick="_fillDealAnalyzer(${idx})" style="${_btnCss('ghost')} font-size:12px;padding:7px 0;width:100%;text-align:center">
      Analyze Deal
    </button>
  </div>`;
}

function _fillDealAnalyzer(idx) {
  const prop = _reSearchResults[idx];
  if (!prop) return;

  const addr = prop.formattedAddress || prop.address || '';
  const price = prop.price || prop.listPrice || prop.salePrice || 0;
  const rent = prop.rentEstimate || prop.monthlyRent || 0;
  const taxes = prop.taxes || prop.annualTaxes || 0;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  };

  setVal('da-address', addr);
  setVal('da-price', price);
  setVal('da-rent', rent);
  if (taxes) setVal('da-taxes', taxes);

  // Scroll to deal analyzer
  document.getElementById('deal-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelector('[onclick="_runDealAnalyzer()"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Deal Analyzer ─────────────────────────────────────────────────────────────

async function _runDealAnalyzer() {
  const el = document.getElementById('deal-result');
  if (!el) return;

  const get = id => document.getElementById(id)?.value;
  const addr = get('da-address') || '';
  const price = parseFloat(get('da-price')) || 0;
  const down = parseFloat(get('da-down')) || 25;
  const rent = parseFloat(get('da-rent')) || 0;
  const rate = parseFloat(get('da-rate')) || 6.87;
  const taxes = parseFloat(get('da-taxes')) || 3600;
  const insurance = parseFloat(get('da-insurance')) || 1800;
  const vacancy = parseFloat(get('da-vacancy')) || 8;
  const mgmt = parseFloat(get('da-mgmt')) || 10;
  const maint = parseFloat(get('da-maintenance')) || 5;

  if (!price || !rent) {
    el.innerHTML = `<div style="color:var(--coral);font-size:13px">Enter purchase price and monthly rent to analyze.</div>`;
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:var(--t3);font-size:13px;padding:12px 0">
      <div style="width:16px;height:16px;border:2px solid var(--gold);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      Running deal analysis...
    </div>`;

  try {
    const data = await _apiPost('/api/realestate/deal-analyzer', {
      address: addr,
      purchase_price: price,
      down_payment_pct: down,
      monthly_rent: rent,
      interest_rate: rate,
      taxes_annual: taxes,
      insurance_annual: insurance,
      vacancy_rate: vacancy,
      management_fee_pct: mgmt,
      maintenance_pct: maint,
      generate_narrative: true,
    });

    const m = data.metrics || {};
    const monthly = data.monthly || {};
    const annual = data.annual || {};
    const summary = data.summary || {};
    const verdict = data.verdict || 'N/A';
    const vColor = data.verdict_color === 'green' ? 'var(--green)' : data.verdict_color === 'amber' ? 'var(--amber)' : 'var(--coral)';

    const capRate = m.cap_rate || 0;
    const capColor = capRate >= 7 ? 'var(--green)' : capRate >= 5 ? 'var(--amber)' : 'var(--coral)';

    el.innerHTML = `
      <div style="margin-top:4px">

        <!-- Verdict banner -->
        <div style="background:var(--bg3);border:2px solid ${vColor};border-radius:var(--r12);padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:11px;color:var(--t3);margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px">SAL Verdict</div>
            <div style="font-size:22px;font-weight:800;color:${vColor}">${verdict}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--t3)">Address</div>
            <div style="font-size:13px;color:var(--t1);font-weight:500">${data.address || 'N/A'}</div>
          </div>
        </div>

        <!-- Key Metrics Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
          ${_metricBox('Cap Rate', capRate.toFixed(2) + '%', capColor)}
          ${_metricBox('Cash-on-Cash', (m.cash_on_cash || 0).toFixed(2) + '%', m.cash_on_cash >= 8 ? 'var(--green)' : m.cash_on_cash >= 4 ? 'var(--amber)' : 'var(--coral)')}
          ${_metricBox('IRR (5yr est.)', (m.irr_estimate_5yr || 0).toFixed(1) + '%', m.irr_estimate_5yr >= 15 ? 'var(--green)' : 'var(--t1)')}
          ${_metricBox('Monthly Cash Flow', '$' + _fmt(monthly.cash_flow || 0), monthly.cash_flow >= 0 ? 'var(--green)' : 'var(--coral)')}
          ${_metricBox('NOI (annual)', '$' + _fmt(annual.noi || 0, 0), 'var(--t1)')}
          ${_metricBox('Total Cash In', '$' + _fmt(summary.total_cash_invested || 0, 0), 'var(--t1)')}
          ${_metricBox('GRM', (m.grm || 0).toFixed(1), 'var(--t2)')}
          ${_metricBox('Debt Coverage', (m.dcr || 0).toFixed(2), m.dcr >= 1.25 ? 'var(--green)' : 'var(--coral)')}
          ${_metricBox('1% Rule', m.one_percent_rule ? 'PASS' : 'FAIL', m.one_percent_rule ? 'var(--green)' : 'var(--coral)')}
        </div>

        <!-- Monthly Breakdown -->
        <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r12);padding:14px;margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Monthly Breakdown</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
            ${_breakdownRow('Gross Rent', monthly.gross_rent, 'var(--green)')}
            ${_breakdownRow('Effective Rent', monthly.effective_rent, 'var(--green)')}
            ${_breakdownRow('Mortgage P&I', monthly.mortgage_pi, 'var(--coral)')}
            ${_breakdownRow('Taxes', monthly.taxes, 'var(--coral)')}
            ${_breakdownRow('Insurance', monthly.insurance, 'var(--coral)')}
            ${_breakdownRow('Management', monthly.management, 'var(--coral)')}
            ${_breakdownRow('Maintenance', monthly.maintenance, 'var(--coral)')}
          </div>
          <div style="border-top:2px solid var(--brd);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;font-weight:700;color:var(--t1)">Net Cash Flow</span>
            <span style="font-size:18px;font-weight:800;color:${monthly.cash_flow >= 0 ? 'var(--green)' : 'var(--coral)'}">${monthly.cash_flow >= 0 ? '+' : ''}$${_fmt(monthly.cash_flow)}/mo</span>
          </div>
        </div>

        <!-- Purchase Summary -->
        <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r12);padding:14px;margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Purchase Summary</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
            ${_breakdownRow('Purchase Price', summary.purchase_price)}
            ${_breakdownRow('Down Payment', summary.down_payment)}
            ${_breakdownRow('Loan Amount', summary.loan_amount)}
            ${_breakdownRow('Closing Costs', summary.closing_costs)}
            ${_breakdownRow('Total Cash Invested', summary.total_cash_invested)}
          </div>
        </div>

        ${data.ai_narrative ? `
        <!-- AI Narrative -->
        <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r12);padding:16px">
          <div style="font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">SAL Analysis</div>
          <div style="font-size:13px;color:var(--t1);line-height:1.7">${_renderMarkdown(data.ai_narrative)}</div>
        </div>` : ''}

      </div>`;
  } catch (e) {
    el.innerHTML = `<div style="color:var(--coral);font-size:13px">Deal analysis failed: ${e.message}</div>`;
  }
}

function _metricBox(label, value, color) {
  return `
  <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);padding:12px;text-align:center">
    <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">${label}</div>
    <div style="font-size:18px;font-weight:700;color:${color}">${value}</div>
  </div>`;
}

function _breakdownRow(label, value, color = 'var(--t1)') {
  const display = value !== undefined && value !== null ? '$' + _fmt(value) : '—';
  return `
  <div style="display:contents">
    <div style="font-size:12px;color:var(--t3);padding:5px 0;border-bottom:1px solid var(--brd)">${label}</div>
    <div style="font-size:12px;color:${color};text-align:right;padding:5px 0;border-bottom:1px solid var(--brd);font-weight:600">${display}</div>
  </div>`;
}

// ── Distressed Leads ──────────────────────────────────────────────────────────

async function _searchDistressed() {
  const el = document.getElementById('re-distressed-results');
  if (!el) return;

  const category = document.getElementById('re-distressed-category')?.value || 'foreclosure';
  const city = document.getElementById('re-distressed-city')?.value.trim() || '';
  const state = document.getElementById('re-distressed-state')?.value.trim() || '';

  el.innerHTML = `<div style="color:var(--t3);font-size:13px">Searching ${category} leads...</div>`;

  try {
    const params = new URLSearchParams({ category, limit: '20' });
    if (city) params.set('city', city);
    if (state) params.set('state', state);

    const data = await _apiGet('/api/realestate/distressed-search?' + params.toString());
    const results = data.results || [];

    if (!results.length) {
      el.innerHTML = `<div style="color:var(--t3);font-size:13px">No ${category} leads found for this location.</div>`;
      return;
    }

    el.innerHTML = `
      <div style="font-size:12px;color:var(--t3);margin-bottom:10px">${results.length} leads · ${category}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${results.slice(0, 10).map(lead => _renderLeadCard(lead, category)).join('')}
      </div>`;
  } catch (e) {
    el.innerHTML = `<div style="color:var(--coral);font-size:13px">Search failed: ${e.message}</div>`;
  }
}

function _renderLeadCard(lead, category) {
  const addr = lead.formattedAddress || lead.address || lead.streetAddress || 'Address N/A';
  const price = lead.price || lead.listPrice || lead.assessedValue || 0;
  const equity = lead.estimatedEquity || lead.equity || 0;
  const dom = lead.daysOnMarket || lead.dom;
  const distressedType = lead.distressed_type || category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const url = lead.url;

  return `
  <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);padding:12px;transition:border-color 0.2s"
       onmouseover="this.style.borderColor='var(--coral)'" onmouseout="this.style.borderColor='var(--brd)'">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
      <div style="font-size:13px;font-weight:600;color:var(--t1)">${addr}</div>
      <span style="font-size:10px;background:rgba(248,113,113,0.15);color:var(--coral);padding:2px 8px;border-radius:12px;flex-shrink:0;font-weight:600">${distressedType}</span>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      ${price ? `<span style="font-size:13px;color:var(--gold);font-weight:700">${_fmtDollar(price)}</span>` : ''}
      ${equity ? `<span style="font-size:12px;color:var(--green)">Est. equity: ${_fmtDollar(equity)}</span>` : ''}
      ${dom !== undefined && dom !== null ? `<span style="font-size:12px;color:var(--t3)">${dom} days on market</span>` : ''}
      ${lead.bedrooms ? `<span style="font-size:12px;color:var(--t2)">${lead.bedrooms}bd/${lead.bathrooms || '?'}ba</span>` : ''}
    </div>
    ${url ? `<a href="${url}" target="_blank" style="font-size:11px;color:var(--blue);display:block;margin-top:6px;text-decoration:none">View Listing →</a>` : ''}
  </div>`;
}

// ── Market Report ─────────────────────────────────────────────────────────────

async function _generateMarketReport() {
  const el = document.getElementById('re-market-report');
  if (!el) return;

  const city = document.getElementById('re-report-city')?.value.trim() || '';
  const state = document.getElementById('re-report-state')?.value.trim() || '';
  const zip = document.getElementById('re-report-zip')?.value.trim() || '';

  if (!city || !state) {
    el.innerHTML = `<div style="color:var(--coral);font-size:13px">Enter city and state to generate a report.</div>`;
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:var(--t3);font-size:13px;padding:12px 0">
      <div style="width:16px;height:16px;border:2px solid var(--gold);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      Generating market report for ${city}, ${state}...
    </div>`;

  let fullReport = '';

  try {
    await _streamPost(
      '/api/realestate/market-report',
      { city, state, zipcode: zip },
      (chunk) => {
        fullReport += chunk;
        el.innerHTML = `<div style="font-size:13px;color:var(--t1);line-height:1.7">${_renderMarkdown(fullReport)}</div>`;
        el.scrollTop = el.scrollHeight;
      },
      (done) => {
        if (done?.error) {
          el.innerHTML = `<div style="color:var(--coral);font-size:13px">Report failed: ${done.error}</div>`;
        }
      },
    );
  } catch (e) {
    el.innerHTML = `<div style="color:var(--coral);font-size:13px">Report generation failed: ${e.message}</div>`;
  }
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

async function _loadREPortfolio() {
  const el = document.getElementById('re-portfolio-list');
  if (!el) return;

  try {
    const data = await _apiGet('/api/realestate/portfolio');
    const properties = data.properties || [];

    if (!properties.length) {
      el.innerHTML = `
        <div style="color:var(--t3);font-size:13px;text-align:center;padding:20px 0">
          <div style="font-size:24px;margin-bottom:8px">🏠</div>
          <div>No saved properties yet.</div>
          <div style="font-size:11px;margin-top:4px">Search for properties and click "Analyze Deal" to save them.</div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
        ${properties.map(prop => `
          <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);padding:14px">
            <div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:6px">${prop.address || 'Unknown'}</div>
            <div style="font-size:12px;color:var(--t3)">${prop.city || ''} ${prop.state || ''} ${prop.zip || ''}</div>
            ${prop.price ? `<div style="font-size:16px;font-weight:700;color:var(--gold);margin-top:6px">${_fmtDollar(prop.price)}</div>` : ''}
            ${prop.beds ? `<div style="font-size:12px;color:var(--t2);margin-top:4px">${prop.beds}bd / ${prop.baths || '?'}ba</div>` : ''}
            <div style="font-size:10px;color:var(--t3);margin-top:6px">Saved ${prop.created_at ? new Date(prop.created_at).toLocaleDateString() : ''} · ${prop.source || ''}</div>
          </div>`).join('')}
      </div>`;
  } catch (e) {
    el.innerHTML = `<div style="color:var(--t3);font-size:13px">Sign in to view your portfolio.</div>`;
  }
}

function _attachREListeners() {
  // Load portfolio on render
  _loadREPortfolio();

  // Enter key on search inputs
  ['re-search-city', 're-search-zip'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _reSearch();
    });
  });
  ['re-distressed-city', 're-distressed-state'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _searchDistressed();
    });
  });
  ['re-report-city', 're-report-state', 're-report-zip'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _generateMarketReport();
    });
  });
}

// ── Spin animation (injected once) ───────────────────────────────────────────
(function _injectSpinKeyframe() {
  if (document.getElementById('sal-spin-style')) return;
  const style = document.createElement('style');
  style.id = 'sal-spin-style';
  style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
})();

// ── Exports (called by app.js) ────────────────────────────────────────────────
window.loadFinance = loadFinance;
window.loadRealEstate = loadRealEstate;
window.initRealestate = initRealestate;

// Internal helpers also exposed for inline onclick handlers
window._financeChat = _financeChat;
window._financePromptClick = _financePromptClick;
window._loadMarketTicker = _loadMarketTicker;
window._runDCF = _runDCF;
window._reSearch = _reSearch;
window._fillDealAnalyzer = _fillDealAnalyzer;
window._runDealAnalyzer = _runDealAnalyzer;
window._searchDistressed = _searchDistressed;
window._generateMarketReport = _generateMarketReport;
window._loadREPortfolio = _loadREPortfolio;
