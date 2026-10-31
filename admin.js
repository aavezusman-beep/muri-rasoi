(() => {
  'use strict';
  const API = (window.VB_API_BASE || '').replace(/\/$/, '');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const KEY = 'vb_admin_token';
  let token = sessionStorage.getItem(KEY) || '';
  let calMonth = new Date(); calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  let availability = {};
  let selected = null;
  let enquiries = [];
  let content = null;
  const lists = {}; // edited list state: events, gallery, facilities, packages, menuItems, reviews

  // ---------- list editor definitions ----------
  const SECTIONS = {
    events: {
      fields: [{ key: 'title', label: 'Title' }, { key: 'text', label: 'Description', type: 'textarea' }, { key: 'image', label: 'Photo', type: 'image' }],
      blank: () => ({ title: '', text: '', image: '' })
    },
    gallery: {
      fields: [{ key: 'src', label: 'Photo', type: 'image' }, { key: 'category', label: 'Category', list: 'cat-list' }, { key: 'caption', label: 'Caption' }],
      blank: () => ({ src: '', category: 'Banquet Interiors', caption: '' })
    },
    facilities: {
      fields: [{ key: 'icon', label: 'Icon letter (1 character)' }, { key: 'title', label: 'Title' }, { key: 'text', label: 'Description', type: 'textarea' }, { key: 'active', label: 'Show on website', type: 'checkbox' }],
      blank: () => ({ icon: '', title: '', text: '', active: false })
    },
    packages: {
      fields: [{ key: 'name', label: 'Package name' }, { key: 'pricing', label: 'Pricing text' }, { key: 'features', label: 'Included services (one per line)', type: 'lines' }, { key: 'draft', label: 'Mark as sample (shows a Sample label)', type: 'checkbox' }],
      blank: () => ({ name: '', pricing: 'Contact for pricing', features: [], draft: false })
    },
    menu: {
      fields: [{ key: 'name', label: 'Dish name' }, { key: 'category', label: 'Category', type: 'select' }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'price', label: 'Price (empty = "Price on request")' }, { key: 'available', label: 'Available (show on website)', type: 'checkbox' }],
      blank: () => ({ id: '', name: '', category: menuCats()[0] || '', description: '', price: '', available: true })
    },
    reviews: {
      fields: [{ key: 'name', label: 'Reviewer name' }, { key: 'text', label: 'Review', type: 'textarea' }],
      blank: () => ({ name: '', text: '' })
    }
  };
  const itemsKey = (k) => (k === 'menu' ? 'menuItems' : k);
  const menuCats = () => {
    const ta = $('#menu-cats');
    return ta ? ta.value.split('\n').map((s) => s.trim()).filter(Boolean) : (content?.menu?.categories || []);
  };

  function fieldHTML(f, val, cardIndex) {
    const v = val ?? '';
    switch (f.type) {
      case 'textarea': return `<div class="field"><label>${esc(f.label)}</label><textarea class="wide" rows="3" data-f="${f.key}">${esc(v)}</textarea></div>`;
      case 'checkbox': return `<label class="chk"><input type="checkbox" data-f="${f.key}" ${val ? 'checked' : ''}> ${esc(f.label)}</label>`;
      case 'lines': return `<div class="field"><label>${esc(f.label)}</label><textarea class="wide" rows="3" data-f="${f.key}">${esc((val || []).join('\n'))}</textarea></div>`;
      case 'select': return `<div class="field"><label>${esc(f.label)}</label><select data-f="${f.key}">${menuCats().map((c) => `<option ${c === v ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>`;
      case 'image': return `<div class="field"><label>${esc(f.label)}</label>
          <input class="wide" data-f="${f.key}" value="${esc(v)}" placeholder="Photo address (filled automatically when you upload)">
          <div style="margin-top:6px"><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${f.key}"><span class="up-status"></span></div>
          <img class="thumb" alt="" src="${esc(v)}" ${v ? '' : 'style="display:none"'}></div>`;
      default: return `<div class="field"><label>${esc(f.label)}</label><input class="wide" data-f="${f.key}" value="${esc(v)}"${f.list ? ` list="${f.list}"` : ''}></div>`;
    }
  }

  function renderList(key) {
    const cfg = SECTIONS[key];
    const items = lists[itemsKey(key)] || [];
    $('#list-' + key).innerHTML = items.length ? items.map((it, i) => `
      <div class="item card" data-i="${i}"${it.id ? ` data-id="${esc(it.id)}"` : ''}>
        ${cfg.fields.map((f) => fieldHTML(f, it[f.key], i)).join('')}
        <div class="row"><button class="btn btn-outline small-btn" data-remove="${key}">Remove</button></div>
      </div>`).join('') : '<p class="muted">Nothing here yet. Click "Add" to create one.</p>';
  }

  function collect(key) {
    const cfg = SECTIONS[key];
    return $$('#list-' + key + ' .item').map((card) => {
      const o = {};
      for (const f of cfg.fields) {
        const el = card.querySelector(`[data-f="${f.key}"]`);
        if (!el) continue;
        if (f.type === 'checkbox') o[f.key] = el.checked;
        else if (f.type === 'lines') o[f.key] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
        else o[f.key] = el.value.trim();
      }
      if (card.dataset.id) o.id = card.dataset.id;
      return o;
    });
  }

  function addItem(key) {
    const items = collect(key);
    const blank = SECTIONS[key].blank();
    if (key === 'menu') blank.id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    items.push(blank);
    lists[itemsKey(key)] = items;
    renderList(key);
  }

  function removeItem(key, idx) {
    const items = collect(key);
    items.splice(idx, 1);
    lists[itemsKey(key)] = items;
    renderList(key);
  }

  async function saveList(key) {
    const msg = '#msg-' + key;
    try {
      const value = key === 'menu'
        ? { categories: menuCats(), items: collect('menu') }
        : collect(key);
      await api('/api/admin/content/' + key, { method: 'PUT', body: { value } });
      say(msg, 'Saved. Refresh the public website to see the change.');
      await loadContent();
    } catch (err) { say(msg, err.message, false); }
  }

  // ---------- api ----------
  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(API + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
    if (r.status === 401 && !path.endsWith('/login')) { logout(true); throw new Error('Your session expired. Please log in again.'); }
    const isJson = (r.headers.get('content-type') || '').includes('json');
    const data = isJson ? await r.json() : null;
    if (!r.ok) throw new Error((data && data.error) || (data && data.errors && Object.values(data.errors)[0]) || 'Request failed (' + r.status + ').');
    return data;
  }
  const say = (sel, text, ok = true) => { const el = $(sel); el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'bad'); };

  // ---------- auth ----------
  function showApp(on) {
    $('#login-view').classList.toggle('hidden', on);
    $('#app-view').classList.toggle('hidden', !on);
  }
  function logout(silent) {
    token = ''; sessionStorage.removeItem(KEY); showApp(false);
    if (silent) $('#login-msg').textContent = 'Your session expired. Please log in again.';
  }
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#login-msg').textContent = '';
    try {
      const d = await api('/api/admin/login', { method: 'POST', body: { password: $('#pw').value } });
      token = d.token; sessionStorage.setItem(KEY, token); $('#pw').value = '';
      await start();
    } catch (err) { $('#login-msg').textContent = err.message; }
  });
  $('#logout').addEventListener('click', () => { api('/api/admin/logout', { method: 'POST' }).catch(() => {}); logout(false); });

  // ---------- tabs ----------
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
    const t = b.dataset.tab;
    if (t === 'overview') loadOverview().catch(showErr);
    if (t === 'calendar') loadAvailability().catch(showErr);
    if (t === 'enquiries') loadEnquiries().catch(showErr);
  }));
  function showErr(err) { alert(err.message); }

  // ---------- overview ----------
  async function loadOverview() {
    const d = await api('/api/admin/overview');
    $('#s-total').textContent = d.total; $('#s-pending').textContent = d.pending;
    $('#s-confirmed').textContent = d.confirmed; $('#s-cancelled').textContent = d.cancelled;
    const rowList = (list) => list.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Name</th><th>Event</th><th>Status</th></tr></thead><tbody>${list.map((e) =>
      `<tr><td>${esc(e.date)}</td><td>${esc(e.name)}<br><span class="small muted">${esc(e.phone)}</span></td><td>${esc(e.eventType)}</td><td><span class="pill p-${esc(e.status)}">${esc(e.status)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nothing yet.</p>';
    $('#o-upcoming').innerHTML = rowList(d.upcoming);
    $('#o-recent').innerHTML = rowList(d.recent);
  }

  // ---------- hall availability ----------
  async function loadAvailability() {
    availability = await api('/api/admin/availability');
    drawAdminCal(); drawList();
  }
  function drawAdminCal() {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    let h = `<div class="row between" style="margin-bottom:10px">
      <button class="btn btn-outline small-btn" id="ac-prev">&lsaquo;</button><strong>${calMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
      <button class="btn btn-outline small-btn" id="ac-next">&rsaquo;</button></div>
      <div class="cal-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}`;
    for (let i = 0; i < first; i++) h += '<div class="day blank"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const st = availability[ds]?.status || 'available';
      h += `<button class="day ${st === 'available' ? 'open' : st} ${ds === selected ? 'sel' : ''}" data-d="${ds}" title="${ds}: ${st}">${d}</button>`;
    }
    h += '</div>';
    $('#admin-cal').innerHTML = h;
    $('#ac-prev').onclick = () => { calMonth = new Date(y, m - 1, 1); drawAdminCal(); };
    $('#ac-next').onclick = () => { calMonth = new Date(y, m + 1, 1); drawAdminCal(); };
  }
  function drawList() {
    const entries = Object.entries(availability).sort(([a], [b]) => a.localeCompare(b));
    $('#a-list').innerHTML = entries.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>${entries.map(([d, v]) =>
      `<tr><td>${esc(d)}</td><td><span class="pill">${esc(v.status)}</span></td><td>${esc(v.note)}</td><td><button class="btn btn-outline small-btn" data-open="${esc(d)}">Make available</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">All dates are available. Mark a date to change it.</p>';
  }
  $('#admin-cal').addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    selected = b.dataset.d;
    $('#a-from').value = selected; $('#a-to').value = selected;
    $('#a-status').value = availability[selected]?.status || 'available';
    $('#a-note').value = availability[selected]?.note || '';
    drawAdminCal();
  });
  $('#a-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-open]'); if (!b) return;
    try {
      await api('/api/admin/availability', { method: 'PUT', body: { dates: [b.dataset.open], status: 'available' } });
      say('#a-msg', 'Date is available again.'); await loadAvailability();
    } catch (err) { say('#a-msg', err.message, false); }
  });
  $('#a-apply').addEventListener('click', async () => {
    const from = $('#a-from').value, to = $('#a-to').value || from;
    if (!from) return say('#a-msg', 'Choose a date.', false);
    if (to < from) return say('#a-msg', 'The "To" date must be on or after "From".', false);
    const dates = [];
    for (let d = new Date(from + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
    if (dates.length > 400) return say('#a-msg', 'Please choose at most 400 days at a time.', false);
    try {
      const r = await api('/api/admin/availability', { method: 'PUT', body: { dates, status: $('#a-status').value, note: $('#a-note').value } });
      say('#a-msg', `Saved. ${r.updated} date(s) updated.`);
      await loadAvailability();
    } catch (err) { say('#a-msg', err.message, false); }
  });

  // ---------- enquiries ----------
  async function loadEnquiries() { enquiries = await api('/api/admin/enquiries'); drawEnquiries(); }
  function drawEnquiries() {
    const f = $('#e-filter').value, q = $('#e-search').value.trim().toLowerCase();
    const list = enquiries.filter((e) => (!f || e.status === f) && (!q || e.name.toLowerCase().includes(q) || e.phone.includes(q)));
    $('#e-body').innerHTML = list.length ? list.map((e) => `
      <tr data-id="${esc(e.id)}">
        <td>${esc(new Date(e.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))}</td>
        <td><b>${esc(e.name)}</b>${e.email ? '<br><span class="small muted">' + esc(e.email) + '</span>' : ''}</td>
        <td>${esc(e.eventType)}${e.package ? '<br><span class="small muted">' + esc(e.package) + '</span>' : ''}${e.budget ? '<br><span class="small muted">Budget: ' + esc(e.budget) + '</span>' : ''}</td>
        <td>${esc(e.date)}<br><span class="small muted">${esc(e.guests)} guests</span></td>
        <td><select data-field="status">${['Pending','Confirmed','Cancelled'].map((s) => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td style="min-width:200px"><div class="small">${esc(e.requirements)}</div><textarea class="wide" rows="2" data-field="adminNote" placeholder="Your private note">${esc(e.adminNote)}</textarea><button class="btn btn-outline small-btn" data-save-note>Save note</button></td>
        <td><a href="tel:+91${esc(e.phone)}">${esc(e.phone)}</a><br><a target="_blank" rel="noopener" href="https://wa.me/91${esc(e.phone)}">WhatsApp</a></td>
      </tr>`).join('') : '<tr><td colspan="7" class="muted">No enquiries match.</td></tr>';
  }
  $('#e-filter').addEventListener('change', drawEnquiries);
  $('#e-search').addEventListener('input', drawEnquiries);
  $('#e-body').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-field="status"]'); if (!sel) return;
    try {
      await api('/api/admin/enquiries/' + sel.closest('tr').dataset.id, { method: 'PATCH', body: { status: sel.value } });
      say('#e-msg', 'Status updated. The calendar reflects it.');
      await loadEnquiries();
    } catch (err) { say('#e-msg', err.message, false); await loadEnquiries(); }
  });
  $('#e-body').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-save-note]'); if (!b) return;
    const row = b.closest('tr');
    try {
      await api('/api/admin/enquiries/' + row.dataset.id, { method: 'PATCH', body: { adminNote: row.querySelector('[data-field="adminNote"]').value } });
      say('#e-msg', 'Note saved.');
    } catch (err) { say('#e-msg', err.message, false); }
  });
  $('#export').addEventListener('click', async () => {
    const r = await fetch(API + '/api/admin/export.csv', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return say('#e-msg', 'Export failed. Please log in again.', false);
    const url = URL.createObjectURL(await r.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'vaishnavi-enquiries.csv' });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // ---------- content ----------
  async function loadContent() {
    content = await api('/api/admin/content');
    $('#c-tagline').value = content.tagline || '';
    $('#c-hname').value = content.hall.name || '';
    $('#c-capacity').value = content.hall.capacity || '';
    $('#c-areas').value = (content.hall.areas || []).join('\n');
    $('#c-note').value = content.hall.note || '';
    $('#c-address').value = content.contact.address || '';
    $('#c-phones').value = (content.contact.phones || []).join(', ');
    $('#c-wa').value = content.contact.whatsapp || '';
    $('#c-maps').value = content.contact.mapsQuery || '';
    $('#c-hours').value = content.contact.hours || '';
    $('#c-restaurant').value = content.contact.restaurant || '';
    $('#c-wheel').checked = !!content.contact.wheelchair;
    $('#menu-cats').value = (content.menu.categories || []).join('\n');
    lists.events = content.events || [];
    lists.gallery = content.gallery || [];
    lists.facilities = content.facilities || [];
    lists.packages = content.packages || [];
    lists.menuItems = content.menu.items || [];
    lists.reviews = content.reviews || [];
    const cats = [...new Set([...(content.gallery || []).map((g) => g.category), 'Banquet Interiors', 'Weddings', 'Receptions', 'Engagements', 'Birthday Parties', 'Decorations', 'Food'])].filter(Boolean);
    $('#cat-list').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
    ['events', 'gallery', 'facilities', 'packages', 'menu', 'reviews'].forEach(renderList);
  }

  $('#save-hall').addEventListener('click', async () => {
    try {
      const phones = $('#c-phones').value.split(',').map((s) => s.trim()).filter(Boolean);
      const hall = {
        name: $('#c-hname').value.trim(), capacity: $('#c-capacity').value.trim(), note: $('#c-note').value.trim(),
        areas: $('#c-areas').value.split('\n').map((s) => s.trim()).filter(Boolean)
      };
      const contact = {
        address: $('#c-address').value.trim(), phones, whatsapp: $('#c-wa').value.trim(),
        mapsQuery: $('#c-maps').value.trim(), hours: $('#c-hours').value.trim(),
        restaurant: $('#c-restaurant').value.trim(), wheelchair: $('#c-wheel').checked
      };
      await api('/api/admin/content/hall', { method: 'PUT', body: { value: hall } });
      await api('/api/admin/content/contact', { method: 'PUT', body: { value: contact } });
      await api('/api/admin/content/tagline', { method: 'PUT', body: { value: $('#c-tagline').value.trim() } });
      say('#msg-hall', 'Saved. Refresh the public website to see changes.');
      await loadContent();
    } catch (err) { say('#msg-hall', err.message, false); }
  });

  // Add / remove / save buttons (event delegation)
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) return addItem(add.dataset.add);
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const card = rm.closest('.item');
      return removeItem(rm.dataset.remove, Number(card.dataset.i));
    }
    const sv = e.target.closest('[data-save]');
    if (sv) return saveList(sv.dataset.save);
  });

  // Photo upload: compress in the browser, then send to the server
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image. Try a JPG or PNG.')); };
      img.src = url;
    });
  }
  document.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-upload]')) return;
    const file = e.target.files[0]; if (!file) return;
    const field = e.target.closest('.field');
    const target = field.querySelector('[data-f]');
    const thumb = field.querySelector('img.thumb');
    const status = field.querySelector('.up-status');
    status.textContent = 'Uploading...';
    try {
      const dataUrl = await compressImage(file);
      const r = await api('/api/admin/upload', { method: 'POST', body: { dataUrl } });
      target.value = r.url; thumb.src = r.url; thumb.style.display = '';
      status.textContent = 'Uploaded. Click Save to publish.';
    } catch (err) { status.textContent = err.message; }
    e.target.value = '';
  });

  // ---------- start ----------
  async function start() {
    showApp(true);
    await Promise.all([loadOverview(), loadContent()]);
    await loadEnquiries();
  }
  if (location.protocol === 'file:') {
    $('#login-msg').textContent = 'Open the admin through the website address, not by double-clicking the file.';
  } else {
    (async () => {
      if (!token) return showApp(false);
      try { await start(); } catch { logout(true); }
    })();
  }
  $('#a-from').min = todayStr();
})();
