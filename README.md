# Vaishnavi Banquet – Website, Database and Admin

This folder is the complete website. It has three parts:

| Part | What it does | Where it runs |
|---|---|---|
| Website (`public/index.html` etc.) | What visitors see | Render (or GitHub Pages, see Step 6) |
| Server (`server.js`) | Handles enquiries, availability, admin login, uploads | Render |
| Database + photo storage | Keeps all enquiries, calendar and content permanently | Supabase |

Your design, layout, photos and animations are unchanged.

---

## Part 1 – Set up the database on Supabase (about 10 minutes)

1. Go to **https://supabase.com** and click **Start your project**. Sign in with GitHub or email.
2. Click **New project**.
   - Name: `vaishnavi-banquet`
   - Database password: create a strong one and save it somewhere safe.
   - Region: choose the one closest to India (for example *Mumbai*, if listed).
   - Click **Create new project** and wait about 2 minutes.
3. In the left menu, click **SQL Editor**, then **+ New query**.
4. Open the file `supabase-schema.sql` from this folder, copy **everything**, paste it into the editor, and click **Run**. You should see "Success". This creates the tables and the photo storage.
5. Get your two keys:
   - Click the **gear icon** (Project Settings) at the bottom left, then **API**.
   - Copy the **Project URL** (looks like `https://abcd1234.supabase.co`). This is `SUPABASE_URL`.
   - Under **Project API keys**, copy the key named **service_role** (click "Reveal" first). This is `SUPABASE_SERVICE_ROLE_KEY`.

**Important:** the `service_role` key is a secret. Never paste it into the website files, into GitHub, or into a chat. It only goes into Render's environment settings (Step 3).

---

## Part 2 – Put the code on GitHub

1. Go to **https://github.com** and sign in.
2. Click **+** (top right) > **New repository**. Name it `vaishnavi-banquet`. Choose **Private**. Click **Create repository**.
3. Click **uploading an existing file**. Drag in **everything inside** the `vaishnavi-banquet` folder (the `public` folder, `server.js`, `package.json`, `data`, `supabase-schema.sql`, `README.md`, `.gitignore`). Click **Commit changes**.

Do **not** upload `node_modules` or any `.env` file.

---

## Part 3 – Deploy on Render (about 10 minutes)

1. Go to **https://render.com**, sign up with GitHub.
2. Click **New +** > **Web Service**. Connect your GitHub account and choose the `vaishnavi-banquet` repository.
3. Fill in the form:
   - **Name:** `vaishnavi-banquet`
   - **Region:** Singapore (closest to India) or any.
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (or a paid plan, see the note below)
4. Scroll to **Environment Variables** and click **Add Environment Variable** for each line below:

| Key | Value |
|---|---|
| `SUPABASE_URL` | the Project URL from Part 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from Part 1 |
| `ADMIN_PASSWORD` | the password the owner will type to log in (at least 12 characters) |
| `ADMIN_SECRET` | a long random text (see below) |
| `NODE_VERSION` | `20` |

**To create `ADMIN_SECRET`:** open any terminal (or the Node.js prompt) and run:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
Copy the long line it prints and paste it as the value.

5. Click **Create Web Service**. Wait for the logs to say the server is running (a few minutes).
6. At the top, Render shows your live address, e.g. `https://vaishnavi-banquet.onrender.com`.
   - Website: that address
   - Admin login: that address + `/admin.html`

**Free plan note:** Free services sleep after 15 minutes without visitors. The first visit after a sleep can take 30–60 seconds. For a live business site, a paid Render plan (about USD 7/month) keeps it always on.

---

## Part 4 – First check (after deploy)

1. Open the website address. The events, gallery, facilities, menu, packages and reviews should all show.
2. Open `/admin.html`, log in with `ADMIN_PASSWORD`.
3. Make a test enquiry on the website, then check it appears under **Enquiries** in the admin.
4. Delete the test enquiry if needed: it is stored in Supabase under **Table Editor > enquiries**.

If something fails, open Render's **Logs** tab; the error message is shown there.

---

## Part 5 – Using the admin dashboard (for the owner)

- **Hall Availability:** choose a date or range, pick Available / Booked / Unavailable, add a private note, click **Save availability**.
- **Enquiries:** change the status. **Confirmed** marks the date Booked automatically. **Cancelled** frees the date. Use **Export to Excel (CSV)** to download all enquiries.
- **Hall & Contact:** name, capacity, areas, address, phone numbers, WhatsApp number for enquiries, hours.
- **Events, Gallery, Facilities, Packages, Menu, Reviews:**
  - **+ Add** creates a new entry. **Remove** deletes one.
  - Photos: click the file box, choose a photo from the phone or computer. It uploads automatically; then click **Save**.
  - Every section has its own **Save** button at the bottom. Changes appear on the public website after a refresh.
  - Facilities only show when **Show on website** is ticked. Dishes marked not available are hidden.

Enquiries are never confirmed bookings until the owner sets them to Confirmed.

---

## Part 6 – Optional: keep GitHub Pages as the website address

If you still want the site at `aavezusman-beep.github.io/try/`:
1. Open `public/js/config.js` and set `window.VB_API_BASE` to your Render address, for example `'https://vaishnavi-banquet.onrender.com'`. Upload the change to GitHub.
2. On Render, add the environment variable `ALLOWED_ORIGINS` = `https://aavezusman-beep.github.io`
3. Upload the `public` folder contents to the GitHub Pages repository. The admin page still works through the Render address (`https://vaishnavi-banquet.onrender.com/admin.html`).

Simplest option: use the Render address for everything and skip this part.

---

## Security summary

- Service-role key and admin secrets live only in Render's environment settings, never in the website files.
- Supabase tables are locked (Row Level Security): the public website can't read or change them directly; only the server can.
- Admin login uses a signed token that expires after 8 hours. Five wrong passwords lock login for 15 minutes.
- Uploaded photos are checked for type (JPG/PNG/WebP) and size (max 5 MB).
- Customer details are only visible in the admin dashboard.

## Credits

Designed & Developed by Aavez Usman · 7004898475 · Instagram @aavez_usman
