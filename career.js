/**
 * SaintSal™ Labs — Career + Business Intelligence Suite
 * Saint Vision Technologies LLC | US Patent #10,290,222 (HACP™)
 *
 * 8 Tabs:
 *   1. Resume Builder        — SSE stream + enhance
 *   2. Job Search            — GET /api/career/jobs
 *   3. AI Career Coach       — Multi-turn SSE chat
 *   4. Cover Letter          — POST /api/career/cover-letter
 *   5. Interview Prep        — SSE result + mock mode
 *   6. Salary Negotiator     — POST /api/career/salary-negotiate
 *   7. LinkedIn Optimizer    — POST /api/career/linkedin-optimize
 *   8. Business Plan AI      — SSE stream 9 sections
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const careerState = {
  activeTab: 'resume',

  // Resume
  resume: {
    name: '', email: '', phone: '', location: '', title: '',
    summary: '', experience: [], education: '', skills: '',
    generatedSections: {}, streaming: false, enhancing: false,
    enhancedResult: null, savedResume: '',
  },

  // Jobs
  jobs: {
    query: '', location: '', jobType: '', remote: false,
    results: [], loading: false, saved: [], page: 1,
  },

  // Coach
  coach: {
    messages: [], loading: false,
    context: { current_role: '', target_role: '', years_exp: '' },
  },

  // Cover Letter
  cover: {
    jobDescription: '', resumeText: '', style: 'direct',
    name: '', company: '', role: '',
    result: null, loading: false,
  },

  // Interview
  interview: {
    role: '', company: '', jobDescription: '', type: 'behavioral',
    result: null, loading: false,
    mockMode: false, mockIndex: 0, mockAnswers: [],
  },

  // Salary
  salary: {
    offerDetails: '', role: '', location: '', yearsExp: '', currentSalary: '',
    result: null, loading: false,
  },

  // LinkedIn
  linkedin: {
    profileText: '', targetRole: '',
    result: null, loading: false,
  },

  // Business Plan
  bizplan: {
    businessName: '', description: '', targetMarket: '', stage: 'pre-revenue',
    sections: {}, streamingSection: null, loading: false, done: false,
  },
};

const SAL_KEY = 'saintvision_gateway_2025';

// ── Utilities ─────────────────────────────────────────────────────────────────

function _esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _salFetch(path, opts = {}) {
  return fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-sal-key': SAL_KEY,
      ...(opts.headers || {}),
    },
  });
}

async function _salPost(path, body) {
  const res = await _salFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function _salGet(path) {
  const res = await _salFetch(path);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

/**
 * Stream SSE from a POST endpoint.
 * onEvent(data) called for every parsed event object.
 * onDone() called when stream ends.
 */
