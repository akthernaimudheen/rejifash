# Deploying

This app is a plain Node HTTP server that keeps orders and uploaded photographs
on disk. Two consequences drive every hosting choice:

1. **It needs a long-running Node process.** PHP-only shared hosting cannot run
   it. Serverless platforms can run it but see below.
2. **It writes to the filesystem.** Anywhere the disk is ephemeral, orders and
   photos vanish on restart.

## Picking a host

| Option | Node? | Data survives restarts? | Notes |
|---|---|---|---|
| **VPS** (Hostinger KVM, Oracle Always Free, DigitalOcean…) | yes | **yes** | Best outcome. Real disk, no cold starts, your own subdomain. `setup-vps.sh` does the whole thing. |
| **Render free** | yes | no | Easiest start. Sleeps after ~15 min idle, wipes the disk on every deploy and wake. Custom domains and TLS are free. Fine for demos. |
| **Render paid + disk** | yes | yes | Uncomment the `disk:` block in `render.yaml`. |
| **Hostinger shared** | **no** | — | PHP/LiteSpeed, no persistent Node process. Use it for DNS and point a subdomain at a Node host, or upload the frontend alone for a static demo. |
| **Vercel / Netlify / Cloudflare Workers** | serverless | **no** | No persistent filesystem, so `data/*.json` does not work. Would need the store swapped for a database first — see below. |

Free tiers change often; check current terms before relying on one.

## Static-only demo

Uploading just the frontend (`*.html`, `js/`, `styles/`, `assets/`) to any web
host — including Hostinger shared — gives a working storefront in **demo mode**:

- the catalog, cart, product pages, size guide and checkout UI all work
- the UPI QR still generates correctly and is scannable
- orders are saved to the visitor's own browser (localStorage)
- the admin dashboard only ever sees that one browser's data
- no WhatsApp alerts are dispatched from a server

Good for showing someone the design. Not a shop.

## Moving off the filesystem

To run this serverless, the only thing that needs replacing is `server/store.js`
— it is the single module that touches disk. Swap the `readJson`/`writeJson`
pair for a database client (Postgres, Turso, Upstash Redis) and the rest of the
application is unchanged; nothing above the store layer knows where data lives.
`server/config.js` would likewise need its `save()` backed by the same store.
