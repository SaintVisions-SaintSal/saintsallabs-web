/**
 * SaintSal™ Labs — Launch Pad
 * 10-Step Business Formation Wizard
 * Saint Vision Technologies LLC | US Patent #10,290,222 (HACP™)
 */

'use strict';

// ── Global State ──────────────────────────────────────────────────────────────

let launchpadData = {
  step:             1,
  completedSteps:   [],
  businessName:     '',
  state:            '',
  entityType:       '',
  domain:           '',
  domainPrice:      '',
  formationOrderId: '',
  ein:              '',
  dnsConfigured:    false,
  sslProvisioned:   false,
  ghlConnected:     false,
  complianceSetup:  false,
  // Step 1 results
  nameCheckResults: null,
  // Step 2 results
  entityAdvisorResult: null,
  // Step 6 results
  dnsRecords:       [],
};

const STEPS = [
  { id: 1,  label: 'Name',       icon: '✦' },
  { id: 2,  label: 'Entity',     icon: '⬡' },
  { id: 3,  label: 'Domain',     icon: '◎' },
  { id: 4,  label: 'Form',       icon: '◈' },
  { id: 5,  label: 'EIN',        icon: '◉' },
  { id: 6,  label: 'DNS',        icon: '◍' },
  { id: 7,  label: 'SSL',        icon: '◑' },
  { id: 8,  label: 'Site',       icon: '◐' },
  { id: 9,  label: 'CRM',        icon: '◒' },
  { id: 10, label: 'Compliance', icon: '◓' },
];

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],
  ['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],
  ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],
  ['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],
  ['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],
  ['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],
  ['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],
  ['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],
  ['WI','Wisconsin'],['WY','Wyoming'],['DC','Washington D.C.'],
];

const SAL_KEY = 'saintvision_gateway_2025';

// ── Persistence ───────────────────────────────────────────────────────────────

function saveLaunchpadState() {
  try {
    const toSave = { ...launchpadData };
    // Don't save large result objects to localStorage
    toSave.nameCheckResults   = null;
    toSave.entityAdvisorResult = null;
    localStorage.setItem('saintsallabs_launchpad', JSON.stringify(toSave));
  } catch(e) {}
}

function loadLaunchpadState() {
  try {
    const saved = localStorage.getItem('saintsallabs_launchpad');
    if (saved) {
      const data = JSON.parse(saved);
      Object.assign(launchpadData, data);
    }
  } catch(e) {}
}

// ── Init ──────────────────────────────────────────────────────────────────────

function initLaunchpad() {
  loadLaunchpadState();
  renderLaunchpad();
}

function renderLaunchpad() {
  const container = document.getElementById('page-launchpad');
  if (!container) return;

  container.innerHTML = `
    <div class="launchpad-wrapper" style="
      max-width:900px;
      margin:0 auto;
      padding:24px 20px;
      font-family:var(--font);
    ">
      <!-- Header -->
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
          <div style="
            background:var(--gold);
            color:#000;
            font-weight:800;
            font-size:11px;
            letter-spacing:0.1em;
            padding:4px 10px;
            border-radius:4px;
          ">LAUNCH PAD</div>
          <span style="color:var(--t3);font-size:12px">Business Formation Wizard</span>
        </div>
        <h1 style="color:var(--t1);font-size:22px;font-weight:700;margin:0">
          Form your business in one session.
        </h1>
        <p style="color:var(--t2);font-size:13px;margin:4px 0 0">
          10 steps from idea to operational — name check, entity formation, domain, DNS, SSL, and compliance.
        </p>
      </div>

      <!-- Step Indicator -->
      <div id="lp-step-indicator" style="margin-bottom:32px"></div>

      <!-- Step Content -->
      <div id="lp-step-content"></div>
    </div>
  `;

  renderStepIndicator();
  renderCurrentStep();
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function renderStepIndicator() {
  const el = document.getElementById('lp-step-indicator');
  if (!el) return;

  const items = STEPS.map(step => {
    const isCurrent   = step.id === launchpadData.step;
    const isCompleted = launchpadData.completedSteps.includes(step.id);
    const isFuture    = !isCurrent && !isCompleted;

    let bg      = 'var(--bg3)';
    let color   = 'var(--t3)';
    let border  = '1px solid var(--brd)';
    let dotBg   = 'var(--bg3)';

    if (isCurrent) {
      bg     = 'rgba(245,158,11,0.12)';
      color  = 'var(--gold)';
      border = '1px solid var(--gold)';
      dotBg  = 'var(--gold)';
    } else if (isCompleted) {
      bg     = 'rgba(0,255,136,0.08)';
      color  = 'var(--green)';
      border = '1px solid rgba(0,255,136,0.25)';
      dotBg  = 'var(--green)';
    }

    return `
      <div
        class="lp-step-pill"
        data-step="${step.id}"
        onclick="lpGoToStep(${step.id})"
        style="
          display:flex;
          align-items:center;
          gap:6px;
          padding:6px 10px;
          border-radius:6px;
          border:${border};
          background:${bg};
          cursor:${isCompleted || isCurrent ? 'pointer' : 'default'};
          transition:all 0.15s;
          white-space:nowrap;
          flex-shrink:0;
        "
        title="Step ${step.id}: ${step.label}"
      >
        <div style="
          width:18px;height:18px;
          border-radius:50%;
          background:${dotBg};
          display:flex;align-items:center;justify-content:center;
          font-size:9px;font-weight:800;
          color:${isCurrent ? '#000' : isCompleted ? '#000' : 'var(--t3)'};
          flex-shrink:0;
        ">${isCompleted ? '✓' : step.id}</div>
        <span style="font-size:11px;font-weight:600;color:${color}">${step.label}</span>
      </div>
    `;
  });

  el.innerHTML = `
    <div style="
      display:flex;
      gap:6px;
      flex-wrap:wrap;
      overflow-x:auto;
      padding-bottom:4px;
    ">${items.join('')}</div>
  `;
}

function lpGoToStep(n) {
  if (n === launchpadData.step) return;
  if (!launchpadData.completedSteps.includes(n) && n > launchpadData.step) return;
  launchpadData.step = n;
  saveLaunchpadState();
  renderStepIndicator();
  renderCurrentStep();
}

// ── Step Router ───────────────────────────────────────────────────────────────

function renderCurrentStep() {
  const el = document.getElementById('lp-step-content');
  if (!el) return;

  switch (launchpadData.step) {
    case 1:  renderStep1(el); break;
    case 2:  renderStep2(el); break;
    case 3:  renderStep3(el); break;
    case 4:  renderStep4(el); break;
    case 5:  renderStep5(el); break;
    case 6:  renderStep6(el); break;
    case 7:  renderStep7(el); break;
    case 8:  renderStep8(el); break;
    case 9:  renderStep9(el); break;
    case 10: renderStep10(el); break;
    default: renderStep1(el);
  }
}

// ── Shared Nav Buttons ────────────────────────────────────────────────────────

function lpNavButtons({ showBack = true, showNext = true, showSkip = false, nextLabel = 'Next Step →', onNext = '', nextDisabled = false } = {}) {
  return `
    <div style="display:flex;gap:12px;align-items:center;margin-top:28px">
      ${showBack && launchpadData.step > 1 ? `
        <button onclick="lpGoToStep(${launchpadData.step - 1})" class="btn btn-ghost" style="
          background:var(--bg3);border:1px solid var(--brd);color:var(--t2);
          padding:10px 18px;border-radius:8px;font-size:13px;cursor:pointer;
        ">← Back</button>
      ` : '<div></div>'}
      ${showSkip ? `
        <button onclick="lpCompleteStep(${launchpadData.step})" style="
          background:none;border:none;color:var(--t3);font-size:12px;cursor:pointer;
          text-decoration:underline;padding:10px 0;
        ">Skip for now</button>
      ` : ''}
      ${showNext ? `
        <button
          ${onNext ? `onclick="${onNext}"` : `onclick="lpCompleteStep(${launchpadData.step})"`}
          ${nextDisabled ? 'disabled' : ''}
          style="
            background:${nextDisabled ? 'var(--bg3)' : 'var(--gold)'};
            color:${nextDisabled ? 'var(--t3)' : '#000'};
            border:none;padding:10px 22px;border-radius:8px;
            font-size:13px;font-weight:700;cursor:${nextDisabled ? 'not-allowed' : 'pointer'};
            margin-left:auto;
            transition:all 0.15s;
          "
        >${nextLabel}</button>
      ` : ''}
    </div>
  `;
}

function lpCompleteStep(n) {
  if (!launchpadData.completedSteps.includes(n)) {
    launchpadData.completedSteps.push(n);
  }
  launchpadData.step = Math.min(n + 1, 10);
  saveLaunchpadState();
  renderStepIndicator();
  renderCurrentStep();
  // Scroll to top of wizard
  document.getElementById('lp-step-indicator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function lpStepCard(content) {
  return `
    <div style="
      background:var(--bg2);
      border:1px solid var(--brd);
      border-radius:12px;
      padding:28px;
    ">${content}</div>
  `;
}

function lpStepTitle(num, title, subtitle = '') {
  return `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div style="
          width:28px;height:28px;border-radius:50%;
          background:var(--gold);color:#000;
          display:flex;align-items:center;justify-content:center;
          font-weight:800;font-size:12px;flex-shrink:0;
        ">${num}</div>
        <h2 style="color:var(--t1);font-size:18px;font-weight:700;margin:0">${title}</h2>
      </div>
      ${subtitle ? `<p style="color:var(--t2);font-size:13px;margin:0 0 0 38px">${subtitle}</p>` : ''}
    </div>
  `;
}

function lpInput(id, label, type = 'text', value = '', placeholder = '') {
  return `
    <div style="margin-bottom:16px">
      <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:6px;letter-spacing:0.05em">${label}</label>
      <input
        id="${id}" type="${type}"
        value="${escapeAttr(value)}"
        placeholder="${escapeAttr(placeholder)}"
        style="
          width:100%;box-sizing:border-box;
          background:var(--bg3);border:1px solid var(--brd);
          color:var(--t1);padding:10px 14px;border-radius:8px;
          font-size:14px;font-family:var(--font);
          outline:none;transition:border 0.15s;
        "
        onfocus="this.style.borderColor='var(--gold)'"
        onblur="this.style.borderColor='var(--brd)'"
      />
    </div>
  `;
}

function lpStateSelect(id, value = '') {
  const opts = US_STATES.map(([abbr, name]) =>
    `<option value="${abbr}" ${value === abbr ? 'selected' : ''}>${name} (${abbr})</option>`
  ).join('');
  return `
    <div style="margin-bottom:16px">
      <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:6px;letter-spacing:0.05em">STATE</label>
      <select id="${id}" style="
        width:100%;box-sizing:border-box;
        background:var(--bg3);border:1px solid var(--brd);
        color:var(--t1);padding:10px 14px;border-radius:8px;
        font-size:14px;font-family:var(--font);
        outline:none;cursor:pointer;
        -webkit-appearance:none;
        background-image:url('data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'12\\' height=\\'8\\'><path d=\\'M1 1l5 5 5-5\\' stroke=\\'%23999\\' stroke-width=\\'1.5\\' fill=\\'none\\'/></svg>');
        background-repeat:no-repeat;background-position:right 14px center;
      "
        onfocus="this.style.borderColor='var(--gold)'"
        onblur="this.style.borderColor='var(--brd)'"
      >
        <option value="">Select state...</option>
        ${opts}
      </select>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function lpSpinner() {
  return `<span style="
    display:inline-block;
    width:16px;height:16px;
    border:2px solid rgba(245,158,11,0.3);
    border-top-color:var(--gold);
    border-radius:50%;
    animation:lp-spin 0.7s linear infinite;
    vertical-align:middle;
    margin-right:8px;
  "></span>`;
}

// Inject keyframe if not present
if (!document.getElementById('lp-spin-style')) {
  const s = document.createElement('style');
  s.id = 'lp-spin-style';
  s.textContent = `@keyframes lp-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
}

// ── STEP 1: Business Name Check ───────────────────────────────────────────────

function renderStep1(el) {
  const prev = launchpadData;
  el.innerHTML = lpStepCard(`
    ${lpStepTitle(1, 'Business Name Check', 'Check domains, trademarks, and social handles simultaneously.')}

    ${lpInput('lp-biz-name', 'BUSINESS NAME', 'text', prev.businessName, 'e.g. AcmeLabs, Brightwave, Forge')}
    ${lpStateSelect('lp-state', prev.state || 'DE')}

    <button onclick="lpRunNameCheck()" id="lp-name-check-btn" style="
      width:100%;background:var(--gold);color:#000;
      border:none;padding:12px;border-radius:8px;
      font-size:14px;font-weight:700;cursor:pointer;
      margin-top:4px;transition:opacity 0.15s;
    ">Check Everything</button>

    <div id="lp-name-check-results" style="margin-top:24px"></div>

    ${lpNavButtons({ showBack: false, showNext: !!prev.businessName, nextLabel: 'Proceed to Entity Advisor →', onNext: 'lpStep1Next()' })}
  `);
}

async function lpRunNameCheck() {
  const name  = document.getElementById('lp-biz-name')?.value?.trim();
  const state = document.getElementById('lp-state')?.value;
  const btn   = document.getElementById('lp-name-check-btn');
  const res   = document.getElementById('lp-name-check-results');

  if (!name) {
    showToast('Enter a business name first', 'error');
    return;
  }

  launchpadData.businessName = name;
  launchpadData.state        = state || 'DE';

  btn.innerHTML = `${lpSpinner()} Checking...`;
  btn.disabled  = true;
  res.innerHTML = `<p style="color:var(--t2);font-size:13px">${lpSpinner()} Running simultaneous checks...</p>`;

  try {
    const data = await apiPost('/api/launchpad/name-check', {
      business_name: name,
      state:         launchpadData.state,
    });

    launchpadData.nameCheckResults = data;
    saveLaunchpadState();
    renderNameCheckResults(res, data);

    // Update next button
    const nxt = document.querySelector('.lp-next-btn');
    if (nxt) nxt.disabled = false;

  } catch(e) {
    res.innerHTML = `
      <div style="
        background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);
        border-radius:8px;padding:14px;color:var(--coral);font-size:13px;
      ">Check failed: ${e.message}. You can still proceed manually.</div>
    `;
  } finally {
    btn.innerHTML = 'Check Everything';
    btn.disabled  = false;
  }
}

function renderNameCheckResults(el, data) {
  const domains    = data.domains    || [];
  const trademarks = data.trademarks || [];
  const social     = data.social     || [];

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
      ${renderDomainColumn(domains)}
      ${renderTrademarkColumn(trademarks, data.business_name)}
      ${renderSocialColumn(social)}
    </div>
  `;
}

function renderDomainColumn(domains) {
  const rows = domains.map(d => {
    const avail = d.available === true;
    const unkn  = d.available === null;
    const icon  = avail ? '✅' : unkn ? '?' : '❌';
    const color = avail ? 'var(--green)' : unkn ? 'var(--t3)' : 'var(--coral)';

    return `
      <div style="
        display:flex;align-items:center;justify-content:space-between;
        padding:8px 0;border-bottom:1px solid var(--brd);
      ">
        <div>
          <span style="color:var(--t1);font-size:13px;font-weight:600">${d.domain}</span>
          <div style="color:${color};font-size:11px">${avail ? `$${d.price}/yr` : unkn ? 'Check manually' : 'Taken'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span>${icon}</span>
          ${avail ? `
            <button
              onclick="lpSelectDomain('${d.domain}', '${d.price}')"
              style="
                background:rgba(245,158,11,0.15);border:1px solid var(--gold);
                color:var(--gold);font-size:10px;font-weight:700;
                padding:3px 8px;border-radius:4px;cursor:pointer;
              "
            >Reserve</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:8px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:var(--t3);letter-spacing:0.08em;margin-bottom:12px">DOMAINS</div>
      ${rows || '<p style="color:var(--t3);font-size:12px">No domain data</p>'}
    </div>
  `;
}

function renderTrademarkColumn(trademarks, name) {
  const hasConflicts = trademarks && trademarks.length > 0;

  const rows = hasConflicts
    ? trademarks.map(t => `
        <div style="padding:6px 0;border-bottom:1px solid var(--brd)">
          <a href="${t.url}" target="_blank" style="
            color:var(--blue);font-size:12px;font-weight:600;
            text-decoration:none;display:block;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          " title="${escapeAttr(t.title)}">${t.title || t.url || 'Possible conflict'}</a>
          <div style="color:var(--t3);font-size:11px;margin-top:2px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          ">${t.snippet || ''}</div>
        </div>
      `).join('')
    : `<div style="color:var(--green);font-size:12px;padding:6px 0">
        ✅ No obvious conflicts found for "${name}"
      </div>`;

  return `
    <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:8px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:var(--t3);letter-spacing:0.08em;margin-bottom:12px">
        TRADEMARKS ${hasConflicts ? `<span style="color:var(--coral)">(${trademarks.length} found)</span>` : ''}
      </div>
      ${rows}
      <div style="font-size:10px;color:var(--t3);margin-top:8px">
        Always verify at <a href="https://tmsearch.uspto.gov" target="_blank" style="color:var(--blue)">USPTO TESS</a>
      </div>
    </div>
  `;
}

function renderSocialColumn(social) {
  const rows = social.map(s => `
    <div style="padding:7px 0;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="color:var(--t2);font-size:11px;font-weight:700">${s.platform}</div>
        <div style="color:var(--t1);font-size:12px">${s.handle}</div>
      </div>
      <a href="${s.url}" target="_blank" style="
        color:var(--blue);font-size:10px;text-decoration:none;
        border:1px solid var(--brd);padding:3px 7px;border-radius:4px;
      ">Check →</a>
    </div>
  `).join('');

  return `
    <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:8px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:var(--t3);letter-spacing:0.08em;margin-bottom:12px">SOCIAL</div>
      ${rows || '<p style="color:var(--t3);font-size:12px">No social data</p>'}
      <div style="font-size:10px;color:var(--t3);margin-top:8px">Verify availability manually — OAuth required for live check.</div>
    </div>
  `;
}

function lpSelectDomain(domain, price) {
  launchpadData.domain      = domain;
  launchpadData.domainPrice = price;
  saveLaunchpadState();
  showToast(`${domain} selected — proceed to Step 3 to purchase`, 'success');

  // Highlight the selected domain
  document.querySelectorAll('[data-domain]').forEach(el => el.style.borderColor = 'var(--brd)');
  const el = document.querySelector(`[data-domain="${domain}"]`);
  if (el) el.style.borderColor = 'var(--gold)';
}

function lpStep1Next() {
  const name  = document.getElementById('lp-biz-name')?.value?.trim() || launchpadData.businessName;
  const state = document.getElementById('lp-state')?.value || launchpadData.state;

  if (!name) { showToast('Enter a business name to continue', 'error'); return; }
  launchpadData.businessName = name;
  launchpadData.state        = state || 'DE';
  saveLaunchpadState();
  lpCompleteStep(1);
}

// ── STEP 2: Entity Advisor ────────────────────────────────────────────────────

function renderStep2(el) {
  const prev = launchpadData.entityAdvisorResult;

  el.innerHTML = lpStepCard(`
    ${lpStepTitle(2, 'Entity Advisor', 'Get an AI-powered entity recommendation tailored to your situation.')}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">HOW MANY FOUNDERS?</label>
        <div id="lp-founders" style="display:flex;gap:8px">
          ${lpRadioBtn('founders', '1', '1', true)}
          ${lpRadioBtn('founders', '2-5', '2–5')}
          ${lpRadioBtn('founders', '5+', '5+')}
        </div>
      </div>
      <div>
        <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">RAISING VC FUNDING?</label>
        <div style="display:flex;gap:8px">
          ${lpRadioBtn('funding', 'yes', 'Yes')}
          ${lpRadioBtn('funding', 'no', 'No', true)}
          ${lpRadioBtn('funding', 'maybe', 'Maybe')}
        </div>
      </div>
      <div>
        <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">REVENUE STAGE?</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${lpRadioBtn('revenue', 'pre-revenue', 'Pre-revenue', true)}
          ${lpRadioBtn('revenue', 'early', 'Early')}
          ${lpRadioBtn('revenue', 'growing', 'Growing')}
        </div>
      </div>
      <div>
        <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">PRIMARY TAX GOAL?</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${lpRadioBtn('tax', 'pass-through', 'Pass-through', true)}
          ${lpRadioBtn('tax', 'c-corp', 'C-Corp treatment')}
        </div>
      </div>
    </div>

    ${lpStateSelect('lp-advisor-state', launchpadData.state || 'DE')}

    <div style="margin-bottom:16px">
      <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:6px;letter-spacing:0.05em">BUSINESS DESCRIPTION <span style="color:var(--t3)">(optional)</span></label>
      <textarea id="lp-biz-description" rows="2" placeholder="Brief description of what your business does..." style="
        width:100%;box-sizing:border-box;
        background:var(--bg3);border:1px solid var(--brd);
        color:var(--t1);padding:10px 14px;border-radius:8px;
        font-size:13px;font-family:var(--font);resize:vertical;
        outline:none;
      " onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--brd)'">${prev?.description || ''}</textarea>
    </div>

    <button onclick="lpGetEntityAdvice()" id="lp-advisor-btn" style="
      width:100%;background:linear-gradient(135deg,var(--gold),var(--amber));
      color:#000;border:none;padding:13px;border-radius:8px;
      font-size:14px;font-weight:700;cursor:pointer;margin-top:4px;
    ">Get AI Recommendation</button>

    <div id="lp-advisor-result" style="margin-top:20px">
      ${prev ? renderEntityAdvisorResult(prev) : ''}
    </div>

    ${lpNavButtons({ nextLabel: 'Proceed with Entity →', onNext: 'lpStep2Next()' })}
  `);
}

function lpRadioBtn(group, value, label, checked = false) {
  return `
    <label style="
      display:flex;align-items:center;gap:6px;cursor:pointer;
      background:var(--bg3);border:1px solid var(--brd);
      border-radius:6px;padding:7px 12px;font-size:12px;
      color:var(--t2);transition:all 0.15s;
    " class="lp-radio-label">
      <input type="radio" name="lp-${group}" value="${value}" ${checked ? 'checked' : ''}
        style="accent-color:var(--gold)" />
      ${label}
    </label>
  `;
}

function lpGetRadio(group) {
  const el = document.querySelector(`input[name="lp-${group}"]:checked`);
  return el ? el.value : null;
}

async function lpGetEntityAdvice() {
  const cofounders    = lpGetRadio('founders')  || '1';
  const funding_plans = lpGetRadio('funding')   || 'no';
  const revenue_stage = lpGetRadio('revenue')   || 'pre-revenue';
  const tax_preference = lpGetRadio('tax')      || 'pass-through';
  const state         = document.getElementById('lp-advisor-state')?.value || launchpadData.state || 'DE';
  const description   = document.getElementById('lp-biz-description')?.value?.trim() || '';

  const btn = document.getElementById('lp-advisor-btn');
  const res = document.getElementById('lp-advisor-result');

  btn.innerHTML = `${lpSpinner()} Consulting AI...`;
  btn.disabled  = true;
  res.innerHTML = `<p style="color:var(--t2);font-size:13px">${lpSpinner()} Claude Opus is analyzing your situation...</p>`;

  try {
    const data = await apiPost('/api/launchpad/entity-advisor', {
      cofounders, funding_plans, revenue_stage, tax_preference,
      state_preference: state,
      business_description: description,
    });

    launchpadData.entityAdvisorResult = data;
    launchpadData.entityType          = data.recommended_entity;
    launchpadData.state               = state;
    saveLaunchpadState();

    res.innerHTML = renderEntityAdvisorResult(data);
    showToast(`Recommended: ${data.recommended_entity}`, 'success');

  } catch(e) {
    res.innerHTML = `<div style="color:var(--coral);font-size:13px;padding:12px;background:rgba(248,113,113,0.08);border-radius:8px">
      Error: ${e.message}
    </div>`;
  } finally {
    btn.innerHTML = 'Get AI Recommendation';
    btn.disabled  = false;
  }
}

function renderEntityAdvisorResult(data) {
  if (!data) return '';

  const comparison = (data.comparison || []).map(row => `
    <tr>
      <td style="padding:8px 10px;color:var(--t1);font-weight:600;font-size:12px">${row.entity}</td>
      <td style="padding:8px 10px;color:var(--t2);font-size:12px">${row.taxation}</td>
      <td style="padding:8px 10px;color:var(--t2);font-size:12px">${row.vc_fundable}</td>
      <td style="padding:8px 10px;color:var(--gold);font-size:12px">${row.formation_cost}</td>
      <td style="padding:8px 10px;color:var(--t3);font-size:11px">${row.complexity}</td>
    </tr>
  `).join('');

  const nextSteps = (data.next_steps || []).map((s, i) => `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">
      <div style="
        width:18px;height:18px;border-radius:50%;background:rgba(245,158,11,0.2);
        color:var(--gold);font-size:10px;font-weight:700;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
      ">${i + 1}</div>
      <span style="color:var(--t2);font-size:13px">${s}</span>
    </div>
  `).join('');

  return `
    <div style="
      background:rgba(245,158,11,0.06);
      border:1px solid rgba(245,158,11,0.3);
      border-radius:10px;padding:20px;margin-bottom:16px;
    ">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="
          background:var(--gold);color:#000;
          font-weight:800;font-size:20px;
          padding:10px 16px;border-radius:8px;
        ">${data.recommended_entity}</div>
        <div>
          <div style="color:var(--t1);font-weight:700;font-size:15px">Recommended Entity</div>
          <div style="color:var(--t2);font-size:12px">State: ${data.state}${data.ai_powered ? ' · AI-Powered' : ' · Rule-Based'}</div>
        </div>
      </div>

      <p style="color:var(--t1);font-size:13px;line-height:1.6;margin-bottom:12px">${data.rationale}</p>

      <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:14px">
        <div style="color:var(--t3);font-size:11px;font-weight:700;margin-bottom:6px;letter-spacing:0.06em">TAX IMPLICATIONS</div>
        <p style="color:var(--t2);font-size:12px;margin:0;line-height:1.5">${data.tax_implications}</p>
      </div>

      ${nextSteps ? `
        <div style="margin-bottom:14px">
          <div style="color:var(--t3);font-size:11px;font-weight:700;margin-bottom:8px;letter-spacing:0.06em">NEXT STEPS</div>
          ${nextSteps}
        </div>
      ` : ''}
    </div>

    ${comparison ? `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="border-bottom:1px solid var(--brd)">
              <th style="padding:8px 10px;color:var(--t3);text-align:left;font-weight:600;font-size:11px">ENTITY</th>
              <th style="padding:8px 10px;color:var(--t3);text-align:left;font-weight:600;font-size:11px">TAXATION</th>
              <th style="padding:8px 10px;color:var(--t3);text-align:left;font-weight:600;font-size:11px">VC-FUNDABLE</th>
              <th style="padding:8px 10px;color:var(--t3);text-align:left;font-weight:600;font-size:11px">COST</th>
              <th style="padding:8px 10px;color:var(--t3);text-align:left;font-weight:600;font-size:11px">COMPLEXITY</th>
            </tr>
          </thead>
          <tbody>${comparison}</tbody>
        </table>
      </div>
    ` : ''}

    <button onclick="lpStep2Next()" style="
      width:100%;background:var(--gold);color:#000;
      border:none;padding:12px;border-radius:8px;
      font-size:14px;font-weight:700;cursor:pointer;margin-top:16px;
    ">Proceed with ${data.recommended_entity} →</button>
  `;
}

function lpStep2Next() {
  if (launchpadData.entityAdvisorResult) {
    launchpadData.entityType = launchpadData.entityAdvisorResult.recommended_entity;
  }
  const stateEl = document.getElementById('lp-advisor-state');
  if (stateEl) launchpadData.state = stateEl.value || launchpadData.state;
  saveLaunchpadState();
  lpCompleteStep(2);
}

// ── STEP 3: Domain ────────────────────────────────────────────────────────────

function renderStep3(el) {
  const domains = launchpadData.nameCheckResults?.domains || [];
  const selected = launchpadData.domain;

  const domainCards = domains
    .filter(d => d.available === true || d.available === null)
    .map(d => `
      <div data-domain="${d.domain}" onclick="lpSelectDomainStep3('${d.domain}','${d.price}')" style="
        background:var(--bg3);border:1px solid ${selected === d.domain ? 'var(--gold)' : 'var(--brd)'};
        border-radius:8px;padding:14px;cursor:pointer;transition:all 0.15s;
        display:flex;align-items:center;justify-content:space-between;
      ">
        <div>
          <div style="color:var(--t1);font-weight:700;font-size:14px">${d.domain}</div>
          <div style="color:${d.available ? 'var(--green)' : 'var(--t3)'};font-size:12px;margin-top:2px">
            ${d.available ? '✅ Available' : '? Verify availability'}
          </div>
        </div>
        <div style="text-align:right">
          <div style="color:var(--gold);font-weight:700;font-size:14px">$${d.price}</div>
          <div style="color:var(--t3);font-size:11px">/year</div>
        </div>
      </div>
    `).join('');

  el.innerHTML = lpStepCard(`
    ${lpStepTitle(3, 'Domain Registration', 'Select and secure your domain name.')}

    ${selected ? `
      <div style="
        background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);
        border-radius:8px;padding:12px 16px;margin-bottom:16px;
        display:flex;align-items:center;justify-content:space-between;
      ">
        <div>
          <div style="color:var(--green);font-weight:700;font-size:14px">✓ Selected: ${selected}</div>
          <div style="color:var(--t2);font-size:12px">$${launchpadData.domainPrice}/yr · Ready to purchase</div>
        </div>
        <button onclick="lpPurchaseDomain()" style="
          background:var(--gold);color:#000;border:none;
          padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;
        ">Purchase Domain →</button>
      </div>
    ` : ''}

    ${domainCards || `
      <div style="text-align:center;padding:24px;color:var(--t2)">
        <p>No domain results from Step 1.</p>
        <p style="font-size:12px">Run a name check in Step 1 first, or enter a domain manually below.</p>
      </div>
    `}

    <div style="margin-top:16px">
      ${lpInput('lp-manual-domain', 'OR ENTER DOMAIN MANUALLY', 'text', launchpadData.domain, 'e.g. mybusiness.com')}
      <button onclick="lpSelectManualDomain()" style="
        background:var(--bg3);border:1px solid var(--brd);color:var(--t2);
        padding:9px 16px;border-radius:8px;font-size:13px;cursor:pointer;
      ">Use this domain</button>
    </div>

    <div id="lp-domain-purchase-status" style="margin-top:16px"></div>

    ${lpNavButtons({
      nextLabel: selected ? 'Domain Selected — Continue →' : 'Skip for now →',
      showSkip: !selected,
      onNext: selected ? 'lpStep3Next()' : null,
    })}
  `);
}

function lpSelectDomainStep3(domain, price) {
  launchpadData.domain      = domain;
  launchpadData.domainPrice = price;
  saveLaunchpadState();

  // Re-render to show updated selection
  const el = document.getElementById('lp-step-content');
  if (el) renderStep3(el);
}

function lpSelectManualDomain() {
  const val = document.getElementById('lp-manual-domain')?.value?.trim();
  if (!val) { showToast('Enter a domain name', 'error'); return; }
  launchpadData.domain = val;
  launchpadData.domainPrice = '14.99';
  saveLaunchpadState();
  const el = document.getElementById('lp-step-content');
  if (el) renderStep3(el);
  showToast(`Domain set to ${val}`, 'success');
}

async function lpPurchaseDomain() {
  const domain = launchpadData.domain;
  if (!domain) { showToast('Select a domain first', 'error'); return; }

  const status = document.getElementById('lp-domain-purchase-status');
  if (status) status.innerHTML = `<p style="color:var(--t2);font-size:13px">${lpSpinner()} Creating secure checkout...</p>`;

  try {
    const data = await apiPost('/api/launchpad/domain/purchase', {
      domain,
    });

    if (data.checkout_url) {
      window.open(data.checkout_url, '_blank');
      if (status) status.innerHTML = `
        <div style="
          background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);
          border-radius:8px;padding:12px;color:var(--green);font-size:13px;
        ">
          ✅ Checkout opened in new tab. Complete payment to secure <strong>${domain}</strong>.
          <br><a href="${data.checkout_url}" target="_blank" style="color:var(--blue);font-size:12px">Reopen checkout →</a>
        </div>
      `;
    }
  } catch(e) {
    if (status) status.innerHTML = `<div style="color:var(--coral);font-size:13px">Error: ${e.message}</div>`;
  }
}

function lpStep3Next() {
  saveLaunchpadState();
  lpCompleteStep(3);
}

// ── STEP 4: Entity Formation ──────────────────────────────────────────────────

function renderStep4(el) {
  const entityType = launchpadData.entityType || 'LLC';
  const bizName    = launchpadData.businessName || '';
  const state      = launchpadData.state || 'DE';

  el.innerHTML = lpStepCard(`
    ${lpStepTitle(4, 'Entity Formation', 'File your LLC or Corporation with the state.')}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${lpInput('lp-form-bizname', 'BUSINESS NAME', 'text', bizName)}
      <div>
        <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:6px;letter-spacing:0.05em">ENTITY TYPE</label>
        <select id="lp-form-entity" style="
          width:100%;box-sizing:border-box;
          background:var(--bg3);border:1px solid var(--brd);
          color:var(--t1);padding:10px 14px;border-radius:8px;
          font-size:14px;font-family:var(--font);outline:none;cursor:pointer;
        ">
          <option value="llc"     ${entityType === 'LLC' ? 'selected' : ''}>LLC — Limited Liability Company</option>
          <option value="c_corp"  ${entityType === 'C-Corp' ? 'selected' : ''}>C Corporation</option>
          <option value="s_corp"  ${entityType === 'S-Corp' ? 'selected' : ''}>S Corporation</option>
          <option value="nonprofit">Nonprofit Corporation</option>
          <option value="pllc">PLLC — Professional LLC</option>
        </select>
      </div>
    </div>

    ${lpStateSelect('lp-form-state', state)}

    <div style="margin-bottom:16px">
      <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">FORMATION PACKAGE</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px" id="lp-pkg-grid">
        ${lpPackageCard('basic', '$197', 'Basic', '5-7 days', ['Name availability search', 'Articles of Organization', '60-day Registered Agent', 'Compliance tool'], false)}
        ${lpPackageCard('deluxe', '$397', 'Deluxe', '24-hr rush', ['Everything in Basic', 'EIN filing included', 'Full year Registered Agent', 'Physical docs mailed'], true)}
        ${lpPackageCard('complete', '$449', 'Complete', '24-hr rush', ['Everything in Deluxe', 'Operating Agreement', 'LLC Kit & Seal', 'Corporate Minutes template'], false)}
      </div>
    </div>

    <div style="
      background:var(--bg3);border:1px solid var(--brd);
      border-radius:8px;padding:14px;margin-bottom:16px;
    ">
      <label style="
        display:flex;align-items:center;gap:10px;cursor:pointer;
        color:var(--t2);font-size:13px;
      ">
        <input type="checkbox" id="lp-form-ra" style="accent-color:var(--gold);width:16px;height:16px" />
        <div>
          <div style="color:var(--t1);font-weight:600">Add Registered Agent Service</div>
          <div style="font-size:12px">$224/yr — Receive legal notices, maintain privacy, stay compliant</div>
        </div>
      </label>
    </div>

    <div style="margin-bottom:16px">
      <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:6px;letter-spacing:0.05em">MEMBERS / OWNERS (name, email, ownership %)</label>
      <div id="lp-members-list">
        <div class="lp-member-row" style="display:grid;grid-template-columns:1fr 1fr 80px auto;gap:8px;margin-bottom:8px">
          <input placeholder="Full Name" style="${memberInputStyle()}" />
          <input placeholder="Email" type="email" style="${memberInputStyle()}" />
          <input placeholder="%" type="number" min="1" max="100" style="${memberInputStyle()}" />
          <button onclick="this.closest('.lp-member-row').remove()" style="
            background:none;border:1px solid var(--brd);color:var(--coral);
            border-radius:6px;cursor:pointer;padding:0 10px;
          ">✕</button>
        </div>
      </div>
      <button onclick="lpAddMemberRow()" style="
        background:none;border:1px solid var(--brd);color:var(--t2);
        padding:7px 14px;border-radius:6px;font-size:12px;cursor:pointer;margin-top:4px;
      ">+ Add Member</button>
    </div>

    ${lpInput('lp-form-contact-name',  'YOUR NAME (PRIMARY CONTACT)', 'text', '', 'Full name')}
    ${lpInput('lp-form-contact-email', 'YOUR EMAIL', 'email', '', 'you@example.com')}

    <div id="lp-formation-price" style="
      background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);
      border-radius:8px;padding:14px;margin-bottom:4px;
      display:flex;align-items:center;justify-content:space-between;
    ">
      <div>
        <div style="color:var(--t1);font-weight:700;font-size:15px" id="lp-price-display">$197 — Basic Formation</div>
        <div style="color:var(--t2);font-size:12px">+ state filing fees (varies by state) · Stripe secure checkout</div>
      </div>
      <button onclick="lpFormBusiness()" id="lp-form-btn" style="
        background:var(--gold);color:#000;border:none;
        padding:11px 20px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
      ">Form My Business →</button>
    </div>

    <div id="lp-formation-status" style="margin-top:16px"></div>

    ${lpNavButtons({ showNext: false })}
  `);

  // Attach package selection behavior
  document.querySelectorAll('.lp-pkg-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.lp-pkg-card').forEach(c => {
        c.style.borderColor = 'var(--brd)';
        c.style.background  = 'var(--bg3)';
      });
      card.style.borderColor = 'var(--gold)';
      card.style.background  = 'rgba(245,158,11,0.06)';
      const pkg    = card.dataset.pkg;
      const prices = { basic: 197, deluxe: 397, complete: 449 };
      const labels = { basic: 'Basic', deluxe: 'Deluxe', complete: 'Complete' };
      const display = document.getElementById('lp-price-display');
      if (display) display.textContent = `$${prices[pkg]} — ${labels[pkg]} Formation`;
      card.dataset.selected = 'true';
    });
  });
}

function memberInputStyle() {
  return `
    width:100%;box-sizing:border-box;
    background:var(--bg3);border:1px solid var(--brd);
    color:var(--t1);padding:8px 10px;border-radius:6px;
    font-size:13px;font-family:var(--font);outline:none;
  `.replace(/\s+/g, ' ');
}

function lpAddMemberRow() {
  const list = document.getElementById('lp-members-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'lp-member-row';
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 80px auto;gap:8px;margin-bottom:8px';
  row.innerHTML = `
    <input placeholder="Full Name" style="${memberInputStyle()}" />
    <input placeholder="Email" type="email" style="${memberInputStyle()}" />
    <input placeholder="%" type="number" min="1" max="100" style="${memberInputStyle()}" />
    <button onclick="this.closest('.lp-member-row').remove()" style="
      background:none;border:1px solid var(--brd);color:var(--coral);
      border-radius:6px;cursor:pointer;padding:0 10px;
    ">✕</button>
  `;
  list.appendChild(row);
}

function lpPackageCard(id, price, name, speed, features, popular) {
  return `
    <div class="lp-pkg-card" data-pkg="${id}" style="
      background:var(--bg3);border:1px solid ${popular ? 'var(--gold)' : 'var(--brd)'};
      border-radius:8px;padding:14px;cursor:pointer;transition:all 0.15s;
      position:relative;
    ">
      ${popular ? `<div style="
        position:absolute;top:-10px;left:50%;transform:translateX(-50%);
        background:var(--gold);color:#000;font-size:9px;font-weight:800;
        padding:3px 8px;border-radius:10px;letter-spacing:0.06em;white-space:nowrap;
      ">MOST POPULAR</div>` : ''}
      <div style="color:var(--gold);font-weight:800;font-size:18px;margin-bottom:2px">${price}</div>
      <div style="color:var(--t1);font-weight:700;font-size:13px;margin-bottom:2px">${name}</div>
      <div style="color:var(--t3);font-size:11px;margin-bottom:10px">${speed}</div>
      ${features.map(f => `<div style="color:var(--t2);font-size:11px;margin-bottom:4px">· ${f}</div>`).join('')}
    </div>
  `;
}

async function lpFormBusiness() {
  const bizName    = document.getElementById('lp-form-bizname')?.value?.trim();
  const entityType = document.getElementById('lp-form-entity')?.value;
  const state      = document.getElementById('lp-form-state')?.value;
  const ra         = document.getElementById('lp-form-ra')?.checked;
  const contactName  = document.getElementById('lp-form-contact-name')?.value?.trim();
  const contactEmail = document.getElementById('lp-form-contact-email')?.value?.trim();
  const btn    = document.getElementById('lp-form-btn');
  const status = document.getElementById('lp-formation-status');

  if (!bizName)  { showToast('Enter a business name', 'error'); return; }
  if (!state)    { showToast('Select a state', 'error'); return; }

  // Get selected package
  const selectedPkg = document.querySelector('.lp-pkg-card[data-selected="true"]');
  const pkg = selectedPkg?.dataset.pkg || 'basic';

  // Collect members
  const members = [];
  document.querySelectorAll('.lp-member-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const name   = inputs[0]?.value?.trim();
    const email  = inputs[1]?.value?.trim();
    const pct    = inputs[2]?.value?.trim();
    if (name) members.push({ name, email, ownership_pct: pct });
  });

  btn.innerHTML = `${lpSpinner()} Filing...`;
  btn.disabled  = true;

  try {
    const data = await apiPost('/api/launchpad/entity/form', {
      entity_type:      entityType,
      state,
      business_name:    bizName,
      package:          pkg,
      registered_agent: ra,
      members,
      contact_name:  contactName,
      contact_email: contactEmail,
    });

    launchpadData.businessName      = bizName;
    launchpadData.entityType        = entityType;
    launchpadData.state             = state;
    launchpadData.formationOrderId  = data.order_id;
    saveLaunchpadState();

    status.innerHTML = `
      <div style="
        background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);
        border-radius:10px;padding:20px;
      ">
        <div style="color:var(--green);font-weight:700;font-size:15px;margin-bottom:8px">
          Formation Order Created ✓
        </div>
        <div style="color:var(--t2);font-size:13px;margin-bottom:4px">Order ID: <code style="color:var(--gold)">${data.order_id}</code></div>
        <div style="color:var(--t2);font-size:13px;margin-bottom:16px">Estimated: ${data.estimated_time}</div>

        ${data.checkout_url ? `
          <button onclick="window.open('${data.checkout_url}','_blank')" style="
            background:var(--gold);color:#000;border:none;
            padding:11px 20px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
          ">Complete Payment → $${data.amount}</button>
          <div style="color:var(--t3);font-size:11px;margin-top:8px">Secure checkout via Stripe · Formation begins after payment.</div>
        ` : ''}

        <button onclick="lpCompleteStep(4)" style="
          background:none;border:1px solid var(--brd);color:var(--t2);
          padding:9px 16px;border-radius:8px;font-size:13px;cursor:pointer;margin-top:12px;
          display:block;width:100%;text-align:center;
        ">Continue to EIN Filing →</button>
      </div>
    `;

  } catch(e) {
    status.innerHTML = `<div style="color:var(--coral);font-size:13px;padding:12px;background:rgba(248,113,113,0.08);border-radius:8px">
      Error: ${e.message}
    </div>`;
  } finally {
    btn.innerHTML = 'Form My Business →';
    btn.disabled  = false;
  }
}

// ── STEP 5: EIN ───────────────────────────────────────────────────────────────

function renderStep5(el) {
  const bizName    = launchpadData.businessName;
  const entityType = launchpadData.entityType;
  const state      = launchpadData.state;

  el.innerHTML = lpStepCard(`
    ${lpStepTitle(5, 'EIN / Federal Tax ID', 'Obtain your Employer Identification Number from the IRS.')}

    <div style="
      background:var(--bg3);border:1px solid var(--brd);
      border-radius:8px;padding:14px;margin-bottom:16px;
    ">
      <div style="color:var(--t2);font-size:12px;margin-bottom:4px">Business: <span style="color:var(--t1);font-weight:600">${bizName || '—'}</span></div>
      <div style="color:var(--t2);font-size:12px;margin-bottom:4px">Entity: <span style="color:var(--t1);font-weight:600">${entityType || '—'}</span></div>
      <div style="color:var(--t2);font-size:12px">Formation Order: <span style="color:var(--gold)">${launchpadData.formationOrderId || 'Pending'}</span></div>
    </div>

    <div style="margin-bottom:20px">
      <div style="
        background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);
        border-radius:8px;padding:14px;
      ">
        <div style="color:var(--blue);font-weight:700;font-size:13px;margin-bottom:6px">Why you need an EIN</div>
        <ul style="color:var(--t2);font-size:12px;margin:0;padding-left:16px;line-height:2">
          <li>Required to open a business bank account</li>
          <li>Needed for hiring employees and filing payroll</li>
          <li>Required for business licenses and permits</li>
          <li>Separates personal and business taxes</li>
        </ul>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="
        background:var(--bg3);border:1px solid var(--brd);
        border-radius:10px;padding:18px;
      ">
        <div style="color:var(--green);font-weight:700;font-size:14px;margin-bottom:6px">Self-File (Free)</div>
        <div style="color:var(--t2);font-size:12px;margin-bottom:12px;line-height:1.5">
          Apply directly on IRS.gov. Issued immediately online (or 2-3 weeks by mail).
        </div>
        <a href="https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online"
           target="_blank"
           style="
             display:block;text-align:center;
             background:rgba(0,255,136,0.12);border:1px solid var(--green);
             color:var(--green);padding:9px;border-radius:6px;
             font-size:12px;font-weight:700;text-decoration:none;
           ">Apply on IRS.gov →</a>
      </div>
      <div style="
        background:var(--bg3);border:1px solid var(--brd);
        border-radius:10px;padding:18px;
      ">
        <div style="color:var(--gold);font-weight:700;font-size:14px;margin-bottom:6px">SaintSal Filing ($79)</div>
        <div style="color:var(--t2);font-size:12px;margin-bottom:12px;line-height:1.5">
          We prepare and file your SS-4. Done in 2-3 business days with confirmation.
        </div>
        <button onclick="lpFileEIN()" id="lp-ein-btn" style="
          width:100%;background:var(--gold);color:#000;
          border:none;padding:9px;border-radius:6px;
          font-size:12px;font-weight:700;cursor:pointer;
        ">File for EIN — $79</button>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:6px">ALREADY HAVE AN EIN?</label>
      <div style="display:flex;gap:10px;align-items:center">
        <input id="lp-existing-ein" type="text" placeholder="XX-XXXXXXX" style="
          flex:1;background:var(--bg3);border:1px solid var(--brd);
          color:var(--t1);padding:10px 14px;border-radius:8px;
          font-size:14px;font-family:var(--mono);outline:none;
        " onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--brd)'" />
        <button onclick="lpSaveEIN()" style="
          background:var(--bg3);border:1px solid var(--brd);color:var(--t2);
          padding:10px 16px;border-radius:8px;font-size:13px;cursor:pointer;
          white-space:nowrap;
        ">Save EIN</button>
      </div>
    </div>

    <div id="lp-ein-status" style="margin-bottom:8px">
      ${launchpadData.ein ? `
        <div style="
          background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);
          border-radius:8px;padding:10px 14px;color:var(--green);font-size:13px;
        ">✅ EIN on file: <code style="font-family:var(--mono)">${launchpadData.ein}</code></div>
      ` : ''}
    </div>

    ${lpNavButtons({ nextLabel: 'Continue to DNS Setup →', onNext: 'lpCompleteStep(5)', showSkip: true })}
  `);
}

async function lpFileEIN() {
  const btn    = document.getElementById('lp-ein-btn');
  const status = document.getElementById('lp-ein-status');

  btn.innerHTML = `${lpSpinner()} Processing...`;
  btn.disabled  = true;

  try {
    const data = await apiPost('/api/launchpad/entity/ein', {
      business_name:    launchpadData.businessName,
      entity_type:      launchpadData.entityType || 'llc',
      state:            launchpadData.state || 'DE',
      formation_order_id: launchpadData.formationOrderId,
    });

    const filingService = data.filing_options?.find(o => o.option?.includes('SaintSal'));
    if (filingService?.checkout_url) {
      window.open(filingService.checkout_url, '_blank');
      status.innerHTML = `
        <div style="
          background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);
          border-radius:8px;padding:12px;color:var(--gold);font-size:13px;
        ">EIN filing checkout opened. EIN typically assigned within 2-3 business days.</div>
      `;
    }
  } catch(e) {
    status.innerHTML = `<div style="color:var(--coral);font-size:13px">Error: ${e.message}</div>`;
  } finally {
    btn.innerHTML = 'File for EIN — $79';
    btn.disabled  = false;
  }
}

function lpSaveEIN() {
  const ein = document.getElementById('lp-existing-ein')?.value?.trim();
  if (!ein) { showToast('Enter your EIN', 'error'); return; }
  launchpadData.ein = ein;
  saveLaunchpadState();
  const status = document.getElementById('lp-ein-status');
  if (status) status.innerHTML = `
    <div style="
      background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);
      border-radius:8px;padding:10px 14px;color:var(--green);font-size:13px;
    ">✅ EIN saved: <code style="font-family:var(--mono)">${ein}</code></div>
  `;
  showToast('EIN saved', 'success');
}

// ── STEP 6: DNS Configuration ─────────────────────────────────────────────────

function renderStep6(el) {
  const domain = launchpadData.domain;

  el.innerHTML = lpStepCard(`
    ${lpStepTitle(6, 'DNS Configuration', 'Point your domain to your hosting platform.')}

    ${lpInput('lp-dns-domain', 'DOMAIN', 'text', domain, 'yourdomain.com')}

    <div style="margin-bottom:16px">
      <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">TARGET PLATFORM</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${lpPlatformCard('vercel',     'Vercel',     'A → 76.76.21.21')}
        ${lpPlatformCard('render',     'Render',     'CNAME → onrender.com')}
        ${lpPlatformCard('cloudflare', 'Cloudflare', 'A → 104.21.0.1')}
        ${lpPlatformCard('other',      'Other',      'Manual DNS records')}
      </div>
    </div>

    <div id="lp-render-app-field" style="display:none;margin-bottom:16px">
      ${lpInput('lp-render-app', 'RENDER APP NAME', 'text', '', 'your-app-name (without .onrender.com)')}
    </div>

    <button onclick="lpConfigureDNS()" id="lp-dns-btn" style="
      width:100%;background:var(--gold);color:#000;
      border:none;padding:12px;border-radius:8px;
      font-size:14px;font-weight:700;cursor:pointer;
    ">Configure DNS →</button>

    <div id="lp-dns-status" style="margin-top:16px"></div>

    ${lpNavButtons({ showNext: false })}
    ${lpNavButtons({ showBack: false, nextLabel: 'Continue to SSL →', onNext: 'lpCompleteStep(6)', showSkip: true })}
  `);

  // Platform card selection
  document.querySelectorAll('.lp-platform-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.lp-platform-card').forEach(c => {
        c.style.borderColor = 'var(--brd)';
        c.style.background  = 'var(--bg3)';
      });
      card.style.borderColor = 'var(--gold)';
      card.style.background  = 'rgba(245,158,11,0.06)';
      card.dataset.selected  = 'true';

      const renderField = document.getElementById('lp-render-app-field');
      if (renderField) renderField.style.display = card.dataset.platform === 'render' ? 'block' : 'none';
    });
  });
}

function lpPlatformCard(id, name, desc) {
  return `
    <div class="lp-platform-card" data-platform="${id}" style="
      background:var(--bg3);border:1px solid var(--brd);
      border-radius:8px;padding:12px;cursor:pointer;transition:all 0.15s;
    ">
      <div style="color:var(--t1);font-weight:700;font-size:13px">${name}</div>
      <div style="color:var(--t3);font-size:11px;margin-top:3px">${desc}</div>
    </div>
  `;
}

async function lpConfigureDNS() {
  const domain   = document.getElementById('lp-dns-domain')?.value?.trim();
  const selected = document.querySelector('.lp-platform-card[data-selected="true"]');
  const platform = selected?.dataset.platform;
  const appName  = document.getElementById('lp-render-app')?.value?.trim();

  if (!domain)   { showToast('Enter a domain', 'error'); return; }
  if (!platform) { showToast('Select a target platform', 'error'); return; }

  const btn    = document.getElementById('lp-dns-btn');
  const status = document.getElementById('lp-dns-status');

  btn.innerHTML = `${lpSpinner()} Configuring...`;
  btn.disabled  = true;

  try {
    const data = await apiPost('/api/launchpad/dns/configure', {
      domain,
      platform,
      app_name: appName || null,
    });

    launchpadData.domain        = domain;
    launchpadData.dnsConfigured = true;
    launchpadData.dnsRecords    = data.records_configured || [];
    saveLaunchpadState();

    const records = (data.records_configured || []).map(r => `
      <tr>
        <td style="padding:7px 10px;color:var(--gold);font-family:var(--mono);font-size:11px">${r.type}</td>
        <td style="padding:7px 10px;color:var(--t1);font-family:var(--mono);font-size:11px">${r.name}</td>
        <td style="padding:7px 10px;color:var(--t2);font-family:var(--mono);font-size:11px;word-break:break-all">${r.data}</td>
        <td style="padding:7px 10px;font-size:11px;color:${r.status === 'created' ? 'var(--green)' : r.status === 'manual_required' ? 'var(--amber)' : 'var(--coral)'}">
          ${r.status === 'created' ? '✅ Created' : r.status === 'manual_required' ? '⚠ Manual' : '❌ Error'}
        </td>
      </tr>
    `).join('');

    status.innerHTML = `
      <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:8px;padding:16px">
        <div style="color:var(--t1);font-weight:700;font-size:13px;margin-bottom:12px">
          DNS Records ${data.status === 'configured' ? '<span style="color:var(--green)">✅ Configured</span>' : '<span style="color:var(--amber)">⚠ Manual Setup Required</span>'}
        </div>
        ${records ? `
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="padding:6px 10px;color:var(--t3);text-align:left;font-size:10px;font-weight:700">TYPE</th>
              <th style="padding:6px 10px;color:var(--t3);text-align:left;font-size:10px;font-weight:700">NAME</th>
              <th style="padding:6px 10px;color:var(--t3);text-align:left;font-size:10px;font-weight:700">VALUE</th>
              <th style="padding:6px 10px;color:var(--t3);text-align:left;font-size:10px;font-weight:700">STATUS</th>
            </tr></thead>
            <tbody>${records}</tbody>
          </table>
        ` : ''}
        <div style="color:var(--t3);font-size:11px;margin-top:12px">
          ${data.propagation_note || 'DNS propagates within 30 minutes to 48 hours.'}
          <a href="${data.verify_url || '#'}" target="_blank" style="color:var(--blue);margin-left:6px">Verify →</a>
        </div>
        <button onclick="lpCompleteStep(6)" style="
          width:100%;background:var(--gold);color:#000;border:none;
          padding:10px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-top:14px;
        ">Continue to SSL →</button>
      </div>
    `;

  } catch(e) {
    status.innerHTML = `<div style="color:var(--coral);font-size:13px;padding:12px;background:rgba(248,113,113,0.08);border-radius:8px">
      Error: ${e.message}
    </div>`;
  } finally {
    btn.innerHTML = 'Configure DNS →';
    btn.disabled  = false;
  }
}

// ── STEP 7: SSL ───────────────────────────────────────────────────────────────

function renderStep7(el) {
  const domain = launchpadData.domain;

  el.innerHTML = lpStepCard(`
    ${lpStepTitle(7, 'SSL Certificate', 'Provision HTTPS for your domain.')}

    ${lpInput('lp-ssl-domain', 'DOMAIN', 'text', domain, 'yourdomain.com')}

    <div style="margin-bottom:16px">
      <label style="display:block;color:var(--t2);font-size:12px;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">HOSTING PLATFORM</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['vercel','render','cloudflare','other'].map(p => `
          <label style="
            display:flex;align-items:center;gap:6px;cursor:pointer;
            background:var(--bg3);border:1px solid var(--brd);
            border-radius:6px;padding:7px 12px;font-size:12px;color:var(--t2);
          ">
            <input type="radio" name="lp-ssl-platform" value="${p}" ${p === 'vercel' ? 'checked' : ''}
              style="accent-color:var(--gold)" />
            ${p.charAt(0).toUpperCase() + p.slice(1)}
          </label>
        `).join('')}
      </div>
    </div>

    <button onclick="lpProvisionSSL()" id="lp-ssl-btn" style="
      width:100%;background:var(--gold);color:#000;
      border:none;padding:12px;border-radius:8px;
      font-size:14px;font-weight:700;cursor:pointer;
    ">Provision SSL →</button>

    <div id="lp-ssl-status" style="margin-top:16px">
      ${launchpadData.sslProvisioned ? `
        <div style="
          background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);
          border-radius:8px;padding:12px;color:var(--green);font-size:13px;
        ">✅ SSL provisioned for ${domain}</div>
      ` : ''}
    </div>

    ${lpNavButtons({ nextLabel: 'Continue to Site Builder →', onNext: 'lpCompleteStep(7)', showSkip: true })}
  `);
}

async function lpProvisionSSL() {
  const domain   = document.getElementById('lp-ssl-domain')?.value?.trim();
  const platform = document.querySelector('input[name="lp-ssl-platform"]:checked')?.value || 'vercel';
  const btn      = document.getElementById('lp-ssl-btn');
  const status   = document.getElementById('lp-ssl-status');

  if (!domain) { showToast('Enter a domain', 'error'); return; }

  btn.innerHTML = `${lpSpinner()} Provisioning...`;
  btn.disabled  = true;

  try {
    const data = await apiPost('/api/launchpad/ssl/provision', { domain, platform });

    launchpadData.sslProvisioned = true;
    saveLaunchpadState();

    const steps = (data.instructions?.steps || []).map((s, i) => `
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div style="
          width:18px;height:18px;border-radius:50%;background:rgba(245,158,11,0.2);
          color:var(--gold);font-size:10px;font-weight:700;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;
        ">${i + 1}</div>
        <span style="color:var(--t2);font-size:13px">${s}</span>
      </div>
    `).join('');

    status.innerHTML = `
      <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:8px;padding:16px">
        <div style="color:${data.ssl_status === 'auto_provisioned' ? 'var(--green)' : 'var(--amber)'};font-weight:700;font-size:13px;margin-bottom:8px">
          ${data.ssl_status === 'auto_provisioned' ? '✅ Auto SSL Active' : '⚠ Manual Setup Required'}
        </div>
        <p style="color:var(--t2);font-size:13px;margin-bottom:12px">${data.instructions?.message || ''}</p>
        ${steps}
        <div style="display:flex;gap:12px;margin-top:14px">
          ${data.instructions?.docs ? `<a href="${data.instructions.docs}" target="_blank" style="color:var(--blue);font-size:12px">Documentation →</a>` : ''}
          <a href="${data.check_url || '#'}" target="_blank" style="color:var(--blue);font-size:12px">Check SSL Status →</a>
        </div>
        <button onclick="lpCompleteStep(7)" style="
          width:100%;background:var(--gold);color:#000;border:none;
          padding:10px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-top:14px;
        ">Continue to Site Builder →</button>
      </div>
    `;

  } catch(e) {
    status.innerHTML = `<div style="color:var(--coral);font-size:13px;padding:12px;background:rgba(248,113,113,0.08);border-radius:8px">
      Error: ${e.message}
    </div>`;
  } finally {
    btn.innerHTML = 'Provision SSL →';
    btn.disabled  = false;
  }
}

// ── STEP 8: Build Your Site ───────────────────────────────────────────────────

function renderStep8(el) {
  const name   = launchpadData.businessName;
  const entity = launchpadData.entityType;
  const domain = launchpadData.domain;

  const prompt = `Build a professional website for ${name || 'my new business'}${entity ? `, a ${entity}` : ''}${domain ? `. Domain: ${domain}` : ''}. Include a hero section, services/features section, about section, and contact form. Use a modern, clean design with a professional color palette.`;

  el.innerHTML = lpStepCard(`
    ${lpStepTitle(8, 'Build Your Site', 'Launch your business website with AI-powered design.')}

    <div style="
      background:var(--bg3);border:1px solid var(--brd);
      border-radius:10px;padding:18px;margin-bottom:20px;
    ">
      <div style="color:var(--t3);font-size:11px;font-weight:700;margin-bottom:8px;letter-spacing:0.06em">PRE-LOADED CONTEXT</div>
      <div style="color:var(--t2);font-size:13px;margin-bottom:4px">Business: <span style="color:var(--t1)">${name || 'Not set'}</span></div>
      <div style="color:var(--t2);font-size:13px;margin-bottom:4px">Entity Type: <span style="color:var(--t1)">${entity || 'Not set'}</span></div>
      <div style="color:var(--t2);font-size:13px">Domain: <span style="color:var(--gold)">${domain || 'Not set'}</span></div>
    </div>

    <div style="
      background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(167,139,250,0.08));
      border:1px solid rgba(245,158,11,0.3);
      border-radius:12px;padding:28px;text-align:center;margin-bottom:20px;
    ">
      <div style="font-size:32px;margin-bottom:12px">◐</div>
      <h3 style="color:var(--t1);font-size:18px;font-weight:700;margin-bottom:8px">
        AI Site Builder
      </h3>
      <p style="color:var(--t2);font-size:13px;margin-bottom:20px;max-width:400px;margin-left:auto;margin-right:auto;line-height:1.6">
        Generate a complete professional website in seconds using the 5-agent Builder pipeline.
        Your business context is pre-loaded.
      </p>

      <button onclick="lpLaunchBuilder()" style="
        background:var(--gold);color:#000;
        border:none;padding:14px 32px;border-radius:10px;
        font-size:15px;font-weight:800;cursor:pointer;
        letter-spacing:0.02em;
        box-shadow:0 4px 20px rgba(245,158,11,0.4);
        transition:all 0.15s;
      " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
        Build My Site with AI Builder →
      </button>

      <div style="color:var(--t3);font-size:11px;margin-top:12px">
        Powered by Grok + Claude + GPT-5 · 5-agent pipeline · 60 seconds
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      ${[
        ['◎', 'Smart Design', 'AI designs tailored to your industry and brand'],
        ['◈', 'Full Code Output', 'HTML, CSS, JS — fully deployable in one click'],
        ['◉', 'Domain Ready', 'Deploy to Vercel or Render with your custom domain'],
      ].map(([icon, title, desc]) => `
        <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:20px;margin-bottom:8px;color:var(--gold)">${icon}</div>
          <div style="color:var(--t1);font-weight:700;font-size:12px;margin-bottom:4px">${title}</div>
          <div style="color:var(--t3);font-size:11px">${desc}</div>
        </div>
      `).join('')}
    </div>

    ${lpNavButtons({ nextLabel: 'Skip — Continue to CRM →', showSkip: true, onNext: 'lpCompleteStep(8)' })}
  `);
}

function lpLaunchBuilder() {
  const context = {
    businessName: launchpadData.businessName,
    entityType:   launchpadData.entityType,
    domain:       launchpadData.domain,
    fromLaunchpad: true,
  };
  // Store context for builder to pick up
  try {
    sessionStorage.setItem('builder_context', JSON.stringify(context));
  } catch(e) {}

  // Mark step complete and navigate to builder
  lpCompleteStep(8);
  if (typeof navigate === 'function') navigate('builder');

  // Pre-fill builder prompt if available
  setTimeout(() => {
    const builderInput = document.getElementById('builder-prompt') ||
                         document.getElementById('prompt-input') ||
                         document.querySelector('[data-builder-prompt]');
    if (builderInput) {
      const name   = launchpadData.businessName || 'my business';
      const entity = launchpadData.entityType ? `, a ${launchpadData.entityType}` : '';
      const domain = launchpadData.domain ? `. Domain: ${launchpadData.domain}` : '';
      builderInput.value = `Build a professional website for ${name}${entity}${domain}. Include a hero section, services section, about section, and a contact form. Modern, clean, and SEO-optimized.`;
    }
  }, 500);
}

// ── STEP 9: CRM Setup ─────────────────────────────────────────────────────────

function renderStep9(el) {
  const connected = launchpadData.ghlConnected;

  el.innerHTML = lpStepCard(`
    ${lpStepTitle(9, 'CRM Setup', 'Connect your business to GoHighLevel CRM.')}

    <div style="
      background:var(--bg3);border:1px solid var(--brd);
      border-radius:10px;padding:20px;margin-bottom:20px;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="
            width:40px;height:40px;border-radius:8px;
            background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.25);
            display:flex;align-items:center;justify-content:center;
            color:var(--blue);font-size:18px;
          ">◎</div>
          <div>
            <div style="color:var(--t1);font-weight:700;font-size:14px">GoHighLevel CRM</div>
            <div style="color:var(--t2);font-size:12px">Contacts · Pipelines · Automations · Email · SMS</div>
          </div>
        </div>
        <div style="
          padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;
          background:${connected ? 'rgba(0,255,136,0.12)' : 'rgba(158,158,158,0.1)'};
          border:1px solid ${connected ? 'rgba(0,255,136,0.3)' : 'var(--brd)'};
          color:${connected ? 'var(--green)' : 'var(--t3)'};
        ">${connected ? '✓ Connected' : 'Not Connected'}</div>
      </div>
    </div>

    ${connected ? `
      <div style="
        background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);
        border-radius:10px;padding:20px;text-align:center;
      ">
        <div style="font-size:28px;margin-bottom:8px">✅</div>
        <div style="color:var(--green);font-weight:700;font-size:15px;margin-bottom:6px">
          ${launchpadData.businessName || 'Your business'} is live in CRM
        </div>
        <div style="color:var(--t2);font-size:13px">
          Contacts, pipelines, and automations are ready to go.
        </div>
      </div>
    ` : `
      <div style="margin-bottom:20px">
        <div style="color:var(--t3);font-size:11px;font-weight:700;margin-bottom:12px;letter-spacing:0.06em">WHAT YOU GET WITH GHL</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${[
            ['◉', 'Contact Management', 'Organize leads, clients, and prospects'],
            ['◈', 'Sales Pipelines', 'Track deals from prospect to close'],
            ['◎', 'Email + SMS', 'Automated follow-up sequences'],
            ['◍', 'Reputation Mgmt', 'Review requests and monitoring'],
          ].map(([icon, t, d]) => `
            <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:8px;padding:12px">
              <div style="color:var(--gold);font-size:16px;margin-bottom:6px">${icon}</div>
              <div style="color:var(--t1);font-weight:600;font-size:12px;margin-bottom:3px">${t}</div>
              <div style="color:var(--t3);font-size:11px">${d}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:12px">
        <a
          href="https://app.gohighlevel.com/signup"
          target="_blank"
          onclick="launchpadData.ghlConnected=true;saveLaunchpadState();"
          style="
            flex:1;text-align:center;text-decoration:none;
            background:var(--gold);color:#000;
            border:none;padding:12px;border-radius:8px;
            font-size:14px;font-weight:700;cursor:pointer;
            display:block;
          "
        >Connect GHL CRM →</a>
        <button onclick="launchpadData.ghlConnected=true;saveLaunchpadState();renderCurrentStep();" style="
          background:var(--bg3);border:1px solid var(--brd);color:var(--t2);
          padding:12px 16px;border-radius:8px;font-size:13px;cursor:pointer;
        ">Already Connected</button>
      </div>
    `}

    ${lpNavButtons({ nextLabel: 'Continue to Compliance →', onNext: 'lpCompleteStep(9)', showSkip: !connected })}
  `);
}

