/**
 * SaintSal™ Labs — Chat & Intelligence UI
 * 8 Verticals: Search, Sports, Finance, Real Estate, Medical, Legal, Technology, Gov/Defense
 * Saint Vision Technologies LLC | US Patent #10,290,222 (HACP™)
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

let activeVertical = 'search';
let conversationHistory = [];        // [{role: 'user'|'assistant', content: ''}]
let chatIsStreaming = false;

// ── Vertical Config ───────────────────────────────────────────────────────────

const VERTICALS = {
  search: {
    label: '🔍 Search',
    name: 'search',
    color: '--blue',
    accent: 'var(--blue)',
    tagline: 'Deep research across the web',
    starters: [
      'What are the latest developments in quantum computing?',
      'Compare the top AI coding assistants in 2025',
      'Summarize recent research on longevity and aging',
      'Who are the top VC firms investing in defense tech?',
    ],
    landingType: 'trending',
  },
  sports: {
    label: '⚽ Sports',
    name: 'sports',
    color: '--green',
    accent: 'var(--green)',
    tagline: "Live scores, picks, fantasy — today's games",
    starters: [
      "What are today's NBA scores and standings?",
      'Give me the best NFL DFS picks for this week',
      'Injury report: who should I start in fantasy football?',
      "Who's favored in tonight's MLB games?",
    ],
    landingType: 'sports',
  },
  finance: {
    label: '💰 Finance',
    name: 'finance',
    color: '--gold',
    accent: 'var(--gold)',
    tagline: 'Capital markets, portfolio, and macro intelligence',
    starters: [
      "What are today's biggest stock market movers?",
      'Build me a DCF model framework for a SaaS company',
      'What sectors are outperforming the S&P 500 this month?',
      'Explain the current Fed rate environment and its impact',
    ],
    landingType: 'finance',
  },
  realestate: {
    label: '🏠 Real Estate',
    name: 'realestate',
    color: '--teal',
    accent: 'var(--teal)',
    tagline: 'Property intelligence, comps, and investment analysis',
    starters: [
      'What are cap rates in Austin, TX right now?',
      'Find distressed multifamily deals in the Southeast',
      'Explain a 1031 exchange strategy for my rental portfolio',
      'How do I analyze a 20-unit apartment complex?',
    ],
    landingType: 'trending',
  },
  medical: {
    label: '🏥 Medical',
    name: 'medical',
    color: '--coral',
    accent: 'var(--coral)',
    tagline: 'Clinical research, drug interactions, ICD-10 coding',
    starters: [
      'What are recent clinical trials for GLP-1 medications?',
      'Check interactions between metformin and ibuprofen',
      'What is the ICD-10 code for type 2 diabetes with neuropathy?',
      'Summarize the latest research on CAR-T cell therapy',
    ],
    landingType: 'medical',
  },
  legal: {
    label: '⚖️ Legal',
    name: 'legal',
    color: '--purple',
    accent: 'var(--purple)',
    tagline: 'Contract review, case law, IP strategy',
    starters: [
      'Review this NDA clause for hidden risks',
      'What are the latest Supreme Court decisions on IP law?',
      'What entity type should I form for a SaaS startup?',
      'How do I file a provisional patent application?',
    ],
    landingType: 'trending',
  },
  technology: {
    label: '💻 Tech',
    name: 'technology',
    color: '--purple',
    accent: 'var(--purple)',
    tagline: 'Code, architecture, and engineering intelligence',
    starters: [
      'Build a FastAPI streaming SSE endpoint in Python',
      'What are the best practices for a multi-tenant SaaS architecture?',
      'Review this database schema for performance issues',
      'Explain the differences between RAG and fine-tuning',
    ],
    landingType: 'trending',
  },
  govdefense: {
    label: '🛡️ Gov/Defense',
    name: 'govdefense',
    color: '--amber',
    accent: 'var(--amber)',
    tagline: 'FAR/DFARS, procurement, compliance, and strategy',
    starters: [
      'How do I structure a winning SBIR Phase II proposal?',
      'Explain OTA (Other Transaction Authority) procurement',
      'What FAR clauses apply to a DOD SaaS contract?',
      'How do I get a government contractor clearance?',
    ],
    landingType: 'trending',
  },
};

// ── Vertical Init ─────────────────────────────────────────────────────────────

/**
 * Switch active vertical: update pills, reset conversation, load landing state.
 * @param {string} vertical - vertical key (e.g. 'sports')
 */
