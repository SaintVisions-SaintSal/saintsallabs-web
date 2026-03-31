/**
 * SaintSal™ Labs — CookinCards™
 * Card scanning, grading, and collection management powered by Ximilar AI
 * Saint Vision Technologies LLC | US Patent #10,290,222 (HACP™)
 *
 * Exports: initCards(), switchCardsTab(tab)
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const CARDS_STATE = {
  activeTab: 'scan',
  scanFile: null,
  scanBase64: null,
  scanUrl: null,
  scanResult: null,
  gradeResult: null,
  frontFile: null,
  frontBase64: null,
  backFile: null,
  backBase64: null,
  searchPage: 1,
  searchQuery: '',
  searchSet: '',
  collectionSort: 'date',
  collectionFilter: '',
  trendingLoaded: false,
};

// ── API helper ────────────────────────────────────────────────────────────────

async function _cardsApi(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-sal-key': 'saintvision_gateway_2025',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  return data;
}

async function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
}

function _getUserId() {
  return window.currentUser?.id || 'anonymous';
}

// ── Grade color helpers ───────────────────────────────────────────────────────

function _gradeColor(grade) {
  const g = parseFloat(grade);
  if (g >= 9.5) return '#f59e0b';    // Gold — PSA 10
  if (g >= 8.5) return '#00ff88';    // Green — PSA 9
  if (g >= 7.5) return '#60a5fa';    // Blue — PSA 8
  if (g >= 6.5) return '#fbbf24';    // Yellow — PSA 7
  return '#f87171';                  // Red — PSA 6 and below
}

function _gradeLabel(grade) {
  const g = parseFloat(grade);
  if (g >= 9.5) return 'GEM MINT';
  if (g >= 8.5) return 'MINT';
  if (g >= 7.5) return 'NEAR MINT-MINT';
  if (g >= 6.5) return 'NEAR MINT';
  if (g >= 5.5) return 'EXCELLENT-MINT';
  if (g >= 4.5) return 'EXCELLENT';
  if (g >= 3.5) return 'VERY GOOD-EXCELLENT';
  if (g >= 2.5) return 'VERY GOOD';
  return 'POOR';
}

function _conditionColor(cond) {
  const c = (cond || '').toUpperCase();
  if (c === 'NM' || c === 'NM-MT') return '#00ff88';
  if (c === 'LP' || c === 'EX') return '#60a5fa';
  if (c === 'MP' || c === 'VG') return '#fbbf24';
  if (c === 'HP' || c === 'G') return '#f87171';
  if (c === 'D' || c === 'PR') return '#f87171';
  return '#999';
}

function _valueColor(val) {
  const v = parseFloat(val);
  if (v >= 1000) return '#00ff88';
  if (v >= 100)  return '#f59e0b';
  if (v >= 10)   return '#60a5fa';
  return '#666';
}

// ── Main init ─────────────────────────────────────────────────────────────────

function initCards() {
  const container = document.getElementById('cards-root');
  if (!container) return;

  container.innerHTML = _buildCardsShell();
  _attachCardsDragDrop();
  _attachScanFileInput();
  _attachGradeDragDrop();
  switchCardsTab('scan');
}

function switchCardsTab(tab) {
  CARDS_STATE.activeTab = tab;
  const tabs = ['scan', 'search', 'collection', 'trending'];
  tabs.forEach(t => {
    const btn = document.getElementById(`cards-tab-${t}`);
    const panel = document.getElementById(`cards-panel-${t}`);
    const isActive = t === tab;
    if (btn) {
      btn.style.background = isActive ? 'rgba(245,158,11,0.2)' : 'transparent';
      btn.style.color = isActive ? '#f59e0b' : '#666';
      btn.style.borderColor = isActive ? 'rgba(245,158,11,0.4)' : 'transparent';
    }
    if (panel) panel.style.display = isActive ? 'block' : 'none';
  });
  if (tab === 'collection') _loadCollection();
  if (tab === 'trending' && !CARDS_STATE.trendingLoaded) _loadTrending();
}

// ── Shell HTML ────────────────────────────────────────────────────────────────

function _buildCardsShell() {
  return `
<div style="background:var(--bg);min-height:100vh;overflow-y:auto;padding-bottom:80px;">

  <!-- Pokemon 30th Anniversary Banner -->
  <div style="position:relative;overflow:hidden;background:linear-gradient(135deg,#1a0533 0%,#0d1a4a 35%,#1a0d00 70%,#0d0d0d 100%);padding:28px 24px;border-bottom:1px solid rgba(245,158,11,0.3);">
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 20% 50%,rgba(239,68,68,0.12),transparent 60%),radial-gradient(ellipse at 80% 50%,rgba(250,204,21,0.12),transparent 60%);pointer-events:none;"></div>
    <style>@keyframes ccFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes ccShimmer{0%{background-position:0%}100%{background-position:200%}}</style>
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none;">
      <div style="position:absolute;top:10px;left:8%;font-size:18px;animation:ccFloat 3s ease-in-out infinite;">⚡</div>
      <div style="position:absolute;top:18px;left:25%;font-size:13px;animation:ccFloat 4s ease-in-out infinite 0.5s;">🔥</div>
      <div style="position:absolute;bottom:12px;left:15%;font-size:15px;animation:ccFloat 3.5s ease-in-out infinite 1s;">✨</div>
      <div style="position:absolute;top:14px;right:20%;font-size:16px;animation:ccFloat 4s ease-in-out infinite 0.3s;">⚡</div>
      <div style="position:absolute;bottom:10px;right:10%;font-size:13px;animation:ccFloat 3s ease-in-out infinite 1.5s;">🔥</div>
    </div>
    <div style="position:relative;text-align:center;">
      <div style="display:inline-block;background:linear-gradient(90deg,#ef4444,#f59e0b,#eab308,#f59e0b,#ef4444);background-size:200%;animation:ccShimmer 2s linear infinite;-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:10px;font-weight:900;letter-spacing:3px;margin-bottom:6px;">🎉 POKEMON TCG — 30th ANNIVERSARY · 1996 – 2026</div>
      <div style="font-size:26px;font-weight:900;color:#fff;text-shadow:0 0 30px rgba(245,158,11,0.5);margin-bottom:6px;">CookinCards™</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:14px;">AI-Powered Card Scanning, Grading &amp; Collection Management</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
        <span style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;">🔥 Base Set 1st Edition</span>
        <span style="background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.4);color:#fcd34d;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;">⚡ Ximilar AI Grading</span>
        <span style="background:rgba(168,85,247,0.2);border:1px solid rgba(168,85,247,0.4);color:#d8b4fe;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;">💎 PSA-Style Grades</span>
      </div>
    </div>
  </div>

  <!-- Header + Live Badge -->
  <div style="padding:16px 20px 0;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:22px;">🃏</span>
      <div style="font-size:16px;font-weight:900;color:var(--gold);">CookinCards™</div>
    </div>
    <div style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:var(--green);padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;">● LIVE</div>
  </div>

  <!-- Tabs -->
  <div style="padding:12px 20px 0;">
    <div style="display:flex;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:4px;">
      <button id="cards-tab-scan"       onclick="switchCardsTab('scan')"       style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid transparent;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s;">📷 Scan</button>
      <button id="cards-tab-search"     onclick="switchCardsTab('search')"     style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid transparent;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s;">🔍 Search</button>
      <button id="cards-tab-collection" onclick="switchCardsTab('collection')" style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid transparent;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s;">📁 Collection</button>
      <button id="cards-tab-trending"   onclick="switchCardsTab('trending')"   style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid transparent;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s;">📈 Trending</button>
    </div>
  </div>

  <!-- Panel: Scan -->
  <div id="cards-panel-scan" style="padding:16px 20px;display:none;">
    ${_buildScanPanel()}
  </div>

  <!-- Panel: Search -->
  <div id="cards-panel-search" style="padding:16px 20px;display:none;">
    ${_buildSearchPanel()}
  </div>

  <!-- Panel: Collection -->
  <div id="cards-panel-collection" style="padding:16px 20px;display:none;">
    <div id="cards-collection-content">
      <div style="text-align:center;padding:40px;color:var(--t3);">Loading collection...</div>
    </div>
  </div>

  <!-- Panel: Trending -->
  <div id="cards-panel-trending" style="padding:16px 20px;display:none;">
    <div id="cards-trending-content">
      <div style="text-align:center;padding:40px;color:var(--t3);">Loading market data...</div>
    </div>
  </div>

</div>`;
}

// ── Tab 1: Scan Panel ─────────────────────────────────────────────────────────

function _buildScanPanel() {
  return `
<div>
  <div style="font-size:14px;font-weight:900;color:var(--t1);margin-bottom:14px;">Identify a Card</div>

  <!-- Upload methods: drag-drop, URL, file -->
  <div id="cards-drop-zone"
    style="border:2px dashed rgba(245,158,11,0.35);border-radius:14px;padding:32px 20px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:12px;position:relative;"
    onclick="document.getElementById('cards-file-input').click()"
    ondragover="event.preventDefault();this.style.borderColor='#f59e0b';this.style.background='rgba(245,158,11,0.06)';"
    ondragleave="this.style.borderColor='rgba(245,158,11,0.35)';this.style.background='transparent';"
    ondrop="_handleScanDrop(event)">
    <div id="cards-drop-preview" style="display:none;margin-bottom:12px;">
      <img id="cards-preview-img" style="max-width:160px;max-height:200px;border-radius:10px;border:1px solid rgba(245,158,11,0.3);" />
    </div>
    <div id="cards-drop-placeholder">
      <div style="font-size:32px;margin-bottom:8px;">📷</div>
      <div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:4px;">Drop card image here</div>
      <div style="font-size:11px;color:var(--t3);">JPG, PNG, WEBP — or click to browse</div>
    </div>
    <input id="cards-file-input" type="file" accept="image/*" style="display:none;" onchange="_handleScanFile(event)" />
  </div>

  <!-- URL input -->
  <div style="display:flex;gap:8px;margin-bottom:14px;">
    <input id="cards-url-input" type="text" placeholder="Or paste image URL..." style="flex:1;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:10px 14px;color:var(--t1);font-size:12px;outline:none;" onfocus="this.style.borderColor='rgba(245,158,11,0.5)'" onblur="this.style.borderColor='var(--brd)'" onkeypress="if(event.key==='Enter')_previewScanUrl()" />
    <button onclick="_previewScanUrl()" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:var(--gold);padding:10px 14px;border-radius:var(--r8);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">Preview</button>
  </div>

  <!-- Identify button -->
  <button id="cards-identify-btn" onclick="_doScan()" style="width:100%;background:var(--gold);border:none;border-radius:var(--r8);padding:13px;color:#000;font-size:13px;font-weight:900;cursor:pointer;letter-spacing:0.5px;transition:opacity 0.2s;">🔍 Identify Card</button>

  <!-- Scan result -->
  <div id="cards-scan-result" style="margin-top:16px;"></div>

  <!-- Grading section — shown after scan -->
  <div id="cards-grade-section" style="display:none;margin-top:20px;">
    <div style="border-top:1px solid var(--brd);padding-top:16px;">
      <div style="font-size:13px;font-weight:900;color:var(--t1);margin-bottom:12px;">Grade This Card</div>

      <!-- Quick grade -->
      <button onclick="_doQuickGrade()" style="width:100%;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);color:var(--blue);border-radius:var(--r8);padding:11px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:10px;">⚡ Quick Grade (Instant Condition)</button>

      <!-- Full grade: front + back upload -->
      <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:14px;margin-bottom:10px;">
        <div style="font-size:11px;font-weight:700;color:var(--t2);letter-spacing:1px;margin-bottom:12px;">FULL GRADE — UPLOAD FRONT &amp; BACK</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <!-- Front upload -->
          <div id="grade-front-zone"
            style="border:2px dashed rgba(245,158,11,0.25);border-radius:10px;padding:16px 8px;text-align:center;cursor:pointer;transition:all 0.2s;"
            onclick="document.getElementById('grade-front-input').click()"
            ondragover="event.preventDefault();this.style.borderColor='#f59e0b';"
            ondragleave="this.style.borderColor='rgba(245,158,11,0.25)';"
            ondrop="_handleGradeDrop(event,'front')">
            <div id="grade-front-preview" style="display:none;margin-bottom:6px;">
              <img id="grade-front-img" style="max-width:80px;max-height:100px;border-radius:6px;" />
            </div>
            <div id="grade-front-placeholder">
              <div style="font-size:20px;margin-bottom:4px;">📤</div>
              <div style="font-size:10px;color:var(--t3);">Front</div>
            </div>
            <input id="grade-front-input" type="file" accept="image/*" style="display:none;" onchange="_handleGradeFile(event,'front')" />
          </div>
          <!-- Back upload -->
          <div id="grade-back-zone"
            style="border:2px dashed rgba(96,165,250,0.25);border-radius:10px;padding:16px 8px;text-align:center;cursor:pointer;transition:all 0.2s;"
            onclick="document.getElementById('grade-back-input').click()"
            ondragover="event.preventDefault();this.style.borderColor='var(--blue)';"
            ondragleave="this.style.borderColor='rgba(96,165,250,0.25)';"
            ondrop="_handleGradeDrop(event,'back')">
            <div id="grade-back-preview" style="display:none;margin-bottom:6px;">
              <img id="grade-back-img" style="max-width:80px;max-height:100px;border-radius:6px;" />
            </div>
            <div id="grade-back-placeholder">
              <div style="font-size:20px;margin-bottom:4px;">📤</div>
              <div style="font-size:10px;color:var(--t3);">Back <span style="font-size:9px;">(optional)</span></div>
            </div>
            <input id="grade-back-input" type="file" accept="image/*" style="display:none;" onchange="_handleGradeFile(event,'back')" />
          </div>
        </div>
        <button onclick="_doFullGrade()" style="width:100%;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:var(--green);border-radius:var(--r8);padding:11px;font-size:12px;font-weight:700;cursor:pointer;">🏆 Run Full Grade (PSA-Style)</button>
      </div>

      <!-- Grade result -->
      <div id="cards-grade-result" style="margin-top:10px;"></div>
    </div>
  </div>
</div>`;
}

// ── Scan handlers ─────────────────────────────────────────────────────────────

function _attachCardsDragDrop() {
  // Drag-drop is handled via inline ondrop attributes
}

function _attachScanFileInput() {
  // File input is handled via inline onchange attributes
}

function _attachGradeDragDrop() {
  // Grade drag-drop handled via inline attributes
}

function _previewScanUrl() {
  const url = (document.getElementById('cards-url-input') || {}).value || '';
  if (!url.trim()) return;
  CARDS_STATE.scanUrl = url.trim();
  CARDS_STATE.scanBase64 = null;
  CARDS_STATE.scanFile = null;
  const img = document.getElementById('cards-preview-img');
  const preview = document.getElementById('cards-drop-preview');
  const placeholder = document.getElementById('cards-drop-placeholder');
  if (img) { img.src = url; preview.style.display = 'block'; }
  if (placeholder) placeholder.style.display = 'none';
}

async function _handleScanFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  CARDS_STATE.scanFile = file;
  CARDS_STATE.scanUrl = null;
  const b64 = await fileToBase64(file);
  CARDS_STATE.scanBase64 = b64;
  const url = URL.createObjectURL(file);
  const img = document.getElementById('cards-preview-img');
  const preview = document.getElementById('cards-drop-preview');
  const placeholder = document.getElementById('cards-drop-placeholder');
  if (img) { img.src = url; preview.style.display = 'block'; }
  if (placeholder) placeholder.style.display = 'none';
}

async function _handleScanDrop(event) {
  event.preventDefault();
  const zone = document.getElementById('cards-drop-zone');
  if (zone) { zone.style.borderColor = 'rgba(245,158,11,0.35)'; zone.style.background = 'transparent'; }
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  CARDS_STATE.scanFile = file;
  CARDS_STATE.scanUrl = null;
  const b64 = await fileToBase64(file);
  CARDS_STATE.scanBase64 = b64;
  const url = URL.createObjectURL(file);
  const img = document.getElementById('cards-preview-img');
  const preview = document.getElementById('cards-drop-preview');
  const placeholder = document.getElementById('cards-drop-placeholder');
  if (img) { img.src = url; preview.style.display = 'block'; }
  if (placeholder) placeholder.style.display = 'none';
}

async function _doScan() {
  if (!CARDS_STATE.scanBase64 && !CARDS_STATE.scanUrl) {
    _showScanResult('<div style="color:var(--coral);font-size:12px;text-align:center;padding:16px;">Please upload an image or enter a URL first.</div>');
    return;
  }
  const btn = document.getElementById('cards-identify-btn');
  if (btn) { btn.disabled = true; btn.textContent = '🔍 Identifying...'; }
  _showScanResult(`
    <div style="text-align:center;padding:32px;color:var(--gold);">
      <div style="font-size:28px;margin-bottom:8px;">🃏</div>
      <div style="font-size:13px;font-weight:700;">Analyzing with Ximilar AI...</div>
      <div style="font-size:11px;color:var(--t3);margin-top:4px;">Checking TCG + Sports databases</div>
    </div>`);

  try {
    const payload = {};
    if (CARDS_STATE.scanBase64) payload.image_base64 = CARDS_STATE.scanBase64;
    else payload.image_url = CARDS_STATE.scanUrl;

    const data = await _cardsApi('POST', '/api/cards/scan', payload);
    CARDS_STATE.scanResult = data;
    _renderScanResult(data);
  } catch (e) {
    _showScanResult(`<div style="color:var(--coral);text-align:center;padding:20px;">Error identifying card. Try again.</div>`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Identify Card'; }
  }
}

function _showScanResult(html) {
  const el = document.getElementById('cards-scan-result');
  if (el) el.innerHTML = html;
}

function _renderScanResult(data) {
  if (data.error && !data.card_name) {
    _showScanResult(`<div style="color:var(--coral);text-align:center;padding:20px;">Could not identify card: ${data.error}</div>`);
    return;
  }

  const confidencePct = Math.round((data.confidence || 0) * 100);
  const valueStr = data.estimated_value > 0 ? `$${parseFloat(data.estimated_value).toFixed(2)}` : 'N/A';

  let ebayHtml = '';
  if (data.ebay_listings && data.ebay_listings.length > 0) {
    ebayHtml = `
      <div style="margin-top:14px;">
        <div style="font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px;margin-bottom:8px;">EBAY LISTINGS</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${data.ebay_listings.slice(0, 5).map(l => `
            <a href="${l.url || '#'}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:space-between;background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);padding:10px 12px;text-decoration:none;transition:border-color 0.2s;" onmouseover="this.style.borderColor='rgba(245,158,11,0.4)'" onmouseout="this.style.borderColor='var(--brd)'">
              <div style="flex:1;min-width:0;margin-right:10px;">
                <div style="font-size:11px;color:var(--t1);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(l.title)}</div>
                <div style="font-size:10px;color:var(--t3);margin-top:2px;">${_esc(l.condition || '')}</div>
              </div>
              <div style="font-size:13px;font-weight:900;color:var(--green);white-space:nowrap;">$${parseFloat(l.price || 0).toFixed(2)}</div>
            </a>`).join('')}
        </div>
      </div>`;
  }

  const html = `
    <div style="background:var(--bg2);border:1px solid rgba(245,158,11,0.25);border-radius:var(--r12);padding:16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
        <div>
          <div style="font-size:16px;font-weight:900;color:var(--t1);">${_esc(data.card_name || 'Unknown Card')}</div>
          ${data.card_set ? `<div style="font-size:11px;color:var(--t2);margin-top:2px;">${_esc(data.card_set)}${data.card_number ? ` · #${_esc(data.card_number)}` : ''}${data.year ? ` · ${_esc(data.year)}` : ''}</div>` : ''}
          ${data.rarity ? `<div style="margin-top:6px;"><span style="background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);color:var(--purple);padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;">${_esc(data.rarity)}</span></div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:900;color:var(--gold);">${valueStr}</div>
          <div style="font-size:9px;color:var(--t3);margin-top:2px;">EST. VALUE</div>
        </div>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
        <span style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.2);color:var(--green);padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">${data.type === 'tcg' ? '🃏 TCG' : '🏀 Sports'}</span>
        ${confidencePct > 0 ? `<span style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);color:var(--gold);padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">${confidencePct}% confidence</span>` : ''}
      </div>

      ${ebayHtml}

      <!-- Add to Collection -->
      <button onclick="_addToCollection()" style="width:100%;margin-top:14px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:var(--green);border-radius:var(--r8);padding:11px;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(0,255,136,0.18)'" onmouseout="this.style.background='rgba(0,255,136,0.1)'">
        + Add to My Collection
      </button>
    </div>`;

  _showScanResult(html);

  // Show grading section
  const gradeSection = document.getElementById('cards-grade-section');
  if (gradeSection) gradeSection.style.display = 'block';
}

async function _addToCollection() {
  const d = CARDS_STATE.scanResult;
  if (!d) return;
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Adding...';
  try {
    const res = await _cardsApi('POST', '/api/cards/collection/add', {
      user_id: _getUserId(),
      card_name: d.card_name || 'Unknown',
      card_set: d.card_set || '',
      card_number: d.card_number || '',
      condition: 'NM',
      estimated_value: d.estimated_value || 0,
      image_url: CARDS_STATE.scanUrl || '',
      ximilar_data: d.raw_ximilar || {},
    });
    if (res.success) {
      btn.textContent = '✓ Added to Collection';
      btn.style.color = 'var(--green)';
    } else {
      btn.textContent = '+ Add to My Collection';
      btn.disabled = false;
    }
  } catch (e) {
    btn.textContent = '+ Add to My Collection';
    btn.disabled = false;
  }
}

// ── Grade handlers ────────────────────────────────────────────────────────────

async function _handleGradeFile(event, side) {
  const file = event.target.files[0];
  if (!file) return;
  const b64 = await fileToBase64(file);
  const url = URL.createObjectURL(file);
  if (side === 'front') {
    CARDS_STATE.frontBase64 = b64;
    CARDS_STATE.frontFile = file;
    const img = document.getElementById('grade-front-img');
    const preview = document.getElementById('grade-front-preview');
    const placeholder = document.getElementById('grade-front-placeholder');
    if (img) { img.src = url; }
    if (preview) preview.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } else {
    CARDS_STATE.backBase64 = b64;
    CARDS_STATE.backFile = file;
    const img = document.getElementById('grade-back-img');
    const preview = document.getElementById('grade-back-preview');
    const placeholder = document.getElementById('grade-back-placeholder');
    if (img) { img.src = url; }
    if (preview) preview.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  }
}

async function _handleGradeDrop(event, side) {
  event.preventDefault();
  const zoneId = side === 'front' ? 'grade-front-zone' : 'grade-back-zone';
  const zone = document.getElementById(zoneId);
  if (zone) zone.style.borderColor = side === 'front' ? 'rgba(245,158,11,0.25)' : 'rgba(96,165,250,0.25)';
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const fakeEvent = { target: { files: [file] } };
  await _handleGradeFile(fakeEvent, side);
}

async function _doQuickGrade() {
  if (!CARDS_STATE.scanBase64 && !CARDS_STATE.scanUrl) {
    _showGradeResult('<div style="color:var(--coral);font-size:12px;text-align:center;padding:16px;">Scan a card first.</div>');
    return;
  }
  _showGradeResult(`<div style="text-align:center;padding:20px;color:var(--blue);">⚡ Running quick condition check...</div>`);
  try {
    const payload = {};
    if (CARDS_STATE.scanBase64) payload.image_base64 = CARDS_STATE.scanBase64;
    else payload.image_url = CARDS_STATE.scanUrl;
    const data = await _cardsApi('POST', '/api/cards/quick-grade', payload);
    const cond = data.condition || 'NM';
    const color = _conditionColor(cond);
    _showGradeResult(`
      <div style="background:var(--bg2);border:1px solid ${color}40;border-radius:var(--r12);padding:16px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--t3);letter-spacing:2px;margin-bottom:8px;">QUICK CONDITION</div>
        <div style="font-size:36px;font-weight:900;color:${color};margin-bottom:4px;">${_esc(cond)}</div>
        <div style="font-size:11px;color:var(--t3);">${_conditionFull(cond)}</div>
      </div>`);
  } catch (e) {
    _showGradeResult('<div style="color:var(--coral);text-align:center;padding:16px;">Quick grade failed. Try again.</div>');
  }
}

async function _doFullGrade() {
  // Need front image
  const hasFront = CARDS_STATE.frontBase64 || CARDS_STATE.scanBase64 || CARDS_STATE.scanUrl;
  if (!hasFront) {
    _showGradeResult('<div style="color:var(--coral);font-size:12px;text-align:center;padding:16px;">Upload a front image to grade.</div>');
    return;
  }
  _showGradeResult(`<div style="text-align:center;padding:24px;color:var(--green);">🏆 Running full PSA-style grade... This may take ~20 seconds.</div>`);
  try {
    const payload = {};
    if (CARDS_STATE.frontBase64) payload.front_base64 = CARDS_STATE.frontBase64;
    else payload.front_url = CARDS_STATE.scanUrl;
    if (CARDS_STATE.backBase64) payload.back_base64 = CARDS_STATE.backBase64;

    const data = await _cardsApi('POST', '/api/cards/grade', payload);
    CARDS_STATE.gradeResult = data;
    _renderFullGradeResult(data);
  } catch (e) {
    _showGradeResult('<div style="color:var(--coral);text-align:center;padding:16px;">Grade failed. Try again.</div>');
  }
}

function _showGradeResult(html) {
  const el = document.getElementById('cards-grade-result');
  if (el) el.innerHTML = html;
}

function _renderFullGradeResult(data) {
  if (data.error) {
    _showGradeResult(`<div style="color:var(--coral);text-align:center;padding:16px;">${_esc(data.error)}</div>`);
    return;
  }

  const grade = parseFloat(data.grade || 0);
  const color = _gradeColor(grade);
  const label = _gradeLabel(grade);
  const psaEq = data.psa_equivalent || 'PSA ?';

  const mkBar = (val, color) => {
    const pct = Math.min(100, Math.max(0, parseFloat(val || 0) * 10));
    return `<div style="background:rgba(255,255,255,0.06);border-radius:4px;height:6px;overflow:hidden;flex:1;min-width:80px;">
      <div style="height:100%;border-radius:4px;background:${color};width:${pct}%;transition:width 0.8s ease;"></div>
    </div>`;
  };

  const mkStat = (label, val, color) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <div style="font-size:10px;color:var(--t3);width:76px;flex-shrink:0;">${label}</div>
      ${mkBar(val, color)}
      <div style="font-size:11px;font-weight:700;color:${color};width:30px;text-align:right;">${parseFloat(val || 0).toFixed(1)}</div>
    </div>`;

  const html = `
    <div style="background:var(--bg2);border:1px solid ${color}40;border-radius:var(--r12);padding:16px;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:10px;font-weight:700;color:var(--t3);letter-spacing:2px;margin-bottom:4px;">OVERALL GRADE</div>
        <div style="font-size:52px;font-weight:900;color:${color};line-height:1;text-shadow:0 0 20px ${color}60;">${grade.toFixed(1)}</div>
        <div style="font-size:12px;font-weight:700;color:${color};margin-top:4px;">${label}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:4px;">${psaEq} equivalent</div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);padding:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px;margin-bottom:10px;">BREAKDOWN</div>
        ${mkStat('Centering', data.centering, '#a78bfa')}
        ${mkStat('Corners', data.corners, '#60a5fa')}
        ${mkStat('Edges', data.edges, '#2dd4bf')}
        ${mkStat('Surface', data.surface, '#f59e0b')}
      </div>
    </div>`;
  _showGradeResult(html);
}

function _conditionFull(cond) {
  const map = { 'NM': 'Near Mint', 'LP': 'Lightly Played', 'MP': 'Moderately Played', 'HP': 'Heavily Played', 'D': 'Damaged' };
  return map[(cond || '').toUpperCase()] || cond;
}

// ── Tab 2: Search Panel ───────────────────────────────────────────────────────

function _buildSearchPanel() {
  return `
<div>
  <div style="font-size:14px;font-weight:900;color:var(--t1);margin-bottom:12px;">Search Cards</div>

  <!-- Search inputs -->
  <div style="display:flex;gap:8px;margin-bottom:10px;">
    <input id="cards-search-input" type="text" placeholder="Charizard, Pikachu, Mewtwo..." style="flex:1;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:11px 14px;color:var(--t1);font-size:12px;outline:none;" onfocus="this.style.borderColor='rgba(245,158,11,0.5)'" onblur="this.style.borderColor='var(--brd)'" onkeypress="if(event.key==='Enter')_doSearch()" />
    <button onclick="_doSearch()" style="background:var(--gold);border:none;border-radius:var(--r8);padding:11px 16px;color:#000;font-size:12px;font-weight:900;cursor:pointer;">🔍</button>
  </div>

  <input id="cards-set-filter" type="text" placeholder="Filter by set (e.g. 'Base Set', '151', 'Scarlet &amp; Violet')..." style="width:100%;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:10px 14px;color:var(--t1);font-size:11px;outline:none;box-sizing:border-box;margin-bottom:12px;" onfocus="this.style.borderColor='rgba(96,165,250,0.5)'" onblur="this.style.borderColor='var(--brd)'" />

  <!-- Results -->
  <div id="cards-search-results" style="color:var(--t3);text-align:center;padding:32px;font-size:12px;">
    Search for any Pokemon TCG card above
  </div>

  <!-- Pagination -->
  <div id="cards-search-pagination" style="display:none;display:flex;justify-content:center;gap:8px;margin-top:14px;"></div>
</div>`;
}

async function _doSearch(page = 1) {
  const query = (document.getElementById('cards-search-input') || {}).value || '';
  const setFilter = (document.getElementById('cards-set-filter') || {}).value || '';
  if (!query.trim() && !setFilter.trim()) {
    document.getElementById('cards-search-results').innerHTML = `<div style="color:var(--coral);font-size:12px;text-align:center;padding:16px;">Enter a card name or set to search.</div>`;
    return;
  }
  CARDS_STATE.searchQuery = query.trim();
  CARDS_STATE.searchSet = setFilter.trim();
  CARDS_STATE.searchPage = page;

  const resultsEl = document.getElementById('cards-search-results');
  resultsEl.innerHTML = `<div style="text-align:center;padding:32px;color:var(--gold);">🔍 Searching Pokemon TCG database...</div>`;

  try {
    const params = new URLSearchParams({ page, page_size: 20 });
    if (CARDS_STATE.searchQuery) params.set('query', CARDS_STATE.searchQuery);
    if (CARDS_STATE.searchSet) params.set('set_name', CARDS_STATE.searchSet);

    const data = await _cardsApi('GET', `/api/cards/search?${params}`);
    if (data.error) {
      resultsEl.innerHTML = `<div style="color:var(--coral);text-align:center;padding:20px;">${_esc(data.error)}</div>`;
      return;
    }
    _renderSearchResults(data, resultsEl);
  } catch (e) {
    resultsEl.innerHTML = `<div style="color:var(--coral);text-align:center;padding:20px;">Search failed. Try again.</div>`;
  }
}

function _renderSearchResults(data, container) {
  const cards = data.cards || [];
  if (!cards.length) {
    container.innerHTML = `<div style="color:var(--t3);text-align:center;padding:32px;font-size:12px;">No cards found. Try a different search.</div>`;
    return;
  }

  const html = `
    <div style="font-size:11px;color:var(--t3);margin-bottom:10px;">${data.count || cards.length} results</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;">
      ${cards.map(card => _buildSearchCardHtml(card)).join('')}
    </div>`;
  container.innerHTML = html;

  // Pagination
  const pagination = document.getElementById('cards-search-pagination');
  if (pagination && data.total_pages > 1) {
    pagination.style.display = 'flex';
    let pagHtml = '';
    const cur = CARDS_STATE.searchPage;
    const total = data.total_pages;
    if (cur > 1) pagHtml += `<button onclick="_doSearch(${cur - 1})" style="background:var(--bg2);border:1px solid var(--brd);color:var(--t1);padding:7px 12px;border-radius:var(--r8);font-size:11px;cursor:pointer;">← Prev</button>`;
    pagHtml += `<span style="color:var(--t3);font-size:11px;padding:7px 8px;">Page ${cur} / ${total}</span>`;
    if (cur < total) pagHtml += `<button onclick="_doSearch(${cur + 1})" style="background:var(--bg2);border:1px solid var(--brd);color:var(--t1);padding:7px 12px;border-radius:var(--r8);font-size:11px;cursor:pointer;">Next →</button>`;
    pagination.innerHTML = pagHtml;
  } else if (pagination) {
    pagination.style.display = 'none';
  }
}

function _buildSearchCardHtml(card) {
  const price = card.price?.market ? `$${parseFloat(card.price.market).toFixed(2)}` : 'N/A';
  const img = card.image_small || '';
  return `
    <div onclick="_showCardDetail(${JSON.stringify(card).replace(/"/g, '&quot;')})"
      style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);overflow:hidden;cursor:pointer;transition:all 0.2s;"
      onmouseover="this.style.borderColor='rgba(245,158,11,0.4)';this.style.transform='translateY(-3px)'"
      onmouseout="this.style.borderColor='var(--brd)';this.style.transform='translateY(0)'">
      ${img ? `<img src="${_esc(img)}" style="width:100%;height:130px;object-fit:contain;background:#111;" loading="lazy" />` : `<div style="width:100%;height:130px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:32px;">🃏</div>`}
      <div style="padding:10px;">
        <div style="font-size:11px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(card.name || '')}</div>
        <div style="font-size:9px;color:var(--t3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(card.set || '')}${card.number ? ` #${_esc(card.number)}` : ''}</div>
        ${card.rarity ? `<div style="font-size:9px;color:var(--purple);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(card.rarity)}</div>` : ''}
        <div style="font-size:13px;font-weight:900;color:var(--gold);margin-top:6px;">${price}</div>
      </div>
    </div>`;
}

function _showCardDetail(card) {
  const modal = document.getElementById('cards-detail-modal');
  const price = card.price?.market ? `$${parseFloat(card.price.market).toFixed(2)}` : 'N/A';
  const low = card.price?.low ? `$${parseFloat(card.price.low).toFixed(2)}` : 'N/A';
  const high = card.price?.high ? `$${parseFloat(card.price.high).toFixed(2)}` : 'N/A';
  const img = card.image_large || card.image_small || '';

  const detailHtml = `
    <div id="cards-detail-modal" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:var(--bg2);border:1px solid rgba(245,158,11,0.3);border-radius:16px;max-width:440px;width:100%;max-height:90vh;overflow-y:auto;">
        <div style="padding:16px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:14px;font-weight:900;color:var(--t1);">${_esc(card.name || '')}</div>
          <button onclick="document.getElementById('cards-detail-modal').remove()" style="background:none;border:none;color:var(--t3);font-size:18px;cursor:pointer;padding:0 4px;">×</button>
        </div>
        <div style="padding:16px;">
          ${img ? `<img src="${_esc(img)}" style="max-width:200px;max-height:280px;object-fit:contain;display:block;margin:0 auto 16px;border-radius:8px;" />` : ''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
            ${_detailRow('Set', card.set || '')}
            ${card.number ? _detailRow('Number', `#${card.number}`) : ''}
            ${card.rarity ? _detailRow('Rarity', card.rarity) : ''}
            ${card.hp ? _detailRow('HP', card.hp) : ''}
          </div>
          <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r8);padding:12px;margin-bottom:14px;">
            <div style="font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px;margin-bottom:8px;">MARKET PRICE</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
              <div><div style="font-size:10px;color:var(--t3);">Low</div><div style="font-size:14px;font-weight:700;color:var(--t1);">${low}</div></div>
              <div><div style="font-size:10px;color:var(--t3);">Market</div><div style="font-size:16px;font-weight:900;color:var(--gold);">${price}</div></div>
              <div><div style="font-size:10px;color:var(--t3);">High</div><div style="font-size:14px;font-weight:700;color:var(--t1);">${high}</div></div>
            </div>
          </div>
          <button onclick="_addSearchCardToCollection(${JSON.stringify(card).replace(/"/g, '&quot;')},this)" style="width:100%;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:var(--green);border-radius:var(--r8);padding:11px;font-size:12px;font-weight:700;cursor:pointer;">
            + Add to My Collection
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', detailHtml);
}

function _detailRow(label, val) {
  return `<div style="background:var(--bg3);border-radius:var(--r8);padding:8px 10px;"><div style="font-size:9px;color:var(--t3);margin-bottom:2px;">${label}</div><div style="font-size:11px;font-weight:600;color:var(--t1);">${_esc(String(val))}</div></div>`;
}

async function _addSearchCardToCollection(card, btn) {
  btn.disabled = true;
  btn.textContent = 'Adding...';
  try {
    const res = await _cardsApi('POST', '/api/cards/collection/add', {
      user_id: _getUserId(),
      card_name: card.name || 'Unknown',
      card_set: card.set || '',
      card_number: card.number || '',
      condition: 'NM',
      estimated_value: card.price?.market || 0,
      image_url: card.image_large || card.image_small || '',
    });
    if (res.success) {
      btn.textContent = '✓ Added!';
      btn.style.color = 'var(--green)';
    } else {
      btn.textContent = '+ Add to My Collection';
      btn.disabled = false;
    }
  } catch (e) {
    btn.textContent = '+ Add to My Collection';
    btn.disabled = false;
  }
}

// ── Tab 3: Collection ─────────────────────────────────────────────────────────

async function _loadCollection() {
  const container = document.getElementById('cards-collection-content');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gold);">📁 Loading your collection...</div>`;

  try {
    const userId = _getUserId();
    const data = await _cardsApi('GET', `/api/cards/collection?user_id=${encodeURIComponent(userId)}`);
    _renderCollection(data, container);
  } catch (e) {
    container.innerHTML = `<div style="color:var(--coral);text-align:center;padding:32px;">Failed to load collection.</div>`;
  }
}

function _renderCollection(data, container) {
  const collection = data.collection || [];
  const totalValue = data.total_value || 0;
  const totalCards = data.total_cards || 0;
  const gradedCount = data.graded_count || 0;

  if (!collection.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:48px;margin-bottom:14px;">📦</div>
        <div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:6px;">No cards yet</div>
        <div style="font-size:12px;color:var(--t3);margin-bottom:20px;">Scan your first card to start building your collection</div>
        <button onclick="switchCardsTab('scan')" style="background:var(--gold);border:none;border-radius:var(--r8);padding:11px 24px;color:#000;font-size:12px;font-weight:900;cursor:pointer;">📷 Scan First Card</button>
      </div>`;
    return;
  }

  // Sort/filter controls + summary bar
  let sorted = [...collection];
  const sort = CARDS_STATE.collectionSort;
  if (sort === 'value') sorted.sort((a, b) => (b.estimated_value || 0) - (a.estimated_value || 0));
  else if (sort === 'grade') sorted.sort((a, b) => (b.grade_estimate || 0) - (a.grade_estimate || 0));
  else if (sort === 'set') sorted.sort((a, b) => (a.card_set || '').localeCompare(b.card_set || ''));
  else sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  if (CARDS_STATE.collectionFilter) {
    const f = CARDS_STATE.collectionFilter.toLowerCase();
    sorted = sorted.filter(c =>
      (c.card_name || '').toLowerCase().includes(f) ||
      (c.card_set || '').toLowerCase().includes(f)
    );
  }

  const html = `
    <!-- Summary bar -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
      <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:12px;text-align:center;">
        <div style="font-size:18px;font-weight:900;color:var(--t1);">${totalCards}</div>
        <div style="font-size:9px;color:var(--t3);letter-spacing:1px;margin-top:2px;">TOTAL CARDS</div>
      </div>
      <div style="background:var(--bg2);border:1px solid rgba(245,158,11,0.25);border-radius:var(--r8);padding:12px;text-align:center;">
        <div style="font-size:18px;font-weight:900;color:var(--gold);">$${parseFloat(totalValue).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:9px;color:var(--t3);letter-spacing:1px;margin-top:2px;">EST. VALUE</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:12px;text-align:center;">
        <div style="font-size:18px;font-weight:900;color:var(--purple);">${gradedCount}</div>
        <div style="font-size:9px;color:var(--t3);letter-spacing:1px;margin-top:2px;">GRADED</div>
      </div>
    </div>

    <!-- Sort + Filter -->
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <input id="coll-filter-input" type="text" placeholder="Filter cards..." value="${_esc(CARDS_STATE.collectionFilter)}"
        oninput="CARDS_STATE.collectionFilter=this.value;_loadCollection()"
        style="flex:1;min-width:120px;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:8px 12px;color:var(--t1);font-size:11px;outline:none;" />
      <select onchange="CARDS_STATE.collectionSort=this.value;_loadCollection()" style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:8px 10px;color:var(--t1);font-size:11px;cursor:pointer;outline:none;">
        <option value="date" ${sort==='date'?'selected':''}>Newest First</option>
        <option value="value" ${sort==='value'?'selected':''}>By Value</option>
        <option value="grade" ${sort==='grade'?'selected':''}>By Grade</option>
        <option value="set" ${sort==='set'?'selected':''}>By Set</option>
      </select>
    </div>

    <!-- Card grid -->
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${sorted.map(card => _buildCollectionCardHtml(card)).join('')}
    </div>`;

  container.innerHTML = html;
}

function _buildCollectionCardHtml(card) {
  const val = parseFloat(card.estimated_value || 0);
  const valColor = _valueColor(val);
  const valStr = val > 0 ? `$${val.toFixed(2)}` : 'N/A';
  const cond = card.condition || 'NM';
  const condColor = _conditionColor(cond);
  const grade = card.grade_estimate;
  const gradeColor = grade ? _gradeColor(grade) : '#666';
  const img = card.image_url || '';

  return `
    <div style="display:flex;align-items:center;gap:12px;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r12);padding:12px;transition:border-color 0.2s;" onmouseover="this.style.borderColor='rgba(245,158,11,0.3)'" onmouseout="this.style.borderColor='var(--brd)'">
      ${img ? `<img src="${_esc(img)}" style="width:44px;height:60px;object-fit:contain;border-radius:6px;background:#0d0d0d;flex-shrink:0;" />` : `<div style="width:44px;height:60px;background:var(--bg3);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🃏</div>`}
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(card.card_name || 'Unknown')}</div>
        <div style="font-size:10px;color:var(--t3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(card.card_set || '')}${card.card_number ? ` · #${_esc(card.card_number)}` : ''}</div>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
          <span style="background:${condColor}18;border:1px solid ${condColor}40;color:${condColor};padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">${_esc(cond)}</span>
          ${grade ? `<span style="background:${gradeColor}18;border:1px solid ${gradeColor}40;color:${gradeColor};padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">Grade ${grade}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:14px;font-weight:900;color:${valColor};">${valStr}</div>
        <button onclick="_removeFromCollection('${_esc(card.id)}', this)" style="margin-top:6px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.2);color:var(--coral);border-radius:var(--r4);padding:3px 8px;font-size:9px;font-weight:700;cursor:pointer;">Remove</button>
      </div>
    </div>`;
}

async function _removeFromCollection(cardId, btn) {
  if (!confirm('Remove this card from your collection?')) return;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const userId = _getUserId();
    await _cardsApi('DELETE', `/api/cards/collection/${encodeURIComponent(cardId)}?user_id=${encodeURIComponent(userId)}`);
    _loadCollection();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Remove';
  }
}

// ── Tab 4: Trending ───────────────────────────────────────────────────────────

async function _loadTrending() {
  const container = document.getElementById('cards-trending-content');
  if (!container) return;
  CARDS_STATE.trendingLoaded = true;
  container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gold);">📈 Loading market data...</div>`;

  try {
    const [trendData, dealsData] = await Promise.all([
      _cardsApi('GET', '/api/cards/market/trending'),
      _cardsApi('GET', '/api/cards/deals'),
    ]);
    _renderTrending(trendData, dealsData, container);
  } catch (e) {
    container.innerHTML = `<div style="color:var(--coral);text-align:center;padding:32px;">Failed to load market data.</div>`;
  }
}

function _renderTrending(trendData, dealsData, container) {
  const trending = trendData.trending || [];
  const anniversary = trendData.anniversary_spotlight || [];
  const deals = dealsData.deals || [];

  // 30th anniversary banner
  let anniversaryHtml = '';
  if (anniversary.length) {
    anniversaryHtml = `
      <div style="background:linear-gradient(135deg,rgba(26,5,51,0.9),rgba(13,26,74,0.9));border:1px solid rgba(245,158,11,0.35);border-radius:var(--r12);padding:16px;margin-bottom:16px;">
        <div style="font-size:10px;font-weight:900;color:var(--gold);letter-spacing:2px;margin-bottom:12px;">🎉 30TH ANNIVERSARY SPOTLIGHT</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">
          ${anniversary.map(c => `
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:var(--r8);padding:10px;transition:all 0.2s;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size:11px;font-weight:700;color:var(--t1);margin-bottom:2px;">${_esc(c.name || '')}</div>
              <div style="font-size:9px;color:var(--t3);margin-bottom:6px;">${_esc(c.set || '')} · ${_esc(c.grade || '')}</div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="font-size:12px;font-weight:900;color:var(--green);">$${(c.value || 0).toLocaleString()}</div>
                <div style="font-size:9px;font-weight:700;color:${(c.change_pct || 0) >= 0 ? 'var(--green)' : 'var(--coral)'};">${(c.change_pct || 0) >= 0 ? '▲' : '▼'} ${Math.abs(c.change_pct || 0)}%</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // Trending cards
  let trendingHtml = '';
  if (trending.length) {
    trendingHtml = `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:900;color:var(--t1);">📈 Trending Now</div>
          <button onclick="CARDS_STATE.trendingLoaded=false;_loadTrending()" style="background:none;border:1px solid var(--brd);color:var(--t3);border-radius:var(--r4);padding:4px 10px;font-size:10px;cursor:pointer;">↻ Refresh</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${trending.map(card => {
            const price = card.market_price > 0 ? `$${parseFloat(card.market_price).toFixed(2)}` : 'N/A';
            const chg = card.change_pct || 0;
            const chgColor = chg >= 0 ? 'var(--green)' : 'var(--coral)';
            return `
              <div style="display:flex;align-items:center;gap:10px;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r8);padding:10px 12px;">
                ${card.image ? `<img src="${_esc(card.image)}" style="width:36px;height:48px;object-fit:contain;border-radius:4px;flex-shrink:0;" />` : `<div style="width:36px;height:48px;background:var(--bg3);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🃏</div>`}
                <div style="flex:1;min-width:0;">
                  <div style="font-size:12px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(card.name || '')}</div>
                  <div style="font-size:10px;color:var(--t3);">${_esc(card.set || '')}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:13px;font-weight:900;color:var(--gold);">${price}</div>
                  <div style="font-size:10px;font-weight:700;color:${chgColor};">${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg)}%</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Hidden Gems / Deals
  let dealsHtml = '';
  if (deals.length) {
    dealsHtml = `
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:900;color:var(--t1);">💎 Hidden Gems</div>
          <span style="background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.3);color:var(--coral);padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">BELOW MARKET</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${deals.slice(0, 6).map(deal => `
            <div style="background:var(--bg2);border:1px solid rgba(0,255,136,0.15);border-radius:var(--r8);padding:10px 12px;display:flex;align-items:center;gap:10px;">
              ${deal.image ? `<img src="${_esc(deal.image)}" style="width:36px;height:48px;object-fit:contain;border-radius:4px;flex-shrink:0;" />` : `<div style="width:36px;height:48px;background:var(--bg3);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🃏</div>`}
              <div style="flex:1;min-width:0;">
                <div style="font-size:11px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(deal.name || '')}</div>
                <div style="font-size:9px;color:var(--t3);">${_esc(deal.set || '')}</div>
                <div style="font-size:9px;color:var(--t3);margin-top:2px;">${_esc(deal.why || '')}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:11px;font-weight:900;color:var(--green);">$${parseFloat(deal.deal_price || 0).toFixed(2)}</div>
                <div style="font-size:9px;color:var(--t3);text-decoration:line-through;">$${parseFloat(deal.market_price || 0).toFixed(2)}</div>
                <div style="font-size:10px;font-weight:700;color:var(--coral);">${deal.discount_pct}% off</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  container.innerHTML = `
    ${anniversaryHtml}
    ${trendingHtml}
    ${dealsHtml}
    ${!trending.length && !deals.length ? '<div style="color:var(--t3);text-align:center;padding:32px;font-size:12px;">Market data unavailable. Check back soon.</div>' : ''}
  `;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _esc(str) {
  if (typeof str !== 'string') str = String(str || '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
