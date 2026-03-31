/**
 * SaintSal™ Labs — Creative Studio
 * Content generation, image generation, social publishing, content calendar.
 * Saint Vision Technologies LLC | US Patent #10,290,222 (HACP™)
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

const creative = {
  activeTab: 'content',
  generatedContent: {},       // { platform: text } — shared between Tab 1 & Tab 3
  lastImagePrompt: '',        // for "Use in content" button
  lastImageUrl: '',           // for display
  calendar: null,             // full calendar object from API
  selectedDay: null,          // currently expanded calendar day
  brandProfiles: [],          // cached brand profiles
  activeBrandProfile: null,   // selected profile ID
};

// Platform char limits and optimal lengths
const PLATFORM_LIMITS = {
  linkedin:  { limit: 3000, optimal: 175,  warn: 2700 },
  twitter:   { limit: 280,  optimal: 220,  warn: 260  },
  instagram: { limit: 2200, optimal: 125,  warn: 2000 },
  facebook:  { limit: 5000, optimal: 125,  warn: 4500 },
  tiktok:    { limit: 2200, optimal: 100,  warn: 150  },
  youtube:   { limit: 5000, optimal: 400,  warn: 4500 },
};

const PLATFORM_META = {
  linkedin:  { label: 'LinkedIn',  color: '#0077b5', icon: 'in' },
  twitter:   { label: 'X',         color: '#000',    icon: 'X'  },
  instagram: { label: 'Instagram', color: '#e1306c', icon: 'ig' },
  facebook:  { label: 'Facebook',  color: '#1877f2', icon: 'fb' },
  tiktok:    { label: 'TikTok',    color: '#010101', icon: 'tt' },
  youtube:   { label: 'YouTube',   color: '#ff0000', icon: 'yt' },
};

// ── Init ──────────────────────────────────────────────────────────────────────

function initCreative() {
  renderCreativeShell();
  switchCreativeTab('content');
  loadSocialPlatformStatus();
}

// ── Shell HTML ────────────────────────────────────────────────────────────────

function renderCreativeShell() {
  const page = document.getElementById('page-creative');
  if (!page || page.dataset.creativeInit) return;
  page.dataset.creativeInit = '1';

  page.innerHTML = `
    <div class="creative-wrap">
      <!-- Tab Bar -->
      <div class="creative-tabs">
        <button class="tab active" data-tab="content" onclick="switchCreativeTab('content')">
          <span class="tab-icon">✦</span> Content Generator
        </button>
        <button class="tab" data-tab="image" onclick="switchCreativeTab('image')">
          <span class="tab-icon">◈</span> Image Generator
        </button>
        <button class="tab" data-tab="publish" onclick="switchCreativeTab('publish')">
          <span class="tab-icon">◉</span> Social Publisher
        </button>
        <button class="tab" data-tab="calendar" onclick="switchCreativeTab('calendar')">
          <span class="tab-icon">▦</span> Content Calendar
        </button>
      </div>

      <!-- Tab Panels -->
      <div id="creative-panel-content"  class="tab-panel active">${buildContentPanel()}</div>
      <div id="creative-panel-image"    class="tab-panel">${buildImagePanel()}</div>
      <div id="creative-panel-publish"  class="tab-panel">${buildPublishPanel()}</div>
      <div id="creative-panel-calendar" class="tab-panel">${buildCalendarPanel()}</div>
    </div>

    <style>
      .creative-wrap { display:flex; flex-direction:column; gap:0; height:100%; min-height:0; }

      /* Tab bar */
      .creative-tabs {
        display:flex; gap:2px; padding:0 24px;
        border-bottom:1px solid var(--brd);
        background:var(--bg2); flex-shrink:0;
      }
      .creative-tabs .tab {
        background:none; border:none; border-bottom:2px solid transparent;
        color:var(--t2); font-size:13px; font-weight:500; cursor:pointer;
        padding:14px 18px; display:flex; align-items:center; gap:6px;
        transition:color 0.15s, border-color 0.15s;
        font-family:var(--font);
      }
      .creative-tabs .tab:hover { color:var(--t1); }
      .creative-tabs .tab.active { color:var(--gold); border-bottom-color:var(--gold); }
      .tab-icon { font-size:14px; }

      /* Panels */
      .tab-panel { display:none; padding:28px 24px; overflow-y:auto; flex:1; }
      .tab-panel.active { display:block; }

      /* Two-column layout */
      .creative-cols { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
      @media (max-width:900px) { .creative-cols { grid-template-columns:1fr; } }

      /* Section cards */
      .c-card {
        background:var(--bg2); border:1px solid var(--brd); border-radius:var(--r12);
        padding:20px;
      }
      .c-card-title {
        font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
        color:var(--t2); margin-bottom:16px;
      }

      /* Form elements */
      .c-label { font-size:12px; color:var(--t2); margin-bottom:6px; display:block; font-weight:500; }
      .c-input, .c-select, .c-textarea {
        width:100%; background:var(--bg3); border:1px solid var(--brd); border-radius:var(--r8);
        color:var(--t1); font-size:13px; font-family:var(--font); box-sizing:border-box;
        transition:border-color 0.15s;
      }
      .c-input, .c-select { padding:9px 12px; height:38px; }
      .c-select { cursor:pointer; }
      .c-textarea { padding:10px 12px; resize:vertical; min-height:80px; line-height:1.5; }
      .c-input:focus, .c-select:focus, .c-textarea:focus {
        outline:none; border-color:var(--gold); box-shadow:0 0 0 2px rgba(245,158,11,0.1);
      }
      .c-field { margin-bottom:16px; }

      /* Platform checkboxes */
      .platform-grid {
        display:flex; flex-wrap:wrap; gap:8px;
      }
      .platform-check {
        display:flex; align-items:center; gap:6px;
        background:var(--bg3); border:1px solid var(--brd); border-radius:var(--r8);
        padding:6px 10px; cursor:pointer; user-select:none; transition:all 0.15s;
        font-size:12px; color:var(--t2); font-weight:500;
      }
      .platform-check:hover { border-color:var(--gold); color:var(--t1); }
      .platform-check.selected { border-color:var(--gold); color:var(--gold); background:rgba(245,158,11,0.08); }
      .platform-check input { display:none; }
      .plat-dot { width:6px; height:6px; border-radius:50%; }

      /* Toggles + checkboxes */
      .c-toggle-row { display:flex; align-items:center; gap:10px; cursor:pointer; }
      .c-toggle { position:relative; width:36px; height:20px; flex-shrink:0; }
      .c-toggle input { opacity:0; width:0; height:0; }
      .c-toggle-slider {
        position:absolute; inset:0; background:var(--bg3); border:1px solid var(--brd);
        border-radius:20px; transition:0.2s;
      }
      .c-toggle-slider:before {
        content:''; position:absolute; width:14px; height:14px; left:2px; top:2px;
        background:var(--t3); border-radius:50%; transition:0.2s;
      }
      .c-toggle input:checked + .c-toggle-slider { background:rgba(245,158,11,0.3); border-color:var(--gold); }
      .c-toggle input:checked + .c-toggle-slider:before { transform:translateX(16px); background:var(--gold); }

      /* Buttons */
      .btn-primary {
        background:var(--gold); color:#000; border:none; border-radius:var(--r8);
        font-size:13px; font-weight:700; cursor:pointer; padding:10px 20px;
        font-family:var(--font); transition:opacity 0.15s; letter-spacing:0.02em;
        display:inline-flex; align-items:center; gap:8px;
      }
      .btn-primary:hover { opacity:0.9; }
      .btn-primary:disabled { opacity:0.4; cursor:not-allowed; }
      .btn-ghost {
        background:none; border:1px solid var(--brd); color:var(--t2); border-radius:var(--r8);
        font-size:12px; cursor:pointer; padding:7px 14px; font-family:var(--font);
        transition:all 0.15s;
      }
      .btn-ghost:hover { border-color:var(--gold); color:var(--gold); }
      .btn-gold {
        background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); color:var(--gold);
        border-radius:var(--r8); font-size:12px; cursor:pointer; padding:7px 14px;
        font-family:var(--font); transition:all 0.15s; font-weight:600;
      }
      .btn-gold:hover { background:rgba(245,158,11,0.25); }

      /* Results area */
      .result-platform-card {
        background:var(--bg3); border:1px solid var(--brd); border-radius:var(--r8);
        padding:16px; margin-bottom:12px;
      }
      .result-platform-header {
        display:flex; align-items:center; justify-content:space-between;
        margin-bottom:10px;
      }
      .result-platform-label {
        display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700;
        text-transform:uppercase; letter-spacing:0.06em;
      }
      .result-platform-dot { width:8px; height:8px; border-radius:50%; }
      .result-content-text {
        font-size:13px; color:var(--t1); line-height:1.6; white-space:pre-wrap;
        word-break:break-word;
      }
      .result-footer { display:flex; align-items:center; justify-content:space-between; margin-top:10px; }
      .char-count { font-size:11px; font-weight:600; }
      .char-count.good { color:var(--green); }
      .char-count.close { color:var(--amber); }
      .char-count.over { color:var(--coral); }

      /* Image result */
      .image-result {
        background:var(--bg3); border:1px solid var(--brd); border-radius:var(--r12);
        overflow:hidden; margin-top:20px;
      }
      .image-result img { width:100%; display:block; border-radius:var(--r8); }
      .image-result-actions { padding:12px 16px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }

      /* Social Publisher */
      .pub-status-grid { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
      .pub-status-badge {
        display:flex; align-items:center; gap:6px;
        background:var(--bg3); border:1px solid var(--brd); border-radius:20px;
        padding:4px 12px; font-size:11px; font-weight:600;
      }
      .pub-status-dot { width:6px; height:6px; border-radius:50%; }
      .status-connected { background:var(--green); }
      .status-pending { background:var(--amber); }
      .status-offline { background:var(--t3); }
      .pub-post-result {
        background:var(--bg3); border:1px solid var(--brd); border-radius:var(--r8);
        padding:12px 16px; margin-top:12px;
      }
      .pub-result-row { display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:6px; }
      .pub-result-row:last-child { margin-bottom:0; }

      /* Calendar */
      .calendar-grid-wrap { overflow-x:auto; }
      .calendar-month {
        display:grid; grid-template-columns:repeat(7,1fr); gap:1px;
        background:var(--brd); border:1px solid var(--brd); border-radius:var(--r8);
        overflow:hidden; min-width:700px;
      }
      .cal-day-header {
        background:var(--bg2); padding:8px; text-align:center;
        font-size:11px; font-weight:700; letter-spacing:0.06em; color:var(--t2);
        text-transform:uppercase;
      }
      .cal-day {
        background:var(--bg2); min-height:90px; padding:8px; cursor:pointer;
        transition:background 0.15s; position:relative;
      }
      .cal-day:hover { background:var(--bg3); }
      .cal-day.has-posts { border-top:2px solid var(--gold); }
      .cal-day.empty { background:var(--bg); opacity:0.5; cursor:default; }
      .cal-day.selected { background:rgba(245,158,11,0.08); }
      .cal-date { font-size:11px; font-weight:700; color:var(--t2); margin-bottom:6px; }
      .cal-post-chips { display:flex; flex-wrap:wrap; gap:3px; }
      .cal-chip {
        font-size:10px; padding:2px 6px; border-radius:10px; font-weight:600;
        background:rgba(245,158,11,0.15); color:var(--gold); border:1px solid rgba(245,158,11,0.3);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;
      }
      .cal-day-detail {
        background:var(--bg2); border:1px solid var(--brd); border-radius:var(--r12);
        padding:20px; margin-top:20px;
      }
      .cal-day-detail-title { font-size:14px; font-weight:700; margin-bottom:16px; color:var(--t1); }
      .cal-post-item {
        background:var(--bg3); border:1px solid var(--brd); border-radius:var(--r8);
        padding:14px; margin-bottom:10px;
      }
      .cal-post-meta { display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; }
      .cal-post-platform { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; }
      .cal-post-type { font-size:11px; color:var(--t2); }
      .cal-post-time { font-size:11px; color:var(--blue); margin-left:auto; }
      .cal-post-topic { font-size:13px; color:var(--t1); margin-bottom:8px; }

      /* Loading spinner */
      .spin {
        display:inline-block; width:14px; height:14px; border:2px solid rgba(0,0,0,0.3);
        border-top-color:#000; border-radius:50%; animation:spin 0.6s linear infinite;
      }
      .spin-gold {
        border:2px solid rgba(245,158,11,0.2); border-top-color:var(--gold);
        animation:spin 0.6s linear infinite;
      }
      @keyframes spin { to { transform:rotate(360deg); } }

      /* Pull from content button */
      .pull-btn {
        background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.3);
        color:var(--blue); border-radius:var(--r8); font-size:12px; cursor:pointer;
        padding:7px 14px; font-family:var(--font); font-weight:600; transition:all 0.15s;
      }
      .pull-btn:hover { background:rgba(96,165,250,0.2); }

      /* Aspect ratio selector */
      .ratio-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
      .ratio-btn {
        background:var(--bg3); border:1px solid var(--brd); border-radius:var(--r8);
        color:var(--t2); font-size:11px; cursor:pointer; padding:8px 6px;
        text-align:center; transition:all 0.15s; font-family:var(--font); font-weight:600;
      }
      .ratio-btn:hover { border-color:var(--gold); color:var(--gold); }
      .ratio-btn.active { border-color:var(--gold); color:var(--gold); background:rgba(245,158,11,0.08); }
      .ratio-icon { font-size:16px; display:block; margin-bottom:3px; }

      /* Style selector */
      .style-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
      .style-btn {
        background:var(--bg3); border:1px solid var(--brd); border-radius:var(--r8);
        color:var(--t2); font-size:12px; cursor:pointer; padding:10px;
        text-align:left; transition:all 0.15s; font-family:var(--font); font-weight:500;
      }
      .style-btn:hover { border-color:var(--purple); color:var(--t1); }
      .style-btn.active { border-color:var(--purple); color:var(--purple); background:rgba(167,139,250,0.08); }

      /* Seo checkbox row */
      .seo-row { display:flex; align-items:center; gap:10px; }
      .seo-check { width:16px; height:16px; cursor:pointer; accent-color:var(--gold); }
    </style>
  `;
}

// ── Tab Content Builders ──────────────────────────────────────────────────────

function buildContentPanel() {
  return `
    <div class="creative-cols">
      <!-- LEFT: Controls -->
      <div>
        <div class="c-card">
          <div class="c-card-title">Platform Selection</div>
          <div class="platform-grid" id="content-platform-grid">
            ${Object.entries(PLATFORM_META).map(([id, m]) => `
              <label class="platform-check ${id === 'linkedin' ? 'selected' : ''}" data-platform="${id}">
                <input type="checkbox" value="${id}" ${id === 'linkedin' ? 'checked' : ''}
                  onchange="togglePlatformCheck(this, 'content')">
                <span class="plat-dot" style="background:${m.color}"></span>
                ${m.label}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="c-card" style="margin-top:16px">
          <div class="c-card-title">Content Settings</div>

          <div class="c-field">
            <label class="c-label">Content Type</label>
            <select class="c-select" id="content-type-select">
              <option value="caption">Caption</option>
              <option value="blog post">Blog Post</option>
              <option value="email">Email</option>
              <option value="ad copy">Ad Copy</option>
              <option value="carousel">Carousel Script</option>
              <option value="thread">Thread (X)</option>
            </select>
          </div>

          <div class="c-field">
            <label class="c-label">What's this content about?</label>
            <textarea class="c-textarea" id="content-prompt" rows="4"
              placeholder="e.g. Our AI automation suite just hit 10,000 users. Announce it with authority."
              style="min-height:100px"></textarea>
          </div>

          <div class="c-field">
            <label class="c-label">Brand Voice</label>
            <select class="c-select" id="content-voice-select">
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="technical">Technical</option>
            </select>
          </div>

          <div class="c-field">
            <div class="seo-row">
              <input type="checkbox" class="seo-check" id="content-seo-check">
              <label for="content-seo-check" style="font-size:13px;color:var(--t1);cursor:pointer">
                SEO Mode — optimize for search keywords
              </label>
            </div>
          </div>

          <button class="btn-primary" id="content-generate-btn" onclick="generateContent()"
            style="width:100%;justify-content:center">
            Generate Content
          </button>
        </div>
      </div>

      <!-- RIGHT: Results -->
      <div>
        <div class="c-card">
          <div class="c-card-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Generated Content</span>
            <span id="content-results-meta" style="color:var(--t3);font-size:11px;text-transform:none;font-weight:400"></span>
          </div>
          <div id="content-results-area">
            <div style="text-align:center;padding:40px 20px;color:var(--t3);font-size:13px">
              Select platforms, write a prompt, and click Generate.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildImagePanel() {
  return `
    <div class="creative-cols">
      <!-- LEFT: Controls -->
      <div>
        <div class="c-card">
          <div class="c-card-title">Image Prompt</div>
          <div class="c-field">
            <textarea class="c-textarea" id="image-prompt" rows="4"
              placeholder="A confident entrepreneur in a modern office, golden light, professional atmosphere, Goldman Sachs energy..."
              style="min-height:100px"></textarea>
          </div>

          <div class="c-card-title" style="margin-top:16px">Style</div>
          <div class="style-grid" id="image-style-grid">
            <button class="style-btn active" data-style="photorealistic" onclick="selectImageStyle(this)">
              <strong>Photorealistic</strong><br>
              <span style="font-size:11px;color:var(--t3)">DALL-E 3 · HD</span>
            </button>
            <button class="style-btn" data-style="artistic" onclick="selectImageStyle(this)">
              <strong>Artistic</strong><br>
              <span style="font-size:11px;color:var(--t3)">SDXL · Creative</span>
            </button>
            <button class="style-btn" data-style="ui_marketing" onclick="selectImageStyle(this)">
              <strong>UI / Marketing</strong><br>
              <span style="font-size:11px;color:var(--t3)">Imagen 3 → DALL-E</span>
            </button>
            <button class="style-btn" data-style="product" onclick="selectImageStyle(this)">
              <strong>Product</strong><br>
              <span style="font-size:11px;color:var(--t3)">DALL-E 3 · Clean</span>
            </button>
          </div>

          <div class="c-card-title" style="margin-top:20px">Aspect Ratio</div>
          <div class="ratio-grid" id="image-ratio-grid">
            <button class="ratio-btn active" data-ratio="square" onclick="selectAspectRatio(this)">
              <span class="ratio-icon">◼</span>Square
            </button>
            <button class="ratio-btn" data-ratio="portrait" onclick="selectAspectRatio(this)">
              <span class="ratio-icon">▮</span>Portrait
            </button>
            <button class="ratio-btn" data-ratio="landscape" onclick="selectAspectRatio(this)">
              <span class="ratio-icon">▬</span>Landscape
            </button>
            <button class="ratio-btn" data-ratio="wide" onclick="selectAspectRatio(this)">
              <span class="ratio-icon">⬛</span>Wide
            </button>
          </div>

          <button class="btn-primary" id="image-generate-btn" onclick="generateImage()"
            style="width:100%;justify-content:center;margin-top:20px">
            Generate Image
          </button>
        </div>
      </div>

      <!-- RIGHT: Result -->
      <div>
        <div class="c-card">
          <div class="c-card-title">Generated Image</div>
          <div id="image-result-area">
            <div style="text-align:center;padding:60px 20px;color:var(--t3);font-size:13px;
              border:1px dashed var(--brd);border-radius:var(--r8)">
              Your generated image will appear here.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildPublishPanel() {
  return `
    <div class="creative-cols">
      <!-- LEFT: Compose & Settings -->
      <div>
        <div class="c-card">
          <div class="c-card-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Post Content</span>
            <button class="pull-btn" onclick="pullContentToPublisher()">Pull from Generator</button>
          </div>

          <div class="c-field">
            <textarea class="c-textarea" id="pub-content" rows="6"
              placeholder="Write your post here, or pull content from the Content Generator..."
              style="min-height:140px"></textarea>
            <div style="text-align:right;margin-top:4px;font-size:11px;color:var(--t3)" id="pub-char-count">0 chars</div>
          </div>

          <div class="c-field">
            <label class="c-label">Image URL (optional)</label>
            <input type="url" class="c-input" id="pub-image-url" placeholder="https://...">
          </div>

          <div class="c-field">
            <label class="c-label">Platforms</label>
            <div class="platform-grid" id="pub-platform-grid">
              ${Object.entries(PLATFORM_META).map(([id, m]) => `
                <label class="platform-check ${id === 'linkedin' ? 'selected' : ''}" data-platform="${id}">
                  <input type="checkbox" value="${id}" ${id === 'linkedin' ? 'checked' : ''}
                    onchange="togglePlatformCheck(this, 'pub')">
                  <span class="plat-dot" style="background:${m.color}"></span>
                  ${m.label}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="c-field">
            <div class="c-toggle-row" onclick="toggleSchedule()">
              <label class="c-toggle">
                <input type="checkbox" id="pub-schedule-toggle">
                <span class="c-toggle-slider"></span>
              </label>
              <span style="font-size:13px;color:var(--t1)">Schedule Post</span>
            </div>
            <div id="pub-schedule-picker" style="display:none;margin-top:12px">
              <label class="c-label">Schedule Date & Time</label>
              <input type="datetime-local" class="c-input" id="pub-schedule-time">
            </div>
          </div>

          <button class="btn-primary" id="pub-post-btn" onclick="publishPost()"
            style="width:100%;justify-content:center">
            Post Now
          </button>
        </div>
      </div>

      <!-- RIGHT: Platform Status + Results -->
      <div>
        <div class="c-card">
          <div class="c-card-title">Platform Status</div>
          <div id="pub-platform-status">
            <div style="text-align:center;padding:20px;color:var(--t3);font-size:12px">
              <span class="spin-gold" style="display:inline-block;width:16px;height:16px;border-radius:50%;
                border:2px solid rgba(245,158,11,0.2);border-top-color:var(--gold);
                animation:spin 0.7s linear infinite"></span>
            </div>
          </div>
        </div>

        <div class="c-card" style="margin-top:16px">
          <div class="c-card-title">Post Results</div>
          <div id="pub-results-area">
            <div style="color:var(--t3);font-size:12px;text-align:center;padding:20px">
              Results will appear here after posting.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildCalendarPanel() {
  return `
    <div class="creative-cols">
      <!-- LEFT: Calendar Generator -->
      <div>
        <div class="c-card">
          <div class="c-card-title">Generate Content Calendar</div>

          <div class="c-field">
            <label class="c-label">Business Description</label>
            <textarea class="c-textarea" id="cal-business-desc" rows="3"
              placeholder="SaintSal™ Labs — AI platform for commercial lending, automation, and investment intelligence. US Patent #10,290,222."></textarea>
          </div>

          <div class="c-field">
            <label class="c-label">Marketing Goals (optional)</label>
            <textarea class="c-textarea" id="cal-goals" rows="2"
              placeholder="Drive leads for commercial lending. Build brand authority in AI automation."></textarea>
          </div>

          <div class="c-field">
            <label class="c-label">Target Platforms</label>
            <div class="platform-grid" id="cal-platform-grid">
              ${Object.entries(PLATFORM_META).map(([id, m]) => `
                <label class="platform-check ${['linkedin','twitter','instagram'].includes(id) ? 'selected' : ''}"
                  data-platform="${id}">
                  <input type="checkbox" value="${id}"
                    ${['linkedin','twitter','instagram'].includes(id) ? 'checked' : ''}
                    onchange="togglePlatformCheck(this, 'cal')">
                  <span class="plat-dot" style="background:${m.color}"></span>
                  ${m.label}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="c-field">
            <label class="c-label">Duration</label>
            <select class="c-select" id="cal-duration">
              <option value="30">30 Days</option>
              <option value="60">60 Days</option>
              <option value="90">90 Days</option>
            </select>
          </div>

          <button class="btn-primary" id="cal-generate-btn" onclick="generateCalendar()"
            style="width:100%;justify-content:center;margin-bottom:12px">
            Generate Calendar
          </button>

          <button class="btn-ghost" id="cal-batch-btn" onclick="batchGenerateWeek()"
            style="width:100%;justify-content:center" disabled>
            Generate This Week's Posts
          </button>
        </div>

        <div id="cal-status-card" style="display:none" class="c-card" style="margin-top:16px">
          <div id="cal-status-text" style="color:var(--t2);font-size:13px"></div>
        </div>
      </div>

      <!-- RIGHT: Calendar View -->
      <div>
        <div id="cal-view-area">
          <div class="c-card">
            <div style="text-align:center;padding:60px 20px;color:var(--t3);font-size:13px">
              Generate a calendar to see your content plan here.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Tab Switching ─────────────────────────────────────────────────────────────

function switchCreativeTab(tab) {
  creative.activeTab = tab;

  // Update tab buttons
  document.querySelectorAll('.creative-tabs .tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const target = document.getElementById(`creative-panel-${tab}`);
  if (target) target.classList.add('active');

  // Lazy setup
  if (tab === 'publish') {
    const ta = document.getElementById('pub-content');
    if (ta) ta.addEventListener('input', updatePubCharCount);
  }
}

// ── Platform Checkbox Toggle ──────────────────────────────────────────────────

function togglePlatformCheck(checkbox, context) {
  const label = checkbox.closest('.platform-check');
  if (label) label.classList.toggle('selected', checkbox.checked);
}

function getSelectedPlatforms(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return [];
  return Array.from(grid.querySelectorAll('input[type=checkbox]:checked')).map(el => el.value);
}

// ── Tab 1: Content Generator ──────────────────────────────────────────────────

async function generateContent() {
  const prompt = document.getElementById('content-prompt')?.value?.trim();
  if (!prompt) { showToast('Enter a content prompt first', 'error'); return; }

  const platforms  = getSelectedPlatforms('content-platform-grid');
  if (!platforms.length) { showToast('Select at least one platform', 'error'); return; }

  const contentType = document.getElementById('content-type-select')?.value || 'caption';
  const voice       = document.getElementById('content-voice-select')?.value || 'professional';
  const seoMode     = document.getElementById('content-seo-check')?.checked || false;

  const btn = document.getElementById('content-generate-btn');
  const resultsArea = document.getElementById('content-results-area');
  const metaEl = document.getElementById('content-results-meta');

  setButtonLoading(btn, true, 'Generating...');
  resultsArea.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:20px;color:var(--t2);font-size:13px">
      <span class="spin-gold" style="display:inline-block;width:16px;height:16px;border-radius:50%;
        border:2px solid rgba(245,158,11,0.2);border-top-color:var(--gold);animation:spin 0.7s linear infinite"></span>
      Generating content for ${platforms.length} platform${platforms.length > 1 ? 's' : ''}...
    </div>`;

  try {
    const data = await apiPost('/api/creative/generate', {
      prompt,
      platforms,
      type: contentType,
      brand_voice: voice,
      seo_mode: seoMode,
    });

    const versions = data.platform_versions || {};
    const charCounts = data.char_counts || {};

    creative.generatedContent = versions;

    if (!Object.keys(versions).length) {
      resultsArea.innerHTML = '<div style="color:var(--coral);padding:20px;font-size:13px">No content returned. Try again.</div>';
      return;
    }

    metaEl.textContent = `${platforms.length} version${platforms.length > 1 ? 's' : ''} · ${contentType}`;

    resultsArea.innerHTML = Object.entries(versions).map(([platform, content]) => {
      const meta = PLATFORM_META[platform] || { label: platform, color: '#999' };
      const cc = charCounts[platform] || {};
      const count = cc.count || content.length;
      const limit = cc.limit || PLATFORM_LIMITS[platform]?.limit || 9999;
      const status = cc.status || getCharStatus(count, platform);
      return buildResultCard(platform, meta, content, count, limit, status);
    }).join('');

    showToast(`Content generated for ${platforms.length} platform${platforms.length > 1 ? 's' : ''}`, 'success');
  } catch (e) {
    resultsArea.innerHTML = `<div style="color:var(--coral);padding:20px;font-size:13px">Error: ${escapeHTML(e.message)}</div>`;
    showToast(e.message || 'Generation failed', 'error');
  } finally {
    setButtonLoading(btn, false, 'Generate Content');
  }
}

function buildResultCard(platform, meta, content, count, limit, status) {
  const escaped = escapeHTML(content);
  const cardId = `result-content-${platform}`;
  return `
    <div class="result-platform-card">
      <div class="result-platform-header">
        <div class="result-platform-label">
          <span class="result-platform-dot" style="background:${meta.color}"></span>
          ${meta.label}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-ghost" style="padding:5px 10px;font-size:11px"
            onclick="copyToClipboard('${cardId}', this)">Copy</button>
          <button class="btn-ghost" style="padding:5px 10px;font-size:11px"
            onclick="pullToPlatformPublisher('${platform}')">→ Publish</button>
        </div>
      </div>
      <div class="result-content-text" id="${cardId}">${escaped}</div>
      <div class="result-footer">
        <span class="char-count ${status}">${count.toLocaleString()} / ${limit.toLocaleString()} chars</span>
        <span style="font-size:11px;color:var(--t3)">${status === 'good' ? '✓ Good length' : status === 'close' ? '⚠ Near limit' : '✗ Over limit'}</span>
      </div>
    </div>
  `;
}

function getCharStatus(count, platform) {
  const limits = PLATFORM_LIMITS[platform];
  if (!limits) return 'good';
  if (count > limits.limit) return 'over';
  if (count > limits.warn) return 'close';
  return 'good';
}

function copyToClipboard(elementId, btn) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'var(--green)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; btn.style.borderColor = ''; }, 1500);
  }).catch(() => showToast('Copy failed', 'error'));
}

function pullToPlatformPublisher(platform) {
  const content = creative.generatedContent[platform];
  if (!content) return;
  const ta = document.getElementById('pub-content');
  if (ta) {
    ta.value = content;
    updatePubCharCount();
  }
  // Check the matching platform checkbox in publisher
  const grid = document.getElementById('pub-platform-grid');
  if (grid) {
    const cb = grid.querySelector(`input[value="${platform}"]`);
    if (cb) {
      cb.checked = true;
      const label = cb.closest('.platform-check');
      if (label) label.classList.add('selected');
    }
  }
  switchCreativeTab('publish');
  showToast(`${PLATFORM_META[platform]?.label || platform} content loaded`, 'success');
}

// ── Tab 2: Image Generator ────────────────────────────────────────────────────

function selectImageStyle(btn) {
  document.querySelectorAll('#image-style-grid .style-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function selectAspectRatio(btn) {
  document.querySelectorAll('#image-ratio-grid .ratio-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function generateImage() {
  const prompt = document.getElementById('image-prompt')?.value?.trim();
  if (!prompt) { showToast('Enter an image prompt', 'error'); return; }

  const styleBtn = document.querySelector('#image-style-grid .style-btn.active');
  const ratioBtn = document.querySelector('#image-ratio-grid .ratio-btn.active');
  const style    = styleBtn?.dataset?.style || 'photorealistic';
  const ratio    = ratioBtn?.dataset?.ratio || 'square';

  const btn = document.getElementById('image-generate-btn');
  const resultArea = document.getElementById('image-result-area');

  setButtonLoading(btn, true, 'Generating...');
  resultArea.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:14px;padding:60px 20px;border:1px dashed var(--brd);border-radius:var(--r8)">
      <span class="spin-gold" style="display:inline-block;width:28px;height:28px;border-radius:50%;
        border:3px solid rgba(245,158,11,0.2);border-top-color:var(--gold);
        animation:spin 0.8s linear infinite"></span>
      <span style="color:var(--t2);font-size:13px">Generating image — this may take 15–30s...</span>
    </div>`;

  try {
    const data = await apiPost('/api/creative/image', { prompt, style, aspect_ratio: ratio });

    if (data.error && !data.image_url) {
      resultArea.innerHTML = `<div style="color:var(--coral);padding:20px;font-size:13px">Error: ${escapeHTML(data.error)}</div>`;
      showToast(data.error, 'error');
      return;
    }

    creative.lastImagePrompt = prompt;
    creative.lastImageUrl    = data.image_url;

    const modelLabel = { dalle3: 'DALL-E 3', replicate_sdxl: 'SDXL', google_imagen3: 'Imagen 3' }[data.model_used] || data.model_used;

    resultArea.innerHTML = `
      <div class="image-result">
        <img src="${data.image_url}" alt="${escapeHTML(prompt)}" style="border-radius:var(--r8) var(--r8) 0 0"
          onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;color:var(--coral);font-size:13px\\'>Failed to load image.</div>'">
        <div class="image-result-actions">
          <span style="font-size:11px;color:var(--t3);margin-right:auto">Model: ${modelLabel} · ${ratio}</span>
          <a class="btn-ghost" href="${data.image_url}" download="saintsallabs-image.png" target="_blank">Download</a>
          <button class="btn-gold" onclick="useImageInContent()">Use in Content</button>
        </div>
      </div>
      <div style="margin-top:12px;padding:10px 12px;background:var(--bg3);border-radius:var(--r8);
        font-size:11px;color:var(--t3);line-height:1.5">
        <strong style="color:var(--t2)">Prompt used:</strong> ${escapeHTML(data.prompt_used || prompt)}
      </div>
    `;

    showToast('Image generated', 'success');
  } catch (e) {
    resultArea.innerHTML = `<div style="color:var(--coral);padding:20px;font-size:13px">Error: ${escapeHTML(e.message)}</div>`;
    showToast(e.message || 'Image generation failed', 'error');
  } finally {
    setButtonLoading(btn, false, 'Generate Image');
  }
}

function useImageInContent() {
  const ta = document.getElementById('content-prompt');
  if (ta && creative.lastImagePrompt) {
    ta.value = creative.lastImagePrompt;
  }
  const imageUrlInput = document.getElementById('pub-image-url');
  if (imageUrlInput && creative.lastImageUrl) {
    imageUrlInput.value = creative.lastImageUrl;
  }
  switchCreativeTab('content');
  showToast('Image prompt loaded into Content Generator', 'success');
}

// ── Tab 3: Social Publisher ───────────────────────────────────────────────────

async function loadSocialPlatformStatus() {
  const statusEl = document.getElementById('pub-platform-status');
  if (!statusEl) return;

  try {
    const data = await apiGet('/api/social/platforms');
    const platforms = data.platforms || [];

    statusEl.innerHTML = `
      <div class="pub-status-grid">
        ${platforms.map(p => {
          const dotClass = p.status === 'connected' || p.status === 'live' ? 'status-connected'
            : p.status === 'pending' || p.status === 'registering' ? 'status-pending' : 'status-offline';
          return `
            <div class="pub-status-badge">
              <span class="pub-status-dot ${dotClass}"></span>
              ${p.name}
            </div>`;
        }).join('')}
      </div>
      <div style="font-size:11px;color:var(--t3);margin-top:4px">
        Via GHL Social Studio · ${platforms.filter(p => p.status === 'connected' || p.status === 'live').length} connected
      </div>
    `;
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div style="color:var(--t3);font-size:12px">Could not load platform status.</div>`;
  }
}

function updatePubCharCount() {
  const ta = document.getElementById('pub-content');
  const el = document.getElementById('pub-char-count');
  if (!ta || !el) return;
  const count = ta.value.length;
  el.textContent = `${count.toLocaleString()} chars`;
  el.style.color = count > 280 ? 'var(--amber)' : 'var(--t3)';
}

function toggleSchedule() {
  const toggle = document.getElementById('pub-schedule-toggle');
  const picker = document.getElementById('pub-schedule-picker');
  const btn    = document.getElementById('pub-post-btn');
  if (!toggle || !picker) return;
  toggle.checked = !toggle.checked;
  picker.style.display = toggle.checked ? 'block' : 'none';
  if (btn) btn.textContent = toggle.checked ? 'Schedule Post' : 'Post Now';
}

function pullContentToPublisher() {
  const firstPlatform = Object.keys(creative.generatedContent)[0];
  if (!firstPlatform) {
    showToast('Generate content first', 'error');
    return;
  }
  // Prefer the platform currently checked in publisher
  const pubPlatforms = getSelectedPlatforms('pub-platform-grid');
  const preferred = pubPlatforms.find(p => creative.generatedContent[p]);
  const platform = preferred || firstPlatform;
  const content = creative.generatedContent[platform];

  const ta = document.getElementById('pub-content');
  if (ta) {
    ta.value = content;
    updatePubCharCount();
    showToast(`${PLATFORM_META[platform]?.label || platform} content loaded`, 'success');
  }
}

async function publishPost() {
  const content = document.getElementById('pub-content')?.value?.trim();
  if (!content) { showToast('Write some content first', 'error'); return; }

  const platforms = getSelectedPlatforms('pub-platform-grid');
  if (!platforms.length) { showToast('Select at least one platform', 'error'); return; }

  const isScheduled   = document.getElementById('pub-schedule-toggle')?.checked;
  const scheduleTime  = isScheduled ? document.getElementById('pub-schedule-time')?.value : null;
  const imageUrl      = document.getElementById('pub-image-url')?.value?.trim() || '';

  if (isScheduled && !scheduleTime) { showToast('Pick a schedule date/time', 'error'); return; }

  const btn = document.getElementById('pub-post-btn');
  const resultsArea = document.getElementById('pub-results-area');

  setButtonLoading(btn, true, isScheduled ? 'Scheduling...' : 'Posting...');

  try {
    const data = await apiPost('/api/creative/social/post', {
      content,
      platforms,
      schedule_time: scheduleTime || null,
      image_url: imageUrl || null,
    });

    const posted   = data.platforms_posted || [];
    const failed   = data.platforms_failed || [];
    const postIds  = data.post_ids || {};
    const errors   = data.errors || {};

    resultsArea.innerHTML = `
      <div class="pub-post-result">
        ${posted.length ? `
          <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:8px">
            ✓ ${isScheduled ? 'Scheduled' : 'Posted'} to ${posted.length} platform${posted.length > 1 ? 's' : ''}
          </div>
          ${posted.map(p => `
            <div class="pub-result-row">
              <span class="plat-dot" style="background:${PLATFORM_META[p]?.color || '#999'};width:8px;height:8px;border-radius:50%;flex-shrink:0"></span>
              <strong style="color:var(--t1)">${PLATFORM_META[p]?.label || p}</strong>
              <span style="color:var(--t3)">ID: ${postIds[p] || '—'}</span>
              ${isScheduled && scheduleTime ? `<span style="color:var(--blue);margin-left:auto">${formatScheduleTime(scheduleTime)}</span>` : ''}
            </div>
          `).join('')}
        ` : ''}
        ${failed.length ? `
          <div style="font-size:12px;font-weight:700;color:var(--coral);margin-top:8px;margin-bottom:8px">
            ✗ Failed on ${failed.length} platform${failed.length > 1 ? 's' : ''}
          </div>
          ${failed.map(p => `
            <div class="pub-result-row" style="color:var(--coral)">
              <span class="plat-dot" style="background:var(--coral);width:8px;height:8px;border-radius:50%;flex-shrink:0"></span>
              ${PLATFORM_META[p]?.label || p}: ${errors[p] || 'Unknown error'}
            </div>
          `).join('')}
        ` : ''}
        ${data.error ? `<div style="color:var(--coral);font-size:12px;margin-top:8px">${escapeHTML(data.error)}</div>` : ''}
      </div>
    `;

    if (posted.length) {
      showToast(`${isScheduled ? 'Scheduled' : 'Posted'} to ${posted.length} platform${posted.length > 1 ? 's' : ''}`, 'success');
    } else {
      showToast('Post failed — check GHL configuration', 'error');
    }
  } catch (e) {
    resultsArea.innerHTML = `<div style="color:var(--coral);padding:12px;font-size:13px">Error: ${escapeHTML(e.message)}</div>`;
    showToast(e.message || 'Post failed', 'error');
  } finally {
    setButtonLoading(btn, false, isScheduled ? 'Schedule Post' : 'Post Now');
  }
}

function formatScheduleTime(isoStr) {
  try {
    return new Date(isoStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return isoStr; }
}

// ── Tab 4: Content Calendar ───────────────────────────────────────────────────

async function generateCalendar() {
  const business = document.getElementById('cal-business-desc')?.value?.trim()
    || 'SaintSal™ Labs AI platform for commercial lending, automation, and investment intelligence.';
  const goals     = document.getElementById('cal-goals')?.value?.trim() || '';
  const duration  = parseInt(document.getElementById('cal-duration')?.value || '30', 10);
  const platforms = getSelectedPlatforms('cal-platform-grid');

  if (!platforms.length) { showToast('Select at least one platform', 'error'); return; }

  const btn        = document.getElementById('cal-generate-btn');
  const batchBtn   = document.getElementById('cal-batch-btn');
  const viewArea   = document.getElementById('cal-view-area');
  const statusCard = document.getElementById('cal-status-card');
  const statusText = document.getElementById('cal-status-text');

  setButtonLoading(btn, true, 'Generating...');
  if (batchBtn) batchBtn.disabled = true;
  if (statusCard) statusCard.style.display = 'block';
  if (statusText) statusText.innerHTML = `<span style="color:var(--gold)">Generating ${duration}-day calendar...</span>`;

  viewArea.innerHTML = `
    <div class="c-card">
      <div style="display:flex;align-items:center;gap:12px;padding:20px">
        <span class="spin-gold" style="display:inline-block;width:20px;height:20px;border-radius:50%;
          border:2px solid rgba(245,158,11,0.2);border-top-color:var(--gold);
          animation:spin 0.7s linear infinite;flex-shrink:0"></span>
        <div>
          <div style="font-size:13px;color:var(--t1)">Building your ${duration}-day content calendar...</div>
          <div style="font-size:11px;color:var(--t3);margin-top:3px">This takes 30–60 seconds. Streaming in progress.</div>
        </div>
      </div>
      <div id="cal-stream-preview" style="padding:0 20px 16px;font-size:11px;color:var(--t3);font-family:var(--mono);
        max-height:120px;overflow:hidden;opacity:0.6"></div>
    </div>`;

  let fullContent = '';

  try {
    await streamAPI('/api/creative/calendar', {
      business_description: business,
      goals,
      duration,
      platforms,
    }, {
      onChunk(chunk) {
        fullContent += chunk;
        const preview = document.getElementById('cal-stream-preview');
        if (preview) {
          preview.textContent = fullContent.slice(-400);
        }
      },
      onEvent(data) {
        if (data.type === 'status' && statusText) {
          statusText.innerHTML = `<span style="color:var(--gold)">${escapeHTML(data.message || '')}</span>`;
        }
        if (data.type === 'complete' && data.calendar) {
          creative.calendar = data.calendar;
          renderCalendar(data.calendar);
          if (statusCard) statusCard.style.display = 'none';
          if (batchBtn) batchBtn.disabled = false;
          showToast(`Calendar generated — ${data.calendar.days?.length || 0} days`, 'success');
        }
      },
      onDone(data) {
        if (data?.calendar) {
          creative.calendar = data.calendar;
          renderCalendar(data.calendar);
          if (statusCard) statusCard.style.display = 'none';
          if (batchBtn) batchBtn.disabled = false;
        } else if (!creative.calendar) {
          viewArea.innerHTML = `<div class="c-card" style="color:var(--coral);font-size:13px;padding:20px">
            Calendar generation incomplete. Try again.</div>`;
        }
        setButtonLoading(btn, false, 'Generate Calendar');
      },
    });
  } catch (e) {
    viewArea.innerHTML = `<div class="c-card" style="color:var(--coral);font-size:13px;padding:20px">Error: ${escapeHTML(e.message)}</div>`;
    showToast(e.message || 'Calendar generation failed', 'error');
    setButtonLoading(btn, false, 'Generate Calendar');
    if (statusCard) statusCard.style.display = 'none';
  }
}

function renderCalendar(calendarData) {
  const viewArea = document.getElementById('cal-view-area');
  if (!viewArea) return;

  const days = calendarData.days || [];
  if (!days.length) {
    viewArea.innerHTML = `<div class="c-card" style="color:var(--t2);font-size:13px;padding:20px">
      Calendar generated but no days found. Raw data may be in non-JSON format.</div>`;
    return;
  }

  // Group days by month
  const months = {};
  days.forEach(day => {
    const d = new Date(day.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!months[key]) months[key] = { label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }), days: [] };
    months[key].days.push(day);
  });

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--t1)">${calendarData.business || 'Content Calendar'}</div>
      <div style="font-size:12px;color:var(--t2);margin-top:2px">${days.length} days · ${calendarData.platforms?.join(', ') || ''}</div>
    </div>
    <span class="badge badge-gold">${days.length} Days</span>
  </div>`;

  Object.values(months).forEach(month => {
    html += `
      <div style="margin-bottom:24px">
        <div style="font-size:12px;font-weight:700;color:var(--t2);letter-spacing:0.08em;
          text-transform:uppercase;margin-bottom:12px">${month.label}</div>
        <div class="calendar-grid-wrap">
          <div class="calendar-month">
            ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d =>
              `<div class="cal-day-header">${d}</div>`
            ).join('')}
            ${buildMonthGrid(month.days)}
          </div>
        </div>
      </div>`;
  });

  html += `<div id="cal-day-detail-area"></div>`;
  viewArea.innerHTML = html;
}

function buildMonthGrid(days) {
  if (!days.length) return '';

  // Find the first day's weekday to add padding
  const firstDate = new Date(days[0].date);
  const firstDow = (firstDate.getDay() + 6) % 7; // Mon=0, Sun=6

  let cells = '';
  // Empty padding cells
  for (let i = 0; i < firstDow; i++) {
    cells += `<div class="cal-day empty"></div>`;
  }

  days.forEach(day => {
    const d = new Date(day.date);
    const dateNum = d.getDate();
    const posts = day.posts || [];
    const dayId = day.date;
    const hasPosts = posts.length > 0;

    const chips = posts.slice(0, 3).map(p => {
      const meta = PLATFORM_META[p.platform] || {};
      return `<span class="cal-chip" style="border-color:${meta.color ? meta.color + '55' : ''};
        color:${meta.color || 'var(--gold)'};background:${meta.color ? meta.color + '15' : ''}">
        ${meta.label || p.platform}: ${(p.topic || '').slice(0, 20)}${(p.topic || '').length > 20 ? '…' : ''}
      </span>`;
    }).join('');

    cells += `
      <div class="cal-day ${hasPosts ? 'has-posts' : ''}" data-date="${dayId}"
        onclick="expandCalendarDay('${dayId}', this)">
        <div class="cal-date">${dateNum}</div>
        <div class="cal-post-chips">${chips}</div>
        ${posts.length > 3 ? `<div style="font-size:10px;color:var(--t3);margin-top:3px">+${posts.length - 3} more</div>` : ''}
      </div>`;
  });

  return cells;
}

function expandCalendarDay(dateStr, el) {
  // Deselect all days
  document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');

  const calendarData = creative.calendar;
  if (!calendarData) return;

  const dayData = (calendarData.days || []).find(d => d.date === dateStr);
  if (!dayData) return;

  creative.selectedDay = dayData;

  const detailArea = document.getElementById('cal-day-detail-area');
  if (!detailArea) return;

  const d = new Date(dateStr);
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const posts = dayData.posts || [];

  detailArea.innerHTML = `
    <div class="cal-day-detail">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="cal-day-detail-title">${dayLabel}</div>
        <div style="display:flex;gap:8px">
          ${dayData.pillar ? `<span style="font-size:11px;color:var(--t2);background:var(--bg3);
            padding:4px 10px;border-radius:20px;border:1px solid var(--brd)">${escapeHTML(dayData.pillar)}</span>` : ''}
          <button class="btn-gold" onclick="generateDayContent('${dateStr}')">Generate Posts</button>
        </div>
      </div>
      ${posts.length === 0 ? `<div style="color:var(--t3);font-size:13px">No posts scheduled for this day.</div>` : ''}
      ${posts.map((post, i) => buildCalPostItem(post, dateStr, i)).join('')}
    </div>
  `;
}

function buildCalPostItem(post, dateStr, idx) {
  const meta = PLATFORM_META[post.platform] || { label: post.platform, color: '#999' };
  const tags = (post.hashtags || []).map(t => `<span style="color:var(--blue);font-size:11px">#${t}</span>`).join(' ');

  return `
    <div class="cal-post-item">
      <div class="cal-post-meta">
        <span class="cal-post-platform" style="color:${meta.color}">${meta.label}</span>
        <span class="cal-post-type">${post.type || 'caption'}</span>
        ${post.time ? `<span class="cal-post-time">${post.time}</span>` : ''}
      </div>
      <div class="cal-post-topic">${escapeHTML(post.topic || '')}</div>
      ${post.notes ? `<div style="font-size:12px;color:var(--t3);margin-bottom:8px;font-style:italic">${escapeHTML(post.notes)}</div>` : ''}
      ${tags ? `<div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px">${tags}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-ghost" style="font-size:11px;padding:5px 10px"
          onclick="generateSinglePost('${post.platform}','${escapeHTML(post.topic || '')}','${post.type || 'caption'}')">
          Generate Content
        </button>
        <button class="btn-ghost" style="font-size:11px;padding:5px 10px"
          onclick="sendToPublisher('${escapeHTML(post.topic || '')}','${post.platform}')">
          Open in Publisher
        </button>
      </div>
    </div>
  `;
}

async function generateDayContent(dateStr) {
  const dayData = (creative.calendar?.days || []).find(d => d.date === dateStr);
  if (!dayData || !dayData.posts?.length) { showToast('No posts scheduled for this day', 'error'); return; }

  showToast('Generating content for all posts...', 'info');
  const posts = dayData.posts;

  try {
    const results = await apiPost('/api/creative/calendar/batch-generate', {
      calendar_id: creative.calendar?.calendar_id || '',
      week_number: 1,
      days: posts.map(p => ({ date: dateStr, platform: p.platform, topic: p.topic, type: p.type || 'caption' })),
    });

    if (results.posts?.length) {
      // Store generated content for each platform
      results.posts.forEach(p => {
        creative.generatedContent[p.platform] = p.content;
      });
      showToast(`Generated ${results.posts.length} posts`, 'success');

      // Refresh the day detail view
      const el = document.querySelector(`.cal-day[data-date="${dateStr}"]`);
      if (el) expandCalendarDay(dateStr, el);
    }
  } catch (e) {
    showToast(e.message || 'Generation failed', 'error');
  }
}

async function generateSinglePost(platform, topic, type) {
  showToast(`Generating ${PLATFORM_META[platform]?.label || platform} post...`, 'info');
  try {
    const data = await apiPost('/api/creative/generate', {
      prompt: topic,
      platforms: [platform],
      type: type || 'caption',
      brand_voice: 'professional',
    });
    const content = data.platform_versions?.[platform];
    if (content) {
      creative.generatedContent[platform] = content;
      showToast('Content generated — use Publisher to post', 'success');
    }
  } catch (e) {
    showToast(e.message || 'Generation failed', 'error');
  }
}

function sendToPublisher(topic, platform) {
  const ta = document.getElementById('pub-content');
  if (ta) {
    const existing = creative.generatedContent[platform];
    ta.value = existing || topic;
    updatePubCharCount();
  }
  // Select platform
  const grid = document.getElementById('pub-platform-grid');
  if (grid) {
    grid.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.checked = cb.value === platform;
      const label = cb.closest('.platform-check');
      if (label) label.classList.toggle('selected', cb.value === platform);
    });
  }
  switchCreativeTab('publish');
}

async function batchGenerateWeek() {
  if (!creative.calendar) { showToast('Generate a calendar first', 'error'); return; }

  const today = new Date();
  const days = (creative.calendar.days || []).filter(d => {
    const diff = (new Date(d.date) - today) / 86400000;
    return diff >= 0 && diff < 7;
  });

  if (!days.length) { showToast('No posts found in the next 7 days', 'error'); return; }

  const btn = document.getElementById('cal-batch-btn');
  setButtonLoading(btn, true, 'Generating...');

  try {
    const allPosts = days.flatMap(d =>
      (d.posts || []).map(p => ({ date: d.date, platform: p.platform, topic: p.topic, type: p.type || 'caption' }))
    );

    const result = await apiPost('/api/creative/calendar/batch-generate', {
      calendar_id: creative.calendar.calendar_id || '',
      week_number: 1,
      days: allPosts.slice(0, 7),
    });

    result.posts?.forEach(p => { creative.generatedContent[p.platform] = p.content; });
    showToast(`Week generated — ${result.count} posts ready`, 'success');
  } catch (e) {
    showToast(e.message || 'Batch generation failed', 'error');
  } finally {
    setButtonLoading(btn, false, 'Generate This Week\'s Posts');
  }
}

// ── Utility Helpers ───────────────────────────────────────────────────────────

function setButtonLoading(btn, loading, loadingText) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn._origText = btn.innerHTML;
    btn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-radius:50%;
      border:2px solid rgba(0,0,0,0.2);border-top-color:#000;
      animation:spin 0.6s linear infinite;display:inline-block"></span> ${loadingText}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._origText || loadingText;
  }
}

// escapeHTML is defined globally in app.js — used directly here