function setVertical(vertical) {
  if (!VERTICALS[vertical]) vertical = 'search';
  activeVertical = vertical;

  // Update pill styles
  document.querySelectorAll('.vertical-pill').forEach(pill => {
    const isActive = pill.dataset.vertical === vertical;
    pill.classList.toggle('active', isActive);
    pill.style.borderColor = isActive ? VERTICALS[vertical].accent : 'var(--brd)';
    pill.style.color        = isActive ? VERTICALS[vertical].accent : 'var(--t2)';
    pill.style.background   = isActive ? `${VERTICALS[vertical].accent}15` : 'transparent';
  });

  // Reset conversation
  conversationHistory = [];

  // Clear messages area and show vertical landing
  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl) {
    messagesEl.innerHTML = '';
    _renderLanding(messagesEl, vertical);
  }

  // Update placeholder
  const input = document.getElementById('chat-input');
  if (input) {
    const cfg = VERTICALS[vertical];
    input.placeholder = `Ask ${cfg.label} anything...`;
  }

  // Fetch trending asynchronously
  loadTrending();
}

/**
 * Render the vertical landing state into the messages container.
 */
function _renderLanding(container, vertical) {
  const cfg = VERTICALS[vertical];
  const type = cfg.landingType;

  let html = `
    <div class="chat-landing" id="chat-landing-${vertical}">
      <div class="landing-header" style="text-align:center;padding:32px 0 16px">
        <div style="font-size:36px;margin-bottom:8px">${cfg.label.split(' ')[0]}</div>
        <h2 style="font-size:20px;font-weight:700;color:var(--t1);margin:0 0 6px">${cfg.label.replace(/^\S+\s/, '')}</h2>
        <p style="color:var(--t2);font-size:14px;margin:0">${cfg.tagline}</p>
      </div>
  `;

  // Medical disclaimer banner
  if (vertical === 'medical') {
    html += `
      <div class="medical-disclaimer" style="
        background:var(--coral)18;border:1px solid var(--coral)44;border-radius:var(--r8);
        padding:12px 16px;margin:0 0 20px;display:flex;gap:10px;align-items:flex-start
      ">
        <span style="font-size:18px;flex-shrink:0">⚕️</span>
        <p style="margin:0;font-size:13px;color:var(--t1);line-height:1.5">
          <strong>Medical Information Only.</strong> SAL uses PubMed-backed research and zero-hallucination Claude Opus.
          Always consult a licensed physician before making any medical decisions.
        </p>
      </div>
    `;
  }

  // Legal disclaimer banner
  if (vertical === 'legal') {
    html += `
      <div class="legal-disclaimer" style="
        background:var(--purple)18;border:1px solid var(--purple)44;border-radius:var(--r8);
        padding:12px 16px;margin:0 0 20px;display:flex;gap:10px;align-items:flex-start
      ">
        <span style="font-size:18px;flex-shrink:0">⚖️</span>
        <p style="margin:0;font-size:13px;color:var(--t1);line-height:1.5">
          <strong>Legal Information Only.</strong> SAL provides research and analysis, not legal advice.
          Consult a licensed attorney before taking legal action.
        </p>
      </div>
    `;
  }

  // Trending placeholder (will be replaced by loadTrending)
  html += `
    <div id="trending-container-${vertical}" class="trending-section" style="margin-bottom:24px">
      <div class="trending-loading" style="display:flex;gap:10px;flex-wrap:wrap">
        ${[1,2,3,4].map(() => `
          <div style="
            flex:1;min-width:160px;height:80px;background:var(--bg3);
            border-radius:var(--r8);border:1px solid var(--brd);
            animation:pulse 1.5s infinite
          "></div>
        `).join('')}
      </div>
    </div>
  `;

  // Starter prompts
  html += `
    <div class="starter-prompts" style="margin-bottom:24px">
      <p style="font-size:12px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Try asking</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${cfg.starters.map(s => `
          <button
            class="starter-prompt-btn"
            onclick="useStarter(${JSON.stringify(s)})"
            style="
              text-align:left;background:var(--bg3);border:1px solid var(--brd);
              border-radius:var(--r8);padding:10px 14px;cursor:pointer;
              color:var(--t1);font-size:13px;line-height:1.4;
              transition:border-color .15s,background .15s
            "
            onmouseover="this.style.borderColor='${cfg.accent}';this.style.background='var(--bg3)'"
            onmouseout="this.style.borderColor='var(--brd)';this.style.background='var(--bg3)'"
          >
            <span style="color:${cfg.accent};margin-right:8px">→</span>${s}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  html += `</div>`; // close .chat-landing

  container.innerHTML = html;
}

