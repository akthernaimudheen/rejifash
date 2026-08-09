# From one shop to a local marketplace

Notes on turning this codebase into a hyperlocal platform for Thrissur: shops
list products, customers search and buy, orders go by courier or in-store
pickup, and service providers — plumbers, coconut pluckers, electricians — take
bookings through the same place.

This document is opinionated on purpose. It says what to build, what order to
build it in, and what not to build. Disagree with it in a pull request.

---

## 1. The uncomfortable part first

**The software is the easy half.** What is written here is maybe four months of
building. The half that decides whether this lives or dies:

**Getting shops to list, and keeping listings true.** A shop in Thrissur has no
digital inventory, no spare staff, and no reason to trust a new platform. They
will sign up at a demo and never log in again. A listing that says "in stock"
when it isn't damages the platform more than not listing at all — one wasted
trip and that customer never returns.

**Price comparison needs a canonical catalog, and that is genuinely hard.** For
"compare the price of this tool across shops" to work, two hardware shops must
both map their listing to the *same* product. One types `1/2 inch PVC pipe
supreme`, the other `PVC Pipe 15mm Supreme brand`. To a database those are
unrelated strings. Amazon and Flipkart employ large catalog teams to solve
exactly this. It is the single most common reason local price-comparison
startups die.

**Price comparison also actively repels supply.** Shop owners do not want to be
ranked against the shop down the road on price alone. Lead the pitch with
comparison and shops will refuse to join. The pitch that works is *"customers
searching for this will find you"*, not *"customers will see you are ₹20 dearer"*.

None of this means don't build it. It means **sequence it so the hard parts come
after you have something people already use.**

---

## 2. Lead with services, not products

Services are dramatically easier than products, and they are in the original
idea already.

|  | Products | Services |
|---|---|---|
| Inventory to maintain | yes | **none** |
| Canonical catalog needed | yes | **no** |
| Price comparison meaningful | yes | no — every job is quoted |
| Delivery needed | yes | **no** |
| What the provider needs | stock discipline | **a phone** |

A plumber listing is: name, trade, area covered, phone, hours. That is it. When
a customer needs a plumber in Ollur tonight, the platform shows three, the
customer taps, the provider's phone rings. No inventory, no catalog, no courier,
no payment.

That is a real, useful product that can launch in weeks, and it does the thing
that matters most: **it makes people in Thrissur open the site.** Products are
far easier to add to an audience that already exists than to build an audience
for.

So: **services first. Products second. Comparison last, and only where it earns
its keep.**

---

## 3. Never touch the money

This is the most important architectural decision in the whole project, and this
codebase already gets it right.

In India, collecting customer money and settling it to merchants is **Payment
Aggregator activity, and requires RBI authorisation** — net-worth requirements,
audits, ongoing compliance. It is not something a free community platform should
walk into.

The current design pays the merchant's own UPI VPA directly. The customer scans,
money moves customer → shop, and the platform is never in the flow. **Keep it
that way.** Every vendor supplies their own VPA; every QR is generated against it.

What this costs:

- No escrow, so no buyer protection at the payment layer. Mitigate with cash on
  delivery and pickup-and-pay, which suit local commerce anyway.
- Commission cannot be skimmed at payment time. Bill it separately — monthly
  invoice or subscription. Simpler to reason about, and honestly easier to sell.
- **A cart spanning three shops means three payments.** Which leads directly to
  the next decision.

### One vendor per order

Do not build a cart that spans shops. Money goes directly to each vendor, so a
three-shop cart is three QR codes and three separate fulfilments — a bad
checkout and a support burden.

Restrict the bag to one vendor at a time, the way most hyperlocal apps do.
Customers can place a second order in under a minute. Revisit only if the data
says people genuinely want mixed baskets.

---

## 4. WhatsApp is the runtime

Shopkeepers will not log into a dashboard daily. They already live in WhatsApp.

This codebase's order alerts are the seed of the right pattern: the order arrives
as a WhatsApp message with everything needed to act on it. Extend that so a
vendor can run their entire business from WhatsApp replies —
`ACCEPT 4821`, `READY 4821`, `OUT 4821` — with the dashboard as the optional
richer view rather than the required one.

Treat the vendor dashboard as the *secondary* interface. Every flow must be
completable from a phone, in WhatsApp, in under thirty seconds.

---

## 5. Data model

The current model is single-merchant. Multi-tenancy is the first real migration.

```
Vendor
  id, kind: 'shop' | 'service_provider'
  name, categories[], phone, whatsapp, upiVpa
  address, lat, lng, serviceRadiusKm
  hours[], verified, active
  fulfilment: { pickup: bool, delivery: bool, deliveryRadiusKm }

Listing                      # what a vendor sells
  id, vendorId, title, description, media[]
  price, unit, stock, category
  canonicalId?               # nullable — only where comparison matters

CanonicalProduct             # the thing that makes comparison possible
  id, brand, name, spec, unit, category
                             # populate slowly, by hand, only in categories
                             # where customers actually compare

Order
  id, vendorId               # exactly one vendor
  items[], pricing, customer
  fulfilment: 'delivery' | 'pickup'
  pickupSlot?, paymentStatus, orderStatus, events[]

ServiceRequest               # NOT an order — different lifecycle, no payment
  id, providerId, customer, category
  description, preferredTime, location
  status: requested → notified → accepted → scheduled → completed | declined
```

