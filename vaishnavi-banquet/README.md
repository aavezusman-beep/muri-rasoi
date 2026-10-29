# Vaishnavi Banquet — Website

A premium website for Vaishnavi Banquet (Silli, Ranchi) and VR Vaishnavi Restaurant.
Plain HTML, CSS and JavaScript on the front end, with **Supabase** (free tier) for the database, login and photo storage.

---

## What is in this project

| File | Purpose |
|---|---|
| `index.html` | Home: hero, about, packages, facilities, gallery preview, Google reviews, testimonials, restaurant link, FAQ, location and contact |
| `gallery.html` | Photo gallery with category filters and lightbox (keyboard arrows and Esc work) |
| `menu.html` | Restaurant menu: search, category and vegetarian filters, dish details, enquiry list sent by WhatsApp |
| `booking.html` | Availability calendar (available / pending / unavailable) and booking enquiry form |
| `policies.html` | Terms, booking policy, cancellation and refund, privacy (placeholder text, owner review required) |
| `admin.html` | Owner dashboard: bookings, blocks, packages, menu, gallery, content, testimonials, CSV export, password |
| `css/styles.css` | Design (cream, champagne gold, ivory, deep maroon), responsive layout |
| `js/config.js` | **The file you edit**: venue details, Supabase keys, sample content |
| `js/common.js` | Shared header, footer, designer credit, helpers |
| `js/pages.js` | Logic for public pages |
| `js/admin.js` | Logic for the admin dashboard |
| `supabase/schema.sql` | Database tables, security rules, availability and enquiry functions |
| `assets/images/` | Venue photos (compressed WebP) |
| `robots.txt`, `sitemap.xml` | Search engine files. Replace `YOUR-DOMAIN` |
| `.env.example` | Lists the values you must fill in. Not read by the site |

---

## Step 1: Create the Supabase project (free)

1. Go to https://supabase.com and create an account.
2. Click **New project**. Pick a name, a database password (save it somewhere safe) and the region closest to India (Mumbai).
3. Wait for the project to finish setting up (about 2 minutes).

## Step 2: Create the database

1. In Supabase, open **SQL Editor > New query**.
2. Open `supabase/schema.sql` from this project, copy **all** of it, paste it in, and click **Run**.
3. It is safe to run again if something fails partway.

## Step 3: Get your public keys

1. Go to **Project Settings > API**.
2. Copy **Project URL** and the **anon public** key.
3. **Do not copy the `service_role` key.** It must never go into this website.

## Step 4: Fill in `js/config.js`

Set these values:

```js
SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
SUPABASE_ANON_KEY: 'YOUR-PUBLIC-ANON-KEY',
ENQUIRY_WHATSAPP: '919334192001',   // the number that receives enquiries: OWNER TO CONFIRM
```

The anon key is designed to be public. Database security comes from the rules in `schema.sql`, not from hiding this key.

## Step 5: Create the owner's admin login

1. Supabase > **Authentication > Users > Add user > Create new user**. Enter the owner's email and a strong password. Turn off "Auto Confirm" only if you want the owner to verify the email.
2. Supabase > **SQL Editor**, run this (replace the email):

```sql
insert into admins (user_id)
select id from auth.users where email = 'owner@example.com'
on conflict do nothing;
```

3. Open `admin.html` and sign in. The owner can change the password under **Settings**.

Only accounts in the `admins` table can change bookings, content or photos.

## Step 6: Run the site locally

The site is static, so you can serve the folder with any simple server:

```bash
cd vaishnavi-banquet
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

(Opening `index.html` directly by double-clicking can block some features, such as the database connection. Use the server above.)

## Step 7: Deploy (free options)

**Netlify Drop (easiest):** go to https://app.netlify.com/drop and drag the whole project folder onto the page. You get a public link.

**GitHub Pages:** create a repository, upload the files, then go to Settings > Pages and choose the main branch.

**Vercel:** import the folder as a static site.

After deploying, replace `YOUR-DOMAIN` in `robots.txt`, `sitemap.xml` and the `<link rel="canonical">` and structured-data URLs in `index.html`.

In Supabase > **Authentication > URL Configuration**, add your deployed domain to the allowed site URLs so password reset emails work.

---

## Things the owner must provide or confirm

These are **not** invented on the site. They show as placeholders or are hidden until supplied:

- **Tagline** and **About the venue** text (Admin > Content).
- **Packages and prices**. Admin > Packages. Leave a price blank and choose "Price on enquiry" if not decided.
- **Menu and prices** for the restaurant (Admin > Menu). The menu page shows a clearly labelled sample until real dishes are added.
- **Guest capacity**, facilities, parking and power backup details (Admin > Content). Only list what the venue actually offers.
- **Which WhatsApp number receives enquiries** (Admin > Content > Contact).
- **Google Business Profile link** and **Google review link**. Admin > Content > Contact. Until these are added, the Google reviews buttons stay hidden. No ratings or review counts are shown.
- **Instagram link**, only if verified.
- **Policies** (terms, booking, cancellation and refunds, privacy). The owner must review them before publishing. Nothing here is legal advice.
- **Photo permission.** The photos supplied for this site must be the venue's own, or used with the owner's permission. Decoration photos should be labelled as decoration setups.

---

## Important rules built in

- An enquiry is **never** a confirmed booking. The customer sees a reference number and the venue confirms it.
- A date becomes **unavailable** only after a booking is confirmed or the owner blocks it. Pending enquiries show amber and do not block the date.
- The database itself refuses to confirm a booking that clashes with another confirmed booking or a blocked date (`schema.sql`, `guard_booking` trigger).
- Customers cannot read other customers' bookings. The public calendar only shows available, pending or unavailable.
- Google reviews and website testimonials are kept separate. Website testimonials are never presented as Google reviews.
- The designer credit is in the shared footer code in `js/common.js`, not in admin-editable content, so the owner's edits cannot remove it.

---

## Ongoing care

- **Backups:** Supabase > Database > Backups (on paid plans, automatic). For your own copy, use Admin > Export & Backup for bookings CSV, and Table Editor for other tables.
- **Restore:** Restore from the Supabase backups page, or re-run `schema.sql` on a new project and re-enter content.
- **Google Search Console:** add the domain, verify it, and submit `sitemap.xml`.
- **Google Business Profile:** keep the venue's profile up to date. This is the source for the Google reviews links.