async function _streamPost(path, body, onEvent, onDone) {
  const res = await _salFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { onDone?.(); break; }
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          onEvent?.(data);
          if (data.type === 'done' || data.type === 'complete') { onDone?.(data); return; }
        } catch (e) { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function _showToast(msg, type = 'info') {
  const t = document.createElement('div');
  const bg = type === 'error' ? 'var(--coral,#f87171)' : type === 'success' ? 'var(--green,#00ff88)' : 'var(--gold,#f59e0b)';
  const color = type === 'success' ? '#000' : type === 'error' ? '#fff' : '#000';
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${bg};color:${color};
    padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;
    z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);transition:opacity .3s;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

function _btn(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _setLoading(id, loading, loadText = 'Working...', defaultText = 'Generate') {
  const el = document.getElementById(id);
  if (!el) return;
  el.disabled = loading;
  el.textContent = loading ? loadText : defaultText;
}

function _renderMarkdownish(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

// ── Styles (scoped CSS injected once) ─────────────────────────────────────────

(function injectCareerStyles() {
  if (document.getElementById('career-styles')) return;
  const style = document.createElement('style');
  style.id = 'career-styles';
  style.textContent = `
    #careerRoot { padding: 20px 16px 100px; max-width: 960px; margin: 0 auto; }
    .cr-tabs { display: flex; gap: 4px; margin-bottom: 24px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }
    .cr-tab { flex-shrink: 0; padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 12px; font-weight: 500; background: var(--bg3,#1a1a22); color: var(--t2,#999); transition: all .2s; }
    .cr-tab.active { background: var(--gold,#f59e0b); color: #000; font-weight: 700; }
    .cr-card { background: var(--bg2,#131318); border: 1px solid var(--brd,#1e1e28); border-radius: 12px; padding: 20px; }
    .cr-label { font-size: 11px; color: var(--t3,#666); display: block; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .04em; }
    .cr-input { width: 100%; padding: 9px 13px; border-radius: 8px; border: 1px solid var(--brd,#1e1e28); background: var(--bg,#0b0b0f); color: var(--t1,#e8e6e1); font-size: 13px; box-sizing: border-box; }
    .cr-input:focus { outline: none; border-color: var(--gold,#f59e0b); }
    .cr-textarea { width: 100%; padding: 9px 13px; border-radius: 8px; border: 1px solid var(--brd,#1e1e28); background: var(--bg,#0b0b0f); color: var(--t1,#e8e6e1); font-size: 13px; box-sizing: border-box; resize: vertical; font-family: inherit; }
    .cr-textarea:focus { outline: none; border-color: var(--gold,#f59e0b); }
    .cr-btn { padding: 10px 20px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; }
    .cr-btn-primary { background: var(--gold,#f59e0b); color: #000; }
    .cr-btn-primary:hover:not(:disabled) { background: var(--amber,#fbbf24); }
    .cr-btn-ghost { background: transparent; border: 1px solid var(--brd,#1e1e28); color: var(--t2,#999); }
    .cr-btn-ghost:hover:not(:disabled) { border-color: var(--gold,#f59e0b); color: var(--gold,#f59e0b); }
    .cr-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cr-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .cr-grid-auto { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .cr-section-title { font-size: 13px; font-weight: 700; color: var(--gold,#f59e0b); text-transform: uppercase; letter-spacing: .06em; margin: 0 0 10px; }
    .cr-field { margin-bottom: 12px; }
    .cr-chat-messages { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; min-height: 200px; max-height: 420px; overflow-y: auto; padding: 4px; }
    .cr-msg { padding: 12px 16px; border-radius: 10px; font-size: 13px; line-height: 1.6; max-width: 85%; }
    .cr-msg-user { background: var(--gold,#f59e0b); color: #000; align-self: flex-end; font-weight: 500; }
    .cr-msg-ai { background: var(--bg3,#1a1a22); color: var(--t1,#e8e6e1); align-self: flex-start; border: 1px solid var(--brd,#1e1e28); }
    .cr-msg-ai.streaming::after { content: '▋'; animation: blink .7s infinite; color: var(--gold,#f59e0b); }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    .cr-job-card { background: var(--bg2,#131318); border: 1px solid var(--brd,#1e1e28); border-radius: 10px; padding: 16px; margin-bottom: 8px; }
    .cr-job-title { font-size: 14px; font-weight: 600; color: var(--t1,#e8e6e1); margin-bottom: 3px; }
    .cr-job-company { font-size: 12px; color: var(--gold,#f59e0b); margin-bottom: 3px; }
    .cr-job-meta { font-size: 11px; color: var(--t3,#666); }
    .cr-job-desc { font-size: 11px; color: var(--t2,#999); margin-top: 8px; line-height: 1.5; }
    .cr-score-bar { height: 8px; border-radius: 4px; background: var(--bg3,#1a1a22); overflow: hidden; margin-top: 4px; }
    .cr-score-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--coral,#f87171), var(--gold,#f59e0b), var(--green,#00ff88)); transition: width .6s ease; }
    .cr-bizplan-nav { display: flex; flex-direction: column; gap: 4px; }
    .cr-section-nav-item { padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; color: var(--t2,#999); transition: all .2s; }
    .cr-section-nav-item.done { color: var(--green,#00ff88); }
    .cr-section-nav-item.active { background: var(--bg3,#1a1a22); color: var(--gold,#f59e0b); }
    .cr-section-block { border: 1px solid var(--brd,#1e1e28); border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
    .cr-section-header { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: var(--bg2,#131318); }
    .cr-section-header:hover { background: var(--bg3,#1a1a22); }
    .cr-section-body { padding: 16px; font-size: 13px; line-height: 1.7; color: var(--t1,#e8e6e1); display: none; }
    .cr-section-body.open { display: block; }
    .cr-streaming-text { white-space: pre-wrap; word-break: break-word; }
    .cr-pill { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: var(--bg3,#1a1a22); color: var(--t2,#999); border: 1px solid var(--brd,#1e1e28); margin: 2px; }
    .cr-pill-gold { background: rgba(245,158,11,.12); color: var(--gold,#f59e0b); border-color: rgba(245,158,11,.3); }
    .cr-pill-green { background: rgba(0,255,136,.1); color: var(--green,#00ff88); border-color: rgba(0,255,136,.25); }
    .cr-copy-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid var(--brd,#1e1e28); background: transparent; color: var(--t2,#999); font-size: 11px; cursor: pointer; transition: all .2s; }
    .cr-copy-btn:hover { border-color: var(--gold,#f59e0b); color: var(--gold,#f59e0b); }
    .cr-star { color: var(--gold,#f59e0b); }
    .cr-empty { text-align: center; padding: 48px 20px; color: var(--t3,#666); }
    .cr-empty-icon { font-size: 40px; margin-bottom: 12px; }
    .cr-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.2); border-top-color: var(--gold,#f59e0b); border-radius: 50%; animation: spin .7s linear infinite; vertical-align: middle; margin-right: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .cr-exp-entry { background: var(--bg,#0b0b0f); border: 1px solid var(--brd,#1e1e28); border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .cr-select { width: 100%; padding: 9px 13px; border-radius: 8px; border: 1px solid var(--brd,#1e1e28); background: var(--bg,#0b0b0f); color: var(--t1,#e8e6e1); font-size: 13px; cursor: pointer; }
    .cr-select:focus { outline: none; border-color: var(--gold,#f59e0b); }
    @media (max-width: 640px) {
      .cr-grid-2 { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
})();


// ── Init ──────────────────────────────────────────────────────────────────────

function initCareer() {
  const root = document.getElementById('careerRoot') || document.getElementById('page-career');
  if (!root) return;
  // Ensure we have a careerRoot div inside the page
  if (!document.getElementById('careerRoot')) {
    root.innerHTML = '<div id="careerRoot"></div>';
  }
  renderCareer();
}

function renderCareer() {
  const root = document.getElementById('careerRoot');
  if (!root) return;

  const tabs = [
    { id: 'resume', label: 'Resume', icon: '📄' },
    { id: 'jobs', label: 'Job Search', icon: '🔍' },
    { id: 'coach', label: 'AI Coach', icon: '🧠' },
    { id: 'cover', label: 'Cover Letter', icon: '✉️' },
    { id: 'interview', label: 'Interview', icon: '🎤' },
    { id: 'salary', label: 'Salary', icon: '💰' },
    { id: 'linkedin', label: 'LinkedIn', icon: '🔗' },
    { id: 'bizplan', label: 'Biz Plan', icon: '📊' },
  ];

  let html = '<div id="careerRoot"><div style="padding:20px 0 4px;">';
  html += '<h2 style="font-size:22px;font-weight:700;color:var(--t1,#e8e6e1);margin:0 0 2px;">Career + Business Intelligence</h2>';
  html += '<p style="color:var(--t3,#666);font-size:12px;margin:0 0 20px;">Your AI-powered career command center.</p>';
  html += '</div>';

  html += '<div class="cr-tabs">';
  tabs.forEach(t => {
    const active = careerState.activeTab === t.id ? ' active' : '';
    html += `<button class="cr-tab${active}" onclick="switchCareerTab('${t.id}')">${t.icon} ${t.label}</button>`;
  });
  html += '</div>';

  html += '<div id="crTabContent">';
  html += renderCareerTab(careerState.activeTab);
  html += '</div></div>';

  root.innerHTML = html;
}

function switchCareerTab(tab) {
  careerState.activeTab = tab;
  const content = document.getElementById('crTabContent');
  if (content) {
    content.innerHTML = renderCareerTab(tab);
  }
  // Update active tab button
  document.querySelectorAll('.cr-tab').forEach(el => {
    el.classList.toggle('active', el.onclick?.toString().includes(`'${tab}'`));
  });
}

function renderCareerTab(tab) {
  switch (tab) {
    case 'resume':    return renderResumeTab();
    case 'jobs':      return renderJobsTab();
    case 'coach':     return renderCoachTab();
    case 'cover':     return renderCoverTab();
    case 'interview': return renderInterviewTab();
    case 'salary':    return renderSalaryTab();
    case 'linkedin':  return renderLinkedInTab();
    case 'bizplan':   return renderBizPlanTab();
    default:          return renderResumeTab();
  }
}


// ════════════════════════════════════════════════════════════════════════════
// TAB 1: RESUME BUILDER
// ════════════════════════════════════════════════════════════════════════════

function renderResumeTab() {
  const r = careerState.resume;
  const expEntries = r.experience.length > 0 ? r.experience : [{ company: '', title: '', dates: '', bullets: '' }];

  let expHtml = '';
  expEntries.forEach((exp, i) => {
    expHtml += `<div class="cr-exp-entry" id="exp-entry-${i}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:11px;color:var(--t3,#666);font-weight:600;">EXPERIENCE ${i + 1}</span>
        <button onclick="careerRemoveExp(${i})" style="background:none;border:none;color:var(--coral,#f87171);font-size:13px;cursor:pointer;padding:2px 6px;">✕</button>
      </div>
      <div class="cr-grid-2" style="gap:8px;margin-bottom:6px;">
        <input class="cr-input" placeholder="Company" value="${_esc(exp.company)}" style="font-size:12px;" oninput="careerUpdateExp(${i},'company',this.value)">
        <input class="cr-input" placeholder="Job Title" value="${_esc(exp.title)}" style="font-size:12px;" oninput="careerUpdateExp(${i},'title',this.value)">
        <input class="cr-input" placeholder="Dates (e.g. Jan 2020 – Present)" value="${_esc(exp.dates)}" style="font-size:12px;" oninput="careerUpdateExp(${i},'dates',this.value)">
      </div>
      <textarea class="cr-textarea" placeholder="Key achievements (one per line, will be AI-enhanced)" style="height:60px;font-size:12px;" oninput="careerUpdateExp(${i},'bullets',this.value)">${_esc(exp.bullets)}</textarea>
    </div>`;
  });

  // Preview panel content
  let previewHtml = '';
  const sections = r.generatedSections;
  if (r.streaming || Object.keys(sections).length > 0) {
    if (sections.summary) {
      previewHtml += `<div style="margin-bottom:16px;">
        <div class="cr-section-title" style="font-size:10px;">PROFESSIONAL SUMMARY</div>
        <div style="font-size:13px;line-height:1.7;color:var(--t1,#e8e6e1);white-space:pre-wrap;">${_esc(sections.summary)}</div>
      </div>`;
    }
    if (sections.experience) {
      previewHtml += `<div style="margin-bottom:16px;">
        <div class="cr-section-title" style="font-size:10px;">WORK EXPERIENCE</div>
        <div style="font-size:13px;line-height:1.7;color:var(--t1,#e8e6e1);white-space:pre-wrap;">${_esc(sections.experience)}</div>
      </div>`;
    }
    if (sections.education) {
      previewHtml += `<div style="margin-bottom:16px;">
        <div class="cr-section-title" style="font-size:10px;">EDUCATION</div>
        <div style="font-size:13px;line-height:1.7;color:var(--t1,#e8e6e1);white-space:pre-wrap;">${_esc(sections.education)}</div>
      </div>`;
    }
    if (sections.skills) {
      previewHtml += `<div style="margin-bottom:16px;">
        <div class="cr-section-title" style="font-size:10px;">SKILLS</div>
        <div style="font-size:13px;line-height:1.7;color:var(--t1,#e8e6e1);white-space:pre-wrap;">${_esc(sections.skills)}</div>
      </div>`;
    }
    if (r.streaming) {
      previewHtml += '<div style="color:var(--gold,#f59e0b);font-size:12px;"><span class="cr-spinner"></span>Generating...</div>';
    }
  } else if (r.enhancedResult) {
    const e = r.enhancedResult;
    previewHtml += `<div style="margin-bottom:14px;">
      <div class="cr-section-title" style="font-size:10px;">ENHANCED SUMMARY</div>
      <div style="font-size:12px;line-height:1.7;color:var(--t1,#e8e6e1);">${_esc(e.enhanced_summary || '')}</div>
    </div>`;
    if (e.ats_keywords?.length) {
      previewHtml += `<div style="margin-bottom:14px;">
        <div class="cr-section-title" style="font-size:10px;">ATS KEYWORDS</div>
        <div>${(e.ats_keywords || []).map(k => `<span class="cr-pill cr-pill-gold">${_esc(k)}</span>`).join('')}</div>
      </div>`;
    }
    if (e.skills_categorized) {
      previewHtml += `<div style="margin-bottom:14px;"><div class="cr-section-title" style="font-size:10px;">CATEGORIZED SKILLS</div>`;
      Object.entries(e.skills_categorized).forEach(([cat, skills]) => {
        if (skills?.length) {
          previewHtml += `<div style="margin-bottom:6px;font-size:12px;"><strong style="color:var(--t2,#999);">${_esc(cat)}:</strong> <span style="color:var(--t1,#e8e6e1);">${skills.map(_esc).join(', ')}</span></div>`;
        }
      });
      previewHtml += '</div>';
    }
    if (e.score_improvement) {
      const si = e.score_improvement;
      previewHtml += `<div style="margin-bottom:14px;">
        <div class="cr-section-title" style="font-size:10px;">SCORE IMPROVEMENT</div>
        <div style="display:flex;align-items:center;gap:12px;font-size:13px;">
          <span style="color:var(--coral,#f87171);">${si.before || 62}/100</span>
          <span style="color:var(--t3,#666);">→</span>
          <span style="color:var(--green,#00ff88);">${si.after || 91}/100</span>
        </div>
      </div>`;
    }
  } else {
    previewHtml = `<div class="cr-empty"><div class="cr-empty-icon">📄</div>
      <div style="font-size:13px;font-weight:500;color:var(--t2,#999);">Fill in your info and generate your resume</div>
      <div style="font-size:12px;color:var(--t3,#666);margin-top:4px;">Goldman Sachs-level content in under 30 seconds</div>
    </div>`;
  }

  return `<div class="cr-grid-2" style="align-items:start;">
    <!-- LEFT: Form -->
    <div class="cr-card">
      <div class="cr-section-title">Your Information</div>
      <div class="cr-field"><label class="cr-label">Full Name</label>
        <input class="cr-input" id="cr-name" placeholder="John Doe" value="${_esc(r.name)}" oninput="careerState.resume.name=this.value"></div>
      <div class="cr-grid-2" style="gap:8px;">
        <div class="cr-field"><label class="cr-label">Email</label>
          <input class="cr-input" id="cr-email" placeholder="john@example.com" value="${_esc(r.email)}" oninput="careerState.resume.email=this.value"></div>
        <div class="cr-field"><label class="cr-label">Phone</label>
          <input class="cr-input" id="cr-phone" placeholder="+1 (555) 000-0000" value="${_esc(r.phone)}" oninput="careerState.resume.phone=this.value"></div>
      </div>
      <div class="cr-grid-2" style="gap:8px;">
        <div class="cr-field"><label class="cr-label">Location</label>
          <input class="cr-input" id="cr-location" placeholder="San Francisco, CA" value="${_esc(r.location)}" oninput="careerState.resume.location=this.value"></div>
        <div class="cr-field"><label class="cr-label">Target Title</label>
          <input class="cr-input" id="cr-title" placeholder="Senior Product Manager" value="${_esc(r.title)}" oninput="careerState.resume.title=this.value"></div>
      </div>
      <div class="cr-field"><label class="cr-label">Professional Summary (optional)</label>
        <textarea class="cr-textarea" id="cr-summary" style="height:60px;" placeholder="Brief background..." oninput="careerState.resume.summary=this.value">${_esc(r.summary)}</textarea></div>

      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <label class="cr-label" style="margin:0;">Work Experience</label>
          <button class="cr-btn cr-btn-ghost" style="padding:4px 10px;font-size:11px;" onclick="careerAddExp()">+ Add Role</button>
        </div>
        <div id="cr-exp-list">${expHtml}</div>
      </div>

      <div class="cr-field"><label class="cr-label">Education</label>
        <textarea class="cr-textarea" style="height:50px;" placeholder="Stanford | B.S. Computer Science | 2019" oninput="careerState.resume.education=this.value">${_esc(r.education)}</textarea></div>
      <div class="cr-field"><label class="cr-label">Skills (comma-separated)</label>
        <input class="cr-input" placeholder="Python, React, Leadership, AWS..." value="${_esc(r.skills)}" oninput="careerState.resume.skills=this.value"></div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <button id="cr-gen-btn" class="cr-btn cr-btn-primary" style="flex:1;" onclick="careerGenerateResume()" ${r.streaming ? 'disabled' : ''}>
          ${r.streaming ? '<span class="cr-spinner"></span>Generating...' : '✨ Generate Resume'}
        </button>
        <button id="cr-enh-btn" class="cr-btn cr-btn-ghost" style="flex:1;" onclick="careerEnhanceResume()" ${r.enhancing ? 'disabled' : ''}>
          ${r.enhancing ? '<span class="cr-spinner"></span>Enhancing...' : '🔧 Enhance Existing'}
        </button>
      </div>
    </div>

    <!-- RIGHT: Preview -->
    <div class="cr-card" style="position:sticky;top:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div class="cr-section-title" style="margin:0;">Live Preview</div>
        <div style="display:flex;gap:6px;">
          <button class="cr-copy-btn" onclick="careerCopyResume()">Copy</button>
          <button class="cr-copy-btn" onclick="careerDownloadResume()">Download</button>
        </div>
      </div>
      <div id="cr-preview-panel">${previewHtml}</div>
    </div>
  </div>`;
}

function careerAddExp() {
  careerState.resume.experience.push({ company: '', title: '', dates: '', bullets: '' });
  _refreshTab('resume');
}

function careerRemoveExp(i) {
  careerState.resume.experience.splice(i, 1);
  _refreshTab('resume');
}

function careerUpdateExp(i, field, val) {
  if (!careerState.resume.experience[i]) careerState.resume.experience[i] = {};
  careerState.resume.experience[i][field] = val;
}

async function careerGenerateResume() {
  const r = careerState.resume;
  if (!r.name || !r.title) { _showToast('Enter at least your name and target title', 'error'); return; }
  r.streaming = true;
  r.generatedSections = {};
  r.enhancedResult = null;
  _setLoading('cr-gen-btn', true, '<span class="cr-spinner"></span>Generating...', '✨ Generate Resume');

  let currentSection = null;

  try {
    await _streamPost(
      '/api/career/resume',
      {
        name: r.name, email: r.email, phone: r.phone, location: r.location, title: r.title,
        summary: r.summary,
        experience: r.experience.filter(e => e.company || e.title),
        education: r.education,
        skills: r.skills.split(',').map(s => s.trim()).filter(Boolean),
      },
      (data) => {
        if (data.type === 'section_start') {
          currentSection = data.section;
          if (!r.generatedSections[currentSection]) r.generatedSections[currentSection] = '';
        } else if (data.type === 'chunk' && currentSection) {
          r.generatedSections[currentSection] = (r.generatedSections[currentSection] || '') + data.content;
          _updateResumePreview();
        } else if (data.type === 'section_done') {
          currentSection = null;
        }
      },
      () => {
        r.streaming = false;
        r.savedResume = Object.entries(r.generatedSections)
          .map(([k, v]) => `## ${k.toUpperCase()}\n${v}`)
          .join('\n\n');
        _setLoading('cr-gen-btn', false, '', '✨ Generate Resume');
        _updateResumePreview();
        _showToast('Resume generated!', 'success');
      }
    );
  } catch (e) {
    r.streaming = false;
    _setLoading('cr-gen-btn', false, '', '✨ Generate Resume');
    _showToast(`Error: ${e.message}`, 'error');
  }
}

function _updateResumePreview() {
  const panel = document.getElementById('cr-preview-panel');
  if (!panel) return;
  const r = careerState.resume;
  const sections = r.generatedSections;
  let html = '';
  if (r.name) {
    html += `<div style="margin-bottom:12px;border-bottom:1px solid var(--brd,#1e1e28);padding-bottom:12px;">
      <div style="font-size:18px;font-weight:700;color:var(--t1,#e8e6e1);">${_esc(r.name)}</div>
      <div style="font-size:13px;color:var(--gold,#f59e0b);margin-top:2px;">${_esc(r.title)}</div>
      <div style="font-size:11px;color:var(--t3,#666);margin-top:2px;">${[r.email, r.phone, r.location].filter(Boolean).map(_esc).join(' · ')}</div>
    </div>`;
  }
  ['summary', 'experience', 'education', 'skills'].forEach(sec => {
    if (sections[sec]) {
      const label = sec === 'summary' ? 'PROFESSIONAL SUMMARY' : sec.toUpperCase();
      html += `<div style="margin-bottom:14px;">
        <div class="cr-section-title" style="font-size:10px;">${label}</div>
        <div style="font-size:12px;line-height:1.7;color:var(--t1,#e8e6e1);white-space:pre-wrap;">${_esc(sections[sec])}</div>
      </div>`;
    }
  });
  if (r.streaming) {
    html += '<div style="color:var(--gold,#f59e0b);font-size:12px;"><span class="cr-spinner"></span>Writing next section...</div>';
  }
  panel.innerHTML = html;
}

async function careerEnhanceResume() {
  const r = careerState.resume;
  // Use either generated resume or prompt for paste
  let resumeText = r.savedResume;
  if (!resumeText) {
    resumeText = prompt('Paste your current resume text to enhance:');
    if (!resumeText) return;
  }
  r.enhancing = true;
  r.generatedSections = {};
  _setLoading('cr-enh-btn', true, '<span class="cr-spinner"></span>Enhancing...', '🔧 Enhance Existing');

  try {
    const data = await _salPost('/api/career/enhance', { resume_text: resumeText, target_role: r.title });
    if (data.status === 'success') {
      r.enhancedResult = data.enhanced;
      _showToast('Resume enhanced!', 'success');
    } else {
      _showToast(data.error || 'Enhancement failed', 'error');
    }
  } catch (e) {
    _showToast(`Error: ${e.message}`, 'error');
  }
  r.enhancing = false;
  _setLoading('cr-enh-btn', false, '', '🔧 Enhance Existing');
  _refreshTab('resume');
}

function careerCopyResume() {
  const r = careerState.resume;
  const text = r.savedResume ||
    Object.entries(r.generatedSections).map(([k, v]) => `${k.toUpperCase()}\n${v}`).join('\n\n');
  if (!text) { _showToast('Generate a resume first', 'error'); return; }
  navigator.clipboard.writeText(text).then(() => _showToast('Copied to clipboard', 'success'));
}

function careerDownloadResume() {
  const r = careerState.resume;
  const text = r.savedResume ||
    `${r.name}\n${r.title}\n${[r.email, r.phone, r.location].filter(Boolean).join(' | ')}\n\n` +
    Object.entries(r.generatedSections).map(([k, v]) => `${k.toUpperCase()}\n${v}`).join('\n\n');
  if (!text.trim()) { _showToast('Generate a resume first', 'error'); return; }
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(r.name || 'resume').replace(/\s+/g, '_')}_resume.txt`;
  a.click();
  URL.revokeObjectURL(url);
}


// ════════════════════════════════════════════════════════════════════════════
// TAB 2: JOB SEARCH
// ════════════════════════════════════════════════════════════════════════════

function renderJobsTab() {
  const j = careerState.jobs;
  const jobTypes = ['Full-time', 'Part-time', 'Remote', 'Contract', 'Internship'];

  let resultsHtml = '';
  if (j.loading) {
    resultsHtml = `<div class="cr-empty"><span class="cr-spinner"></span><span style="color:var(--t2,#999);font-size:13px;">Searching across LinkedIn, Indeed, Glassdoor...</span></div>`;
  } else if (j.results.length > 0) {
    resultsHtml += `<div style="font-size:11px;color:var(--t3,#666);margin-bottom:10px;">${j.results.length} results found</div>`;
    j.results.forEach((job, idx) => {
      const saved = j.saved.includes(job.id);
      resultsHtml += `<div class="cr-job-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div class="cr-job-title">${_esc(job.title)}</div>
            <div class="cr-job-company">${_esc(job.company)}</div>
            <div class="cr-job-meta">
              ${_esc(job.location)}${job.remote ? ' · Remote' : ''}
              ${job.salary_range ? ` · <span style="color:var(--green,#00ff88);">${_esc(job.salary_range)}</span>` : ''}
              ${job.source ? ` · ${_esc(job.source)}` : ''}
            </div>
            ${job.description ? `<div class="cr-job-desc">${_esc(job.description.substring(0, 200))}${job.description.length > 200 ? '…' : ''}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
            ${job.url ? `<a href="${_esc(job.url)}" target="_blank" rel="noopener" class="cr-btn cr-btn-primary" style="padding:6px 14px;font-size:11px;text-decoration:none;text-align:center;">Apply →</a>` : ''}
            <button onclick="careerSaveJob(${idx})" style="padding:6px 14px;border-radius:6px;border:1px solid var(--brd,#1e1e28);background:${saved ? 'rgba(245,158,11,.12)' : 'transparent'};color:${saved ? 'var(--gold,#f59e0b)' : 'var(--t2,#999)'};font-size:11px;cursor:pointer;">${saved ? '★ Saved' : '☆ Save'}</button>
          </div>
        </div>
      </div>`;
    });
  } else {
    resultsHtml = `<div class="cr-empty">
      <div class="cr-empty-icon">🔍</div>
      <div style="font-size:14px;font-weight:500;color:var(--t2,#999);">Search for your next opportunity</div>
      <div style="font-size:12px;color:var(--t3,#666);margin-top:4px;">AI-powered search across LinkedIn, Indeed, Glassdoor and more</div>
    </div>`;
  }

  return `<div class="cr-card" style="margin-bottom:16px;">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <input class="cr-input" id="cr-job-query" placeholder="Job title, skill, or keyword..." value="${_esc(j.query)}" style="flex:1;min-width:200px;"
        oninput="careerState.jobs.query=this.value" onkeydown="if(event.key==='Enter')careerSearchJobs()">
      <input class="cr-input" id="cr-job-loc" placeholder="Location (optional)" value="${_esc(j.location)}" style="width:180px;"
        oninput="careerState.jobs.location=this.value" onkeydown="if(event.key==='Enter')careerSearchJobs()">
      <button class="cr-btn cr-btn-primary" onclick="careerSearchJobs()" ${j.loading ? 'disabled' : ''}>
        ${j.loading ? '<span class="cr-spinner"></span>Searching' : '🔍 Search'}
      </button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      ${jobTypes.map(jt => `<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--t2,#999);cursor:pointer;">
        <input type="checkbox" style="accent-color:var(--gold,#f59e0b);"
          ${j.jobType === jt ? 'checked' : ''}
          onchange="careerState.jobs.jobType=this.checked?'${jt}':'';careerState.jobs.remote=${jt === 'Remote' ? 'this.checked' : 'careerState.jobs.remote'}">
        ${jt}
      </label>`).join('')}
    </div>
  </div>
  <div id="cr-job-results">${resultsHtml}</div>`;
}