`canonicalId` being nullable is the whole trick: listings work immediately
without a canonical catalog, and comparison lights up gradually in the
categories where someone has done the mapping work. Never block a listing on
catalog data.

### Storage

JSON files will not survive multi-tenancy. Move to Postgres — Neon or Supabase
have adequate free tiers.

The good news: **`server/store.js` is the only module in this codebase that
touches the filesystem.** Everything above it goes through that interface. The
migration is contained to one file plus `config.js`'s `save()`.

### Search

Resist the urge to reach for Elasticsearch. Thrissur is perhaps tens of thousands
of listings. Postgres full-text search plus a haversine distance calculation over
`lat`/`lng` will be fast and is far less to operate. Revisit at a million rows,
not before.

---

## 6. Build order

**Phase 0 — Multi-tenant foundation.** Introduce `Vendor`; make Reji Fashions
vendor #1 so there is always a real tenant exercising the code. Move to Postgres.
Vendor signup, verification, per-vendor admin scoping.

**Phase 1 — Services directory.** Provider registration, categories, service
areas, request → notify → accept flow over WhatsApp. No payments. **Launch this.**
This is the phase that gets Thrissur using the site.

**Phase 2 — Product listings.** Vendors list stock. Search with geo ranking.
In-store pickup — no delivery yet, no comparison yet. Pickup is the perfect first
fulfilment: zero logistics, and it drives footfall, which is what shops actually
want.

**Phase 3 — Delivery.** Start with the shop's own delivery person and a status
field. Integrate a third-party partner only once volume justifies it.

**Phase 4 — Comparison.** Build the canonical catalog by hand in one category
where comparison genuinely matters — hardware and building materials are a good
candidate, textiles a poor one since every piece is unique. Prove it in one
category before generalising.

---

## 7. What not to build

- **Your own courier fleet.** Capital-intensive, operationally brutal. Let shops
  deliver, or partner.
- **Central payment collection.** See §3.
- **Native apps first.** A good PWA is enough. Getting an Indian user to install
  an unknown app is far harder than getting them to open a link.
- **Comparison as the launch pitch.** It repels the supply you need.
- **A ratings system on day one.** With few reviews it is noise, and one bad
  review can destroy a small local business unfairly. Add it when volume makes it
  statistically meaningful.

---

## 8. Free for two years, then what

Free is the right call for supply acquisition. Two risks worth naming now:

**No habit of paying.** If every vendor gets everything free for two years, the
conversion conversation in year three is brutal. Better: free *forever* for basic
listing — that is the thing that acquires supply — and charge from early on for
something clearly additive: featured placement, verified badge, delivery
coordination, extra photos, promoted service categories. A small number paying
from month six teaches you what people will actually pay for, which two years of
free will not.

**Free means no commitment.** A vendor with nothing at stake will not keep
listings current, and stale listings are the thing that kills trust. Consider a
nominal fee, or a non-monetary commitment such as verification with a shop photo
and GST/registration number.

---

## 9. Open source

The code is not the moat here — the network is. So open sourcing costs little and
buys real things:

- **Vendor trust.** "You can read exactly what we do with your data" is a strong
  answer to a suspicious shop owner.
- **Marketplace-in-a-box.** The most interesting angle. Thrissur is the pilot;
  the repository lets Palakkad, Kozhikode or anywhere else run their own instance.
  A town-scale marketplace that any town can self-host is a genuinely useful thing
  to put into the world, and it is a much better story than another startup.

**Licence.** If you want to stop a funded competitor taking the code and running
a closed hosted version against you, use **AGPL-3.0** — network use triggers the
share-alike obligation. If maximum adoption matters more than that protection,
Apache-2.0. Given the plan to monetise later, AGPL-3.0 is the safer default, and
you can always relicense your own code.

**Keep operational data out of the repository.** Vendor lists, orders, customer
details, API keys. `.gitignore` already excludes `data/`; that discipline has to
hold as the project grows.

---

## 10. Measure the right things

Signups are a vanity metric. What actually predicts survival:

- **Listings kept fresh** — percentage updated in the last 30 days
- **Provider response time** — minutes from service request to acceptance
- **Repeat rate** — customers ordering a second time within 60 days
- **Search success** — searches that end in a call, visit or order, versus
  searches that return nothing useful. Every empty result is a map of the supply
  you still need.

---

## Open questions

Worth deciding before Phase 0, not during:

1. Does a vendor need GST registration, or are unregistered shops welcome? Affects
   invoicing, and most small Thrissur shops are unregistered.
2. What happens when a customer pays a vendor by UPI and the goods never arrive?
   With no escrow, the platform's recourse is delisting. Is that enough?
3. Malayalam interface — day one, or after? It probably matters more than any
   feature in this document.
4. Who verifies a service provider is competent and safe to send to someone's
   home? This carries real liability.