// ── STEP 10: Compliance Calendar ──────────────────────────────────────────────

function renderStep10(el) {
  const bizName    = launchpadData.businessName;
  const entityType = launchpadData.entityType;
  const state      = launchpadData.state;

  el.innerHTML = lpStepCard(`
    ${lpStepTitle(10, 'Compliance Calendar', 'Never miss a deadline — stay in good standing.')}

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div>
        <div style="color:var(--t2);font-size:11px;font-weight:700;margin-bottom:4px">BUSINESS</div>
        <div style="color:var(--t1);font-size:13px">${bizName || '—'}</div>
      </div>
      <div>
        <div style="color:var(--t2);font-size:11px;font-weight:700;margin-bottom:4px">ENTITY</div>
        <div style="color:var(--t1);font-size:13px">${entityType || '—'}</div>
      </div>
      <div>
        <div style="color:var(--t2);font-size:11px;font-weight:700;margin-bottom:4px">STATE</div>
        <div style="color:var(--t1);font-size:13px">${state || '—'}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      ${lpInput('lp-compliance-date', 'FORMATION DATE (or today)', 'date', new Date().toISOString().split('T')[0])}
      ${lpInput('lp-compliance-ein',  'EIN (optional)', 'text', launchpadData.ein, 'XX-XXXXXXX')}
    </div>

    <button onclick="lpGenerateCompliance()" id="lp-compliance-btn" style="
      width:100%;background:var(--gold);color:#000;
      border:none;padding:12px;border-radius:8px;
      font-size:14px;font-weight:700;cursor:pointer;margin-bottom:16px;
    ">Generate Compliance Calendar →</button>

    <div id="lp-compliance-results" style="margin-bottom:16px">
      ${launchpadData.complianceSetup ? `
        <div style="
          background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);
          border-radius:8px;padding:12px;color:var(--green);font-size:13px;
        ">✅ Compliance calendar has been generated.</div>
      ` : ''}
    </div>

    ${lpNavButtons({ nextLabel: 'Complete LaunchPad ✓', onNext: 'lpFinishWizard()', showSkip: false })}
  `);
}