// ── Trending ──────────────────────────────────────────────────────────────────

/**
 * Fetch trending content for the active vertical and render it.
 */
async function loadTrending() {
  const vertical = activeVertical;
  const containerId = `trending-container-${vertical}`;

  try {
    const data = await apiGet(`/api/verticals/trending?vertical=${vertical}`);
    const articles = data.articles || [];

    const container = document.getElementById(containerId);
    if (!container) return;

    if (!articles.length) {
      container.innerHTML = '';
      return;
    }

    // Choose rendering style based on vertical
    if (vertical === 'sports') {
      container.innerHTML = _renderSportsTrending(articles);
    } else if (vertical === 'finance') {
      container.innerHTML = _renderFinanceTrending(articles);
    } else {
      container.innerHTML = _renderArticleTrending(articles, vertical);
    }

  } catch (e) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
  }
}

function _renderArticleTrending(articles, vertical) {
  const cfg = VERTICALS[vertical] || VERTICALS.search;
  return `
    <div>
      <p style="font-size:12px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Trending Now</p>
      <div class="trending-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${articles.slice(0, 6).map(a => `
          <a href="${a.url || '#'}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">
            <div class="trending-card" style="
              background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);
              padding:12px;cursor:pointer;transition:border-color .15s;
            "
            onmouseover="this.style.borderColor='${cfg.accent}'"
            onmouseout="this.style.borderColor='var(--brd)'"
            >
              <p style="font-size:12px;color:${cfg.accent};margin:0 0 4px;font-weight:600">${a.source || 'Web'}</p>
              <p style="font-size:13px;color:var(--t1);margin:0;line-height:1.4;
                display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${a.title || ''}</p>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

function _renderSportsTrending(articles) {
  return `
    <div>
      <p style="font-size:12px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Today's Games & Scores</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${articles.slice(0, 6).map(a => `
          <a href="${a.url || '#'}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">
            <div style="
              background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);
              padding:10px 14px;display:flex;align-items:center;gap:12px;
              transition:border-color .15s
            "
            onmouseover="this.style.borderColor='var(--green)'"
            onmouseout="this.style.borderColor='var(--brd)'"
            >
              <span style="width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0"></span>
              <div style="flex:1;min-width:0">
                <p style="margin:0;font-size:13px;color:var(--t1);font-weight:500;
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.title || ''}</p>
                <p style="margin:2px 0 0;font-size:11px;color:var(--t3)">${a.source || ''}</p>
              </div>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

function _renderFinanceTrending(articles) {
  return `
    <div>
      <p style="font-size:12px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Market Movers</p>
      <div class="trending-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${articles.slice(0, 6).map(a => `
          <a href="${a.url || '#'}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">
            <div style="
              background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);
              padding:12px;cursor:pointer;transition:border-color .15s
            "
            onmouseover="this.style.borderColor='var(--gold)'"
            onmouseout="this.style.borderColor='var(--brd)'"
            >
              <p style="font-size:12px;color:var(--gold);margin:0 0 4px;font-weight:600">${a.source || 'Finance'}</p>
              <p style="font-size:13px;color:var(--t1);margin:0;line-height:1.4;
                display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${a.title || ''}</p>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

// ── Message Rendering ─────────────────────────────────────────────────────────

/**
 * Render a user message bubble in the chat.
 */
function _renderUserMessage(text) {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  // Remove landing state on first message
  const landing = messagesEl.querySelector('.chat-landing');
  if (landing) landing.remove();

  const el = document.createElement('div');
  el.className = 'message message-user';
  el.innerHTML = `
    <div class="message-bubble" style="
      background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r12) var(--r12) 4px var(--r12);
      padding:12px 16px;max-width:80%;margin-left:auto;
      font-size:14px;color:var(--t1);line-height:1.6;white-space:pre-wrap
    ">${_escapeHtml(text)}</div>
  `;
  el.style.cssText = 'display:flex;justify-content:flex-end;padding:8px 0';
  messagesEl.appendChild(el);
  _scrollToBottom();
  return el;
}

/**
 * Render an AI message bubble, returns { el, bubble } for streaming updates.
 */
