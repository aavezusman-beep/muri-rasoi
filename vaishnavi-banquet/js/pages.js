/* Public pages: home, gallery, menu, booking/calendar, policies.
   Each page sets <body data-page="..." data-file="..."> and this file runs the right init. */

const SAMPLE_NOTE = '<strong>Sample content.</strong> Real details have not been added yet. The owner can replace this from the admin dashboard.';
const money = n => '₹' + Number(n).toLocaleString('en-IN');
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function loadContent() {
  const out = {};
  if (db) {
    const { data } = await db.from('site_content').select('key,value');
    (data || []).forEach(r => out[r.key] = r.value);
  }
  return out;
}

// ---------- HOME ----------
async function initHome() {
  const c = await loadContent();
  const set = (k, v) => { if (v) document.querySelectorAll(`[data-bind="${k}"]`).forEach(el => el.textContent = v); };
  set('hero_title', c.hero_title);
  set('hero_tagline', c.hero_tagline);
  set('about_text', c.about_text);
  document.querySelectorAll('[data-bind="venue"]').forEach(el => el.textContent = SITE.venue);
  document.getElementById('contact-phones').innerHTML = (SITE.phones || []).map(p => `<a class="btn btn-ghost small" href="tel:+91${esc(p)}">Call +91 ${esc(p)}</a>`).join(' ');
  document.getElementById('contact-address').textContent = SITE.address || '';
  document.getElementById('contact-whatsapp').href = waLink('Hello, I would like to enquire about booking ' + SITE.venue + '.');
  document.getElementById('map-frame').src = 'https://www.google.com/maps?q=' + encodeURIComponent(SITE.map_query || SITE.address) + '&output=embed';
  document.getElementById('directions').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(SITE.map_query || SITE.address);
  if (SITE.email) document.getElementById('contact-email').innerHTML = `<a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>`;

  // Facilities
  const fac = c.facilities || CFG.FACILITIES;
  document.getElementById('facilities').innerHTML = fac.length
    ? fac.map(f => `<li>${esc(f)}</li>`).join('')
    : '<li class="muted">Facilities will be listed here once the venue confirms them.</li>';

  // FAQ
  const faqs = c.faqs || CFG.FAQS;
  document.getElementById('faq-list').innerHTML = faqs.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');

  // Google reviews: only show buttons if the venue gave real links. Never fake a rating.
  const gr = document.getElementById('google-reviews');
  const btns = [];
  if (SITE.google_business_url) btns.push(`<a class="btn btn-gold" target="_blank" rel="noopener noreferrer" href="${esc(SITE.google_business_url)}">Read All Google Reviews</a>`);
  if (SITE.google_review_url) btns.push(`<a class="btn btn-ghost" target="_blank" rel="noopener noreferrer" href="${esc(SITE.google_review_url)}">Write a Google Review</a>`);
  gr.innerHTML = btns.length
    ? `<p class="lead center">You will be taken to Google. Reviews are posted on Google, not on this website.</p><div class="links center" style="justify-content:center">${btns.join('')}</div>`
    : '<div class="empty">Google review links will appear here once the venue adds its Google Business Profile.</div>';

  // Packages (featured first)
  let pk = [], usingSample = false;
  if (db) { const { data, error } = await db.from('packages').select('*').eq('visible', true).order('sort_order'); if (!error) pk = data || []; }
  if (!pk.length) { pk = CFG.SAMPLE_PACKAGES; usingSample = true; }
  document.getElementById('packages').innerHTML = (usingSample ? `<div class="notice warn">${SAMPLE_NOTE}</div>` : '') +
    `<div class="grid">${pk.map(p => packageCard(p)).join('')}</div>`;

  // Gallery preview
  let gi = [];
  if (db) { const { data } = await db.from('gallery_images').select('*').eq('visible', true).order('sort_order').limit(6); gi = data || []; }
  if (!gi.length) gi = CFG.SAMPLE_GALLERY.slice(0, 6);
  document.getElementById('gallery-preview').innerHTML = gi.map(g =>
    `<figure class="card" style="padding:0;overflow:hidden;margin:0"><img loading="lazy" src="${esc(g.url)}" alt="${esc(g.caption || 'Venue photo')}" style="height:200px;width:100%;object-fit:cover"></figure>`).join('');

  // Testimonials (website testimonials only, never presented as Google reviews)
  const tEl = document.getElementById('testimonials');
  if (db) {
    const { data } = await db.from('testimonials').select('*').eq('approved', true).eq('show_on_home', true).limit(6);
    tEl.innerHTML = (data && data.length)
      ? `<div class="grid">${data.map(t => `<figure class="card"><p class="quote">&ldquo;${esc(t.quote)}&rdquo;</p><figcaption class="muted">${esc(t.customer_name || 'Guest')}${t.event_type ? ' &middot; ' + esc(t.event_type) : ''}</figcaption></figure>`).join('')}</div>`
      : '<div class="empty">Guest testimonials will appear here once they are approved by the venue.</div>';
  } else tEl.innerHTML = '<div class="empty">Testimonials will appear here once the database is connected.</div>';
}

