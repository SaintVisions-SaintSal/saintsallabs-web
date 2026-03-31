/**
 * SaintSal™ Labs — Headquarters + Business DNA
 * Overrides the loadHeadquarters() stub in app.js with real dashboard data.
 * Also implements renderBusinessDNA() for the Settings page.
 * Saint Vision Technologies LLC | US Patent #10,290,222 (HACP™)
 *
 * Loaded after app.js. Overrides:
 *   loadHeadquarters()   — rich HQ page with real stats, usage, health
 *   renderBusinessDNA()  — Business DNA form injected into #page-settings
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const hqState = {
  dashboardData: null,
  businessDNA:   null,
  saveTimer:     null,
};

// ══════════════════════════════════════════════════════════════════════════════
// HEADQUARTERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Full Headquarters page load.
 * Replaces the stub in app.js. Called by navigate('headquarters') and onSignedIn().
 */
async function loadHeadquarters() {
  const userId = window.currentUser?.id || '';

  // Render skeleton first for instant feedback
  const statsGrid   = document.getElementById('hq-stats-grid');
  const ghlData     = document.getElementById('hq-ghl-data');
  const usageEl     = document.getElementById('hq-usage-section');
  const healthEl    = document.getElementById('hq-health-section');
  const projectsEl  = document.getElementById('hq-projects-section');

  if (statsGrid) statsGrid.innerHTML = _hqSkeletonStats();

  try {
    const data = await apiGet(`/api/dashboard/stats${userId ? `?user_id=${userId}` : ''}`);
    hqState.dashboardData = data;

    // Stats row
    if (statsGrid) _hqRenderStats(statsGrid, data);

    // GHL pipeline summary
    if (ghlData) _hqRenderGHL(ghlData, data);

    // Compute usage bar
    const usageTarget = usageEl || _hqFindOrCreate('hq-usage-section', '#page-headquarters');
    if (usageTarget) _hqRenderUsage(usageTarget, data.usage || {});

    // Platform health dots
    const healthTarget = healthEl || _hqFindOrCreate('hq-health-section', '#page-headquarters');
    if (healthTarget) _hqRenderHealth(healthTarget, data.health || {});

    // Recent builder projects
    const projTarget = projectsEl || _hqFindOrCreate('hq-projects-section', '#page-headquarters');
    if (projTarget && userId) _hqLoadProjects(projTarget, userId);

    // Quick actions with real counts
    _hqUpdateQuickActions(data);

  } catch (e) {
    console.warn('[HQ] Dashboard load failed:', e);
    // Fall back gracefully — still show the page structure
    if (statsGrid) statsGrid.innerHTML = _hqFallbackStats();
    if (ghlData)   ghlData.innerHTML   = '<p class="text-muted">CRM data unavailable — check GHL configuration.</p>';
  }
}

// ── Stats grid ────────────────────────────────────────────────────────────────

function _hqRenderStats(el, data) {
  const ghl   = data.ghl    || {};
  const usage = data.usage  || {};

  const pctUsed = usage.compute_minutes_limit
    ? Math.min(100, Math.round((usage.compute_minutes_used / usage.compute_minutes_limit) * 100))
    : 0;

  el.innerHTML = `
    <div class="stat-card" style="${_statStyle()}">
      <div class="stat-value" style="color:var(--blue);">${(ghl.total_contacts || 0).toLocaleString()}</div>
      <div class="stat-label">Total Contacts</div>
    </div>
    <div class="stat-card" style="${_statStyle()}">
      <div class="stat-value" style="color:var(--purple);">${ghl.pipelines_count || 0}</div>
      <div class="stat-label">Pipelines</div>
    </div>
    <div class="stat-card" style="${_statStyle()}">
      <div class="stat-value" style="color:var(--gold);">${(ghl.active_deals || 0).toLocaleString()}</div>
      <div class="stat-label">Active Deals</div>
    </div>
    <div class="stat-card" style="${_statStyle()}">
      <div class="stat-value" style="color:var(--teal);">${usage.builder_sessions || 0}</div>
      <div class="stat-label">Builder Sessions</div>
    </div>
    <div class="stat-card" style="${_statStyle()}">
      <div class="stat-value" style="color:${ghl.tasks_due_today > 0 ? 'var(--coral)' : 'var(--t2)'};">${ghl.tasks_due_today || 0}</div>
      <div class="stat-label">Tasks Due Today</div>
    </div>
    <div class="stat-card" style="${_statStyle('position:relative;overflow:hidden;')}">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div class="stat-value" style="color:var(--gold);">${pctUsed}%</div>
          <div class="stat-label">Compute Used</div>
        </div>
        <div style="font-size:11px;color:var(--t3);text-align:right;">
          ${(usage.compute_minutes_used || 0).toLocaleString()} /<br>
          ${(usage.compute_minutes_limit || 0).toLocaleString()} min
        </div>
      </div>
      <!-- Progress bar -->
      <div style="
        position:absolute;bottom:0;left:0;right:0;height:3px;
        background:var(--bg3);
      ">
        <div style="
          height:100%;width:${pctUsed}%;
          background:${pctUsed >= 90 ? 'var(--coral)' : pctUsed >= 70 ? 'var(--amber)' : 'var(--gold)'};
          transition:width 0.8s ease;
        "></div>
      </div>
    </div>
  `;
}