function _renderAiMessageShell() {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return null;

  const cfg = VERTICALS[activeVertical] || VERTICALS.search;

  const el = document.createElement('div');
  el.className = 'message message-ai message-streaming';
  el.style.cssText = 'display:flex;justify-content:flex-start;padding:8px 0;gap:10px';

  el.innerHTML = `
    <div class="ai-avatar" style="
      width:32px;height:32px;border-radius:50%;background:${cfg.accent}22;
      border:1px solid ${cfg.accent}55;display:flex;align-items:center;justify-content:center;
      font-size:14px;flex-shrink:0;margin-top:2px
    ">${cfg.label.split(' ')[0]}</div>
    <div class="message-bubble" style="
      background:var(--bg2);border:1px solid var(--brd);border-radius:4px var(--r12) var(--r12) var(--r12);
      padding:12px 16px;max-width:80%;font-size:14px;color:var(--t1);line-height:1.7;
    ">
      <span class="streaming-cursor" style="
        display:inline-block;width:2px;height:14px;background:${cfg.accent};
        vertical-align:middle;animation:blink .8s step-end infinite;margin-left:1px
      "></span>
    </div>
  `;

  messagesEl.appendChild(el);
  _scrollToBottom();

  const bubble = el.querySelector('.message-bubble');
  return { el, bubble };
}

/**
 * Append streamed content to an AI message bubble.
 */
function _appendChunk(bubble, chunk) {
  if (!bubble) return;
  const cursor = bubble.querySelector('.streaming-cursor');
  const textNode = document.createTextNode(chunk);
  if (cursor) {
    bubble.insertBefore(textNode, cursor);
  } else {
    bubble.appendChild(textNode);
  }
  _scrollToBottom();
}

/**
 * Finalize an AI message bubble: remove cursor, render markdown.
 */
function _finalizeMessage(bubble, fullText) {
  if (!bubble) return;
  bubble.innerHTML = _renderMarkdown(fullText);
  bubble.closest('.message-streaming')?.classList.remove('message-streaming');
  _scrollToBottom();
}

// ── Core Send ─────────────────────────────────────────────────────────────────

/**
 * Send the current input as a chat message.
 */
async function sendMessage() {
  if (chatIsStreaming) return;

  const input = document.getElementById('chat-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  // Render user bubble
  _renderUserMessage(text);

  // Add to history
  conversationHistory.push({ role: 'user', content: text });

  // Disable send button while streaming
  chatIsStreaming = true;
  _setSendButtonState(false);

  // Create AI message shell
  const { el: msgEl, bubble } = _renderAiMessageShell() || {};
  let fullResponse = '';

  try {
    await streamAPI(
      '/api/mcp/chat',
      {
        message:              text,
        vertical:             activeVertical,
        user_id:              currentUser?.id || null,
        conversation_history: conversationHistory.slice(0, -1), // exclude the message we just added
      },
      {
        onChunk(chunk) {
          fullResponse += chunk;
          _appendChunk(bubble, chunk);
        },
        onEvent(evt) {
          if (evt.type === 'error') {
            fullResponse = evt.message || 'An error occurred. Please try again.';
          }
        },
        onDone() {
          _finalizeMessage(bubble, fullResponse);
          conversationHistory.push({ role: 'assistant', content: fullResponse });
          chatIsStreaming = false;
          _setSendButtonState(true);
          input.focus();
        },
      }
    );
  } catch (err) {
    const errMsg = `Unable to reach SAL. Please check your connection and try again.\n\nError: ${err.message || err}`;
    _finalizeMessage(bubble, errMsg);
    if (typeof showToast === 'function') showToast('Connection error — please try again', 'error');
    chatIsStreaming = false;
    _setSendButtonState(true);
    input.focus();
  }
}

/**
 * Use a starter prompt: insert text and send.
 */
function useStarter(text) {
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = text;
    _autoResizeInput(input);
  }
  sendMessage();
}

/**
 * Keyboard handler for the chat input — Enter sends, Shift+Enter newline.
 */
function chatKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// ── Scroll & Input Helpers ────────────────────────────────────────────────────

