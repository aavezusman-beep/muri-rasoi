/* Shared helpers: Supabase client, site settings, header/footer, toasts, escaping. */
const CFG = window.VB_CONFIG;

// Null until config.js has a Supabase URL and anon key. Pages then show a clear message.
const db = (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY)
  : null;

// Contact settings. Defaults come from config.js; the owner's saved values (admin > Content) override them.
const SITE = {
  venue: CFG.VENUE_NAME, phones: CFG.PHONES, address: CFG.ADDRESS, email: CFG.EMAIL,
  enquiry_whatsapp: CFG.ENQUIRY_WHATSAPP, map_query: CFG.MAP_QUERY,
  google_business_url: CFG.GOOGLE_BUSINESS_URL, google_review_url: CFG.GOOGLE_REVIEW_URL, instagram_url: CFG.INSTAGRAM_URL
};

async function loadSite() {
  if (db) {
    try {
      const { data } = await db.from('site_content').select('value').eq('key', 'contact').maybeSingle();
      if (data && data.value) Object.assign(SITE, data.value);
    } catch (e) { /* fall back to config defaults */ }
  }
  return SITE;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg, type = 'ok') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.className = 'toast show ' + (type === 'err' ? 'err' : '');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 4500);
}
function waLink(msg = '', number) {
  return `https://wa.me/${number || SITE.enquiry_whatsapp}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
}
function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function notice(el, html, cls = '') { if (el) el.innerHTML = html ? `<div class="notice ${cls}">${html}</div>` : ''; }
function setBusy(btn, busy, label) {
  if (!btn) return;
  btn.disabled = busy;
  if (busy) { btn.dataset.label = btn.textContent; btn.innerHTML = '<span class="spinner"></span> Please wait'; }
  else btn.textContent = label || btn.dataset.label || btn.textContent;
}
function dbMissingNotice(el) {
  notice(el, 'The website database is not connected yet. The owner or developer needs to add the Supabase details in <code>js/config.js</code> (see README).', 'warn');
}

const NAV = [
  ['index.html', 'Home'], ['gallery.html', 'Gallery'], ['menu.html', 'Menu'],
  ['booking.html', 'Availability & Booking'], ['policies.html', 'Policies'], ['index.html#contact', 'Contact']
];

function renderChrome(activeFile) {
  const header = document.getElementById('site-header');
  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="wrap nav-row">
          <a class="brand" href="index.html" aria-label="${esc(SITE.venue)} home">${esc(SITE.venue)}</a>
          <button class="nav-toggle" aria-expanded="false" aria-controls="nav" aria-label="Open menu">&#9776;</button>
          <nav id="nav" class="nav" aria-label="Main">
            ${NAV.map(([href, label]) => `<a href="${href}" class="${href === activeFile ? 'active' : ''}">${label}</a>`).join('')}
            <a class="btn btn-gold small" href="booking.html">Check Availability</a>
          </nav>
        </div>
      </header>`;
    const t = header.querySelector('.nav-toggle'), nav = header.querySelector('#nav');
    t.addEventListener('click', () => { const o = nav.classList.toggle('open'); t.setAttribute('aria-expanded', o); });
  }
  const footer = document.getElementById('site-footer');
  if (footer) {
    const d = CFG.DESIGNER; // designer credit is hard-coded here, not in admin-editable content
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="wrap footer-grid">
          <div><strong>${esc(SITE.venue)}</strong><p>${esc(SITE.address)}</p>
            <p>${(SITE.phones || []).map(p => `<a href="tel:+91${esc(p)}">+91 ${esc(p)}</a>`).join(' &middot; ')}</p></div>
          <div><p><a href="policies.html#terms">Terms</a> &middot; <a href="policies.html#booking">Booking Policy</a></p>
            <p><a href="policies.html#cancellation">Cancellation</a> &middot; <a href="policies.html#privacy">Privacy</a></p>
            ${SITE.instagram_url ? `<p><a href="${esc(SITE.instagram_url)}" target="_blank" rel="noopener noreferrer">Instagram</a></p>` : ''}</div>
        </div>
        <div class="designer-credit">
          <p>Designed &amp; Developed by <strong>${esc(d.name)}</strong></p>
          <p><a href="tel:+${d.phone}">+91 ${d.phone.slice(2, 7)} ${d.phone.slice(7)}</a>
            <span aria-hidden="true">|</span>
            <a href="${d.instagram}" target="_blank" rel="noopener noreferrer">@aavez_usman</a></p>
          <p><a class="need-site" href="${waLink('Hi Aavez, I would like a website for my business.', d.phone)}" target="_blank" rel="noopener noreferrer">Need a Website for Your Business?</a></p>
        </div>
        <p class="copy">&copy; ${new Date().getFullYear()} ${esc(SITE.venue)} &middot; <a href="admin.html">Owner login</a></p>
      </footer>
      <a class="whatsapp-float" href="${waLink('Hello, I would like to enquire about booking ' + SITE.venue + '.')}" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">WhatsApp</a>`;
  }
}