function packageCard(p) {
  const price = p.price_type === 'fixed' && p.price != null ? `${money(p.price)}`
    : p.price_type === 'per_plate' && p.price != null ? `${money(p.price)} <small>per plate</small>`
    : 'Price on enquiry';
  return `<article class="card ${p.featured ? 'featured' : ''}">
    ${p.featured ? '<span class="badge">Featured</span>' : ''}
    <h3>${esc(p.name)}</h3>
    <div class="price">${price}</div>
    ${p.guest_limit ? `<p class="muted">Up to ${esc(p.guest_limit)} guests</p>` : ''}
    <p>${esc(p.description || '')}</p>
    ${(p.inclusions || []).length ? `<ul class="check">${p.inclusions.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    ${(p.exclusions || []).length ? `<p class="muted"><strong>Not included:</strong> ${p.exclusions.map(esc).join(', ')}</p>` : ''}
    <a class="btn btn-maroon small" href="booking.html?package=${encodeURIComponent(p.name)}">Enquire Now</a>
  </article>`;
}

// ---------- GALLERY ----------
let galleryItems = [], galleryIdx = 0;
async function initGallery() {
  const el = document.getElementById('gallery');
  let items = [], sample = false;
  if (db) { const { data, error } = await db.from('gallery_images').select('*').eq('visible', true).order('sort_order'); if (!error) items = data || []; }
  if (!items.length) { items = CFG.SAMPLE_GALLERY; sample = true; }
  galleryItems = items;
  if (sample) document.getElementById('gallery-note').innerHTML = `<div class="notice warn">${SAMPLE_NOTE}</div>`;
  const cats = [...new Set(items.map(i => i.category).filter(Boolean))];
  const fl = document.getElementById('gallery-filters');
  fl.innerHTML = ['All', ...cats].map((c, i) => `<button class="chip" aria-pressed="${i === 0}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  fl.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    fl.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b));
    render(b.dataset.cat);
  });
  function render(cat = 'All') {
    const list = galleryItems.map((g, i) => ({ g, i })).filter(x => cat === 'All' || x.g.category === cat);
    el.innerHTML = list.length ? list.map(({ g, i }) => `
      <button data-i="${i}" aria-label="Open photo: ${esc(g.caption || 'venue photo')}">
        <img loading="lazy" src="${esc(g.url)}" alt="${esc(g.caption || 'Venue photo')}">
        <figcaption>${esc(g.caption || '')}</figcaption></button>`).join('')
      : '<div class="empty">No photos in this category yet.</div>';
  }
  el.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) openLightbox(+b.dataset.i); });
  render();
  const lb = document.getElementById('lightbox');
  lb.querySelector('.close').addEventListener('click', () => lb.classList.remove('open'));
  lb.querySelector('.next').addEventListener('click', () => openLightbox((galleryIdx + 1) % galleryItems.length));
  lb.querySelector('.prev').addEventListener('click', () => openLightbox((galleryIdx - 1 + galleryItems.length) % galleryItems.length));
  lb.addEventListener('click', e => { if (e.target === lb) lb.classList.remove('open'); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') lb.classList.remove('open');
    if (e.key === 'ArrowRight') lb.querySelector('.next').click();
    if (e.key === 'ArrowLeft') lb.querySelector('.prev').click();
  });
}
function openLightbox(i) {
  galleryIdx = i;
  const g = galleryItems[i], lb = document.getElementById('lightbox');
  lb.querySelector('img').src = g.url; lb.querySelector('img').alt = g.caption || 'Venue photo';
  lb.querySelector('.cap').textContent = g.caption || '';
  lb.classList.add('open');
}