async function careerSearchJobs() {
  const j = careerState.jobs;
  const queryEl = document.getElementById('cr-job-query');
  const locEl = document.getElementById('cr-job-loc');
  if (queryEl) j.query = queryEl.value.trim();
  if (locEl) j.location = locEl.value.trim();

  if (!j.query) { _showToast('Enter a job title or keyword', 'error'); return; }

  j.loading = true;
  j.results = [];
  const resultsEl = document.getElementById('cr-job-results');
  if (resultsEl) {
    resultsEl.innerHTML = `<div class="cr-empty"><span class="cr-spinner"></span><span style="color:var(--t2,#999);font-size:13px;">Searching jobs...</span></div>`;
  }

  try {
    let params = `query=${encodeURIComponent(j.query)}`;
    if (j.location) params += `&location=${encodeURIComponent(j.location)}`;
    if (j.jobType && j.jobType !== 'Remote') params += `&job_type=${encodeURIComponent(j.jobType)}`;
    if (j.remote || j.jobType === 'Remote') params += '&remote=true';

    const data = await _salGet(`/api/career/jobs?${params}`);
    j.results = data.jobs || [];
    j.loading = false;
    if (resultsEl) {
      // Re-render results section only
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = renderJobsTab();
      const newResults = tempDiv.querySelector('#cr-job-results');
      if (newResults) resultsEl.innerHTML = newResults.innerHTML;
    }
    if (!j.results.length) _showToast('No results found. Try different keywords.', 'info');
  } catch (e) {
    j.loading = false;
    if (resultsEl) resultsEl.innerHTML = `<div class="cr-empty"><div style="color:var(--coral,#f87171);font-size:13px;">Search failed: ${_esc(e.message)}</div></div>`;
    _showToast(`Search error: ${e.message}`, 'error');
  }
}

