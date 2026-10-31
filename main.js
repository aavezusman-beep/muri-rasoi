(() => {
  'use strict';
  const API = (window.VB_API_BASE || '').replace(/\/$/, '');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const reveal = (el) => el.classList.add('reveal');
  let C = null;
  let calMonth = new Date();
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);

  // ---------- load content ----------
  async function loadContent() {
    const r = await fetch(API + '/api/content');
    if (!r.ok) throw new Error('Could not load site content');
    C = await r.json();
    render();
  }

  function render() {
    const c = C.contact;
    const wa = '91' + c.whatsapp;
    $('#footer-tagline').textContent = C.tagline;
    $('#footer-contact').innerHTML = c.phones.map((p) => `<a href="tel:+91${esc(p)}">+91 ${esc(p)}</a>`).join('');
    $('#year').textContent = new Date().getFullYear();

    const callLink = `tel:+91${c.phones[0]}`;
    $('#call-now').href = callLink; $('#float-call').href = callLink; $('#contact-call').href = callLink;
    $('#contact-wa').href = `https://wa.me/${wa}?text=${encodeURIComponent('Hello Vaishnavi Banquet, I would like to know about your hall.')}`;
    $('#float-wa').href = $('#contact-wa').href;
    $('#directions').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.mapsQuery)}`;
    $('#map').src = `https://maps.google.com/maps?q=${encodeURIComponent(c.mapsQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

    $('#contact-info').innerHTML = `
      <div class="info-row"><b>Address</b><span>${esc(c.address)}</span></div>
      <div class="info-row"><b>Phone</b><span>${c.phones.map((p) => `<a href="tel:+91${esc(p)}">+91 ${esc(p)}</a>`).join(' &middot; ')}</span></div>
      <div class="info-row"><b>Hours</b><span>${esc(c.hours)}</span></div>
      ${c.wheelchair ? '<div class="info-row"><b>Access</b><span>Wheelchair-accessible entrance, exit and parking</span></div>' : ''}
      <div class="info-row"><b>Restaurant</b><span>${esc(c.restaurant)}</span></div>`;

    $('#events-grid').innerHTML = C.events.map((e) => `
      <article class="card reveal">
        <img loading="lazy" src="${esc(e.image)}" alt="${esc(e.title)} decoration at Vaishnavi Banquet">
        <h3>${esc(e.title)}</h3>
        <p class="muted">${esc(e.text)}</p>
        <a class="btn btn-outline btn-small" href="#book" data-event="${esc(e.title)}">Enquire</a>
      </article>`).join('');

    $('#facilities-grid').innerHTML = C.facilities.map((f) => `
      <div class="card facility reveal"><div class="ico">${esc(f.icon)}</div><h3>${esc(f.title)}</h3><p class="muted small">${esc(f.text)}</p></div>`).join('');

    renderGallery();
    renderMenu();

    $('#packages-grid').innerHTML = C.packages.map((p) => `
      <article class="card package reveal">
        <h3 class="pname">${esc(p.name)}${p.draft ? ' <span class="tag">Sample</span>' : ''}</h3>
        <p class="price">${esc(p.pricing || 'Contact for pricing')}</p>
        <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <a class="btn btn-gold btn-small" href="#book" data-package="${esc(p.name)}">Enquire About This Package</a>
      </article>`).join('');

    $('#reviews-grid').innerHTML = C.reviews.map((r) => `
      <blockquote class="card review reveal">&ldquo;${esc(r.text)}&rdquo;<span class="by">${esc(r.name)}</span></blockquote>`).join('');

    const ev = $('#f-event');
    ev.innerHTML = '<option value="">Select event</option>' + C.events.map((e) => `<option>${esc(e.title)}</option>`).join('') + '<option>Other</option>';
    const pk = $('#f-package');
    pk.innerHTML = '<option value="">Not decided</option>' + C.packages.map((p) => `<option>${esc(p.name)}</option>`).join('') + '<option>Custom</option>';
    $('#f-date').min = todayStr();

    $('#wa-book').href = '#';
    $$('.reveal').forEach((el) => observer.observe(el));
    loadCalendar();
  }

  // ---------- gallery ----------
  let galleryItems = [];
  let galleryFilter = 'All';
  function renderGallery() {
    const cats = ['All', ...new Set(C.gallery.map((g) => g.category))];
    $('#gallery-filters').innerHTML = cats.map((c) => `<button class="chip ${c === galleryFilter ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    galleryItems = C.gallery.filter((g) => galleryFilter === 'All' || g.category === galleryFilter);
    $('#gallery-grid').innerHTML = galleryItems.map((g, i) => `
      <figure data-i="${i}"><img loading="lazy" src="${esc(g.src)}" alt="${esc(g.caption)}"><figcaption>${esc(g.caption)}</figcaption></figure>`).join('');
  }
  $('#gallery-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    galleryFilter = b.dataset.cat; renderGallery();
  });

  // lightbox
  let lbIndex = 0;
  const lb = $('#lightbox');
  function showLb(i) {
    if (!galleryItems.length) return;
    lbIndex = (i + galleryItems.length) % galleryItems.length;
    const g = galleryItems[lbIndex];
    $('#lb-img').src = g.src; $('#lb-img').alt = g.caption; $('#lb-cap').textContent = `${g.caption} (${lbIndex + 1}/${galleryItems.length})`;
  }
  $('#gallery-grid').addEventListener('click', (e) => {
    const f = e.target.closest('figure'); if (!f) return;
    lb.hidden = false; showLb(Number(f.dataset.i));
  });
  const closeLb = () => { lb.hidden = true; };
  $('.lb-close').addEventListener('click', closeLb);
  $('.lb-prev').addEventListener('click', () => showLb(lbIndex - 1));
  $('.lb-next').addEventListener('click', () => showLb(lbIndex + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
    if (e.key === 'ArrowRight') showLb(lbIndex + 1);
  });

  // ---------- menu ----------
  let menuFilter = 'All';
  function renderMenu() {
    const cats = ['All', ...C.menu.categories];
    $('#menu-filters').innerHTML = cats.map((c) => `<button class="chip ${c === menuFilter ? 'active' : ''}" data-mcat="${esc(c)}">${esc(c)}</button>`).join('');
    drawDishes();
  }
  function drawDishes() {
    const q = $('#menu-search').value.trim().toLowerCase();
    const items = C.menu.items.filter((i) =>
      (menuFilter === 'All' || i.category === menuFilter) &&
      (!q || i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)));
    $('#menu-list').innerHTML = items.length ? items.map((i, idx) => `
      <div class="dish" data-dish="${esc(i.id)}" tabindex="0" role="button">
        <span class="cat">${esc(i.category)}</span>
        <h4>${esc(i.name)}</h4>
        <p class="muted small">${esc(i.description)}</p>
        <span class="price">${i.price ? esc(i.price) : 'Price on request'}</span>
      </div>`).join('') : '<p class="muted">No dishes match your search.</p>';
  }
  $('#menu-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mcat]'); if (!b) return;
    menuFilter = b.dataset.mcat; renderMenu();
  });
  $('#menu-search').addEventListener('input', drawDishes);
  $('#menu-list').addEventListener('click', (e) => {
    const d = e.target.closest('[data-dish]'); if (!d) return;
    const item = C.menu.items.find((i) => i.id === d.dataset.dish);
    if (item) alert(`${item.name}\n${item.category}\n${item.description}\n${item.price ? 'Price: ' + item.price : 'Price on request'}`);
  });

  // ---------- availability calendar ----------
  let availability = {};
  async function loadCalendar() {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    try {
      const r = await fetch(`${API}/api/availability?from=${from}&to=${to}`);
      availability = (await r.json()).days || {};
    } catch { availability = {}; }
    drawCalendar();
  }
  function drawCalendar() {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const today = todayStr();
    const sel = $('#f-date').value;
    const title = calMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    let html = `<div class="cal-head"><button id="cal-prev" aria-label="Previous month">&lsaquo;</button><strong>${title}</strong><button id="cal-next" aria-label="Next month">&rsaquo;</button></div>
      <div class="cal-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}`;
    for (let i = 0; i < first; i++) html += '<div class="day blank"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const st = availability[ds];
      let cls = 'open', label = 'Open';
      if (st && st !== 'available') { cls = 'closed'; label = st === 'blocked' ? 'Unavailable' : 'Booked'; }
      if (ds < today) cls = 'past';
      html += `<button class="day ${cls} ${ds === sel ? 'sel' : ''}" data-date="${ds}" title="${ds}: ${cls === 'open' ? 'Available' : label}" ${cls === 'past' ? 'disabled' : ''} aria-label="${ds} ${cls === 'open' ? 'available' : label}">${d}</button>`;
    }
    html += '</div>';
    $('#calendar').innerHTML = html;
    $('#cal-prev').onclick = () => { calMonth = new Date(y, m - 1, 1); loadCalendar(); };
    $('#cal-next').onclick = () => { calMonth = new Date(y, m + 1, 1); loadCalendar(); };
  }
  $('#calendar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-date]'); if (!b) return;
    if (b.classList.contains('closed')) { setMsg('That date is not available. Please pick another date.', 'bad'); return; }
    $('#f-date').value = b.dataset.date; clearErr('date'); setMsg('');
    drawCalendar();
  });
  $('#f-date').addEventListener('change', () => { drawCalendar(); });

  // ---------- enquiry form ----------
  const form = $('#enquiry-form');
  const setMsg = (t, kind = '') => { const el = $('#form-msg'); el.textContent = t; el.className = 'form-msg ' + kind; };
  const showErr = (k, msg) => {
    const f = form.querySelector(`[name="${k}"]`);
    const wrap = f && f.closest('.field'); if (wrap) wrap.classList.add('bad');
    const el = form.querySelector(`.err[data-for="${k}"]`); if (el) el.textContent = msg;
  };
  const clearErr = (k) => {
    const f = form.querySelector(`[name="${k}"]`);
    const wrap = f && f.closest('.field'); if (wrap) wrap.classList.remove('bad');
    const el = form.querySelector(`.err[data-for="${k}"]`); if (el) el.textContent = '';
  };
  const readForm = () => Object.fromEntries(new FormData(form).entries());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['name','phone','email','eventType','date','guests'].forEach(clearErr);
    const data = readForm();
    const btn = $('#submit-btn');
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      const r = await fetch(API + '/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const body = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg(body.message || 'Thank you! Your enquiry was received.', 'ok');
        form.reset(); $('#f-date').min = todayStr(); drawCalendar();
      } else {
        const errs = body.errors || {};
        Object.entries(errs).forEach(([k, v]) => showErr(k, v));
        setMsg(Object.values(errs)[0] || body.error || 'Something went wrong. Please call us.', 'bad');
      }
    } catch {
      setMsg('Network problem. Please check your connection or call us directly.', 'bad');
    } finally {
      btn.disabled = false; btn.textContent = 'Submit Enquiry';
    }
  });

  $('#wa-book').addEventListener('click', (e) => {
    e.preventDefault();
    const d = readForm();
    const txt = `Hello Vaishnavi Banquet, I would like to enquire.\nName: ${d.name || ''}\nEvent: ${d.eventType || ''}\nDate: ${d.date || ''}\nGuests: ${d.guests || ''}\nPackage: ${d.package || ''}\nNotes: ${d.requirements || ''}`;
    window.open(`https://wa.me/91${C.contact.whatsapp}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
  });

  // prefill event/package from links
  document.addEventListener('click', (e) => {
    const ev = e.target.closest('[data-event]');
    if (ev) $('#f-event').value = ev.dataset.event;
    const pk = e.target.closest('[data-package]');
    if (pk) $('#f-package').value = pk.dataset.package;
  });

  // ---------- nav, misc ----------
  const toggle = $('.nav-toggle'), nav = $('#nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  $$('#nav a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }));
  const toTop = $('#to-top');
  window.addEventListener('scroll', () => toTop.classList.toggle('show', window.scrollY > 600), { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); observer.unobserve(en.target); } });
  }, { threshold: 0.12 });

  // Hero text and staging
  $$('.hero-img').forEach((img) => img.setAttribute('loading', 'eager'));

  if (location.protocol === 'file:') {
    setMsg('This page must be opened through the server. Run "npm start" and visit http://localhost:3000 instead of opening the file directly.', 'bad');
  } else {
    loadContent().catch(() => {
      setMsg('The page could not load its content. Check that the server is running (npm start) and refresh.', 'bad');
    });
  }
})();