// ---------- MENU (restaurant) ----------
let menuItems = [], cart = {};
async function initMenu() {
  let items = [], sample = false;
  if (db) { const { data, error } = await db.from('menu_items').select('*').order('sort_order'); if (!error) items = data || []; }
  if (!items.length) { items = CFG.SAMPLE_MENU; sample = true; }
  menuItems = items;
  if (sample) document.getElementById('menu-note').innerHTML = `<div class="notice warn">${SAMPLE_NOTE} Ordering here sends an enquiry only. It is not confirmed until the restaurant confirms it.</div>`;
  const cats = ['All', ...new Set(items.map(i => i.category))];
  const fl = document.getElementById('menu-filters');
  fl.innerHTML = cats.map((c, i) => `<button class="chip" aria-pressed="${i === 0}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  let cat = 'All', veg = false, q = '';
  fl.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.cat; fl.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); });
  document.getElementById('menu-search').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); draw(); });
  document.getElementById('menu-veg').addEventListener('change', e => { veg = e.target.checked; draw(); });
  function draw() {
    const list = menuItems.filter(i => (cat === 'All' || i.category === cat) && (!veg || i.is_veg === true)
      && (!q || (i.name + ' ' + (i.description || '')).toLowerCase().includes(q)));
    const el = document.getElementById('menu-list');
    el.innerHTML = list.length ? list.map(i => `
      <div class="dish ${i.available ? '' : 'off'}" role="button" tabindex="0" data-name="${esc(i.name)}">
        <div><h3>${i.is_veg === true ? '<span class="veg v" title="Vegetarian"></span>' : i.is_veg === false ? '<span class="veg nv" title="Non-vegetarian"></span>' : ''}${esc(i.name)}</h3>
          <p class="muted" style="margin:.2rem 0 0">${esc(i.description || '')}</p>
          ${i.available ? '' : '<span class="badge">Currently unavailable</span>'}</div>
        <div class="price">${i.price != null ? money(i.price) : ''}</div>
      </div>`).join('') : '<div class="empty">No dishes match your search.</div>';
  }
  document.getElementById('menu-list').addEventListener('click', e => { const d = e.target.closest('.dish'); if (d) showDish(d.dataset.name); });
  document.getElementById('menu-list').addEventListener('keydown', e => { if (e.key === 'Enter') { const d = e.target.closest('.dish'); if (d) showDish(d.dataset.name); } });
  draw(); renderCart();
}
function showDish(name) {
  const i = menuItems.find(x => x.name === name); if (!i) return;
  const m = document.getElementById('dish-modal');
  m.querySelector('.modal-body').innerHTML = `<h3>${esc(i.name)}</h3><p>${esc(i.description || 'Description to be added.')}</p>
    <p class="price">${i.price != null ? money(i.price) : 'Price on request'}</p>
    ${i.available ? `<button class="btn btn-maroon" id="add-cart">Add to enquiry list</button>` : '<p class="muted">This dish is currently unavailable.</p>'}`;
  m.classList.add('open');
  const add = document.getElementById('add-cart');
  if (add) add.onclick = () => { cart[i.name] = (cart[i.name] || 0) + 1; renderCart(); m.classList.remove('open'); toast('Added to your enquiry list'); };
}
function renderCart() {
  const names = Object.keys(cart);
  const bar = document.getElementById('cart');
  const count = names.reduce((s, n) => s + cart[n], 0);
  const total = names.reduce((s, n) => { const i = menuItems.find(x => x.name === n); return s + (i && i.price ? i.price * cart[n] : 0); }, 0);
  bar.innerHTML = count ? `<div class="wrap"><span>${count} item(s) selected${total ? ' &middot; approx. ' + money(total) : ''}</span>
    <span class="links"><button class="btn btn-gold small" id="send-enq">Send as WhatsApp enquiry</button>
    <button class="btn btn-ghost small" id="clear-cart" style="color:#fff;border-color:#fff">Clear</button></span></div>` : '';
  if (count) {
    document.getElementById('send-enq').onclick = () => {
      const lines = names.map(n => `- ${n} x${cart[n]}`).join('\n');
      window.open(waLink(`Hello, I would like to enquire about these dishes from the ${CFG.RESTAURANT_NAME} menu:\n${lines}\nPlease confirm availability and prices.`), '_blank', 'noopener');
    };
    document.getElementById('clear-cart').onclick = () => { cart = {}; renderCart(); };
  }
}

// ---------- BOOKING & AVAILABILITY CALENDAR ----------
const B = { hallId: null, halls: [], y: 0, m: 0, sel: null, slot: '', states: {}, busy: false };
const SLOT_LABEL = { day: 'Day event', evening: 'Evening event', full_day: 'Full day' };

async function initBooking() {
  const now = new Date(); B.y = now.getFullYear(); B.m = now.getMonth();
  const form = document.getElementById('enquiry-form');
  const params = new URLSearchParams(location.search);
  if (params.get('package')) {
    setTimeout(() => { const s = form.elements.package; if (s) [...s.options].forEach(o => { if (o.value === params.get('package')) s.value = o.value; }); }, 0);
  }
  if (!db) {
    dbMissingNotice(document.getElementById('booking-notice'));
    form.querySelector('button[type=submit]').disabled = true;
    document.getElementById('cal-grid').innerHTML = '<div class="empty" style="grid-column:1/-1">Calendar will load once the database is connected.</div>';
    renderPackageOptions(CFG.SAMPLE_PACKAGES);
    return;
  }
  // halls
  const { data: halls } = await db.from('halls').select('id,name,capacity').eq('active', true).order('name');
  B.halls = halls || [];
  const hs = document.getElementById('hall');
  if (B.halls.length > 1) { hs.innerHTML = B.halls.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join(''); hs.parentElement.hidden = false; }
  else { hs.parentElement.hidden = true; }
  B.hallId = B.halls[0] ? B.halls[0].id : null;
  hs.onchange = () => { B.hallId = hs.value; B.sel = null; loadMonth(); };
  // packages
  const { data: pk } = await db.from('packages').select('name').eq('visible', true).order('sort_order');
  renderPackageOptions(pk && pk.length ? pk : CFG.SAMPLE_PACKAGES);
  // events
  document.getElementById('cal-prev').onclick = () => { B.m--; if (B.m < 0) { B.m = 11; B.y--; } loadMonth(); };
  document.getElementById('cal-next').onclick = () => { B.m++; if (B.m > 11) { B.m = 0; B.y++; } loadMonth(); };
  document.getElementById('slot').onchange = e => { B.slot = e.target.value; updateSlotMessage(); };
  form.addEventListener('submit', submitEnquiry);
  loadMonth();
}

function renderPackageOptions(list) {
  const s = document.getElementById('package');
  s.innerHTML = '<option value="">Not sure yet</option>' + list.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
}

async function loadMonth() {
  const label = new Date(B.y, B.m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  document.getElementById('cal-title').textContent = label;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem"><span class="spinner"></span></div>';
  const from = isoDate(new Date(B.y, B.m, 1)), to = isoDate(new Date(B.y, B.m + 1, 0));
  if (!B.hallId) { notice(document.getElementById('booking-notice'), 'No hall is set up yet.', 'warn'); return; }
  const { data, error } = await db.rpc('get_availability', { p_hall: B.hallId, p_from: from, p_to: to });
  if (error) { notice(document.getElementById('booking-notice'), 'Could not load availability. Please check your connection and refresh. (' + esc(error.message) + ')', 'warn'); grid.innerHTML = ''; return; }
  B.states = {};
  (data || []).forEach(r => { (B.states[r.day] = B.states[r.day] || {})[r.slot] = r.state; });
  renderCalendar();
}

function dayState(iso) {
  const s = B.states[iso]; if (!s) return 'available';
  const a = s.day || 'available', b = s.evening || 'available';
  if (a === 'unavailable' && b === 'unavailable') return 'unavailable';
  if (a === 'available' && b === 'available') return 'available';
  return 'pending';
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const today = isoDate(new Date());
  const first = new Date(B.y, B.m, 1).getDay(); // 0 = Sunday
  const days = new Date(B.y, B.m + 1, 0).getDate();
  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('');
  for (let i = 0; i < first; i++) html += '<span></span>';
  for (let d = 1; d <= days; d++) {
    const iso = isoDate(new Date(B.y, B.m, d));
    const st = dayState(iso), past = iso < today;
    const cls = ['day', past ? 'past' : st, iso === today ? 'today' : '', iso === B.sel ? 'selected' : ''].join(' ');
    const label = past ? 'Past date' : st === 'available' ? 'Available' : st === 'pending' ? 'Pending or partly booked' : 'Unavailable';
    html += `<button class="${cls}" data-iso="${iso}" ${past || st === 'unavailable' ? 'disabled' : ''} aria-label="${fmtDate(iso)}: ${label}">${d}</button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('button.day:not([disabled])').forEach(b => b.onclick = () => selectDate(b.dataset.iso));
  document.getElementById('cal-note').textContent = B.sel ? '' : 'Select an available date to continue.';
}

function selectDate(iso) {
  B.sel = iso;
  document.getElementById('event_date').value = iso;
  document.getElementById('picked').textContent = 'Selected: ' + fmtDate(iso);
  renderCalendar();
  updateSlotMessage();
  document.getElementById('enquiry-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Slot availability for the chosen date
function slotState(iso, slot) {
  const s = B.states[iso] || {};
  if (slot === 'full_day') {
    const a = s.day || 'available', b = s.evening || 'available';
    if (a === 'unavailable' || b === 'unavailable') return 'unavailable';
    if (a === 'pending' || b === 'pending') return 'pending';
    return 'available';
  }
  return s[slot] || 'available';
}
function updateSlotMessage() {
  const el = document.getElementById('slot-msg');
  const slot = document.getElementById('slot').value;
  if (!B.sel || !slot) { el.innerHTML = ''; return; }
  const st = slotState(B.sel, slot);
  if (st === 'unavailable') notice(el, `Sorry, <strong>${SLOT_LABEL[slot]}</strong> is not available on ${fmtDate(B.sel)}. Please choose another date or slot.`, 'warn');
  else if (st === 'pending') notice(el, `Another enquiry is pending for this date. You can still send yours, and the venue will confirm the date.`, '');
  else notice(el, `${SLOT_LABEL[slot]} looks open on ${fmtDate(B.sel)}. The venue confirms every booking, so this is still an enquiry.`, 'success');
}

async function submitEnquiry(e) {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button[type=submit]'), out = document.getElementById('form-result');
  if (f.elements.website.value) return; // honeypot: bots fill this hidden field
  const v = n => (f.elements[n] ? f.elements[n].value.trim() : '');
  let ok = true;
  const err = (id, msg) => { const el = document.getElementById('err-' + id); if (el) el.textContent = msg; if (msg) ok = false; };
  ['date','slot','name','phone','event_type','email','guests'].forEach(k => err(k, ''));
  if (!B.sel) err('date', 'Please choose a date on the calendar');
  if (!v('slot')) err('slot', 'Please choose a time slot');
  if (v('name').length < 2) err('name', 'Please enter your name');
  if (!/^[0-9+ ]{10,15}$/.test(v('phone'))) err('phone', 'Enter a valid phone number (10 digits)');
  if (!v('event_type')) err('event_type', 'Please choose an event type');
  if (v('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'))) err('email', 'Enter a valid email or leave it blank');
  if (v('guests') && (+v('guests') < 1 || +v('guests') > 10000)) err('guests', 'Enter a sensible guest count');
  if (!ok) { toast('Please check the highlighted fields', 'err'); return; }
  if (slotState(B.sel, v('slot')) === 'unavailable') { toast('That date and slot is no longer available', 'err'); await loadMonth(); return; }
  if (B.busy) return;
  B.busy = true; setBusy(btn, true);
  const params = {
    p_hall: B.hallId, p_date: B.sel, p_slot: v('slot'), p_event_type: v('event_type'),
    p_name: v('name'), p_phone: v('phone'), p_email: v('email') || null,
    p_guests: v('guests') ? parseInt(v('guests'), 10) : null,
    p_package: v('package') || null, p_requirements: v('requirements') || null, p_notes: v('notes') || null
  };
  const { data, error } = await db.rpc('submit_enquiry', params);
  B.busy = false; setBusy(btn, false, 'Send Booking Enquiry');
  if (error) {
    notice(out, esc(error.message), 'warn');
    toast('Enquiry not sent. See the message above.', 'err');
    await loadMonth();
    return;
  }
  f.reset(); B.sel = null; B.slot = '';
  document.getElementById('picked').textContent = '';
  notice(out, `<strong>Thank you! Your enquiry has been received.</strong><br>Your reference is <strong>${esc(data)}</strong>. Please keep it for your records. The venue will review and confirm your booking. This enquiry is not a confirmed booking yet.<br><a class="btn btn-gold small" style="margin-top:.6rem" target="_blank" rel="noopener noreferrer" href="${waLink('Hello, my booking enquiry reference is ' + data + '.')}">Share reference on WhatsApp</a>`, 'success');
  toast('Enquiry sent. Reference: ' + data);
  loadMonth();
}

// ---------- POLICIES ----------
async function initPolicies() {
  const c = await loadContent();
  const p = c.policies || {};
  const defaults = {
    terms: 'Placeholder. The venue must supply its Terms and Conditions before publishing. Owner review is required.',
    booking: 'Placeholder. An enquiry is not a confirmed booking. The venue confirms each booking. Advance payment terms, if any, must be supplied by the venue. Owner review is required.',
    cancellation: 'Placeholder. The venue must supply its cancellation and refund policy. No refund terms are promised here. Owner review is required before publishing.',
    privacy: 'Placeholder. This privacy policy must be reviewed by the venue owner. Customer details entered on this site are used only to respond to enquiries and manage bookings.'
  };
  ['terms','booking','cancellation','privacy'].forEach(k => {
    document.getElementById('policy-' + k).innerHTML = `<p>${esc(p[k] || defaults[k])}</p>`;
  });
}

// ---------- DISPATCH ----------
document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.page;
  await loadSite();
  renderChrome(document.body.dataset.file || '');
  const inits = { home: initHome, gallery: initGallery, menu: initMenu, booking: initBooking, policies: initPolicies };
  if (inits[page]) {
    try { await inits[page](); }
    catch (err) { console.error(err); toast('Something went wrong loading this page. Please refresh.', 'err'); }
  }
});
