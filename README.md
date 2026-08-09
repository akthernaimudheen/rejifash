# Reji Fashions

A complete ethnic-wear storefront: catalog, cart, UPI payment, order tracking,
WhatsApp order alerts, and an admin dashboard with a photo studio for turning
raw phone pictures into catalog imagery.

No dependencies, no build step, no accounts. Node's standard library only.

```bash
node server/server.js
```

| | |
|---|---|
| Storefront | http://localhost:4173/ |
| Track an order | http://localhost:4173/orders |
| Shop admin | http://localhost:4173/admin — `admin` / `reji@admin` |

Opening `index.html` straight off disk also works — the site falls back to
storing orders in the browser so you can demo it with no server. A chip in the
top bar says when it's in that mode.

---

## Before you take a real order

Two settings decide whether money and messages reach you. Both live in
**Admin → Settings**.

### 1. Your UPI ID

`data/config.json` ships with `9074666413@upi` as a placeholder. **Every QR the
site prints pays whatever is in this field**, so replace it with the real one
from your UPI app (Profile → UPI IDs) and send yourself a ₹1 test before going
live.

### 2. WhatsApp alerts

Order alerts go to **+91 90746 66413**. How they're delivered is up to you:

| Mode | Setup | What happens |
|---|---|---|
| **Manual** (default) | none | Every order shows a one-tap "send on WhatsApp" link in the dashboard, and the customer gets a prefilled link on their confirmation screen. Nothing is automatic, nothing is lost. |
| **CallMeBot** | free | Messages arrive on your WhatsApp by themselves. Send `I allow callmebot to send me messages` to **+34 644 51 95 23** from your shop number; paste the API key it replies with into Settings. |
| **Meta Cloud API** | verified business | Official route. Free-form text only reaches a number inside a 24-hour service window — outside it you need an approved template. |
| **Twilio** | paid | Twilio WhatsApp sender. |

Use **Send a test message** in Settings to confirm before relying on it.

---

## How payment actually works

This matters, because it is the one place where being vague would cost you money.

A static UPI QR has **no callback**. Nothing tells the website that a payment
happened — that information only exists in your bank. So the site does not
pretend to know:

1. Customer checks out. **The order is saved first, before any payment.**
2. A QR appears with the exact amount and the order number already filled in
   (`Reji RF-260809-0001`). That reference is how a line in your bank statement
   gets matched back to an order.
3. Customer pays and enters the UPI reference (UTR), optionally a screenshot.
4. Order shows in the dashboard as **Payment claimed — verify**.
5. You check your bank, hit **✅ Payment received**, and the order moves to
   Confirmed. One tap sends the customer a WhatsApp confirmation.

Saving the order before payment is deliberate: a customer who scans the QR and
then loses signal still appears in your dashboard as "awaiting payment" and can
be chased, instead of vanishing. They can also finish paying later from the
Track Order page — the same QR reappears there.

If you'd rather have payment confirmed automatically, that needs a payment
gateway (Razorpay, Cashfree, PhonePe PG) with a webhook. The order model already
has the states for it — `server/store.js` `setPaymentStatus()` is where a
webhook would call in.

---

## Deploying

The app is a plain Node server with no dependencies, so anything that runs Node
will host it. `render.yaml` and a `Dockerfile` are included.

### Render (free, gives you a subdomain)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/akthernaimudheen/rejifash)

Or by hand:

