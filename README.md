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

1. Go to **[dashboard.render.com](https://dashboard.render.com)** → **New** →
   **Blueprint**, and point it at this repository. It reads `render.yaml`.
2. Set these environment variables when prompted:
   - `ADMIN_PASSWORD` — **required.** The server refuses to boot in production
     without it, because the default is published in this README.
   - `UPI_VPA` — your real UPI ID. Every payment QR pays this address.
3. Deploy. You get **`https://rejifash.onrender.com`**.

Change `name:` in `render.yaml` to claim a different subdomain — it has to be
unique across Render.

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

### Anywhere else

`Dockerfile` works as-is on Fly.io, Railway, a VPS, or anything else that takes
a container. Mount a volume at `/var/data` and set `ADMIN_PASSWORD` and
`UPI_VPA`. Full list of variables in `.env.example`.

Static hosts (GitHub Pages, Netlify drop) will serve the storefront but there is
no Node process, so it runs in browser-only demo mode: orders stay in the
visitor's localStorage, the admin dashboard sees only that browser's data, and
no WhatsApp alerts are dispatched from the server.

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
