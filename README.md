# TapReview

NFC card + QR code + Google Review management platform for restaurants and businesses in the Philippines.

- **Customers** tap an NFC card or scan its QR code → a fast mobile landing page → **Write a Google Review**. No app, no account.
- **Businesses** manage branches, NFC cards, QR codes, their Google Review link and analytics.
- **Administrators** see every card, restaurant and location on an interactive **Philippine map**, manage inventory, reassign/replace cards, and read audit logs and reports.

Stack: React + Vite · Supabase (PostgreSQL, Auth, RLS) · Leaflet + OpenStreetMap (marker clustering + heatmap) · Recharts · qrcode · Lucide · Vercel.

---

## 1. Run it now (demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:5173. With no Supabase keys configured, the app runs in **demo mode**: realistic Philippine sample data lives in your browser (localStorage).

**Logging in:** the sign-in page lists the demo accounts — click one, or type it. Password for all: `demo1234`.

| Account | Role |
|---|---|
| `admin@tapreview.demo` | System administrator (map, all restaurants, inventory, users, logs, reports) |
| `owner@abccoffee.demo` | Business owner — ABC Coffee (3 Davao branches) |
| `staff@abccoffee.demo` | Staff — ABC Coffee, Davao Downtown branch only |

Try the customer flow: open any card → **Open landing page** (or copy its URL to your phone). Settings → **Reset demo data** restores the sample data.

> Demo mode is for exploring only — permissions are simulated in the browser. Use Supabase for anything real.

## 2. Production setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/migrations/001_schema.sql`.
3. (Optional) Run `supabase/seed.sql` for the Philippine reference data and demo restaurants. It always needs at least the regions/provinces part — if you don't want demo businesses, run only the first three `insert` statements.
   Regenerate it any time with `npm run seed:sql`.
4. Copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...            # the public anon key — never the service_role key
   VITE_PUBLIC_BASE_URL=https://tapreview.app
   ```
5. `npm run dev`, register an account at `/register`, then make yourself an admin in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
6. In Supabase **Auth → URL Configuration**, set the Site URL to your domain.

### Deploy to Vercel
Import the repo, add the same `VITE_*` environment variables, deploy. `vercel.json` already handles SPA routing (`/t/:token`, `/admin/...`) and security headers (HSTS, nosniff, frame-deny, referrer policy).

## 3. How NFC works

```
NFC card ──► https://tapreview.app/t/8FJ29KD3QX ──► card lookup ──► anonymous event log ──► landing page ──► Google Review
QR code  ──► https://tapreview.app/t/8FJ29KD3QX?src=qr (same page, counted as a scan)
```

- Each card gets a server-generated **Card ID** (`TR-NFC-000001`) and an **unpredictable 10-character public token**. Internal database IDs are never exposed.
- **Programming a tag:** write the card's public URL as a single **URL (NDEF) record**. On Android Chrome use **Write to NFC tag** on the card page (Web NFC); otherwise use any NFC writer app (e.g. NFC Tools). NTAG213/215/216 recommended. Lock the tag afterwards if you like — the destination is changed in TapReview, so the tag never needs rewriting.
- Android and iPhone XS+ open the URL natively; QR is the fallback for everything else.
- **Lost** / **replaced** cards immediately show "This NFC card has been disabled." **Inactive/suspended** cards show "This NFC card is currently inactive."
- **Replace card** marks the old card *Replaced*, creates a new card for the same restaurant/branch/destination, links the two, and keeps all historical analytics.

## 4. Privacy & review policy

- Only anonymous events are stored: `NFC_TAP`, `QR_SCAN`, `LANDING_PAGE_VIEW`, `GOOGLE_REVIEW_CLICK`, with timestamp, coarse device type, browser and referrer.
- **No customer GPS or identity is collected.** The map shows the *registered branch location*, never the customer's.
- TapReview never creates, submits, filters or gates reviews. Every customer sees the same button linking to the business's legitimate Google review page.

## 5. Security model

- **Row-level security** on every table. Admins see everything; owners see their businesses; staff see only their assigned branches; anonymous users can only call `public_card_visit` / `public_review_click`, which return public landing-page fields only.
- Card identifiers, public tokens and replacement links are generated server-side and immutable (trigger-enforced). Only admins can reassign a card to another business, suspend cards, change roles, or change business status.
- All card changes are written to `audit_logs` by database triggers (who, what, before/after, when). Reassignments also go to `nfc_card_assignments`.
- Public endpoints cap logged events per card per minute. Supabase Auth handles password hashing, sessions and its own rate limits.
- No secrets in the frontend — only the public anon key, which is safe because RLS enforces access.

## 6. Project layout

```
supabase/migrations/001_schema.sql   tables, indexes, RLS, triggers, RPCs
supabase/seed.sql                    generated reference + demo data
scripts/generate-seed.mjs            builds seed.sql from src/demo/seed.js
src/lib/api/                         one API, two adapters: supabase.js (production) and demo.js
src/lib/geo.js                       PH regions (incl. NIR), all provinces, major cities with coordinates
src/components/PHMap.jsx             Leaflet map: NFC markers, clustering, heatmap, popups
src/pages/public/Landing.jsx         customer tap/scan page (/t/:token)
src/pages/app/                       admin + business dashboards
```

## 7. Known limitations / next steps

- Logo and cover images are set by URL; add Supabase Storage uploads for direct upload.
- "PDF" export uses the browser's Print → Save as PDF.
- The city list in `geo.js` covers major cities; the branch form accepts any typed city/municipality and a map pin.
- OpenStreetMap's public tiles are fine for development; for production traffic set `VITE_MAP_TILE_URL` to a commercial tile provider (MapTiler, Stadia, etc.).
- Card lists load in full and paginate client-side — fine for thousands of cards; move to server-side pagination beyond ~50k.