1. **[dashboard.render.com](https://dashboard.render.com)** → **New** →
   **Blueprint** → pick this repository. It reads `render.yaml`.
2. Render will prompt for two values:

   | Variable | Value |
   |---|---|
   | `ADMIN_PASSWORD` | Any password you choose. **Required** — the server refuses to boot in production without it, since the default is published right here in this README. |
   | `UPI_VPA` | Your real UPI ID, e.g. `yourname@okicici`. Every payment QR pays this address. Leave blank to deploy now and set it later in the Render dashboard; the storefront will show a clear "UPI not configured" message instead of a broken QR. |

3. **Apply**. First build takes a minute or two — there is nothing to install.

You get **`https://rejifash.onrender.com`**. Change `name:` in `render.yaml` to
claim a different subdomain; it has to be unique across all of Render.

Afterwards, sign in at `/admin` with username `admin` and the password you set,
then go to **Settings** and send yourself a test WhatsApp message to confirm
alerts are reaching you.

### Two things about the free tier

**Orders do not survive a restart.** The free plan has no persistent disk, and
it spins the service down after 15 minutes of inactivity. `data/` is wiped on
every deploy and every wake-up, so orders, verified payments and uploaded
photographs all disappear. Fine for showing the site to people; not fine for
real customers.

To fix it, switch to a paid instance and uncomment the `disk:` block at the
bottom of `render.yaml` — it mounts persistent storage at `/var/data`, which is
where `DATA_DIR` already points.

**First request after idle takes ~30 seconds** while the container wakes.

### Your own domain in front of Render

Render issues free TLS for custom domains, including on the free plan. So a
domain you already own — at Hostinger or anywhere else — can front the app:

1. Render → your service → **Settings** → **Custom Domains** → add
   `shop.yourdomain.com`.
2. In your DNS panel add a **CNAME** for `shop` pointing at
   `rejifash.onrender.com`.
3. Wait for propagation. Render provisions the certificate automatically.

The client then sees `https://shop.yourdomain.com` and never knows Render exists.

### VPS (best result, ~5 minutes)

A VPS removes both free-tier problems at once: no cold starts, and a real disk
so orders actually persist. Point an A record at the server first, then:

```bash
curl -fsSL https://raw.githubusercontent.com/akthernaimudheen/rejifash/main/deploy/setup-vps.sh -o setup.sh
sudo bash setup.sh shop.yourdomain.com
```

That installs Node, clones the repo, creates a locked-down service user,
generates an admin password, sets up nginx and issues a Let's Encrypt
certificate. Files it uses live in [`deploy/`](deploy/).

Update later with `cd /opt/rejifash && sudo git pull && sudo systemctl restart rejifash`.

### Anywhere else

`Dockerfile` works as-is on anything that takes a container. Mount a volume at
`/var/data` and set `ADMIN_PASSWORD` and `UPI_VPA`. Full variable list in
`.env.example`.

**Serverless platforms need a change first.** Vercel, Netlify Functions and
Cloudflare Workers have no persistent filesystem, so `data/*.json` won't work.
`server/store.js` is the only module that touches disk — swap its read/write
pair for a database and nothing above it changes. See [`deploy/README.md`](deploy/README.md).

**Static hosts** (GitHub Pages, Hostinger shared, a Netlify drop) serve the
storefront but run no Node process, so it's browser-only demo mode: orders live
in the visitor's localStorage, the admin dashboard sees only that browser, and
no WhatsApp alerts are dispatched.

---

## Photographs

Raw phone photos are the fastest way to make a shop look amateur — mismatched
crops, yellow indoor light, a different background in every frame. **Admin →
Image studio** fixes that in the browser, with no upload to any service:

1. Straightens the photo (phone EXIF rotation).
2. Finds the garment and crops to the catalog's 3:4 frame with even margins.
3. Neutralises the colour cast using the backdrop as a grey reference.
4. Lifts exposure without crushing dark silks.
5. Fades the original background out to a clean studio backdrop, feathered so
   sheer dupattas and loose threads survive.
6. Exports zoom / gallery / card / thumbnail sizes.
7. Reads the fabric and zari colours and fills in the product swatch.

**Shooting tips:** plain light background, daylight not flash, whole garment in
frame with a little space around it, portrait orientation.

Every image on the site — photo or generated artwork — is rendered through the
same fixed 3:4 frame in `js/media.js` and fitted with `contain`, never cropped.
That single rule is what keeps a mixed catalog looking deliberate. Products
without photographs fall back to the generated SVG artwork, and the product page
says so rather than passing an illustration off as a photo.

Each photo also carries a **caption** and a **description of what it shows**.
The product page renders these under the gallery and again in a
"What you're seeing in each photo" section — the thing shoppers actually want
when buying fabric online.

---

## Layout

```
index.html          storefront
product.html        product detail page
orders.html         customer order tracking / finish payment
admin.html          shop dashboard

js/
  qrcode.js         QR encoder (ISO/IEC 18004), byte mode, versions 1–40
  upi.js            NPCI UPI intent URLs + app deep links
  api.js            API client; falls back to localStorage with no server
  media.js          the one place image presentation is decided
  image-studio.js   raw photo → catalog image pipeline
  app.js            catalog, bag, wishlist, filters, search
  checkout.js       delivery → UPI/COD → confirmation
  product-page.js   gallery, zoom, specs, image guide
  orders-page.js    tracking and deferred payment
  admin.js          orders, catalog, image studio, settings
  site-chrome.js    header, drawer, modals, footer (shared by every page)
  products-data.js  seed catalog, lookbooks, reviews, size chart, coupons
  visual-engine.js  generated SVG artwork fallback

server/
  server.js         static files + JSON API
  store.js          file-backed orders and products
  notify.js         WhatsApp dispatch
  config.js         settings, created on first boot

data/               orders.json, products.json, config.json  (created at runtime)
assets/products/    processed photographs
```

**Prices are never trusted from the browser.** The client sends product ids,
sizes and quantities; `priceCart()` in `server/server.js` recomputes every rupee
from the server-side catalog before an order is written.

---

## Notes

- Order IDs are `RF-YYMMDD-NNNN`.
- `styles/main.css` pulls Playfair Display / Cormorant / Plus Jakarta Sans from
  Google Fonts — the only external request the site makes. On a blocked or
  offline connection it falls back to Georgia and the system sans; everything
  still works, it just looks plainer. Self-host the woff2 files if you want the
  typography guaranteed.
- Order lookup requires the order ID *and* the mobile number used at checkout,
  so IDs can't be enumerated.
- Admin sessions are held in memory — restarting the server signs you out.
- The currency switcher is display-only; payment is always charged in INR.
- Change the admin password in Settings before this is reachable by anyone else.
