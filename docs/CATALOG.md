# Keeping your catalog and photographs

Short version: **on a host with no persistent disk, upload photographs locally
and commit them.** Anything uploaded directly to the live site is temporary.

---

## Why

The app writes uploaded photographs to `assets/products/` and catalog edits to
`data/products.json`. On a normal server those are just files on a disk and they
stay put.

Render's free plan has **no persistent disk**. The container filesystem is rebuilt
from the repository on every deploy, and the service is also spun down after 15
minutes idle. Everything written at runtime goes with it — photographs, catalog
edits, and any orders placed in the meantime.

This is not a bug in the app. It is what a free container host is.

---

## The workflow that survives

Photography is content. Treat it like content: version it.

```bash
# 1. run the shop on your own machine
node server/server.js
```

2. Open <http://localhost:4173/admin> → **Image studio** → upload and attach
   photographs as usual. They are written to your local `assets/products/`.

3. Go to the **Catalog** tab → **⬇ Export catalog**. Save the downloaded file as
   `catalog.json` in the project root.

```bash
# 4. commit both the catalog and the images
git add catalog.json assets/products
git commit -m "Add product photography"
git push
```

Render redeploys automatically. `catalog.json` and the images are part of the
build now, so they come back every single time.

### How the app picks a catalog

`server/store.js` looks in this order:

1. `data/products.json` — live edits made through the dashboard
2. `catalog.json` — the committed catalog (this is the one that survives)
3. `js/products-data.js` — the bundled demo catalog

On a fresh container, step 1 does not exist, so step 2 wins. That is the whole
trick.

---

## If you'd rather edit live

Then you need a real disk:

- **Render paid plan** — raise `plan:` in `render.yaml`, uncomment the `disk:`
  block and the matching `DATA_DIR`. Storage mounts at `/var/data` and persists.
- **A VPS** — `deploy/setup-vps.sh` sets up `/var/lib/rejifash` on the machine's
  own disk. Nothing is ever wiped, and there are no cold starts either.

With either, uploads through the live dashboard are permanent and this document
stops mattering.

---

## Orders have the same problem

Worth being blunt about: on the free plan **orders do not survive** a redeploy or
a spin-down. Fine while showing the site to someone. Not fine once a real
customer has paid you.

Before taking real orders, move to a disk. Until then, the WhatsApp alert is the
durable copy of an order — it is on your phone, not on the server.