async function lpGenerateCompliance() {
  const btn    = document.getElementById('lp-compliance-btn');
  const res    = document.getElementById('lp-compliance-results');
  const date   = document.getElementById('lp-compliance-date')?.value;
  const ein    = document.getElementById('lp-compliance-ein')?.value?.trim();

  btn.innerHTML = `${lpSpinner()} Generating...`;
  btn.disabled  = true;

  try {
    const data = await apiPost('/api/launchpad/compliance/setup', {
      business_name:  launchpadData.businessName || 'My Business',
      entity_type:    launchpadData.entityType   || 'llc',
      state:          launchpadData.state        || 'DE',
      formation_date: date,
      ein:            ein || launchpadData.ein || null,
    });

    launchpadData.complianceSetup = true;
    if (ein) launchpadData.ein = ein;
    saveLaunchpadState();

    const calendarRows = (data.calendar || []).map(event => `
      <div style="
        background:var(--bg3);border:1px solid var(--brd);
        border-radius:8px;padding:14px;margin-bottom:10px;
        display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
      ">
        <div style="flex:1">
          <div style="color:var(--t1);font-weight:700;font-size:13px;margin-bottom:4px">${event.event}</div>
          <div style="color:var(--t2);font-size:12px;margin-bottom:4px">${event.description || ''}</div>
          <div style="color:var(--t3);font-size:11px">${event.cost_estimate || ''} · ${event.recurring || ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="
            background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);
            border-radius:6px;padding:5px 10px;
            color:var(--gold);font-size:12px;font-weight:700;
            white-space:nowrap;
          ">${event.due_date}</div>
        </div>
      </div>
    `).join('');

    const ghlNote = data.ghl_synced
      ? `<div style="color:var(--green);font-size:12px;margin-bottom:12px">✅ ${data.ghl_reminders?.length || 0} reminders synced to GHL CRM</div>`
      : '';

    res.innerHTML = `
      <div>
        <div style="color:var(--t1);font-weight:700;font-size:14px;margin-bottom:12px">
          ${data.total_events} Compliance Events
        </div>
        ${ghlNote}
        ${calendarRows}
        <div style="
          background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);
          border-radius:8px;padding:12px;
          color:var(--t2);font-size:11px;line-height:1.6;margin-top:12px;
        ">
          ⚠ ${data.note || 'Always consult a licensed attorney or CPA for compliance guidance specific to your business.'}
        </div>
      </div>
    `;

  } catch(e) {
    res.innerHTML = `<div style="color:var(--coral);font-size:13px;padding:12px;background:rgba(248,113,113,0.08);border-radius:8px">
      Error: ${e.message}
    </div>`;
  } finally {
    btn.innerHTML = 'Generate Compliance Calendar →';
    btn.disabled  = false;
  }
}

