/**
 * SaintSal™ Labs — GHL Intel Hub
 * CRM & Pipeline Intelligence: Contacts, Pipelines, Activity
 * Saint Vision Technologies LLC | US Patent #10,290,222 (HACP™)
 *
 * Exports (called by app.js):
 *   loadGHL()          — initial page load, defaults to Dashboard tab
 *   switchGHLTab(tab)  — switch between 'dashboard', 'contacts', 'pipelines'
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const ghlState = {
  activeTab:      'dashboard',
  contacts:       [],
  contactOffset:  0,
  contactTotal:   0,
  pipelines:      [],
  stats:          null,
  recentLeads:    [],
  activity:       [],
  searchTimer:    null,
  drawerContact:  null,
  addContactOpen: false,
};

// ── Entry points ──────────────────────────────────────────────────────────────

async function loadGHL() {
  const page = document.getElementById('page-ghl');
  if (!page) return;

  page.innerHTML = _ghlShell();
  ghlState.activeTab = 'dashboard';
  await _ghlLoadDashboard();
}

function switchGHLTab(tab) {
  ghlState.activeTab = tab;

  // Update tab UI
  document.querySelectorAll('.ghl-tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.style.background = active ? 'var(--gold)' : 'var(--bg3)';
    btn.style.color      = active ? '#000'        : 'var(--t2)';
    btn.style.fontWeight = active ? '600'          : '400';
  });

  const content = document.getElementById('ghl-tab-content');
  if (!content) return;

  content.innerHTML = _ghlLoading('Loading...');

  switch (tab) {
    case 'dashboard':  _ghlLoadDashboard(); break;
    case 'contacts':   _ghlLoadContacts();  break;
    case 'pipelines':  _ghlLoadPipelines(); break;
  }
}

// ── Shell HTML ────────────────────────────────────────────────────────────────

function _ghlShell() {
  return `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
      <!-- Topbar -->
      <div style="
        padding:16px 24px 0;
        background:var(--bg);
        border-bottom:1px solid var(--brd);
        flex-shrink:0;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div>
            <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--t1);">GHL Intel Hub</h2>
            <p style="margin:0;font-size:12px;color:var(--t2);">CRM &amp; Pipeline Intelligence</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div id="ghl-status-dot" style="width:8px;height:8px;border-radius:50%;background:var(--t3);"></div>
            <span id="ghl-status-text" style="font-size:11px;color:var(--t2);">Connecting...</span>
            <button
              onclick="_ghlOpenAddContact()"
              style="
                padding:6px 14px;border-radius:8px;border:none;cursor:pointer;
                background:var(--gold);color:#000;font-size:12px;font-weight:600;
              ">
              + Add Contact
            </button>
          </div>
        </div>

        <!-- Tab bar -->
        <div style="display:flex;gap:4px;padding-bottom:0;">
          ${['dashboard','contacts','pipelines'].map((t, i) => {
            const labels = { dashboard: '📊 Dashboard', contacts: '👥 Contacts', pipelines: '🔄 Pipelines' };
            const active = t === 'dashboard';
            return `
              <button
                class="ghl-tab-btn"
                data-tab="${t}"
                onclick="switchGHLTab('${t}')"
                style="
                  padding:8px 16px;border-radius:8px 8px 0 0;border:none;cursor:pointer;
                  font-size:12px;font-weight:${active ? '600' : '400'};
                  background:${active ? 'var(--gold)' : 'var(--bg3)'};
                  color:${active ? '#000' : 'var(--t2)'};
                  transition:all 0.15s;
                "
              >${labels[t]}</button>`;
          }).join('')}
        </div>
      </div>

      <!-- Content -->
      <div id="ghl-tab-content" style="
        flex:1;overflow-y:auto;padding:20px 24px 100px;
      ">
        ${_ghlLoading('Loading GHL data...')}
      </div>
    </div>

    <!-- Contact drawer overlay -->
    <div id="ghl-drawer-overlay" onclick="_ghlCloseDrawer()" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:900;
    "></div>
    <div id="ghl-contact-drawer" style="
      display:none;position:fixed;top:0;right:0;width:380px;height:100vh;
      background:var(--bg2);border-left:1px solid var(--brd);z-index:901;
      overflow-y:auto;padding:24px;transition:transform 0.25s;
      transform:translateX(100%);
    "></div>

    <!-- Add contact modal -->
    <div id="ghl-modal-overlay" onclick="_ghlCloseModal()" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:950;
      align-items:center;justify-content:center;
    "></div>
    <div id="ghl-add-contact-modal" style="
      display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      width:420px;max-width:90vw;background:var(--bg2);border:1px solid var(--brd);
      border-radius:16px;padding:28px;z-index:951;
    "></div>
  `;
}

function _ghlLoading(msg) {
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:40px;color:var(--t2);font-size:13px;">
      <div style="width:16px;height:16px;border:2px solid var(--gold);border-top-color:transparent;
        border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      ${msg}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

async function _ghlLoadDashboard() {
  const content = document.getElementById('ghl-tab-content');
  if (!content) return;

  try {
    const data = await apiGet('/api/ghl/stats');
    ghlState.stats      = data.stats;
    ghlState.recentLeads = data.recent_leads || [];
    ghlState.pipelines   = data.pipelines || [];

    _setGHLStatus(true);
    content.innerHTML = _ghlDashboardHTML(data);

    // Wire up lead expand
    document.querySelectorAll('.ghl-lead-row').forEach(row => {
      row.addEventListener('click', () => {
        const contactId = row.dataset.contactId;
        const contact = ghlState.recentLeads.find(c => c.id === contactId);
        if (contact) _ghlOpenDrawer(contact);
      });
    });

    // Load activity async
    _ghlLoadActivity();
  } catch (e) {
    _setGHLStatus(false);
    content.innerHTML = _ghlError('Failed to load GHL stats. Check GHL_PRIVATE_TOKEN is configured.');
  }
}

function _ghlDashboardHTML(data) {
  const s = data.stats || {};
  const pipelines = data.pipelines || [];
  const leads = data.recent_leads || [];

  return `
    <!-- Stats row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      ${_ghlStatCard('👥', s.total_contacts?.toLocaleString() || '0', 'Total Contacts', 'var(--blue)')}
      ${_ghlStatCard('🔄', s.pipelines_count || '0', 'Active Pipelines', 'var(--purple)')}
      ${_ghlStatCard('✅', s.tasks_due_today || '0', 'Tasks Due Today', s.tasks_due_today > 0 ? 'var(--coral)' : 'var(--t3)')}
      ${_ghlStatCard('💰', _formatCurrency(s.revenue_mtd || 0), 'Revenue MTD', 'var(--gold)')}
    </div>

    <!-- Two-column layout: leads + pipelines | activity -->
    <div style="display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start;">

      <!-- Left column: pipelines + leads -->
      <div>
        ${pipelines.length ? `
          <div style="margin-bottom:24px;">
            <h3 style="font-size:13px;font-weight:600;color:var(--t1);margin:0 0 12px;
              text-transform:uppercase;letter-spacing:0.06em;">Pipelines</h3>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${pipelines.map(p => _ghlPipelineCard(p)).join('')}
            </div>
          </div>
        ` : ''}

        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h3 style="font-size:13px;font-weight:600;color:var(--t1);margin:0;
              text-transform:uppercase;letter-spacing:0.06em;">Recent Leads</h3>
            <button onclick="switchGHLTab('contacts')" style="
              font-size:11px;color:var(--gold);background:none;border:none;cursor:pointer;
            ">View All →</button>
          </div>
          ${leads.length === 0 ? `
            <div style="padding:24px;text-align:center;color:var(--t3);font-size:13px;
              background:var(--bg2);border-radius:12px;border:1px solid var(--brd);">
              No recent contacts found.
            </div>
          ` : `
            <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:12px;overflow:hidden;">
              ${leads.map(l => _ghlLeadRow(l)).join('')}
            </div>
          `}
        </div>
      </div>

      <!-- Right column: activity feed -->
      <div>
        <h3 style="font-size:13px;font-weight:600;color:var(--t1);margin:0 0 12px;
          text-transform:uppercase;letter-spacing:0.06em;">Activity Feed</h3>
        <div id="ghl-activity-feed" style="
          background:var(--bg2);border:1px solid var(--brd);border-radius:12px;
          padding:16px;min-height:200px;
        ">
          ${_ghlLoading('Loading activity...')}
        </div>
      </div>
    </div>
  `;
}

function _ghlStatCard(icon, value, label, accentColor) {
  return `
    <div style="
      background:var(--bg2);border:1px solid var(--brd);border-radius:12px;
      padding:16px;display:flex;align-items:center;gap:12px;
    ">
      <div style="
        width:40px;height:40px;border-radius:10px;
        background:${accentColor}18;
        display:flex;align-items:center;justify-content:center;
        font-size:18px;flex-shrink:0;
      ">${icon}</div>
      <div>
        <div style="font-size:22px;font-weight:700;color:var(--t1);line-height:1;">${value}</div>
        <div style="font-size:11px;color:var(--t2);margin-top:2px;">${label}</div>
      </div>
    </div>
  `;
}

function _ghlPipelineCard(p) {
  const stages = p.stages || [];
  const totalDeals = p.total_deals || 0;

  // Stage bar: CSS-only proportional widths
  const stageColors = ['var(--blue)', 'var(--purple)', 'var(--teal)', 'var(--gold)', 'var(--green)', 'var(--coral)'];
  const totalCount  = stages.reduce((s, st) => s + (st.deal_count || st.opportunityCount || 0), 0) || 1;

  return `
    <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:12px;padding:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-weight:600;font-size:13px;color:var(--t1);">${p.name || 'Pipeline'}</div>
        <span style="font-size:11px;color:var(--t2);">${totalDeals} deals</span>
      </div>

      <!-- Mini bar chart: CSS proportional segments -->
      <div style="
        display:flex;height:6px;border-radius:3px;overflow:hidden;
        background:var(--bg3);gap:1px;margin-bottom:10px;
      ">
        ${stages.map((st, i) => {
          const count = st.deal_count || st.opportunityCount || 0;
          const pct = ((count / totalCount) * 100).toFixed(1);
          return count > 0 ? `
            <div style="
              flex:${pct};background:${stageColors[i % stageColors.length]};
              min-width:4px;border-radius:3px;
            " title="${st.name}: ${count} deals"></div>
          ` : '';
        }).join('')}
      </div>

      <!-- Stage breakdown -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${stages.map((st, i) => {
          const count = st.deal_count || st.opportunityCount || 0;
          return `
            <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--t2);">
              <div style="width:6px;height:6px;border-radius:50%;background:${stageColors[i % stageColors.length]};"></div>
              ${st.name} (${count})
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function _ghlLeadRow(lead) {
  const name  = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown';
  const tag   = (lead.tags || [])[0] || '';
  const src   = lead.source || '';
  const date  = lead.dateAdded ? _relDate(lead.dateAdded) : '';

  return `
    <div
      class="ghl-lead-row"
      data-contact-id="${lead.id}"
      style="
        display:flex;align-items:center;justify-content:space-between;
        padding:12px 16px;cursor:pointer;transition:background 0.1s;
        border-bottom:1px solid var(--brd);
      "
      onmouseover="this.style.background='var(--bg3)'"
      onmouseout="this.style.background=''"
    >
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <div style="
          width:34px;height:34px;border-radius:50%;
          background:var(--bg3);border:1px solid var(--brd);
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:600;color:var(--gold);flex-shrink:0;
        ">${_initials(name)}</div>
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--t1);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(name)}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:1px;">
            ${_esc(lead.email || '')}${src ? ` · ${_esc(src)}` : ''}
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:8px;">
        ${tag ? `<span style="
          padding:2px 8px;border-radius:20px;
          background:var(--blue)20;color:var(--blue);
          font-size:10px;font-weight:600;
        ">${_esc(tag)}</span>` : ''}
        <span style="font-size:10px;color:var(--t3);">${date}</span>
        <span style="font-size:14px;color:var(--t3);">›</span>
      </div>
    </div>
  `;
}

async function _ghlLoadActivity() {
  const feed = document.getElementById('ghl-activity-feed');
  if (!feed) return;
  try {
    const data = await apiGet('/api/ghl/activity?limit=15');
    const activity = data.activity || [];
    if (!activity.length) {
      feed.innerHTML = `<p style="color:var(--t3);font-size:12px;text-align:center;padding:20px;">No recent activity.</p>`;
      return;
    }
    feed.innerHTML = activity.map(a => `
      <div style="
        display:flex;gap:10px;padding:8px 0;
        border-bottom:1px solid var(--brd);
      ">
        <div style="
          width:28px;height:28px;border-radius:50%;
          background:var(--blue)20;color:var(--blue);
          display:flex;align-items:center;justify-content:center;
          font-size:12px;flex-shrink:0;
        ">+</div>
        <div style="min-width:0;">
          <div style="font-size:12px;font-weight:600;color:var(--t1);">${_esc(a.name || 'Contact')}</div>
          <div style="font-size:11px;color:var(--t2);">
            Contact added${a.source ? ` via ${_esc(a.source)}` : ''}
          </div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px;">${a.timestamp ? _relDate(a.timestamp) : ''}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    feed.innerHTML = `<p style="color:var(--t3);font-size:12px;padding:16px;">Activity unavailable.</p>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: CONTACTS
// ══════════════════════════════════════════════════════════════════════════════

async function _ghlLoadContacts(append = false) {
  const content = document.getElementById('ghl-tab-content');
  if (!content) return;

  if (!append) {
    ghlState.contactOffset = 0;
    content.innerHTML = `
      <!-- Search + filter bar -->
      <div style="display:flex;gap:10px;margin-bottom:20px;align-items:center;">
        <div style="flex:1;position:relative;">
          <span style="
            position:absolute;left:12px;top:50%;transform:translateY(-50%);
            color:var(--t3);font-size:14px;pointer-events:none;
          ">🔍</span>
          <input
            id="ghl-contact-search"
            type="text"
            placeholder="Search by name, email, or phone..."
            oninput="_ghlSearchDebounce(this.value)"
            style="
              width:100%;padding:10px 12px 10px 36px;
              background:var(--bg2);border:1px solid var(--brd);border-radius:10px;
              color:var(--t1);font-size:13px;outline:none;box-sizing:border-box;
            "
          />
        </div>
        <button onclick="_ghlOpenAddContact()" style="
          padding:10px 16px;border-radius:10px;border:none;cursor:pointer;
          background:var(--gold);color:#000;font-size:12px;font-weight:600;
          white-space:nowrap;
        ">+ Add Contact</button>
      </div>
      <div id="ghl-contacts-list">
        ${_ghlLoading('Loading contacts...')}
      </div>
    `;
    _ghlFetchContacts();
  } else {
    _ghlFetchContacts(true);
  }
}

async function _ghlFetchContacts(append = false) {
  const list = document.getElementById('ghl-contacts-list');
  if (!list) return;

  const query = document.getElementById('ghl-contact-search')?.value?.trim() || '';

  try {
    let data;
    if (query) {
      data = await apiPost('/api/ghl/contacts/search', {
        query,
        limit: 20,
        offset: ghlState.contactOffset,
      });
    } else {
      data = await apiGet(`/api/ghl/contacts?limit=20&offset=${ghlState.contactOffset}`);
    }

    const contacts  = data.contacts || [];
    const meta      = data.meta || {};
    ghlState.contactTotal = meta.total || contacts.length;

    if (!append) {
      ghlState.contacts = contacts;
    } else {
      ghlState.contacts = [...ghlState.contacts, ...contacts];
    }

    _renderContactsList(meta);
  } catch (e) {
    list.innerHTML = _ghlError('Failed to load contacts.');
  }
}

function _ghlSearchDebounce(query) {
  clearTimeout(ghlState.searchTimer);
  ghlState.searchTimer = setTimeout(async () => {
    ghlState.contactOffset = 0;
    await _ghlFetchContacts(false);
  }, 300);
}

function _renderContactsList(meta) {
  const list = document.getElementById('ghl-contacts-list');
  if (!list) return;
  const contacts = ghlState.contacts;

  if (!contacts.length) {
    list.innerHTML = `
      <div style="
        padding:40px;text-align:center;color:var(--t3);font-size:13px;
        background:var(--bg2);border:1px solid var(--brd);border-radius:12px;
      ">No contacts found.</div>
    `;
    return;
  }

  const total    = meta.total || ghlState.contactTotal || contacts.length;
  const hasMore  = contacts.length < total;

  list.innerHTML = `
    <div style="
      display:flex;align-items:center;justify-content:space-between;
      margin-bottom:12px;
    ">
      <span style="font-size:12px;color:var(--t2);">
        Showing ${contacts.length} of ${total.toLocaleString()} contacts
      </span>
    </div>

    <div style="
      display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
      gap:10px;margin-bottom:20px;
    ">
      ${contacts.map(c => _ghlContactCard(c)).join('')}
    </div>

    ${hasMore ? `
      <div style="text-align:center;">
        <button
          onclick="_ghlLoadMore()"
          style="
            padding:10px 24px;border-radius:10px;border:1px solid var(--brd);
            background:var(--bg2);color:var(--t1);font-size:13px;cursor:pointer;
          "
        >Load More</button>
      </div>
    ` : ''}
  `;

  // Wire click events
  document.querySelectorAll('.ghl-contact-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.contactId;
      const contact = ghlState.contacts.find(c => c.id === id);
      if (contact) _ghlOpenDrawer(contact);
    });
  });
}

function _ghlContactCard(c) {
  const name  = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown';
  const tags  = c.tags || [];
  const stage = c.opportunityStage || '';
  const src   = c.source || '';
  const date  = c.dateAdded ? _relDate(c.dateAdded) : '';

  return `
    <div
      class="ghl-contact-card"
      data-contact-id="${c.id}"
      style="
        background:var(--bg2);border:1px solid var(--brd);border-radius:12px;
        padding:16px;cursor:pointer;transition:border-color 0.15s,transform 0.1s;
      "
      onmouseover="this.style.borderColor='var(--gold)';this.style.transform='translateY(-1px)'"
      onmouseout="this.style.borderColor='var(--brd)';this.style.transform=''"
    >
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="
          width:40px;height:40px;border-radius:50%;
          background:var(--bg3);border:1px solid var(--brd);
          display:flex;align-items:center;justify-content:center;
          font-size:14px;font-weight:700;color:var(--gold);flex-shrink:0;
        ">${_initials(name)}</div>
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--t1);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(name)}</div>
          ${c.email ? `<div style="font-size:11px;color:var(--t2);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(c.email)}</div>` : ''}
          ${c.phone ? `<div style="font-size:11px;color:var(--t3);">${_esc(c.phone)}</div>` : ''}
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
        ${tags.slice(0, 3).map(t => `
          <span style="
            padding:2px 7px;border-radius:20px;
            background:var(--blue)18;color:var(--blue);font-size:10px;font-weight:600;
          ">${_esc(t)}</span>
        `).join('')}
        ${stage ? `
          <span style="
            padding:2px 7px;border-radius:20px;
            background:var(--purple)18;color:var(--purple);font-size:10px;font-weight:600;
          ">${_esc(stage)}</span>
        ` : ''}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:var(--t3);">${src ? _esc(src) : ''}</span>
        <span style="font-size:10px;color:var(--t3);">${date}</span>
      </div>
    </div>
  `;
}

function _ghlLoadMore() {
  ghlState.contactOffset += 20;
  _ghlFetchContacts(true);
}

// ── Contact detail drawer ─────────────────────────────────────────────────────

function _ghlOpenDrawer(contact) {
  ghlState.drawerContact = contact;
  const overlay = document.getElementById('ghl-drawer-overlay');
  const drawer  = document.getElementById('ghl-contact-drawer');
  if (!overlay || !drawer) return;

  const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown';
  const tags = contact.tags || [];

  drawer.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--t1);">Contact Detail</h3>
      <button onclick="_ghlCloseDrawer()" style="
        background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;
        width:32px;height:32px;display:flex;align-items:center;justify-content:center;
        border-radius:8px;
      ">✕</button>
    </div>

    <!-- Avatar + name -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="
        width:64px;height:64px;border-radius:50%;
        background:var(--bg3);border:2px solid var(--gold);
        display:flex;align-items:center;justify-content:center;
        font-size:22px;font-weight:700;color:var(--gold);margin:0 auto 10px;
      ">${_initials(name)}</div>
      <div style="font-size:16px;font-weight:700;color:var(--t1);">${_esc(name)}</div>
      ${contact.email ? `<div style="font-size:12px;color:var(--t2);margin-top:2px;">${_esc(contact.email)}</div>` : ''}
      ${contact.phone ? `<div style="font-size:12px;color:var(--t3);">${_esc(contact.phone)}</div>` : ''}
    </div>

    <!-- Tags -->
    ${tags.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;
          letter-spacing:0.06em;color:var(--t3);margin-bottom:6px;">Tags</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${tags.map(t => `
            <span style="
              padding:3px 9px;border-radius:20px;
              background:var(--blue)18;color:var(--blue);font-size:11px;font-weight:600;
            ">${_esc(t)}</span>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Contact info -->
    <div style="
      background:var(--bg3);border:1px solid var(--brd);border-radius:10px;
      padding:14px;margin-bottom:16px;
    ">
      ${_drawerRow('Source', contact.source || '—')}
      ${_drawerRow('Date Added', contact.dateAdded ? new Date(contact.dateAdded).toLocaleDateString() : '—')}
      ${_drawerRow('Location', [contact.city, contact.state, contact.country].filter(Boolean).join(', ') || '—')}
      ${contact.opportunityStage ? _drawerRow('Pipeline Stage', contact.opportunityStage) : ''}
    </div>

    <!-- Quick actions -->
    <div style="font-size:10px;font-weight:600;text-transform:uppercase;
      letter-spacing:0.06em;color:var(--t3);margin-bottom:8px;">Quick Actions</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;">
      <button onclick="_ghlQuickTask('${contact.id}')" style="
        padding:10px 14px;border-radius:8px;border:1px solid var(--brd);
        background:var(--bg3);color:var(--t1);font-size:12px;cursor:pointer;
        text-align:left;display:flex;align-items:center;gap:8px;
      ">✅ Create Follow-up Task</button>
      ${contact.email ? `
        <a href="mailto:${contact.email}" style="
          padding:10px 14px;border-radius:8px;border:1px solid var(--brd);
          background:var(--bg3);color:var(--t1);font-size:12px;cursor:pointer;
          text-align:left;display:flex;align-items:center;gap:8px;
          text-decoration:none;
        ">✉️ Send Email</a>
      ` : ''}
      <button onclick="_ghlAddNote('${contact.id}')" style="
        padding:10px 14px;border-radius:8px;border:1px solid var(--brd);
        background:var(--bg3);color:var(--t1);font-size:12px;cursor:pointer;
        text-align:left;display:flex;align-items:center;gap:8px;
      ">📝 Add Note</button>
    </div>
  `;

  overlay.style.display = 'block';
  drawer.style.display  = 'block';
  requestAnimationFrame(() => { drawer.style.transform = 'translateX(0)'; });
}

function _ghlCloseDrawer() {
  const overlay = document.getElementById('ghl-drawer-overlay');
  const drawer  = document.getElementById('ghl-contact-drawer');
  if (!drawer) return;
  drawer.style.transform = 'translateX(100%)';
  setTimeout(() => {
    if (overlay) overlay.style.display = 'none';
    if (drawer) drawer.style.display = 'none';
  }, 250);
}

function _drawerRow(label, value) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:4px 0;border-bottom:1px solid var(--brd);">
      <span style="font-size:11px;color:var(--t3);">${label}</span>
      <span style="font-size:12px;color:var(--t1);">${_esc(String(value))}</span>
    </div>
  `;
}

async function _ghlQuickTask(contactId) {
  const title = prompt('Task title:');
  if (!title) return;
  try {
    await apiPost('/api/ghl/tasks', { title, contact_id: contactId });
    _showToast('Task created');
  } catch (e) {
    _showToast('Failed to create task', true);
  }
}

function _ghlAddNote(contactId) {
  _showToast('Note feature coming soon — use GHL directly.');
}

// ── Add contact modal ─────────────────────────────────────────────────────────

function _ghlOpenAddContact() {
  const overlay = document.getElementById('ghl-modal-overlay');
  const modal   = document.getElementById('ghl-add-contact-modal');
  if (!overlay || !modal) return;

  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--t1);">Add Contact</h3>
      <button onclick="_ghlCloseModal()" style="
        background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;
      ">✕</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;">
      ${_ghlInput('ghl-new-firstName', 'First Name', 'text', true)}
      ${_ghlInput('ghl-new-lastName', 'Last Name', 'text')}
      ${_ghlInput('ghl-new-email', 'Email', 'email')}
      ${_ghlInput('ghl-new-phone', 'Phone', 'tel')}
      ${_ghlInput('ghl-new-tags', 'Tags (comma-separated)', 'text')}
    </div>

    <div style="display:flex;gap:10px;margin-top:20px;">
      <button onclick="_ghlCloseModal()" style="
        flex:1;padding:10px;border-radius:8px;border:1px solid var(--brd);
        background:var(--bg3);color:var(--t1);font-size:13px;cursor:pointer;
      ">Cancel</button>
      <button onclick="_ghlSubmitNewContact()" style="
        flex:2;padding:10px;border-radius:8px;border:none;
        background:var(--gold);color:#000;font-size:13px;font-weight:600;cursor:pointer;
      ">Create Contact</button>
    </div>
    <div id="ghl-modal-error" style="
      display:none;margin-top:10px;padding:8px 12px;border-radius:8px;
      background:var(--coral)20;color:var(--coral);font-size:12px;
    "></div>
  `;

  overlay.style.display = 'flex';
  modal.style.display   = 'block';
}

function _ghlCloseModal() {
  const overlay = document.getElementById('ghl-modal-overlay');
  const modal   = document.getElementById('ghl-add-contact-modal');
  if (overlay) overlay.style.display = 'none';
  if (modal)   modal.style.display   = 'none';
}

function _ghlInput(id, placeholder, type = 'text', required = false) {
  return `
    <input
      id="${id}"
      type="${type}"
      placeholder="${placeholder}${required ? ' *' : ''}"
      style="
        width:100%;padding:10px 12px;
        background:var(--bg3);border:1px solid var(--brd);border-radius:8px;
        color:var(--t1);font-size:13px;outline:none;box-sizing:border-box;
      "
    />
  `;
}

async function _ghlSubmitNewContact() {
  const errEl = document.getElementById('ghl-modal-error');
  const firstName = document.getElementById('ghl-new-firstName')?.value?.trim();
  if (!firstName) {
    if (errEl) { errEl.textContent = 'First name is required.'; errEl.style.display = 'block'; }
    return;
  }

  const tagRaw = document.getElementById('ghl-new-tags')?.value || '';
  const tags   = tagRaw.split(',').map(t => t.trim()).filter(Boolean);

  const payload = {
    firstName,
    lastName:  document.getElementById('ghl-new-lastName')?.value?.trim() || '',
    email:     document.getElementById('ghl-new-email')?.value?.trim() || '',
    phone:     document.getElementById('ghl-new-phone')?.value?.trim() || '',
    tags,
    source:    'SaintSal Labs',
  };

  try {
    await apiPost('/api/ghl/contacts/create', payload);
    _ghlCloseModal();
    _showToast('Contact created');
    // Refresh the contacts if on that tab
    if (ghlState.activeTab === 'contacts') {
      ghlState.contactOffset = 0;
      await _ghlFetchContacts(false);
    } else if (ghlState.activeTab === 'dashboard') {
      await _ghlLoadDashboard();
    }
  } catch (e) {
    if (errEl) { errEl.textContent = e.message || 'Failed to create contact.'; errEl.style.display = 'block'; }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: PIPELINES (Kanban-style)
// ══════════════════════════════════════════════════════════════════════════════

async function _ghlLoadPipelines() {
  const content = document.getElementById('ghl-tab-content');
  if (!content) return;

  try {
    const data = await apiGet('/api/ghl/pipelines');
    const pipelines = data.pipelines || [];

    if (!pipelines.length) {
      content.innerHTML = _ghlError('No pipelines found in this GHL location.');
      return;
    }

    ghlState.pipelines = pipelines;

    // Build pipeline selector tabs
    let selectedIdx = 0;
    const renderKanban = (idx) => {
      selectedIdx = idx;
      const p = pipelines[idx];
      _ghlRenderKanban(p, idx, pipelines);
    };

    content.innerHTML = `
      <!-- Pipeline selector tabs -->
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:20px;">
        ${pipelines.map((p, i) => `
          <button
            id="ptab-${i}"
            onclick="_ghlSelectPipeline(${i})"
            style="
              padding:6px 14px;border-radius:8px;border:none;cursor:pointer;
              font-size:12px;
              background:${i === 0 ? 'var(--gold)' : 'var(--bg2)'};
              color:${i === 0 ? '#000' : 'var(--t2)'};
              border:1px solid ${i === 0 ? 'var(--gold)' : 'var(--brd)'};
            "
          >${_esc(p.name || `Pipeline ${i + 1}`)}</button>
        `).join('')}
      </div>
      <div id="ghl-kanban-board">
        ${_ghlLoading('Loading pipeline...')}
      </div>
    `;

    // Load deals for first pipeline
    await _ghlLoadKanban(pipelines[0], 0);
  } catch (e) {
    content.innerHTML = _ghlError('Failed to load pipelines.');
  }
}

async function _ghlSelectPipeline(idx) {
  const pipelines = ghlState.pipelines;
  if (!pipelines[idx]) return;

  // Update tab styles
  pipelines.forEach((_, i) => {
    const btn = document.getElementById(`ptab-${i}`);
    if (!btn) return;
    const active = i === idx;
    btn.style.background   = active ? 'var(--gold)' : 'var(--bg2)';
    btn.style.color        = active ? '#000' : 'var(--t2)';
    btn.style.borderColor  = active ? 'var(--gold)' : 'var(--brd)';
  });

  const board = document.getElementById('ghl-kanban-board');
  if (board) board.innerHTML = _ghlLoading('Loading pipeline...');
  await _ghlLoadKanban(pipelines[idx], idx);
}

async function _ghlLoadKanban(pipeline, idx) {
  const board = document.getElementById('ghl-kanban-board');
  if (!board) return;

  try {
    const data  = await apiGet(`/api/ghl/pipeline/${pipeline.id}/deals?limit=100`);
    const deals = data.deals || [];
    board.innerHTML = _ghlKanbanHTML(pipeline, deals);
  } catch (e) {
    board.innerHTML = _ghlKanbanHTML(pipeline, []);
  }
}

function _ghlKanbanHTML(pipeline, deals) {
  const stages = pipeline.stages || [];
  const stageColors = ['var(--blue)', 'var(--purple)', 'var(--teal)', 'var(--gold)', 'var(--green)', 'var(--coral)'];

  // Group deals by stage
  const dealsByStage = {};
  stages.forEach(s => { dealsByStage[s.id] = []; });
  deals.forEach(d => {
    const sid = d.pipelineStageId || d.stageId || '';
    if (dealsByStage[sid]) {
      dealsByStage[sid].push(d);
    } else {
      // Put unmatched in first stage
      const firstId = stages[0]?.id;
      if (firstId) dealsByStage[firstId] = (dealsByStage[firstId] || []).concat(d);
    }
  });

  return `
    <div style="
      display:flex;gap:12px;overflow-x:auto;padding-bottom:20px;
      -webkit-overflow-scrolling:touch;
    ">
      ${stages.map((stage, i) => {
        const stageDeals = dealsByStage[stage.id] || [];
        const totalValue = stageDeals.reduce((s, d) => s + (d.monetaryValue || d.value || 0), 0);
        const color = stageColors[i % stageColors.length];

        return `
          <div style="
            flex-shrink:0;width:240px;
            display:flex;flex-direction:column;gap:8px;
          ">
            <!-- Stage header -->
            <div style="
              background:var(--bg2);border:1px solid var(--brd);border-radius:10px;
              padding:10px 12px;
              border-top:3px solid ${color};
            ">
              <div style="font-size:12px;font-weight:600;color:var(--t1);">${_esc(stage.name)}</div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span style="font-size:10px;color:var(--t3);">${stageDeals.length} deal${stageDeals.length !== 1 ? 's' : ''}</span>
                <span style="font-size:10px;color:${color};font-weight:600;">${_formatCurrency(totalValue)}</span>
              </div>
            </div>

            <!-- Deal cards -->
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${stageDeals.length === 0 ? `
                <div style="
                  padding:16px;text-align:center;color:var(--t3);font-size:11px;
                  background:var(--bg2);border:1px dashed var(--brd);border-radius:8px;
                ">No deals</div>
              ` : stageDeals.map(d => _ghlDealCard(d, color)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function _ghlDealCard(deal, accentColor) {
  const name    = deal.name || deal.title || 'Unnamed Deal';
  const contact = deal.contact?.name || deal.contactName || '';
  const value   = deal.monetaryValue || deal.value || 0;
  const age     = deal.dateAdded ? _relDate(deal.dateAdded) : '';

  return `
    <div style="
      background:var(--bg2);border:1px solid var(--brd);border-radius:8px;
      padding:12px;cursor:grab;
      border-left:3px solid ${accentColor};
      transition:border-color 0.1s,transform 0.1s;
    "
    onmouseover="this.style.borderColor='${accentColor}';this.style.transform='translateY(-1px)'"
    onmouseout="this.style.borderColor='${accentColor}';this.style.transform=''"
    >
      <div style="font-size:12px;font-weight:600;color:var(--t1);margin-bottom:4px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(name)}</div>
      ${contact ? `<div style="font-size:11px;color:var(--t2);margin-bottom:4px;">👤 ${_esc(contact)}</div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;">
        ${value > 0 ? `<span style="font-size:11px;color:var(--gold);font-weight:600;">${_formatCurrency(value)}</span>` : '<span></span>'}
        <span style="font-size:10px;color:var(--t3);">${age}</span>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

function _ghlError(msg) {
  return `
    <div style="
      padding:24px;border-radius:12px;
      background:var(--coral)10;border:1px solid var(--coral)40;
      color:var(--coral);font-size:13px;
    ">⚠️ ${_esc(msg)}</div>
  `;
}

function _setGHLStatus(online) {
  const dot  = document.getElementById('ghl-status-dot');
  const text = document.getElementById('ghl-status-text');
  if (!dot || !text) return;
  dot.style.background  = online ? 'var(--green)' : 'var(--coral)';
  text.textContent      = online ? 'Connected' : 'Offline';
}

function _initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _formatCurrency(n) {
  const num = Number(n) || 0;
  if (num === 0) return '$0';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

function _relDate(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function _showToast(msg, isError = false) {
  const existing = document.getElementById('ghl-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'ghl-toast';
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;
    background:${isError ? 'var(--coral)' : 'var(--green)'};
    color:${isError ? '#fff' : '#000'};
    box-shadow:0 4px 16px rgba(0,0,0,0.4);
    animation:fadeIn 0.2s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── CSS keyframe injection ────────────────────────────────────────────────────

(function _injectGHLStyles() {
  if (document.getElementById('ghl-styles')) return;
  const style = document.createElement('style');
  style.id = 'ghl-styles';
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity:0;transform:translateY(8px); } to { opacity:1;transform:none; } }
    #ghl-contact-drawer { transition: transform 0.25s ease; }
  `;
  document.head.appendChild(style);
})();