function careerSaveJob(idx) {
  const job = careerState.jobs.results[idx];
  if (!job) return;
  const j = careerState.jobs;
  const pos = j.saved.indexOf(job.id);
  if (pos >= 0) {
    j.saved.splice(pos, 1);
  } else {
    j.saved.push(job.id);
    _showToast('Job saved', 'success');
  }
  _refreshTab('jobs');
}


// ════════════════════════════════════════════════════════════════════════════
// TAB 3: AI CAREER COACH
// ════════════════════════════════════════════════════════════════════════════

function renderCoachTab() {
  const c = careerState.coach;
  const ctx = c.context;

  const starters = [
    'How do I negotiate a promotion?',
    'Review my career path',
    'What skills should I learn next?',
    'How do I handle a difficult manager?',
    'Should I take this job offer?',
  ];

  let messagesHtml = '';
  if (c.messages.length === 0) {
    messagesHtml = `<div class="cr-empty" style="min-height:120px;">
      <div class="cr-empty-icon" style="font-size:28px;">🧠</div>
      <div style="font-size:13px;color:var(--t2,#999);">Your personal career strategist is ready.</div>
      <div style="font-size:12px;color:var(--t3,#666);margin-top:4px;">Ask anything about career strategy, salary, promotions, or pivots.</div>
    </div>`;
  } else {
    c.messages.forEach((msg, i) => {
      const isAI = msg.role === 'assistant';
      const streaming = isAI && i === c.messages.length - 1 && c.loading;
      messagesHtml += `<div class="cr-msg ${isAI ? 'cr-msg-ai' + (streaming ? ' streaming' : '') : 'cr-msg-user'}">${_esc(msg.content)}</div>`;
    });
  }

  return `<div style="display:flex;flex-direction:column;gap:12px;">
    <!-- Context -->
    <div class="cr-card">
      <div class="cr-section-title" style="margin-bottom:10px;">Your Context (optional)</div>
      <div class="cr-grid-2" style="gap:8px;">
        <div class="cr-field"><label class="cr-label">Current Role</label>
          <input class="cr-input" placeholder="Senior Engineer" value="${_esc(ctx.current_role)}"
            oninput="careerState.coach.context.current_role=this.value" style="font-size:12px;"></div>
        <div class="cr-field"><label class="cr-label">Target Role</label>
          <input class="cr-input" placeholder="VP Engineering" value="${_esc(ctx.target_role)}"
            oninput="careerState.coach.context.target_role=this.value" style="font-size:12px;"></div>
        <div class="cr-field"><label class="cr-label">Years Experience</label>
          <input class="cr-input" placeholder="7" value="${_esc(ctx.years_exp)}"
            oninput="careerState.coach.context.years_exp=this.value" style="font-size:12px;"></div>
      </div>
    </div>

    <!-- Chat -->
    <div class="cr-card">
      <div id="cr-coach-messages" class="cr-chat-messages">${messagesHtml}</div>

      <!-- Starter prompts -->
      ${c.messages.length === 0 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
        ${starters.map(s => `<button class="cr-pill cr-pill-gold" style="cursor:pointer;font-size:11px;" onclick="careerCoachSend('${_esc(s)}')">${_esc(s)}</button>`).join('')}
      </div>` : ''}

      <div style="display:flex;gap:8px;">
        <textarea id="cr-coach-input" class="cr-textarea" style="height:44px;resize:none;flex:1;"
          placeholder="Ask anything about your career..."
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();careerCoachSend()}"></textarea>
        <button class="cr-btn cr-btn-primary" onclick="careerCoachSend()" ${c.loading ? 'disabled' : ''} style="padding:10px 18px;">
          ${c.loading ? '<span class="cr-spinner"></span>' : '↑'}
        </button>
      </div>
      ${c.messages.length > 0 ? `<button class="cr-copy-btn" style="margin-top:8px;" onclick="careerClearCoach()">Clear Chat</button>` : ''}
    </div>
  </div>`;
}

async function careerCoachSend(prefill) {
  const c = careerState.coach;
  const inputEl = document.getElementById('cr-coach-input');
  const message = prefill || (inputEl ? inputEl.value.trim() : '');
  if (!message || c.loading) return;

  if (inputEl) inputEl.value = '';

  c.messages.push({ role: 'user', content: message });
  c.loading = true;

  // Add streaming placeholder
  c.messages.push({ role: 'assistant', content: '' });
  _refreshCoachUI();

  const aiIdx = c.messages.length - 1;
  let fullText = '';

  try {
    await _streamPost(
      '/api/career/coach',
      {
        message,
        messages: c.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        context: c.context,
      },
      (data) => {
        if (data.type === 'chunk') {
          fullText += data.content;
          c.messages[aiIdx].content = fullText;
          _refreshCoachMessages();
        }
      },
      () => {
        c.loading = false;
        if (!fullText) c.messages[aiIdx].content = 'Sorry, I could not respond right now.';
        else c.messages[aiIdx].content = fullText;
        _refreshCoachMessages();
      }
    );
  } catch (e) {
    c.loading = false;
    c.messages[aiIdx].content = `Error: ${e.message}`;
    _refreshCoachMessages();
  }
}

function _refreshCoachMessages() {
  const container = document.getElementById('cr-coach-messages');
  if (!container) return;
  const c = careerState.coach;
  let html = '';
  c.messages.forEach((msg, i) => {
    const isAI = msg.role === 'assistant';
    const streaming = isAI && i === c.messages.length - 1 && c.loading;
    html += `<div class="cr-msg ${isAI ? 'cr-msg-ai' + (streaming ? ' streaming' : '') : 'cr-msg-user'}" style="white-space:pre-wrap;">${_esc(msg.content)}</div>`;
  });
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function _refreshCoachUI() {
  const content = document.getElementById('crTabContent');
  if (content && careerState.activeTab === 'coach') {
    content.innerHTML = renderCoachTab();
  }
}

function careerClearCoach() {
  careerState.coach.messages = [];
  careerState.coach.loading = false;
  _refreshTab('coach');
}


// ════════════════════════════════════════════════════════════════════════════
// TAB 4: COVER LETTER
// ════════════════════════════════════════════════════════════════════════════

function renderCoverTab() {
  const cv = careerState.cover;
  const styles = [
    { id: 'direct', label: 'Direct', desc: 'Lead with value. Executive tone.' },
    { id: 'storytelling', label: 'Storytelling', desc: 'Open with a compelling narrative.' },
    { id: 'technical', label: 'Technical', desc: 'Lead with technical depth and specifics.' },
  ];

  let resultHtml = '';
  if (cv.loading) {
    resultHtml = `<div class="cr-empty"><span class="cr-spinner"></span><span style="color:var(--t2,#999);">Writing your cover letter...</span></div>`;
  } else if (cv.result) {
    const r = cv.result;
    const wordCount = r.word_count || 0;
    const keywords = r.keywords_matched || [];
    resultHtml = `<div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:12px;color:var(--t3,#666);">${wordCount} words${keywords.length ? ` · ${keywords.length} keywords matched` : ''}</div>
        <div style="display:flex;gap:6px;">
          <button class="cr-copy-btn" onclick="careerCopyCoverLetter()">Copy</button>
          <button class="cr-copy-btn" onclick="careerDownloadCoverLetter()">Download</button>
        </div>
      </div>
      ${keywords.length ? `<div style="margin-bottom:12px;">${keywords.slice(0, 10).map(k => `<span class="cr-pill cr-pill-green">${_esc(k)}</span>`).join('')}</div>` : ''}
      <div style="background:var(--bg,#0b0b0f);border:1px solid var(--brd,#1e1e28);border-radius:8px;padding:20px;font-size:13px;line-height:1.8;color:var(--t1,#e8e6e1);white-space:pre-wrap;">${_esc(r.cover_letter || '')}</div>
    </div>`;
  } else {
    resultHtml = `<div class="cr-empty">
      <div class="cr-empty-icon">✉️</div>
      <div style="font-size:13px;color:var(--t2,#999);">Your cover letter will appear here</div>
    </div>`;
  }

  return `<div class="cr-grid-2" style="align-items:start;">
    <div class="cr-card">
      <div class="cr-section-title">Cover Letter Generator</div>
      <div class="cr-field"><label class="cr-label">Job Description</label>
        <textarea class="cr-textarea" style="height:120px;" placeholder="Paste the full job description here..."
          oninput="careerState.cover.jobDescription=this.value">${_esc(cv.jobDescription)}</textarea></div>
      <div class="cr-grid-2" style="gap:8px;">
        <div class="cr-field"><label class="cr-label">Company</label>
          <input class="cr-input" placeholder="Google" value="${_esc(cv.company)}"
            oninput="careerState.cover.company=this.value"></div>
        <div class="cr-field"><label class="cr-label">Role</label>
          <input class="cr-input" placeholder="Staff Engineer" value="${_esc(cv.role)}"
            oninput="careerState.cover.role=this.value"></div>
        <div class="cr-field"><label class="cr-label">Your Name</label>
          <input class="cr-input" placeholder="John Doe" value="${_esc(cv.name || careerState.resume.name)}"
            oninput="careerState.cover.name=this.value"></div>
      </div>

      <div class="cr-field" style="margin-bottom:14px;">
        <label class="cr-label">Style</label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          ${styles.map(s => `<div onclick="careerState.cover.style='${s.id}';_refreshTab('cover')"
            style="padding:10px;border-radius:8px;border:1px solid ${cv.style === s.id ? 'var(--gold,#f59e0b)' : 'var(--brd,#1e1e28)'};
            background:${cv.style === s.id ? 'rgba(245,158,11,.1)' : 'var(--bg,#0b0b0f)'};cursor:pointer;transition:all .2s;">
            <div style="font-size:12px;font-weight:600;color:${cv.style === s.id ? 'var(--gold,#f59e0b)' : 'var(--t1,#e8e6e1)'};">${s.label}</div>
            <div style="font-size:10px;color:var(--t3,#666);margin-top:2px;">${s.desc}</div>
          </div>`).join('')}
        </div>
      </div>

      <div class="cr-field"><label class="cr-label">Your Resume (optional — auto-uses from Resume tab)</label>
        <textarea class="cr-textarea" style="height:80px;" placeholder="Paste resume highlights or leave blank to use Resume Builder data..."
          oninput="careerState.cover.resumeText=this.value">${_esc(cv.resumeText)}</textarea></div>

      <button class="cr-btn cr-btn-primary" style="width:100%;" onclick="careerGenerateCoverLetter()" ${cv.loading ? 'disabled' : ''}>
        ${cv.loading ? '<span class="cr-spinner"></span>Writing Letter...' : '✍️ Generate Cover Letter'}
      </button>
    </div>

    <div class="cr-card">
      <div class="cr-section-title" style="margin-bottom:12px;">Your Cover Letter</div>
      <div id="cr-cover-result">${resultHtml}</div>
    </div>
  </div>`;
}

async function careerGenerateCoverLetter() {
  const cv = careerState.cover;
  if (!cv.jobDescription) { _showToast('Paste the job description first', 'error'); return; }

  cv.loading = true;
  cv.result = null;
  _refreshTab('cover');

  const resumeText = cv.resumeText ||
    Object.values(careerState.resume.generatedSections).join('\n') ||
    careerState.resume.summary;

  try {
    const data = await _salPost('/api/career/cover-letter', {
      job_description: cv.jobDescription,
      resume_text: resumeText,
      style: cv.style,
      name: cv.name || careerState.resume.name,
      company: cv.company,
      role: cv.role,
    });
    if (data.status === 'success') {
      cv.result = data.result;
      _showToast('Cover letter ready!', 'success');
    } else {
      _showToast(data.error || 'Generation failed', 'error');
    }
  } catch (e) {
    _showToast(`Error: ${e.message}`, 'error');
  }
  cv.loading = false;
  _refreshTab('cover');
}

function careerCopyCoverLetter() {
  const cv = careerState.cover;
  if (!cv.result?.cover_letter) { _showToast('Generate a letter first', 'error'); return; }
  navigator.clipboard.writeText(cv.result.cover_letter).then(() => _showToast('Copied!', 'success'));
}

function careerDownloadCoverLetter() {
  const cv = careerState.cover;
  if (!cv.result?.cover_letter) { _showToast('Generate a letter first', 'error'); return; }
  const blob = new Blob([cv.result.cover_letter], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cover_letter.txt';
  a.click();
}


// ════════════════════════════════════════════════════════════════════════════
// TAB 5: INTERVIEW PREP
// ════════════════════════════════════════════════════════════════════════════

function renderInterviewTab() {
  const iv = careerState.interview;
  const types = ['behavioral', 'technical', 'case', 'executive'];

  let resultHtml = '';
  if (iv.loading) {
    resultHtml = `<div class="cr-empty"><span class="cr-spinner"></span><span style="color:var(--t2,#999);">Building your prep package...</span></div>`;
  } else if (iv.result && !iv.mockMode) {
    const r = iv.result;
    resultHtml = `<div>
      ${r.salary_range?.mid ? `<div class="cr-card" style="margin-bottom:12px;background:rgba(0,255,136,.05);border-color:rgba(0,255,136,.2);">
        <div class="cr-section-title" style="font-size:10px;margin-bottom:6px;">SALARY RANGE</div>
        <div style="font-size:20px;font-weight:700;color:var(--green,#00ff88);">$${r.salary_range.low?.toLocaleString()} – $${r.salary_range.high?.toLocaleString()}</div>
        <div style="font-size:12px;color:var(--t3,#666);margin-top:3px;">${_esc(r.salary_range.note || '')}</div>
      </div>` : ''}

      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div class="cr-section-title" style="margin:0;">Interview Questions</div>
          <button class="cr-btn cr-btn-ghost" style="padding:6px 14px;font-size:11px;" onclick="careerStartMockInterview()">
            🎯 Mock Interview Mode
          </button>
        </div>
        ${(r.likely_questions || []).map((q, i) => `
          <div class="cr-card" style="margin-bottom:8px;padding:14px;">
            <div style="font-size:13px;font-weight:600;color:var(--t1,#e8e6e1);margin-bottom:4px;">${i + 1}. ${_esc(q.question)}</div>
            ${q.why_they_ask ? `<div style="font-size:11px;color:var(--t3,#666);margin-bottom:8px;font-style:italic;">${_esc(q.why_they_ask)}</div>` : ''}
            <details>
              <summary style="font-size:11px;color:var(--gold,#f59e0b);cursor:pointer;list-style:none;">Show Model Answer ▾</summary>
              <div style="margin-top:8px;font-size:12px;line-height:1.7;color:var(--t2,#999);white-space:pre-wrap;">${_esc(q.model_answer || '')}</div>
            </details>
          </div>`).join('')}
      </div>

      ${r.star_examples?.length ? `<div class="cr-card" style="margin-bottom:12px;">
        <div class="cr-section-title" style="font-size:10px;margin-bottom:8px;">STAR STORY STARTERS</div>
        ${r.star_examples.map((s, i) => `<div style="font-size:12px;color:var(--t1,#e8e6e1);margin-bottom:6px;padding:8px;border-left:2px solid var(--gold,#f59e0b);line-height:1.5;">${i + 1}. ${_esc(s)}</div>`).join('')}
      </div>` : ''}

      ${r.negotiation_script ? `<div class="cr-card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div class="cr-section-title" style="margin:0;font-size:10px;">NEGOTIATION SCRIPT</div>
          <button class="cr-copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(_esc(r.negotiation_script))}).then(()=>_showToast('Copied!','success'))">Copy</button>
        </div>
        <div style="font-size:12px;line-height:1.7;color:var(--t1,#e8e6e1);font-style:italic;white-space:pre-wrap;">${_esc(r.negotiation_script)}</div>
      </div>` : ''}

      ${r.day_of_checklist?.length ? `<div class="cr-card">
        <div class="cr-section-title" style="font-size:10px;margin-bottom:8px;">DAY-OF CHECKLIST</div>
        ${r.day_of_checklist.map(item => `<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--t2,#999);margin-bottom:4px;">
          <span class="cr-star">✓</span>${_esc(item)}</div>`).join('')}
      </div>` : ''}
    </div>`;
  } else if (iv.mockMode && iv.result) {
    resultHtml = renderMockInterviewMode();
  } else {
    resultHtml = `<div class="cr-empty">
      <div class="cr-empty-icon">🎤</div>
      <div style="font-size:13px;color:var(--t2,#999);">Enter details and generate your prep package</div>
      <div style="font-size:12px;color:var(--t3,#666);margin-top:4px;">Questions, STAR examples, salary data, and negotiation scripts</div>
    </div>`;
  }

  return `<div class="cr-grid-2" style="align-items:start;">
    <div class="cr-card">
      <div class="cr-section-title">Interview Details</div>
      <div class="cr-field"><label class="cr-label">Role</label>
        <input class="cr-input" placeholder="Senior Product Manager" value="${_esc(iv.role)}"
          oninput="careerState.interview.role=this.value"></div>
      <div class="cr-field"><label class="cr-label">Company</label>
        <input class="cr-input" placeholder="Google" value="${_esc(iv.company)}"
          oninput="careerState.interview.company=this.value"></div>
      <div class="cr-field"><label class="cr-label">Job Description (optional)</label>
        <textarea class="cr-textarea" style="height:80px;" placeholder="Paste JD for tailored questions..."
          oninput="careerState.interview.jobDescription=this.value">${_esc(iv.jobDescription)}</textarea></div>
      <div class="cr-field">
        <label class="cr-label">Interview Type</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          ${types.map(t => `<button onclick="careerState.interview.type='${t}';_refreshTab('interview')"
            class="cr-btn ${iv.type === t ? 'cr-btn-primary' : 'cr-btn-ghost'}" style="font-size:12px;padding:8px;text-transform:capitalize;">
            ${t}
          </button>`).join('')}
        </div>
      </div>
      <button class="cr-btn cr-btn-primary" style="width:100%;margin-top:4px;" onclick="careerGenerateInterviewPrep()" ${iv.loading ? 'disabled' : ''}>
        ${iv.loading ? '<span class="cr-spinner"></span>Generating...' : '🎯 Generate Prep Package'}
      </button>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;">
      <div id="cr-interview-result">${resultHtml}</div>
    </div>
  </div>`;
}

async function careerGenerateInterviewPrep() {
  const iv = careerState.interview;
  if (!iv.role) { _showToast('Enter the role you are interviewing for', 'error'); return; }

  iv.loading = true;
  iv.result = null;
  iv.mockMode = false;
  _refreshTab('interview');

  try {
    await _streamPost(
      '/api/career/interview',
      {
        role: iv.role, company: iv.company,
        job_description: iv.jobDescription,
        interview_type: iv.type,
      },
      (data) => {
        if (data.type === 'result') {
          iv.result = data.data;
          iv.mockIndex = 0;
          iv.mockAnswers = [];
        }
      },
      () => {
        iv.loading = false;
        _refreshTab('interview');
        if (iv.result) _showToast('Prep package ready!', 'success');
      }
    );
  } catch (e) {
    iv.loading = false;
    _refreshTab('interview');
    _showToast(`Error: ${e.message}`, 'error');
  }
}

function careerStartMockInterview() {
  careerState.interview.mockMode = true;
  careerState.interview.mockIndex = 0;
  careerState.interview.mockAnswers = [];
  _refreshTab('interview');
}

function renderMockInterviewMode() {
  const iv = careerState.interview;
  const questions = iv.result?.likely_questions || [];
  if (!questions.length) return '<div class="cr-empty">No questions available.</div>';

  const current = questions[iv.mockIndex];
  const total = questions.length;
  const progress = Math.round(((iv.mockIndex) / total) * 100);

  if (iv.mockIndex >= total) {
    return `<div class="cr-card" style="text-align:center;padding:40px 24px;">
      <div style="font-size:36px;margin-bottom:12px;">🎉</div>
      <div style="font-size:18px;font-weight:700;color:var(--t1,#e8e6e1);margin-bottom:8px;">Mock Interview Complete!</div>
      <div style="font-size:13px;color:var(--t3,#666);margin-bottom:20px;">You practiced ${total} questions.</div>
      <button class="cr-btn cr-btn-primary" onclick="careerState.interview.mockMode=false;_refreshTab('interview')">Back to Prep Package</button>
    </div>`;
  }

  const savedAnswer = iv.mockAnswers[iv.mockIndex] || '';

  return `<div class="cr-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div class="cr-section-title" style="margin:0;">Mock Interview</div>
      <button class="cr-copy-btn" onclick="careerState.interview.mockMode=false;_refreshTab('interview')">Exit</button>
    </div>
    <div class="cr-score-bar" style="margin-bottom:12px;">
      <div class="cr-score-fill" style="width:${progress}%;"></div>
    </div>
    <div style="font-size:11px;color:var(--t3,#666);margin-bottom:16px;">Question ${iv.mockIndex + 1} of ${total}</div>
    <div style="font-size:15px;font-weight:600;color:var(--t1,#e8e6e1);line-height:1.5;margin-bottom:20px;">
      ${_esc(current.question)}
    </div>
    ${current.why_they_ask ? `<div style="font-size:11px;color:var(--t3,#666);font-style:italic;margin-bottom:16px;">${_esc(current.why_they_ask)}</div>` : ''}
    <div class="cr-field">
      <label class="cr-label">Your Answer</label>
      <textarea class="cr-textarea" id="mock-answer-input" style="height:120px;" placeholder="Type your answer here..."
        oninput="careerState.interview.mockAnswers[${iv.mockIndex}]=this.value">${_esc(savedAnswer)}</textarea>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="cr-btn cr-btn-primary" onclick="careerMockNext()" style="flex:1;">
        ${iv.mockIndex < total - 1 ? 'Next Question →' : 'Finish Mock'}
      </button>
      <details style="flex:1;">
        <summary class="cr-btn cr-btn-ghost" style="cursor:pointer;list-style:none;padding:10px 20px;border-radius:8px;text-align:center;font-size:13px;font-weight:600;">Show Model Answer</summary>
        <div style="margin-top:8px;padding:12px;background:var(--bg,#0b0b0f);border-radius:8px;font-size:12px;line-height:1.7;color:var(--t2,#999);white-space:pre-wrap;">${_esc(current.model_answer || '')}</div>
      </details>
    </div>
  </div>`;
}

function careerMockNext() {
  const iv = careerState.interview;
  const inputEl = document.getElementById('mock-answer-input');
  if (inputEl) iv.mockAnswers[iv.mockIndex] = inputEl.value;
  iv.mockIndex++;
  _refreshTab('interview');
}


// ════════════════════════════════════════════════════════════════════════════
// TAB 6: SALARY NEGOTIATOR
// ════════════════════════════════════════════════════════════════════════════

function renderSalaryTab() {
  const s = careerState.salary;

  let resultHtml = '';
  if (s.loading) {
    resultHtml = `<div class="cr-empty"><span class="cr-spinner"></span><span style="color:var(--t2,#999);">Pulling market data and building strategy...</span></div>`;
  } else if (s.result) {
    const r = s.result;
    const mr = r.market_range || {};
    resultHtml = `<div style="display:flex;flex-direction:column;gap:12px;">
      <!-- Market Range -->
      <div class="cr-card" style="background:rgba(0,255,136,.04);border-color:rgba(0,255,136,.2);">
        <div class="cr-section-title" style="font-size:10px;margin-bottom:8px;">MARKET RANGE</div>
        <div style="display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap;">
          ${mr.low ? `<div><div style="font-size:11px;color:var(--t3,#666);">Low</div><div style="font-size:18px;font-weight:700;color:var(--t2,#999);">$${mr.low?.toLocaleString()}</div></div>` : ''}
          ${mr.mid ? `<div><div style="font-size:11px;color:var(--t3,#666);">Market Mid</div><div style="font-size:24px;font-weight:700;color:var(--green,#00ff88);">$${mr.mid?.toLocaleString()}</div></div>` : ''}
          ${mr.high ? `<div><div style="font-size:11px;color:var(--t3,#666);">High</div><div style="font-size:18px;font-weight:700;color:var(--t2,#999);">$${mr.high?.toLocaleString()}</div></div>` : ''}
          ${r.recommended_ask ? `<div><div style="font-size:11px;color:var(--gold,#f59e0b);">Your Ask</div><div style="font-size:26px;font-weight:800;color:var(--gold,#f59e0b);">$${r.recommended_ask?.toLocaleString()}</div></div>` : ''}
        </div>
        ${r.market_sources?.length ? `<div style="margin-top:8px;font-size:11px;color:var(--t3,#666);">Sources: ${r.market_sources.map(_esc).join(', ')}</div>` : ''}
      </div>

      <!-- Counter-offer Script -->
      ${r.counter_offer_script ? `<div class="cr-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div class="cr-section-title" style="margin:0;font-size:10px;">COUNTER-OFFER SCRIPT</div>
          <button class="cr-copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(r.counter_offer_script)}).then(()=>_showToast('Copied!','success'))">Copy Script</button>
        </div>
        <div style="font-size:13px;line-height:1.8;color:var(--t1,#e8e6e1);font-style:italic;white-space:pre-wrap;padding:12px;background:var(--bg,#0b0b0f);border-radius:8px;">${_esc(r.counter_offer_script)}</div>
      </div>` : ''}

      <!-- Email Template -->
      ${r.email_template ? `<div class="cr-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div class="cr-section-title" style="margin:0;font-size:10px;">EMAIL TEMPLATE</div>
          <button class="cr-copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(r.email_template)}).then(()=>_showToast('Copied!','success'))">Copy Email</button>
        </div>
        <div style="font-size:12px;line-height:1.7;color:var(--t1,#e8e6e1);white-space:pre-wrap;padding:12px;background:var(--bg,#0b0b0f);border-radius:8px;">${_esc(r.email_template)}</div>
      </div>` : ''}

      <!-- Backup Positions -->
      ${r.backup_positions?.length ? `<div class="cr-card">
        <div class="cr-section-title" style="font-size:10px;margin-bottom:8px;">BACKUP POSITIONS</div>
        ${r.backup_positions.map(pos => `<div style="padding:10px;border:1px solid var(--brd,#1e1e28);border-radius:8px;margin-bottom:6px;">
          <div style="font-size:13px;font-weight:600;color:var(--gold,#f59e0b);">${_esc(pos.position)} — $${pos.amount?.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--t3,#666);margin-top:3px;">${_esc(pos.rationale)}</div>
        </div>`).join('')}
      </div>` : ''}

      <!-- Non-salary levers -->
      ${r.non_salary_levers?.length ? `<div class="cr-card">
        <div class="cr-section-title" style="font-size:10px;margin-bottom:8px;">OTHER LEVERS TO NEGOTIATE</div>
        <div>${r.non_salary_levers.map(l => `<span class="cr-pill">${_esc(l)}</span>`).join('')}</div>
      </div>` : ''}
    </div>`;
  } else {
    resultHtml = `<div class="cr-empty">
      <div class="cr-empty-icon">💰</div>
      <div style="font-size:13px;color:var(--t2,#999);">Enter your offer details to get a complete negotiation strategy</div>
      <div style="font-size:12px;color:var(--t3,#666);margin-top:4px;">Real market data + exact scripts</div>
    </div>`;
  }

  return `<div class="cr-grid-2" style="align-items:start;">
    <div class="cr-card">
      <div class="cr-section-title">Your Situation</div>
      <div class="cr-field"><label class="cr-label">Current Offer Details</label>
        <textarea class="cr-textarea" style="height:80px;" placeholder="Describe the offer: $95k base, 10% bonus, no equity..."
          oninput="careerState.salary.offerDetails=this.value">${_esc(s.offerDetails)}</textarea></div>
      <div class="cr-field"><label class="cr-label">Role</label>
        <input class="cr-input" placeholder="Senior Software Engineer" value="${_esc(s.role)}"
          oninput="careerState.salary.role=this.value"></div>
      <div class="cr-grid-2" style="gap:8px;">
        <div class="cr-field"><label class="cr-label">Location</label>
          <input class="cr-input" placeholder="San Francisco, CA" value="${_esc(s.location)}"
            oninput="careerState.salary.location=this.value"></div>
        <div class="cr-field"><label class="cr-label">Years Experience</label>
          <input class="cr-input" placeholder="5" value="${_esc(s.yearsExp)}"
            oninput="careerState.salary.yearsExp=this.value"></div>
      </div>
      <div class="cr-field"><label class="cr-label">Current Salary (optional)</label>
        <input class="cr-input" placeholder="$85,000" value="${_esc(s.currentSalary)}"
          oninput="careerState.salary.currentSalary=this.value"></div>
      <button class="cr-btn cr-btn-primary" style="width:100%;margin-top:4px;" onclick="careerGetSalaryStrategy()" ${s.loading ? 'disabled' : ''}>
        ${s.loading ? '<span class="cr-spinner"></span>Pulling Market Data...' : '💰 Build Negotiation Strategy'}
      </button>
    </div>
    <div id="cr-salary-result">${resultHtml}</div>
  </div>`;
}

async function careerGetSalaryStrategy() {
  const s = careerState.salary;
  if (!s.role) { _showToast('Enter the role you are negotiating for', 'error'); return; }

  s.loading = true;
  s.result = null;
  _refreshTab('salary');

  try {
    const data = await _salPost('/api/career/salary-negotiate', {
      offer_details: s.offerDetails,
      role: s.role,
      location: s.location,
      years_exp: s.yearsExp,
      current_salary: s.currentSalary,
    });
    if (data.status === 'success') {
      s.result = data.result;
      _showToast('Strategy ready!', 'success');
    } else {
      _showToast(data.error || 'Failed', 'error');
    }
  } catch (e) {
    _showToast(`Error: ${e.message}`, 'error');
  }
  s.loading = false;
  _refreshTab('salary');
}


// ════════════════════════════════════════════════════════════════════════════
// TAB 7: LINKEDIN OPTIMIZER
// ════════════════════════════════════════════════════════════════════════════

function renderLinkedInTab() {
  const li = careerState.linkedin;

  let resultHtml = '';
  if (li.loading) {
    resultHtml = `<div class="cr-empty"><span class="cr-spinner"></span><span style="color:var(--t2,#999);">Optimizing your profile...</span></div>`;
  } else if (li.result) {
    const r = li.result;
    const scoreBefore = r.score_before || 0;
    const scoreAfter = r.score_after || 0;

    resultHtml = `<div style="display:flex;flex-direction:column;gap:12px;">
      <!-- Score -->
      <div class="cr-card" style="background:rgba(245,158,11,.05);border-color:rgba(245,158,11,.2);">
        <div class="cr-section-title" style="font-size:10px;margin-bottom:10px;">PROFILE SCORE</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
          <div style="text-align:center;">
            <div style="font-size:28px;font-weight:700;color:var(--coral,#f87171);">${scoreBefore}</div>
            <div style="font-size:10px;color:var(--t3,#666);">BEFORE</div>
          </div>
          <div style="font-size:20px;color:var(--t3,#666);">→</div>
          <div style="text-align:center;">
            <div style="font-size:36px;font-weight:700;color:var(--green,#00ff88);">${scoreAfter}</div>
            <div style="font-size:10px;color:var(--t3,#666);">AFTER</div>
          </div>
          <div style="flex:1;">
            <div class="cr-score-bar"><div class="cr-score-fill" style="width:${scoreAfter}%;"></div></div>
            <div style="font-size:11px;color:var(--t3,#666);margin-top:4px;">${_esc(r.score_notes || '')}</div>
          </div>
        </div>
        ${r.quick_wins?.length ? `<div style="margin-top:8px;">
          <div style="font-size:10px;font-weight:600;color:var(--gold,#f59e0b);margin-bottom:4px;">QUICK WINS</div>
          ${r.quick_wins.map(w => `<div style="font-size:12px;color:var(--t2,#999);margin-bottom:3px;">• ${_esc(w)}</div>`).join('')}
        </div>` : ''}
      </div>

      <!-- Headline -->
      ${r.headline ? `<div class="cr-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="cr-section-title" style="margin:0;font-size:10px;">OPTIMIZED HEADLINE</div>
          <button class="cr-copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(r.headline)}).then(()=>_showToast('Copied!','success'))">Copy</button>
        </div>
        <div style="font-size:14px;font-weight:600;color:var(--t1,#e8e6e1);line-height:1.5;">${_esc(r.headline)}</div>
      </div>` : ''}

      <!-- Summary -->
      ${r.summary ? `<div class="cr-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="cr-section-title" style="margin:0;font-size:10px;">OPTIMIZED ABOUT</div>
          <button class="cr-copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(r.summary)}).then(()=>_showToast('Copied!','success'))">Copy</button>
        </div>
        <div style="font-size:13px;line-height:1.7;color:var(--t1,#e8e6e1);white-space:pre-wrap;">${_esc(r.summary)}</div>
      </div>` : ''}

      <!-- Experience Rewrites -->
      ${r.experience_rewrites?.length ? `<div class="cr-card">
        <div class="cr-section-title" style="font-size:10px;margin-bottom:10px;">EXPERIENCE REWRITES</div>
        ${r.experience_rewrites.map((exp, i) => `<div style="margin-bottom:12px;${i > 0 ? 'padding-top:12px;border-top:1px solid var(--brd,#1e1e28);' : ''}">
          <div style="font-size:12px;font-weight:600;color:var(--gold,#f59e0b);margin-bottom:6px;">${_esc(exp.company || exp.original_role || `Role ${i+1}`)}</div>
          ${(exp.rewritten_bullets || []).map(b => `<div style="font-size:12px;color:var(--t1,#e8e6e1);margin-bottom:3px;line-height:1.5;">• ${_esc(b)}</div>`).join('')}
          <button class="cr-copy-btn" style="margin-top:6px;" onclick="navigator.clipboard.writeText(${JSON.stringify((exp.rewritten_bullets || []).join('\n'))}).then(()=>_showToast('Copied!','success'))">Copy Bullets</button>
        </div>`).join('')}
      </div>` : ''}

      <!-- Skills to Add -->
      ${r.skills_to_add?.length ? `<div class="cr-card">
        <div class="cr-section-title" style="font-size:10px;margin-bottom:8px;">SKILLS TO ADD</div>
        <div>${r.skills_to_add.map(s => `<span class="cr-pill cr-pill-green">${_esc(s)}</span>`).join('')}</div>
      </div>` : ''}
    </div>`;
  } else {
    resultHtml = `<div class="cr-empty">
      <div class="cr-empty-icon">🔗</div>
      <div style="font-size:13px;color:var(--t2,#999);">Paste your LinkedIn profile to optimize it</div>
      <div style="font-size:12px;color:var(--t3,#666);margin-top:4px;">Headline, About, Experience rewrites + score</div>
    </div>`;
  }

  return `<div class="cr-grid-2" style="align-items:start;">
    <div class="cr-card">
      <div class="cr-section-title">LinkedIn Profile</div>
      <div class="cr-field"><label class="cr-label">Current Profile (paste your LinkedIn text)</label>
        <textarea class="cr-textarea" style="height:200px;" placeholder="Copy your LinkedIn About section + job descriptions and paste here..."
          oninput="careerState.linkedin.profileText=this.value">${_esc(li.profileText)}</textarea></div>
      <div class="cr-field"><label class="cr-label">Target Role (optional)</label>
        <input class="cr-input" placeholder="VP of Product" value="${_esc(li.targetRole)}"
          oninput="careerState.linkedin.targetRole=this.value"></div>
      <button class="cr-btn cr-btn-primary" style="width:100%;margin-top:4px;" onclick="careerOptimizeLinkedIn()" ${li.loading ? 'disabled' : ''}>
        ${li.loading ? '<span class="cr-spinner"></span>Optimizing...' : '🔗 Optimize LinkedIn'}
      </button>
      <div style="margin-top:12px;font-size:11px;color:var(--t3,#666);line-height:1.5;">
        <strong style="color:var(--t2,#999);">How to copy your LinkedIn:</strong><br>
        Go to your profile → Click "View profile" → Select all text → Paste above.
      </div>
    </div>
    <div id="cr-linkedin-result">${resultHtml}</div>
  </div>`;
}

async function careerOptimizeLinkedIn() {
  const li = careerState.linkedin;
  if (!li.profileText) { _showToast('Paste your LinkedIn profile text first', 'error'); return; }

  li.loading = true;
  li.result = null;
  _refreshTab('linkedin');

  try {
    const data = await _salPost('/api/career/linkedin-optimize', {
      profile_text: li.profileText,
      target_role: li.targetRole,
    });
    if (data.status === 'success') {
      li.result = data.result;
      _showToast('Profile optimized!', 'success');
    } else {
      _showToast(data.error || 'Optimization failed', 'error');
    }
  } catch (e) {
    _showToast(`Error: ${e.message}`, 'error');
  }
  li.loading = false;
  _refreshTab('linkedin');
}


// ════════════════════════════════════════════════════════════════════════════
// TAB 8: BUSINESS PLAN AI
// ════════════════════════════════════════════════════════════════════════════

const BIZPLAN_LABELS = {
  executive_summary: 'Executive Summary',
  market_analysis: 'Market Analysis',
  competitive_landscape: 'Competitive Landscape',
  product_service: 'Product & Service',
  business_model: 'Business Model',
  go_to_market: 'Go-to-Market Strategy',
  financial_projections: 'Financial Projections',
  team: 'Team & Advisors',
  funding_ask: 'Funding Ask',
};

const BIZPLAN_SECTION_ORDER = Object.keys(BIZPLAN_LABELS);

function renderBizPlanTab() {
  const bp = careerState.bizplan;
  const stages = ['pre-revenue', 'seed', 'series-a', 'established'];

  const hasSections = Object.keys(bp.sections).length > 0;

  let planHtml = '';
  if (bp.loading) {
    const streamingSec = bp.streamingSection;
    planHtml = `<div class="cr-card" style="padding:20px;">
      <div style="font-size:13px;font-weight:600;color:var(--gold,#f59e0b);margin-bottom:16px;">
        <span class="cr-spinner"></span>Building your business plan...
      </div>
      <div class="cr-bizplan-nav">
        ${BIZPLAN_SECTION_ORDER.map(sec => {
          const done = bp.sections[sec];
          const active = streamingSec === sec;
          return `<div class="cr-section-nav-item ${done ? 'done' : ''} ${active ? 'active' : ''}" id="nav-${sec}">
            ${done ? '✓' : active ? '●' : '○'} ${BIZPLAN_LABELS[sec]}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  } else if (hasSections) {
    planHtml = `<div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div class="cr-section-title" style="margin:0;">${_esc(bp.businessName || 'Business Plan')}</div>
        <div style="display:flex;gap:6px;">
          <button class="cr-copy-btn" onclick="careerExportBizPlan()">Export All</button>
          <button class="cr-btn cr-btn-ghost" style="padding:6px 14px;font-size:11px;" onclick="careerResetBizPlan()">New Plan</button>
        </div>
      </div>
      <div id="cr-bizplan-sections">
        ${BIZPLAN_SECTION_ORDER.map((sec, i) => {
          const content = bp.sections[sec];
          if (!content) return '';
          return `<div class="cr-section-block" id="section-${sec}">
            <div class="cr-section-header" onclick="careerToggleBizSection('${sec}')">
              <div>
                <span style="font-size:11px;color:var(--t3,#666);margin-right:8px;">${String(i+1).padStart(2,'0')}</span>
                <span style="font-size:13px;font-weight:600;color:var(--t1,#e8e6e1);">${BIZPLAN_LABELS[sec]}</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <button class="cr-copy-btn" onclick="event.stopPropagation();navigator.clipboard.writeText(careerState.bizplan.sections['${sec}']||'').then(()=>_showToast('Copied!','success'))">Copy</button>
                <span style="color:var(--t3,#666);font-size:12px;" id="chevron-${sec}">▾</span>
              </div>
            </div>
            <div class="cr-section-body open" id="body-${sec}">
              <div class="cr-streaming-text">${_esc(content)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  } else {
    planHtml = `<div class="cr-empty">
      <div class="cr-empty-icon">📊</div>
      <div style="font-size:14px;font-weight:500;color:var(--t2,#999);">Enter your business details</div>
      <div style="font-size:12px;color:var(--t3,#666);margin-top:4px;">9 sections generated sequentially: executive summary, market analysis, and more</div>
    </div>`;
  }

  return `<div class="cr-grid-2" style="align-items:start;">
    <div class="cr-card">
      <div class="cr-section-title">Business Plan Generator</div>
      <div class="cr-field"><label class="cr-label">Business Name</label>
        <input class="cr-input" placeholder="Acme AI" value="${_esc(bp.businessName)}"
          oninput="careerState.bizplan.businessName=this.value" ${bp.loading ? 'disabled' : ''}></div>
      <div class="cr-field"><label class="cr-label">Business Description</label>
        <textarea class="cr-textarea" style="height:100px;" placeholder="Describe your business, what it does, and who it serves..."
          oninput="careerState.bizplan.description=this.value" ${bp.loading ? 'disabled' : ''}>${_esc(bp.description)}</textarea></div>
      <div class="cr-field"><label class="cr-label">Target Market</label>
        <input class="cr-input" placeholder="SMBs, B2B SaaS, 10-200 employees" value="${_esc(bp.targetMarket)}"
          oninput="careerState.bizplan.targetMarket=this.value" ${bp.loading ? 'disabled' : ''}></div>
      <div class="cr-field">
        <label class="cr-label">Stage</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${stages.map(st => `<button onclick="careerState.bizplan.stage='${st}';_refreshTab('bizplan')"
            class="cr-btn ${bp.stage === st ? 'cr-btn-primary' : 'cr-btn-ghost'}"
            style="font-size:11px;padding:7px 12px;text-transform:capitalize;" ${bp.loading ? 'disabled' : ''}>
            ${st}
          </button>`).join('')}
        </div>
      </div>
      <button class="cr-btn cr-btn-primary" style="width:100%;margin-top:4px;" onclick="careerGenerateBizPlan()" ${bp.loading ? 'disabled' : ''}>
        ${bp.loading ? '<span class="cr-spinner"></span>Generating Plan...' : '📊 Generate Business Plan'}
      </button>
      ${hasSections ? `<button class="cr-btn cr-btn-ghost" style="width:100%;margin-top:8px;" onclick="careerResetBizPlan()">Start New Plan</button>` : ''}
    </div>

    <div id="cr-bizplan-output" style="display:flex;flex-direction:column;gap:8px;">${planHtml}</div>
  </div>`;
}

async function careerGenerateBizPlan() {
  const bp = careerState.bizplan;
  if (!bp.description) { _showToast('Describe your business first', 'error'); return; }

  bp.loading = true;
  bp.sections = {};
  bp.streamingSection = null;
  bp.done = false;
  _refreshTab('bizplan');

  let currentSection = null;

  try {
    await _streamPost(
      '/api/business/plan',
      {
        business_name: bp.businessName,
        description: bp.description,
        target_market: bp.targetMarket,
        stage: bp.stage,
      },
      (data) => {
        if (data.type === 'section_start') {
          currentSection = data.section;
          bp.streamingSection = currentSection;
          if (!bp.sections[currentSection]) bp.sections[currentSection] = '';
          _updateBizPlanOutput();
        } else if (data.type === 'chunk' && currentSection) {
          bp.sections[currentSection] = (bp.sections[currentSection] || '') + data.content;
          _updateBizSectionBody(currentSection);
        } else if (data.type === 'section_done') {
          currentSection = null;
          bp.streamingSection = null;
        }
      },
      () => {
        bp.loading = false;
        bp.done = true;
        bp.streamingSection = null;
        _refreshTab('bizplan');
        _showToast('Business plan complete!', 'success');
      }
    );
  } catch (e) {
    bp.loading = false;
    _refreshTab('bizplan');
    _showToast(`Error: ${e.message}`, 'error');
  }
}

function _updateBizPlanOutput() {
  const output = document.getElementById('cr-bizplan-output');
  if (!output) return;
  const bp = careerState.bizplan;

  // Update nav items
  BIZPLAN_SECTION_ORDER.forEach(sec => {
    const navEl = document.getElementById(`nav-${sec}`);
    if (navEl) {
      const done = bp.sections[sec] && bp.streamingSection !== sec;
      const active = bp.streamingSection === sec;
      navEl.className = `cr-section-nav-item ${done ? 'done' : ''} ${active ? 'active' : ''}`;
      navEl.textContent = `${done ? '✓' : active ? '●' : '○'} ${BIZPLAN_LABELS[sec]}`;
    }
  });
}

function _updateBizSectionBody(sectionKey) {
  const bodyEl = document.getElementById(`body-${sectionKey}`);
  if (bodyEl) {
    bodyEl.innerHTML = `<div class="cr-streaming-text">${_esc(careerState.bizplan.sections[sectionKey] || '')}</div>`;
    return;
  }
  // Section block not in DOM yet — full refresh
  const outputEl = document.getElementById('cr-bizplan-output');
  if (outputEl) {
    outputEl.innerHTML = renderBizPlanOutputOnly();
  }
}

function renderBizPlanOutputOnly() {
  const bp = careerState.bizplan;
  if (bp.loading) {
    return `<div class="cr-card" style="padding:20px;">
      <div style="font-size:13px;font-weight:600;color:var(--gold,#f59e0b);margin-bottom:16px;"><span class="cr-spinner"></span>Building your business plan...</div>
      <div class="cr-bizplan-nav">
        ${BIZPLAN_SECTION_ORDER.map(sec => {
          const done = bp.sections[sec] && bp.streamingSection !== sec;
          const active = bp.streamingSection === sec;
          return `<div class="cr-section-nav-item ${done ? 'done' : ''} ${active ? 'active' : ''}" id="nav-${sec}">
            ${done ? '✓' : active ? '●' : '○'} ${BIZPLAN_LABELS[sec]}
            ${active ? `<div style="font-size:11px;color:var(--t3,#666);margin-top:2px;margin-left:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc((bp.sections[sec] || '').substring(0, 60))}...</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }
  return renderBizPlanTab().split('<div id="cr-bizplan-output"')[1]?.split('</div>\n  </div>')[0] || '';
}

function careerToggleBizSection(sec) {
  const body = document.getElementById(`body-${sec}`);
  const chevron = document.getElementById(`chevron-${sec}`);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (chevron) chevron.textContent = isOpen ? '▸' : '▾';
}

function careerExportBizPlan() {
  const bp = careerState.bizplan;
  const text = BIZPLAN_SECTION_ORDER
    .filter(sec => bp.sections[sec])
    .map(sec => `# ${BIZPLAN_LABELS[sec].toUpperCase()}\n\n${bp.sections[sec]}`)
    .join('\n\n---\n\n');
  if (!text) { _showToast('Generate a plan first', 'error'); return; }
  navigator.clipboard.writeText(text).then(() => _showToast('Full plan copied to clipboard!', 'success'));
}

function careerResetBizPlan() {
  careerState.bizplan.sections = {};
  careerState.bizplan.loading = false;
  careerState.bizplan.done = false;
  careerState.bizplan.streamingSection = null;
  _refreshTab('bizplan');
}


// ════════════════════════════════════════════════════════════════════════════
// SHARED UTILITY
// ════════════════════════════════════════════════════════════════════════════

function _refreshTab(tab) {
  if (careerState.activeTab !== tab) return;
  const content = document.getElementById('crTabContent');
  if (content) content.innerHTML = renderCareerTab(tab);
}

// Expose globally for app.js navigate() call
window.initCareer = initCareer;
window.switchCareerTab = switchCareerTab;