function lpFinishWizard() {
  lpCompleteStep(10);
  saveLaunchpadState();

  const el = document.getElementById('lp-step-content');
  if (!el) return;

  el.innerHTML = `
    <div style="
      text-align:center;padding:48px 24px;
      background:var(--bg2);border:1px solid var(--brd);border-radius:12px;
    ">
      <div style="
        width:64px;height:64px;border-radius:50%;
        background:var(--gold);color:#000;
        display:flex;align-items:center;justify-content:center;
        font-size:28px;font-weight:800;
        margin:0 auto 20px;
      ">✓</div>

      <h2 style="color:var(--t1);font-size:22px;font-weight:800;margin-bottom:8px">
        ${launchpadData.businessName || 'Your Business'} is Live.
      </h2>
      <p style="color:var(--t2);font-size:14px;margin-bottom:28px;max-width:480px;margin-left:auto;margin-right:auto;line-height:1.6">
        All 10 steps complete. You have a legally formed business with domain, DNS, SSL, and compliance calendar.
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:440px;margin:0 auto 28px;text-align:left">
        ${[
          ['Entity',     launchpadData.entityType  || '—'],
          ['State',      launchpadData.state       || '—'],
          ['Domain',     launchpadData.domain      || '—'],
          ['EIN',        launchpadData.ein         || 'Pending'],
          ['Formation',  launchpadData.formationOrderId || 'Pending'],
          ['Compliance', 'Calendar Generated'],
        ].map(([k, v]) => `
          <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:8px;padding:12px">
            <div style="color:var(--t3);font-size:10px;font-weight:700;margin-bottom:3px">${k.toUpperCase()}</div>
            <div style="color:var(--t1);font-size:13px;font-weight:600">${v}</div>
          </div>
        `).join('')}
      </div>

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button onclick="if(typeof navigate==='function')navigate('builder')" style="
          background:var(--gold);color:#000;border:none;
          padding:11px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
        ">Open Site Builder →</button>
        <button onclick="if(typeof navigate==='function')navigate('ghl')" style="
          background:var(--bg3);border:1px solid var(--brd);color:var(--t2);
          padding:11px 24px;border-radius:8px;font-size:14px;cursor:pointer;
        ">View CRM →</button>
        <button onclick="lpRestartWizard()" style="
          background:none;border:1px solid var(--brd);color:var(--t3);
          padding:11px 16px;border-radius:8px;font-size:13px;cursor:pointer;
        ">Start New Business</button>
      </div>
    </div>
  `;

  renderStepIndicator();
}

function lpRestartWizard() {
  launchpadData = {
    step: 1, completedSteps: [],
    businessName: '', state: '', entityType: '',
    domain: '', domainPrice: '',
    formationOrderId: '', ein: '',
    dnsConfigured: false, sslProvisioned: false,
    ghlConnected: false, complianceSetup: false,
    nameCheckResults: null, entityAdvisorResult: null, dnsRecords: [],
  };
  saveLaunchpadState();
  renderLaunchpad();
}

// ── API Helpers ───────────────────────────────────────────────────────────────
// These are defined in app.js but re-declared here for safety

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sal-key': SAL_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const e = await res.json(); msg = e.detail || e.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function showToast(message, type = 'info') {
  // Use global showToast if available, otherwise create one
  if (typeof window._showToast === 'function') {
    window._showToast(message, type);
    return;
  }
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;
    background:${type === 'error' ? 'var(--coral)' : type === 'success' ? 'var(--green)' : 'var(--gold)'};
    color:${type === 'success' ? '#000' : type === 'error' ? '#fff' : '#000'};
    padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;
    z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.3);
    animation:lp-fadein 0.15s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Auto-save on visibility change ────────────────────────────────────────────

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveLaunchpadState();
});
