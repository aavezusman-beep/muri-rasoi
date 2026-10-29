/* Admin dashboard. Every action writes to Supabase. Access is enforced by Row Level Security in the database. */
const $ = s => document.querySelector(s);
const panel = () => $('#panel');
const today = () => isoDate(new Date());
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const SLOT = { day: 'Day', evening: 'Evening', full_day: 'Full day' };
const lines = t => (t || '').split('\n').map(x => x.trim()).filter(Boolean);
const waPhone = p => { const d = String(p).replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; };
const money = n => '₹' + Number(n).toLocaleString('en-IN');

function needDb() { if (!db) { panel().innerHTML = '<div class="notice warn">Database not connected. Add Supabase details in js/config.js (see README).</div>'; return false; } return true; }
function err(e) { toast((e && e.message) || 'Something went wrong', 'err'); console.error(e); }

// ---------- AUTH ----------
async function start() {
  if (!db) { notice($('#login-notice'), '<strong>Setup needed before the admin can be used:</strong><ol style="margin:.5rem 0 0 1.1rem;padding:0"><li>Create a Supabase project and run <code>supabase/schema.sql</code>.</li><li>Add the Project URL and anon key to <code>js/config.js</code>.</li><li>Create the owner login and add it to the <code>admins</code> table (README, Step 5).</li></ol>', 'warn'); $('#login-form').querySelector('button').disabled = true; return; }
  const { data: { session } } = await db.auth.getSession();
  if (session) await enter(session); else show('login');
}
function show(which) { $('#login').hidden = which !== 'login'; $('#app').hidden = which !== 'app'; }
async function enter(session) {
  const { data, error } = await db.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (error || !data) {
    await db.auth.signOut();
    notice($('#login-notice'), 'This account is not authorised to use the admin dashboard. Ask the developer to add it to the admins table.', 'warn');
    show('login'); return;
  }
  show('app'); go('overview');
}
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button'); setBusy(btn, true);
  const { data, error } = await db.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
  setBusy(btn, false, 'Sign in');
  if (error) { notice($('#login-notice'), 'Sign-in failed: ' + esc(error.message), 'warn'); return; }
  notice($('#login-notice'), '');
  await enter(data.session);
});
$('#logout').addEventListener('click', async () => { if (db) await db.auth.signOut(); show('login'); });
document.querySelectorAll('.admin-nav [data-tab]').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
function go(tab) {
  document.querySelectorAll('.admin-nav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const r = { overview, bookings, calendar, packages, menu, gallery, content, testimonials, export: exportPanel, settings }[tab];
  if (needDb()) r().catch(err);
}

// ---------- OVERVIEW ----------
async function overview() {
  const count = async q => { const { count, error } = await q; if (error) throw error; return count || 0; };
  const [pending, confirmed, upcoming, blocks] = await Promise.all([
    count(db.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    count(db.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed')),
    count(db.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed').gte('event_date', today())),
    count(db.from('blocked_dates').select('*', { count: 'exact', head: true }).gte('block_date', today()))
  ]);
  const { data: recent } = await db.from('bookings').select('reference,customer_name,event_date,slot,status,created_at').order('created_at', { ascending: false }).limit(8);
  panel().innerHTML = `<h2>Dashboard</h2>
    <div class="stats">
      <div class="stat"><b>${pending}</b>Pending enquiries</div>
      <div class="stat"><b>${confirmed}</b>Confirmed bookings</div>
      <div class="stat"><b>${upcoming}</b>Upcoming events</div>
      <div class="stat"><b>${blocks}</b>Upcoming blocked dates</div>
    </div>
    <div class="panel"><h3>Recent enquiries</h3>${table(['Reference','Customer','Date','Slot','Status'],
      (recent || []).map(r => [esc(r.reference), esc(r.customer_name), fmtDate(r.event_date), SLOT[r.slot], badge(r.status)]))}</div>
    <p class="muted">Pending enquiries are not confirmed bookings. Confirm them in the Bookings tab.</p>`;
}
function badge(s) { return `<span class="status s-${s}">${s}</span>`; }
function table(heads, rows) {
  if (!rows.length) return '<div class="empty">Nothing here yet.</div>';
  return `<div style="overflow-x:auto"><table class="table"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ---------- BOOKINGS ----------
let bookingRows = [];
async function bookings() {
  const { data, error } = await db.from('bookings').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  bookingRows = data || [];
  panel().innerHTML = `<h2>Bookings &amp; Enquiries</h2>
    <div class="panel inline">
      <div><label class="muted">Search</label><input id="bsearch" placeholder="Name, phone, reference or date"></div>
      <div><label class="muted">Status</label><select id="bstatus"><option value="">All</option><option>pending</option><option>confirmed</option><option>rejected</option><option>cancelled</option></select></div>
      <div><label class="muted">Event type</label><select id="btype"><option value="">All</option><option>Wedding</option><option>Reception</option><option>Engagement</option><option>Birthday</option><option>Anniversary</option><option>Other</option></select></div>
    </div>
    <div id="blist"></div>`;
  ['bsearch','bstatus','btype'].forEach(id => $('#' + id).addEventListener(id === 'bsearch' ? 'input' : 'change', drawBookings));
  drawBookings();
}
function drawBookings() {
  const q = $('#bsearch').value.trim().toLowerCase(), st = $('#bstatus').value, ty = $('#btype').value;
  const list = bookingRows.filter(b => (!st || b.status === st) && (!ty || b.event_type === ty) &&
    (!q || [b.customer_name, b.phone, b.reference, b.event_date].join(' ').toLowerCase().includes(q)));
  const rows = list.map(b => [
    `<strong>${esc(b.reference)}</strong><br><span class="muted">${new Date(b.created_at).toLocaleString('en-IN')}</span>`,
    `${esc(b.customer_name)}<br><a href="tel:+${waPhone(b.phone)}">${esc(b.phone)}</a>${b.email ? '<br>' + esc(b.email) : ''}`,
    `${fmtDate(b.event_date)}<br>${SLOT[b.slot]}`,
    `${esc(b.event_type)}${b.guests ? '<br>' + b.guests + ' guests' : ''}${b.package_name ? '<br><span class="muted">' + esc(b.package_name) + '</span>' : ''}`,
    `${badge(b.status)}`,
    `${b.requirements ? '<div class="muted">Req: ' + esc(b.requirements) + '</div>' : ''}${b.customer_notes ? '<div class="muted">Notes: ' + esc(b.customer_notes) + '</div>' : ''}<div class="muted">Internal: ${esc(b.internal_notes || '—')}</div>`,
    `<div class="links">
      ${b.status !== 'confirmed' ? `<button class="btn btn-gold small" data-act="status" data-id="${b.id}" data-s="confirmed">Confirm</button>` : ''}
      ${b.status === 'pending' ? `<button class="btn btn-ghost small" data-act="status" data-id="${b.id}" data-s="rejected">Reject</button>` : ''}
      ${b.status === 'confirmed' ? `<button class="btn btn-ghost small" data-act="status" data-id="${b.id}" data-s="cancelled">Cancel</button>` : ''}
      ${b.status !== 'pending' ? `<button class="btn btn-ghost small" data-act="status" data-id="${b.id}" data-s="pending">Mark pending</button>` : ''}
      <button class="btn btn-ghost small" data-act="note" data-id="${b.id}">Notes</button>
      <a class="btn btn-maroon small" target="_blank" rel="noopener noreferrer" href="${waLink(`Hello ${b.customer_name}, regarding your enquiry ${b.reference} at ${SITE.venue}.`, waPhone(b.phone))}">WhatsApp</a>
    </div>`
  ]);
  $('#blist').innerHTML = table(['Reference','Customer','Date & slot','Event','Status','Details','Actions'], rows);
  $('#blist').onclick = async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    if (b.dataset.act === 'note') {
      const row = bookingRows.find(x => x.id === b.dataset.id);
      const txt = prompt('Internal notes (owner only):', row.internal_notes || ''); if (txt === null) return;
      const { error } = await db.from('bookings').update({ internal_notes: txt }).eq('id', b.dataset.id);
      if (error) return err(error);
      toast('Notes saved'); return bookings();
    }
    const s = b.dataset.s;
    if (['cancelled','rejected'].includes(s) && !confirm(`Mark this booking as ${s}?`)) return;
    b.disabled = true;
    const { error } = await db.from('bookings').update({ status: s }).eq('id', b.dataset.id);
    if (error) { err(error); b.disabled = false; return; }
    toast(`Booking ${s}`); bookings();
  };
}

// ---------- CALENDAR & BLOCKS ----------
async function calendar() {
  const { data: halls } = await db.from('halls').select('id,name').eq('active', true).order('name');
  const { data: blocks, error } = await db.from('blocked_dates').select('*').gte('block_date', today()).order('block_date').limit(300);
  if (error) throw error;
  const { data: pend } = await db.from('bookings').select('reference,event_date,slot').eq('status', 'pending').gte('event_date', today()).order('event_date').limit(100);
  const hallName = id => (halls || []).find(h => h.id === id)?.name || '—';
  panel().innerHTML = `<h2>Calendar &amp; Blocked Dates</h2>
    <p class="muted">Confirmed bookings and blocked dates make a date unavailable on the public calendar. Pending enquiries show as amber and are not reserved.</p>
    <div class="panel"><h3>Block a date (maintenance / private event)</h3>
      <form class="inline" id="block-form">
        <div><label class="muted">Hall</label><select name="hall">${(halls || []).map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></div>
        <div><label class="muted">Date</label><input type="date" name="d" required min="${today()}"></div>
        <div><label class="muted">Slot</label><select name="s"><option value="full_day">Full day</option><option value="day">Day</option><option value="evening">Evening</option></select></div>
        <div style="flex:1 1 200px"><label class="muted">Reason (private)</label><input name="r" maxlength="120" style="width:100%"></div>
        <button class="btn btn-maroon small" type="submit">Block date</button>
      </form></div>
    <div class="panel"><h3>Upcoming blocked dates</h3>${table(['Date','Slot','Hall','Reason',''],
      (blocks || []).map(b => [fmtDate(b.block_date), SLOT[b.slot], esc(hallName(b.hall_id)), esc(b.reason || '—'),
        `<button class="btn btn-ghost small" data-unblock="${b.id}">Unblock</button>`]))}</div>
    <div class="panel"><h3>Pending enquiries (not confirmed)</h3>${table(['Reference','Date','Slot'],
      (pend || []).map(p => [esc(p.reference), fmtDate(p.event_date), SLOT[p.slot]]))}</div>`;
  $('#block-form').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target;
    const { error } = await db.from('blocked_dates').insert({ hall_id: f.hall.value, block_date: f.d.value, slot: f.s.value, reason: f.r.value || null });
    if (error) return err(error);
    toast('Date blocked'); calendar();
  });
  panel().onclick = async e => {
    const b = e.target.closest('[data-unblock]'); if (!b) return;
    if (!confirm('Unblock this date? It will show as available again.')) return;
    const { error } = await db.from('blocked_dates').delete().eq('id', b.dataset.unblock);
    if (error) return err(error);
    toast('Date unblocked'); calendar();
  };
}

// ---------- GENERIC CRUD for packages / menu / testimonials ----------
async function packages() {
  const { data } = await db.from('packages').select('*').order('sort_order');
  panel().innerHTML = `<h2>Packages &amp; Pricing</h2>
    <p class="muted">Leave price blank and choose "Price on enquiry" if you have not set a price. Nothing is invented.</p>
    <div class="panel"><h3 id="pk-title">Add package</h3>
    <form class="form" id="pk-form"><input type="hidden" name="id">
      <div class="row"><div><label>Name *</label><input name="name" required></div>
        <div><label>Price type</label><select name="price_type"><option value="enquiry">Price on enquiry</option><option value="fixed">Fixed price</option><option value="per_plate">Per plate</option></select></div></div>
      <div class="row"><div><label>Price (₹)</label><input name="price" type="number" min="0" step="1"></div>
        <div><label>Guest limit</label><input name="guest_limit" type="number" min="1"></div></div>
      <div><label>Description</label><textarea name="description"></textarea></div>
      <div class="row"><div><label>Inclusions (one per line)</label><textarea name="inclusions"></textarea></div>
        <div><label>Exclusions (one per line)</label><textarea name="exclusions"></textarea></div></div>
      <div class="row"><div><label>Sort order</label><input name="sort_order" type="number" value="0"></div>
        <div class="links"><label><input type="checkbox" name="featured"> Featured</label><label><input type="checkbox" name="visible" checked> Visible on website</label></div></div>
      <div class="links"><button class="btn btn-maroon small" type="submit">Save package</button><button type="button" class="btn btn-ghost small" id="pk-reset">Clear form</button></div>
    </form></div>
    <div class="panel">${table(['Name','Price','Visible','Featured',''], (data || []).map(p => [esc(p.name),
      p.price_type === 'enquiry' || p.price == null ? 'On enquiry' : money(p.price) + (p.price_type === 'per_plate' ? ' / plate' : ''),
      p.visible ? 'Yes' : 'No', p.featured ? 'Yes' : '',
      `<div class="links"><button class="btn btn-ghost small" data-edit="${p.id}">Edit</button><button class="btn btn-ghost small" data-del="${p.id}">Delete</button></div>`]))}</div>`;
  const pkRows = data || [];
  const f = $('#pk-form');
  $('#pk-reset').onclick = () => f.reset();
  panel().onclick = async e => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (ed) { const p = pkRows.find(x => x.id === ed.dataset.edit); fillForm(f, p, { inclusions: (p.inclusions || []).join('\n'), exclusions: (p.exclusions || []).join('\n') }); $('#pk-title').textContent = 'Edit package'; f.scrollIntoView(); }
    if (dl) { if (!confirm('Delete this package permanently?')) return; const { error } = await db.from('packages').delete().eq('id', dl.dataset.del); if (error) return err(error); toast('Package deleted'); packages(); }
  };
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const v = f.elements; const row = {
      name: v.name.value.trim(), price_type: v.price_type.value, price: v.price.value === '' ? null : +v.price.value,
      guest_limit: v.guest_limit.value === '' ? null : +v.guest_limit.value, description: v.description.value.trim() || null,
      inclusions: lines(v.inclusions.value), exclusions: lines(v.exclusions.value), sort_order: +v.sort_order.value || 0,
      featured: v.featured.checked, visible: v.visible.checked
    };
    if (row.price_type !== 'enquiry' && row.price == null) return toast('Enter a price, or choose "Price on enquiry"', 'err');
    const q = v.id.value ? db.from('packages').update(row).eq('id', v.id.value) : db.from('packages').insert(row);
    const { error } = await q; if (error) return err(error);
    toast('Package saved'); packages();
  });
}
function fillForm(f, obj, extra = {}) {
  f.reset();
  Object.entries({ ...obj, ...extra }).forEach(([k, val]) => {
    const el = f.elements[k]; if (!el) return;
    if (el.type === 'checkbox') el.checked = !!val; else el.value = val ?? '';
  });
}

async function menu() {
  const { data } = await db.from('menu_items').select('*').order('sort_order');
  panel().innerHTML = `<h2>Menu</h2>
    <div class="panel"><h3 id="mn-title">Add dish</h3>
    <form class="form" id="mn-form"><input type="hidden" name="id">
      <div class="row"><div><label>Name *</label><input name="name" required></div><div><label>Category *</label><input name="category" required placeholder="Starters, Main course, Desserts…"></div></div>
      <div><label>Description</label><textarea name="description"></textarea></div>
      <div class="row"><div><label>Price (₹, blank = not set)</label><input name="price" type="number" min="0"></div>
        <div><label>Veg / non-veg</label><select name="is_veg"><option value="">Not specified</option><option value="true">Vegetarian</option><option value="false">Non-vegetarian</option></select></div></div>
      <div class="row"><div><label>Image URL (optional)</label><input name="image_url" type="url"></div><div><label>Sort order</label><input name="sort_order" type="number" value="0"></div></div>
      <div class="links"><label><input type="checkbox" name="available" checked> Available</label></div>
      <div class="links"><button class="btn btn-maroon small" type="submit">Save dish</button><button type="button" class="btn btn-ghost small" id="mn-reset">Clear form</button></div>
    </form></div>
    <div class="panel">${table(['Category','Dish','Price','Available',''], (data || []).map(i => [esc(i.category), esc(i.name),
      i.price == null ? '—' : money(i.price), i.available ? 'Yes' : 'No',
      `<div class="links"><button class="btn btn-ghost small" data-edit="${i.id}">Edit</button><button class="btn btn-ghost small" data-del="${i.id}">Delete</button></div>`]))}</div>`;
  const rows = data || []; const f = $('#mn-form');
  $('#mn-reset').onclick = () => f.reset();
  panel().onclick = async e => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (ed) { const i = rows.find(x => x.id === ed.dataset.edit); fillForm(f, { ...i, is_veg: i.is_veg == null ? '' : String(i.is_veg) }); $('#mn-title').textContent = 'Edit dish'; f.scrollIntoView(); }
    if (dl) { if (!confirm('Delete this dish?')) return; const { error } = await db.from('menu_items').delete().eq('id', dl.dataset.del); if (error) return err(error); toast('Dish deleted'); menu(); }
  };
  f.addEventListener('submit', async e => {
    e.preventDefault(); const v = f.elements;
    const row = { name: v.name.value.trim(), category: v.category.value.trim(), description: v.description.value.trim() || null,
      price: v.price.value === '' ? null : +v.price.value, is_veg: v.is_veg.value === '' ? null : v.is_veg.value === 'true',
      image_url: v.image_url.value.trim() || null, sort_order: +v.sort_order.value || 0, available: v.available.checked };
    const q = v.id.value ? db.from('menu_items').update(row).eq('id', v.id.value) : db.from('menu_items').insert(row);
    const { error } = await q; if (error) return err(error);
    toast('Dish saved'); menu();
  });
}

async function testimonials() {
  const { data } = await db.from('testimonials').select('*').order('event_date', { ascending: false, nullsFirst: false });
  panel().innerHTML = `<h2>Testimonials</h2>
    <p class="muted">These are website testimonials only. They are not Google reviews. Add a name or initials only with the customer's permission. Never add invented testimonials.</p>
    <div class="panel"><h3>Add testimonial</h3>
    <form class="form" id="tm-form">
      <div class="row"><div><label>Customer name or initials</label><input name="customer_name" maxlength="60"></div><div><label>Event type</label><input name="event_type" maxlength="40"></div></div>
      <div class="row"><div><label>Event date</label><input name="event_date" type="date"></div><div class="links"><label><input type="checkbox" name="approved"> Approved</label><label><input type="checkbox" name="show_on_home"> Show on home page</label></div></div>
      <div><label>Testimonial *</label><textarea name="quote" required maxlength="600"></textarea></div>
      <div><button class="btn btn-maroon small" type="submit">Save</button></div>
    </form></div>
    <div class="panel">${table(['Name','Event','Quote','Approved','Home',''], (data || []).map(t => [esc(t.customer_name || '—'), esc(t.event_type || '—'), esc(t.quote),
      `<input type="checkbox" data-tog="approved" data-id="${t.id}" ${t.approved ? 'checked' : ''}>`,
      `<input type="checkbox" data-tog="show_on_home" data-id="${t.id}" ${t.show_on_home ? 'checked' : ''}>`,
      `<button class="btn btn-ghost small" data-del="${t.id}">Delete</button>`]))}</div>`;
  $('#tm-form').addEventListener('submit', async e => {
    e.preventDefault(); const v = e.target.elements;
    const { error } = await db.from('testimonials').insert({ customer_name: v.customer_name.value.trim() || null, event_type: v.event_type.value.trim() || null,
      event_date: v.event_date.value || null, quote: v.quote.value.trim(), approved: v.approved.checked, show_on_home: v.show_on_home.checked });
    if (error) return err(error); toast('Testimonial saved'); testimonials();
  });
  panel().onchange = async e => { const t = e.target; if (!t.dataset.tog) return;
    const { error } = await db.from('testimonials').update({ [t.dataset.tog]: t.checked }).eq('id', t.dataset.id); if (error) return err(error); toast('Updated'); };
  panel().onclick = async e => { const d = e.target.closest('[data-del]'); if (!d) return;
    if (!confirm('Delete this testimonial permanently?')) return;
    const { error } = await db.from('testimonials').delete().eq('id', d.dataset.del); if (error) return err(error); toast('Deleted'); testimonials(); };
}

// ---------- GALLERY ----------
const IMG_TYPES = ['image/jpeg','image/png','image/webp','image/avif'];
async function gallery() {
  const { data } = await db.from('gallery_images').select('*').order('sort_order');
  panel().innerHTML = `<h2>Gallery</h2>
    <div class="panel"><h3>Upload photo</h3>
    <form class="form" id="gl-form">
      <div><label>Photo (JPG, PNG, WebP or AVIF, max 5 MB) *</label><input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required></div>
      <div class="row"><div><label>Caption</label><input name="caption" maxlength="120"></div>
        <div><label>Category</label><select name="category"><option>Exterior</option><option>Interior</option><option>Stage</option><option>Decoration</option><option>Dining</option><option>Events</option></select></div></div>
      <div><button class="btn btn-maroon small" type="submit">Upload</button> <span id="gl-status" class="muted"></span></div>
    </form>
    <p class="hint muted">Preview: the uploaded photo appears on the Gallery page immediately after upload. Remove a photo with Delete.</p></div>
    <div class="panel">${table(['Preview','Caption','Category','Order','Visible',''], (data || []).map(g => [
      `<img class="thumb" src="${esc(g.url)}" alt="">`, esc(g.caption || '—'), esc(g.category || '—'),
      `<input type="number" value="${g.sort_order}" data-order="${g.id}" style="width:70px">`,
      `<input type="checkbox" data-vis="${g.id}" ${g.visible ? 'checked' : ''}>`,
      `<button class="btn btn-ghost small" data-del="${g.id}" data-url="${esc(g.url)}">Delete</button>`]))}</div>`;
  $('#gl-form').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, file = f.file.files[0], st = $('#gl-status'), btn = f.querySelector('button');
    if (!file) return;
    if (!IMG_TYPES.includes(file.type)) return toast('Only JPG, PNG, WebP or AVIF images are allowed', 'err');
    if (file.size > 5 * 1024 * 1024) return toast('Image is larger than 5 MB. Please resize it first.', 'err');
    setBusy(btn, true); st.textContent = 'Uploading…';
    const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await db.storage.from('gallery').upload(path, file, { contentType: file.type, cacheControl: '3600' });
    if (upErr) { setBusy(btn, false, 'Upload'); st.textContent = ''; return err(upErr); }
    const url = db.storage.from('gallery').getPublicUrl(path).data.publicUrl;
    const { error } = await db.from('gallery_images').insert({ url, caption: f.caption.value.trim() || null, category: f.category.value, sort_order: 0 });
    setBusy(btn, false, 'Upload');
    if (error) return err(error);
    toast('Photo uploaded'); gallery();
  });
  panel().onchange = async e => {
    if (e.target.dataset.vis) { const { error } = await db.from('gallery_images').update({ visible: e.target.checked }).eq('id', e.target.dataset.vis); if (error) return err(error); toast('Updated'); }
    if (e.target.dataset.order) { const { error } = await db.from('gallery_images').update({ sort_order: +e.target.value || 0 }).eq('id', e.target.dataset.order); if (error) return err(error); toast('Order saved'); }
  };
  panel().onclick = async e => {
    const d = e.target.closest('[data-del]'); if (!d) return;
    if (!confirm('Delete this photo from the website? This cannot be undone.')) return;
    const { error } = await db.from('gallery_images').delete().eq('id', d.dataset.del);
    if (error) return err(error);
    const marker = '/object/public/gallery/'; const i = d.dataset.url.indexOf(marker);
    if (i > -1) await db.storage.from('gallery').remove([d.dataset.url.slice(i + marker.length)]);
    toast('Photo deleted'); gallery();
  };
}

// ---------- CONTENT & HALL ----------
async function getContent() {
  const { data } = await db.from('site_content').select('key,value'); const o = {};
  (data || []).forEach(r => o[r.key] = r.value); return o;
}
async function saveKey(key, value) { const { error } = await db.from('site_content').upsert({ key, value, updated_at: new Date().toISOString() }); if (error) throw error; }

async function content() {
  const c = await getContent(); const ct = c.contact || {}; const pol = c.policies || {};
  const { data: halls } = await db.from('halls').select('*').order('name');
  const h = (halls || [])[0] || {};
  panel().innerHTML = `<h2>Website Content</h2>
    <div class="panel"><h3>Homepage</h3><form class="form" id="f-home">
      <div><label>Headline</label><input name="hero_title" value="${esc(c.hero_title || '')}"></div>
      <div><label>Tagline</label><input name="hero_tagline" value="${esc(c.hero_tagline || '')}"></div>
      <div><label>About the venue</label><textarea name="about_text" rows="5">${esc(c.about_text || '')}</textarea></div>
      <div><label>Facilities (one per line, only what the venue offers)</label><textarea name="facilities">${esc((c.facilities || []).join('\n'))}</textarea></div>
      <button class="btn btn-maroon small" type="submit">Save homepage</button></form></div>
    <div class="panel"><h3>Contact &amp; location</h3><form class="form" id="f-contact">
      <div class="row"><div><label>Phone numbers (comma-separated)</label><input name="phones" value="${esc((ct.phones || SITE.phones || []).join(', '))}"></div>
        <div><label>WhatsApp enquiry number (country code + number)</label><input name="enquiry_whatsapp" value="${esc(ct.enquiry_whatsapp || SITE.enquiry_whatsapp || '')}"></div></div>
      <div class="row"><div><label>Address</label><input name="address" value="${esc(ct.address || SITE.address || '')}"></div>
        <div><label>Email</label><input name="email" type="email" value="${esc(ct.email || '')}"></div></div>
      <div><label>Map search text (exact place name)</label><input name="map_query" value="${esc(ct.map_query || SITE.map_query || '')}"></div>
      <div class="row"><div><label>Google Business Profile link (verified)</label><input name="google_business_url" type="url" value="${esc(ct.google_business_url || '')}"></div>
        <div><label>Google review form link (verified)</label><input name="google_review_url" type="url" value="${esc(ct.google_review_url || '')}"></div></div>
      <div><label>Instagram link (only if verified)</label><input name="instagram_url" type="url" value="${esc(ct.instagram_url || '')}"></div>
      <button class="btn btn-maroon small" type="submit">Save contact</button></form></div>
    <div class="panel"><h3>Hall details</h3><form class="form" id="f-hall">
      <div class="row"><div><label>Hall name</label><input name="name" value="${esc(h.name || '')}" required></div>
        <div><label>Guest capacity (blank = not yet confirmed)</label><input name="capacity" type="number" min="1" value="${h.capacity ?? ''}"></div></div>
      <div><label>Description</label><textarea name="description">${esc(h.description || '')}</textarea></div>
      <button class="btn btn-maroon small" type="submit">Save hall</button></form></div>
    <div class="panel"><h3>FAQs (JSON list of {"q": "...", "a": "..."})</h3><form class="form" id="f-faq">
      <textarea name="faqs" rows="10" style="font-family:monospace">${esc(JSON.stringify(c.faqs || CFG.FAQS, null, 2))}</textarea>
      <button class="btn btn-maroon small" type="submit">Save FAQs</button></form></div>
    <div class="panel"><h3>Policies (owner review required before publishing)</h3><form class="form" id="f-pol">
      ${['terms','booking','cancellation','privacy'].map(k => `<div><label>${({terms:'Terms & Conditions',booking:'Booking Policy',cancellation:'Cancellation & Refund',privacy:'Privacy Policy'})[k]}</label><textarea name="${k}" rows="4">${esc(pol[k] || '')}</textarea></div>`).join('')}
      <button class="btn btn-maroon small" type="submit">Save policies</button></form></div>`;

  const wrap = (id, fn) => $(id).addEventListener('submit', async e => { e.preventDefault(); try { await fn(new FormData(e.target)); toast('Saved'); } catch (x) { err(x); } });
  wrap('#f-home', async fd => {
    await saveKey('hero_title', fd.get('hero_title')); await saveKey('hero_tagline', fd.get('hero_tagline'));
    await saveKey('about_text', fd.get('about_text')); await saveKey('facilities', lines(fd.get('facilities')));
  });
  wrap('#f-contact', async fd => {
    await saveKey('contact', { phones: fd.get('phones').split(',').map(s => s.trim()).filter(Boolean), enquiry_whatsapp: fd.get('enquiry_whatsapp').replace(/\D/g, ''),
      address: fd.get('address'), email: fd.get('email'), map_query: fd.get('map_query'), google_business_url: fd.get('google_business_url'),
      google_review_url: fd.get('google_review_url'), instagram_url: fd.get('instagram_url') });
  });
  wrap('#f-hall', async fd => {
    const row = { name: fd.get('name').trim(), capacity: fd.get('capacity') ? +fd.get('capacity') : null, description: fd.get('description').trim() || null };
    const q = h.id ? db.from('halls').update(row).eq('id', h.id) : db.from('halls').insert(row);
    const { error } = await q; if (error) throw error;
  });
  wrap('#f-faq', async fd => { let v; try { v = JSON.parse(fd.get('faqs')); } catch { throw new Error('FAQ text is not valid JSON. Check commas and quotes.'); }
    if (!Array.isArray(v) || v.some(x => !x.q || !x.a)) throw new Error('Each FAQ needs "q" and "a".'); await saveKey('faqs', v); });
  wrap('#f-pol', async fd => { await saveKey('policies', { terms: fd.get('terms'), booking: fd.get('booking'), cancellation: fd.get('cancellation'), privacy: fd.get('privacy') }); });
}

// ---------- EXPORT ----------
function csvCell(v) { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
async function exportPanel() {
  panel().innerHTML = `<h2>Export &amp; Backup</h2>
    <div class="panel"><h3>Export bookings to CSV</h3>
      <p class="muted">Includes references, dates, statuses and customer contact details. Internal notes and passwords or keys are never exported.</p>
      <button class="btn btn-maroon small" id="csv">Download bookings CSV</button></div>
    <div class="panel"><h3>Database backup</h3>
      <p>Supabase automatically backs up paid projects. To take your own copy: Supabase Dashboard &gt; Database &gt; Backups, or export tables from the Table Editor. To restore, use Supabase support or the SQL editor with your exported file. See the README for steps.</p></div>`;
  $('#csv').onclick = async () => {
    const { data, error } = await db.from('bookings').select('reference,status,event_date,slot,event_type,customer_name,phone,email,guests,package_name,requirements,customer_notes,created_at').order('event_date');
    if (error) return err(error);
    const cols = ['reference','status','event_date','slot','event_type','customer_name','phone','email','guests','package_name','requirements','customer_notes','created_at'];
    const csv = [cols.join(','), ...(data || []).map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `vaishnavi-bookings-${today()}.csv`; a.click(); toast('CSV downloaded');
  };
}

// ---------- SETTINGS ----------
async function settings() {
  panel().innerHTML = `<h2>Settings</h2>
    <div class="panel"><h3>Change password</h3><form class="form" id="pw-form" style="max-width:380px">
      <div><label>New password (min 8 characters)</label><input type="password" name="p" minlength="8" required autocomplete="new-password"></div>
      <button class="btn btn-maroon small" type="submit">Update password</button></form></div>
    <div class="panel"><h3>Security</h3><p class="muted">Admin pages are protected by Supabase login and database rules. Only accounts listed in the admins table can change content or bookings.</p></div>`;
  $('#pw-form').addEventListener('submit', async e => { e.preventDefault();
    const { error } = await db.auth.updateUser({ password: e.target.p.value }); if (error) return err(error); toast('Password updated'); e.target.reset(); });
}

start();