function _statStyle(extra = '') {
  return `
    background:var(--bg2);border:1px solid var(--brd);border-radius:12px;
    padding:16px;${extra}
  `;
}

function _hqSkeletonStats() {
  return Array(6).fill(0).map(() => `
    <div style="${_statStyle()}">
      <div style="height:28px;width:60%;background:var(--bg3);border-radius:6px;margin-bottom:8px;
        animation:pulse 1.5s ease infinite;"></div>
      <div style="height:12px;width:40%;background:var(--bg3);border-radius:4px;
        animation:pulse 1.5s ease infinite;"></div>
    </div>
  `).join('');
}

function _hqFallbackStats() {
  return `
    <div style="${_statStyle('grid-column:1/-1;text-align:center;color:var(--t3);font-size:13px;')}">
      Dashboard data unavailable — reload to retry.
    </div>
  `;
}

// ── GHL summary ───────────────────────────────────────────────────────────────

function _hqRenderGHL(el, data) {
  const leads     = data.recent_leads || [];
  const pipelines = data.pipelines    || [];

  if (!leads.length && !pipelines.length) {
    el.innerHTML = '<p style="color:var(--t2);font-size:13px;">No CRM data. Configure GHL_PRIVATE_TOKEN to connect.</p>';
    return;
  }

  el.innerHTML = `
    ${pipelines.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;
          color:var(--t3);margin-bottom:8px;">Pipeline Summary</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${pipelines.slice(0, 3).map(p => {
            const stages = p.stages || [];
            const deals  = p.total_deals || 0;
            const stageColors = ['var(--blue)','var(--purple)','var(--teal)','var(--gold)'];
            const total  = Math.max(1, stages.reduce((s, st) => s + (st.deal_count || 0), 0));

            return `
              <div style="
                background:var(--bg3);border:1px solid var(--brd);border-radius:8px;
                padding:10px 12px;
              ">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                  <span style="font-size:12px;font-weight:600;color:var(--t1);">${_hqEsc(p.name || 'Pipeline')}</span>
                  <span style="font-size:11px;color:var(--t2);">${deals} deals</span>
                </div>
                <div style="display:flex;height:4px;border-radius:2px;overflow:hidden;background:var(--bg2);gap:1px;">
                  ${stages.map((st, i) => {
                    const cnt = st.deal_count || 0;
                    const pct = ((cnt / total) * 100).toFixed(1);
                    return cnt > 0 ? `<div style="flex:${pct};background:${stageColors[i % stageColors.length]};min-width:3px;border-radius:2px;" title="${st.name}: ${cnt}"></div>` : '';
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    ${leads.length ? `
      <div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;
          color:var(--t3);margin-bottom:8px;">Recent Leads</div>
        ${leads.slice(0, 5).map(l => `
          <div style="
            display:flex;align-items:center;justify-content:space-between;
            padding:8px 0;border-bottom:1px solid var(--brd);
          ">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="
                width:28px;height:28px;border-radius:50%;
                background:var(--bg3);border:1px solid var(--brd);
                display:flex;align-items:center;justify-content:center;
                font-size:10px;font-weight:700;color:var(--gold);
              ">${_hqInitials(`${l.firstName || ''} ${l.lastName || ''}`)}</div>
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--t1);">
                  ${_hqEsc((l.firstName || '') + ' ' + (l.lastName || '')) || 'Unknown'}
                </div>
                <div style="font-size:11px;color:var(--t2);">${_hqEsc(l.email || '')}</div>
              </div>
            </div>
            <span style="
              padding:2px 7px;border-radius:20px;
              background:var(--blue)18;color:var(--blue);font-size:10px;font-weight:600;
            ">${_hqEsc((l.tags || [])[0] || 'Lead')}</span>
          </div>
        `).join('')}
        <button onclick="navigate('ghl')" style="
          margin-top:12px;width:100%;padding:8px;border-radius:8px;
          border:1px solid var(--brd);background:none;
          color:var(--gold);font-size:12px;cursor:pointer;
        ">View All in GHL Intel Hub →</button>
      </div>
    ` : ''}
  `;
}

// ── Compute usage bar ─────────────────────────────────────────────────────────

function _hqRenderUsage(el, usage) {
  const used  = usage.compute_minutes_used  || 0;
  const limit = usage.compute_minutes_limit || 2000;
  const tier  = usage.tier  || 'free';
  const pct   = Math.min(100, Math.round((used / limit) * 100));
  const isHigh = pct >= 80;

  const tierUpgrade = { free: 'starter', starter: 'pro', pro: 'teams', teams: 'enterprise' };
  const nextTier    = tierUpgrade[tier];
  const tierBadgeColor = { free: 'var(--t3)', starter: 'var(--blue)', pro: 'var(--gold)', teams: 'var(--purple)', enterprise: 'var(--teal)' };

  el.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;
        color:var(--t3);margin-bottom:10px;">Compute Usage — This Month</div>

      <div style="
        background:var(--bg2);border:1px solid var(--brd);border-radius:12px;padding:16px;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="
              padding:3px 10px;border-radius:20px;
              background:${tierBadgeColor[tier] || 'var(--t3)'}18;
              color:${tierBadgeColor[tier] || 'var(--t3)'};
              font-size:11px;font-weight:700;text-transform:uppercase;
            ">${tier}</span>
            <span style="font-size:12px;color:var(--t1);font-weight:600;">${used.toLocaleString()} / ${limit.toLocaleString()} min</span>
          </div>
          <span style="font-size:12px;color:${isHigh ? 'var(--coral)' : 'var(--t2)'};">${pct}% used</span>
        </div>

        <!-- Progress bar -->
        <div style="
          height:8px;border-radius:4px;background:var(--bg3);
          overflow:hidden;margin-bottom:10px;
        ">
          <div style="
            height:100%;border-radius:4px;
            width:${pct}%;
            background:${pct >= 90 ? 'var(--coral)' : pct >= 70 ? 'var(--amber)' : 'var(--gold)'};
            transition:width 1s ease;
          "></div>
        </div>

        ${isHigh ? `
          <div style="
            padding:8px 12px;border-radius:8px;
            background:var(--amber)18;border:1px solid var(--amber)40;
            color:var(--amber);font-size:11px;margin-bottom:10px;
          ">
            ⚠️ You've used ${pct}% of your compute. ${nextTier ? 'Upgrade to avoid hitting the limit.' : 'Contact support for enterprise options.'}
          </div>
        ` : ''}

        ${nextTier ? `
          <button onclick="navigate('settings')" style="
            width:100%;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;
            background:var(--gold);color:#000;font-size:12px;font-weight:700;
          ">Upgrade to ${nextTier.charAt(0).toUpperCase() + nextTier.slice(1)} →</button>
        ` : `
          <div style="text-align:center;font-size:11px;color:var(--teal);">Enterprise — Unlimited Compute</div>
        `}
      </div>
    </div>
  `;
}

// ── Platform health ───────────────────────────────────────────────────────────

async function _hqRenderHealth(el, health) {
  // Also ping /api/health for live status
  let liveHealth = health;
  try {
    const liveData = await apiGet('/api/health');
    if (liveData.services) liveHealth = { ...health, ...liveData.services };
  } catch (e) { /* use passed-in health */ }

  const services = Object.entries(liveHealth).map(([name, status]) => ({
    name:   name.charAt(0).toUpperCase() + name.slice(1),
    status: typeof status === 'string' ? status : (status ? 'operational' : 'unconfigured'),
  }));

  const dotColor = (s) => {
    if (s === 'operational' || s === 'configured') return 'var(--green)';
    if (s === 'unconfigured' || s === 'missing')   return 'var(--amber)';
    return 'var(--coral)';
  };

  el.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;
        color:var(--t3);margin-bottom:10px;">Platform Health</div>
      <div style="
        background:var(--bg2);border:1px solid var(--brd);border-radius:12px;
        padding:12px 16px;
        display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
        gap:8px;
      ">
        ${services.map(svc => `
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="
              width:8px;height:8px;border-radius:50%;flex-shrink:0;
              background:${dotColor(svc.status)};
              box-shadow:0 0 6px ${dotColor(svc.status)}60;
            "></div>
            <div>
              <div style="font-size:12px;color:var(--t1);">${_hqEsc(svc.name)}</div>
              <div style="font-size:10px;color:var(--t3);text-transform:capitalize;">${_hqEsc(svc.status)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── Builder projects ──────────────────────────────────────────────────────────

async function _hqLoadProjects(el, userId) {
  try {
    const { data } = await window.supabase
      .from('builder_sessions')
      .select('id,project_name,created_at,status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4);

    if (!data || !data.length) {
      el.innerHTML = `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;
            color:var(--t3);margin-bottom:10px;">Recent Builder Projects</div>
          <div style="
            padding:24px;text-align:center;
            background:var(--bg2);border:1px dashed var(--brd);border-radius:12px;
            color:var(--t3);font-size:13px;
          ">
            No projects yet.
            <button onclick="navigate('builder')" style="
              display:block;margin:10px auto 0;padding:6px 14px;
              border-radius:8px;border:none;background:var(--gold);
              color:#000;font-size:12px;font-weight:600;cursor:pointer;
            ">Start Building →</button>
          </div>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;
            color:var(--t3);">Recent Builder Projects</div>
          <button onclick="navigate('builder')" style="
            font-size:11px;color:var(--gold);background:none;border:none;cursor:pointer;
          ">New Build →</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">
          ${data.map(p => {
            const statusColor = { complete:'var(--green)', failed:'var(--coral)', active:'var(--blue)' };
            const sc = statusColor[p.status] || 'var(--t3)';
            return `
              <div style="
                background:var(--bg2);border:1px solid var(--brd);border-radius:10px;
                padding:12px;cursor:pointer;
                transition:border-color 0.15s;
              "
              onclick="navigate('builder')"
              onmouseover="this.style.borderColor='var(--gold)'"
              onmouseout="this.style.borderColor='var(--brd)'"
              >
                <div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:4px;
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${_hqEsc(p.project_name || 'Untitled Build')}
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <span style="
                    font-size:10px;font-weight:600;
                    padding:2px 7px;border-radius:20px;
                    background:${sc}18;color:${sc};text-transform:capitalize;
                  ">${_hqEsc(p.status || 'draft')}</span>
                  <span style="font-size:10px;color:var(--t3);">
                    ${p.created_at ? _hqRelDate(p.created_at) : ''}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = '';
  }
}

// ── Quick actions with real counts ────────────────────────────────────────────

function _hqUpdateQuickActions(data) {
  // Update quick action count badges if they exist in the HTML
  const ghl = data.ghl || {};
  _hqSetBadge('hq-qa-contacts-count', ghl.total_contacts);
  _hqSetBadge('hq-qa-deals-count', ghl.active_deals);
  _hqSetBadge('hq-qa-tasks-count', ghl.tasks_due_today);
}

function _hqSetBadge(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined) el.textContent = value?.toLocaleString?.() ?? value;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function _hqFindOrCreate(id, parentSelector) {
  let el = document.getElementById(id);
  if (el) return el;
  const parent = document.querySelector(parentSelector);
  if (!parent) return null;
  el = document.createElement('div');
  el.id = id;
  parent.appendChild(el);
  return el;
}

function _hqInitials(name) {
  return (name || '?').trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function _hqEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _hqRelDate(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ══════════════════════════════════════════════════════════════════════════════
// BUSINESS DNA — Settings Page
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Render the Business DNA section inside #page-settings.
 * Call this from settings.js or from the navigate('settings') handler.
 */
async function renderBusinessDNA() {
  const userId = window.currentUser?.id || '';
  if (!userId) return;

  // Find or create the section inside settings page
  let section = document.getElementById('biz-dna-section');
  if (!section) {
    const settingsPage = document.getElementById('page-settings');
    if (!settingsPage) return;
    section = document.createElement('div');
    section.id = 'biz-dna-section';
    settingsPage.appendChild(section);
  }

  section.innerHTML = _dnaFormSkeleton();

  try {
    const data = await apiGet(`/api/profile/${userId}/preferences`);
    const prefs = data.preferences || {};
    const dna   = (typeof prefs.business_dna === 'string')
      ? JSON.parse(prefs.business_dna)
      : (prefs.business_dna || {});
    hqState.businessDNA = dna;
    section.innerHTML = _dnaFormHTML(dna);
    _dnaBind(userId);
  } catch (e) {
    section.innerHTML = _dnaFormHTML({});
    _dnaBind(userId);
  }
}

function _dnaFormSkeleton() {
  return `
    <div style="padding:24px 0;">
      ${Array(4).fill(0).map(() => `
        <div style="height:48px;background:var(--bg3);border-radius:8px;margin-bottom:10px;
          animation:pulse 1.5s ease infinite;"></div>
      `).join('')}
    </div>
  `;
}

function _dnaFormHTML(dna) {
  const stages = ['pre-revenue', 'seed', 'series-a', 'established'];

  return `
    <div style="
      background:var(--bg2);border:1px solid var(--brd);border-radius:16px;
      padding:24px;margin-top:24px;
    ">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--t1);">Business DNA</h3>
          <p style="margin:4px 0 0;font-size:12px;color:var(--t2);">
            Your business profile — used by SAL to personalize every AI response.
          </p>
        </div>
        <span style="
          padding:3px 10px;border-radius:20px;
          background:var(--gold)18;color:var(--gold);
          font-size:10px;font-weight:700;
        ">AI CONTEXT</span>
      </div>

      <div id="dna-save-status" style="
        display:none;padding:8px 12px;border-radius:8px;
        background:var(--green)18;color:var(--green);
        font-size:12px;margin-bottom:16px;
      "></div>

      <!-- AI Generate button -->
      <div style="
        background:var(--bg3);border:1px solid var(--brd);border-radius:10px;
        padding:14px;margin-bottom:20px;
      ">
        <div style="font-size:12px;font-weight:600;color:var(--t1);margin-bottom:6px;">
          AI Auto-Fill
        </div>
        <p style="font-size:11px;color:var(--t2);margin:0 0 10px;">
          Describe your business in plain language and Claude will fill all fields automatically.
        </p>
        <div style="display:flex;gap:8px;">
          <input
            id="dna-pitch-input"
            type="text"
            placeholder="e.g. We're a B2B SaaS startup helping mortgage brokers automate lead follow-up..."
            value="${_hqEsc(dna.elevator_pitch || '')}"
            style="
              flex:1;padding:9px 12px;background:var(--bg2);
              border:1px solid var(--brd);border-radius:8px;
              color:var(--t1);font-size:12px;outline:none;
            "
          />
          <button onclick="_dnaGenerate()" id="dna-gen-btn" style="
            padding:9px 16px;border-radius:8px;border:none;cursor:pointer;
            background:var(--gold);color:#000;font-size:12px;font-weight:700;
            white-space:nowrap;
          ">Generate ✨</button>
        </div>
      </div>

      <!-- Form fields -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${_dnaField('dna-company_name',    'Company Name',      dna.company_name    || '')}
        ${_dnaField('dna-industry',         'Industry',          dna.industry         || '')}
        ${_dnaSelect('dna-stage',           'Business Stage',    dna.stage            || '', stages)}
        ${_dnaField('dna-revenue_range',    'Revenue Range',     dna.revenue_range    || '', 'e.g. $100K–$500K/yr')}
        ${_dnaField('dna-employee_count',   'Employee Count',    dna.employee_count   || '', 'e.g. 1–10, 11–50')}
        ${_dnaField('dna-geographic_focus', 'Geographic Focus',  dna.geographic_focus || '', 'e.g. US, Global, Northeast')}
        ${_dnaField('dna-funding_status',   'Funding Status',    dna.funding_status   || '', 'Bootstrapped, Angel, Seed, etc.')}
        ${_dnaField('dna-target_market',    'Target Market',     dna.target_market    || '', 'Who do you sell to?')}
      </div>

      <!-- Full-width fields -->
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px;">
        ${_dnaTextarea('dna-elevator_pitch',        'Elevator Pitch',       dna.elevator_pitch         || '', 'What do you do in 2 sentences?')}
        ${_dnaField('dna-key_competitors',           'Key Competitors',      Array.isArray(dna.key_competitors) ? dna.key_competitors.join(', ') : (dna.key_competitors || ''), 'Comma-separated')}
        ${_dnaField('dna-core_differentiators',      'Core Differentiators', Array.isArray(dna.core_differentiators) ? dna.core_differentiators.join(', ') : (dna.core_differentiators || ''), 'Comma-separated')}
      </div>

      <!-- Save button -->
      <div style="display:flex;justify-content:flex-end;margin-top:20px;gap:10px;">
        <button onclick="_dnaClear()" style="
          padding:10px 20px;border-radius:10px;border:1px solid var(--brd);
          background:none;color:var(--t2);font-size:13px;cursor:pointer;
        ">Clear</button>
        <button onclick="_dnaSave()" style="
          padding:10px 24px;border-radius:10px;border:none;cursor:pointer;
          background:var(--gold);color:#000;font-size:13px;font-weight:700;
        ">Save Business DNA</button>
      </div>
    </div>
  `;
}

function _dnaField(id, label, value, placeholder = '') {
  return `
    <div>
      <label style="display:block;font-size:11px;font-weight:600;color:var(--t2);
        text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${_hqEsc(label)}</label>
      <input
        id="${id}"
        type="text"
        value="${_hqEsc(value)}"
        placeholder="${_hqEsc(placeholder)}"
        style="
          width:100%;padding:9px 12px;background:var(--bg3);
          border:1px solid var(--brd);border-radius:8px;
          color:var(--t1);font-size:12px;outline:none;box-sizing:border-box;
        "
        oninput="_dnaAutoSave()"
      />
    </div>
  `;
}

function _dnaSelect(id, label, value, options) {
  return `
    <div>
      <label style="display:block;font-size:11px;font-weight:600;color:var(--t2);
        text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${_hqEsc(label)}</label>
      <select
        id="${id}"
        style="
          width:100%;padding:9px 12px;background:var(--bg3);
          border:1px solid var(--brd);border-radius:8px;
          color:var(--t1);font-size:12px;outline:none;box-sizing:border-box;
          appearance:none;cursor:pointer;
        "
        onchange="_dnaAutoSave()"
      >
        <option value="">Select stage...</option>
        ${options.map(o => `
          <option value="${o}" ${o === value ? 'selected' : ''}>${o.charAt(0).toUpperCase() + o.slice(1).replace(/-/g, ' ')}</option>
        `).join('')}
      </select>
    </div>
  `;
}

function _dnaTextarea(id, label, value, placeholder = '') {
  return `
    <div>
      <label style="display:block;font-size:11px;font-weight:600;color:var(--t2);
        text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${_hqEsc(label)}</label>
      <textarea
        id="${id}"
        rows="3"
        placeholder="${_hqEsc(placeholder)}"
        style="
          width:100%;padding:9px 12px;background:var(--bg3);
          border:1px solid var(--brd);border-radius:8px;
          color:var(--t1);font-size:12px;outline:none;box-sizing:border-box;
          resize:vertical;font-family:var(--font);
        "
        oninput="_dnaAutoSave()"
      >${_hqEsc(value)}</textarea>
    </div>
  `;
}

function _dnaBind(userId) {
  hqState._dnaUserId = userId;
}

function _dnaAutoSave() {
  clearTimeout(hqState.saveTimer);
  hqState.saveTimer = setTimeout(() => _dnaSave(true), 2000);
}

function _dnaGetValues() {
  const v = (id) => document.getElementById(id)?.value?.trim() || '';
  const arr = (id) => v(id).split(',').map(s => s.trim()).filter(Boolean);

  return {
    company_name:         v('dna-company_name'),
    industry:             v('dna-industry'),
    stage:                v('dna-stage'),
    revenue_range:        v('dna-revenue_range'),
    employee_count:       v('dna-employee_count'),
    target_market:        v('dna-target_market'),
    elevator_pitch:       v('dna-elevator_pitch'),
    key_competitors:      arr('dna-key_competitors'),
    core_differentiators: arr('dna-core_differentiators'),
    funding_status:       v('dna-funding_status'),
    geographic_focus:     v('dna-geographic_focus'),
  };
}

async function _dnaSave(silent = false) {
  const userId = hqState._dnaUserId || window.currentUser?.id;
  if (!userId) return;

  const dna = _dnaGetValues();
  try {
    await apiPost(`/api/profile/${userId}/preferences`, { business_dna: dna });
    hqState.businessDNA = dna;
    if (!silent) {
      const status = document.getElementById('dna-save-status');
      if (status) {
        status.textContent = '✓ Business DNA saved';
        status.style.display = 'block';
        setTimeout(() => { status.style.display = 'none'; }, 3000);
      }
    }
  } catch (e) {
    if (!silent) {
      const status = document.getElementById('dna-save-status');
      if (status) {
        status.style.background = 'var(--coral)18';
        status.style.color      = 'var(--coral)';
        status.textContent      = '✗ Save failed — check connection';
        status.style.display    = 'block';
      }
    }
  }
}

async function _dnaGenerate() {
  const userId = hqState._dnaUserId || window.currentUser?.id;
  if (!userId) return;

  const pitch = document.getElementById('dna-pitch-input')?.value?.trim();
  if (!pitch) {
    alert('Please enter a business description first.');
    return;
  }

  const btn = document.getElementById('dna-gen-btn');
  if (btn) { btn.textContent = 'Generating...'; btn.disabled = true; }

  try {
    const data = await apiPost(`/api/profile/${userId}/preferences/generate-dna`, {
      user_id:        userId,
      elevator_pitch: pitch,
    });

    const dna = data.business_dna || {};

    // Fill all form fields
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'SELECT') el.value = val || '';
      else el.value = Array.isArray(val) ? val.join(', ') : (val || '');
    };

    setVal('dna-company_name',    dna.company_name);
    setVal('dna-industry',        dna.industry);
    setVal('dna-stage',           dna.stage);
    setVal('dna-revenue_range',   dna.revenue_range);
    setVal('dna-employee_count',  dna.employee_count);
    setVal('dna-geographic_focus',dna.geographic_focus);
    setVal('dna-funding_status',  dna.funding_status);
    setVal('dna-target_market',   dna.target_market);
    setVal('dna-elevator_pitch',  dna.elevator_pitch);
    setVal('dna-key_competitors', dna.key_competitors);
    setVal('dna-core_differentiators', dna.core_differentiators);

    // Auto-save
    await _dnaSave();

    const status = document.getElementById('dna-save-status');
    if (status) {
      status.textContent  = '✓ Business DNA generated and saved by Claude';
      status.style.display = 'block';
      setTimeout(() => { status.style.display = 'none'; }, 4000);
    }
  } catch (e) {
    alert('Generation failed: ' + (e.message || 'Unknown error'));
  } finally {
    if (btn) { btn.textContent = 'Generate ✨'; btn.disabled = false; }
  }
}

function _dnaClear() {
  const fields = [
    'dna-company_name','dna-industry','dna-stage','dna-revenue_range',
    'dna-employee_count','dna-geographic_focus','dna-funding_status',
    'dna-target_market','dna-elevator_pitch','dna-key_competitors',
    'dna-core_differentiators','dna-pitch-input',
  ];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ── CSS injection ─────────────────────────────────────────────────────────────

(function _injectHQStyles() {
  if (document.getElementById('hq-styles')) return;
  const style = document.createElement('style');
  style.id = 'hq-styles';
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }
    #hq-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
  `;
  document.head.appendChild(style);
})();