function _scrollToBottom() {
  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function _setSendButtonState(enabled) {
  const btn = document.getElementById('chat-send-btn');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? '1' : '0.5';
  btn.style.cursor  = enabled ? 'pointer' : 'not-allowed';
}

function _autoResizeInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

// ── Markdown Renderer ─────────────────────────────────────────────────────────

/**
 * Lightweight markdown renderer.
 * Handles: **bold**, *italic*, `inline code`, ```code blocks```,
 *          # headings, - bullet lists, numbered lists, and line breaks.
 */
function _renderMarkdown(text) {
  if (!text) return '';

  // Escape HTML first to prevent XSS, then selectively un-escape for markdown
  let html = _escapeHtml(text);

  // Code blocks (```lang\n...\n```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang
      ? `<span style="font-size:11px;color:var(--t3);float:right">${_escapeHtml(lang)}</span>`
      : '';
    return `<pre style="
      background:var(--bg);border:1px solid var(--brd);border-radius:var(--r8);
      padding:14px 16px;overflow-x:auto;margin:10px 0;font-family:var(--mono);font-size:13px
    ">${langLabel}<code style="color:var(--t1)">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`\n]+)`/g,
    '<code style="font-family:var(--mono);font-size:13px;background:var(--bg);padding:1px 5px;border-radius:var(--r4);color:var(--amber)">$1</code>'
  );

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;color:var(--t1);margin:14px 0 6px">$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2 style="font-size:17px;font-weight:700;color:var(--t1);margin:16px 0 8px">$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1 style="font-size:20px;font-weight:700;color:var(--t1);margin:18px 0 10px">$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g,     '<strong style="color:var(--t1);font-weight:700">$1</strong>');
  html = html.replace(/\*(.+?)\*/g,         '<em style="color:var(--t2)">$1</em>');

  // Unordered lists
  html = html.replace(/^[-*•] (.+)$/gm,
    '<li style="margin:4px 0;padding-left:4px;color:var(--t1)">$1</li>'
  );
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g,
    '<ul style="margin:8px 0;padding-left:18px;list-style:disc">$&</ul>'
  );

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm,
    '<li style="margin:4px 0;padding-left:4px;color:var(--t1)">$1</li>'
  );

  // Horizontal rule
  html = html.replace(/^---$/gm,
    '<hr style="border:none;border-top:1px solid var(--brd);margin:12px 0">'
  );

  // Line breaks → paragraphs (double newline)
  const paras = html.split(/\n{2,}/);
  html = paras.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    if (/^<(h[1-6]|ul|ol|pre|hr|li)/.test(trimmed)) return trimmed;
    return `<p style="margin:0 0 10px;color:var(--t1);line-height:1.7">${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).filter(Boolean).join('\n');

  return html;
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Initialize the chat section. Called from app.js when navigating to 'chat'.
 * Renders vertical pills and sets default vertical landing state.
 */
function initChat() {
  _renderVerticalPills();

  // Restore or default vertical
  const saved = sessionStorage.getItem('sal_active_vertical');
  setVertical(saved && VERTICALS[saved] ? saved : 'search');

  // Wire up input auto-resize
  const input = document.getElementById('chat-input');
  if (input) {
    input.addEventListener('input', () => _autoResizeInput(input));
    input.addEventListener('keydown', chatKeydown);
  }

  // Persist active vertical on change
  // (setVertical is called directly by pill onclick, persistence handled there)
}

/**
 * Render the vertical pill bar into #vertical-pills.
 */
function _renderVerticalPills() {
  const container = document.getElementById('vertical-pills');
  if (!container) return;

  container.innerHTML = Object.entries(VERTICALS).map(([key, cfg]) => `
    <button
      class="vertical-pill"
      data-vertical="${key}"
      onclick="setVertical('${key}');sessionStorage.setItem('sal_active_vertical','${key}')"
      style="
        display:inline-flex;align-items:center;gap:6px;
        padding:6px 14px;border-radius:20px;
        border:1px solid var(--brd);background:transparent;
        font-size:13px;font-weight:500;cursor:pointer;
        transition:border-color .15s,color .15s,background .15s;
        white-space:nowrap;color:var(--t2)
      "
    >${cfg.label}</button>
  `).join('');
}

// ── Blink keyframe (injected once) ───────────────────────────────────────────

(function _injectStyles() {
  if (document.getElementById('chat-js-styles')) return;
  const style = document.createElement('style');
  style.id = 'chat-js-styles';
  style.textContent = `
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }
    .vertical-pill:hover {
      background: var(--bg3) !important;
    }
    .starter-prompt-btn:focus {
      outline: none;
      border-color: var(--gold) !important;
    }
    #chat-messages {
      scroll-behavior: smooth;
    }
  `;
  document.head.appendChild(style);
})();
