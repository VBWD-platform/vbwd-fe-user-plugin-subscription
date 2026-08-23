# Subscription Plugin (fe-user)

The user-facing Vue plugin for subscriptions: **browse plans, view your
subscription, manage add-ons, and check out**. It is a plugin for the
`vbwd-fe-user` app and integrates with the agnostic core app through registries
(routes, sidebar nav, the public checkout flow) — core never names a
subscription concept.

> **Core principle:** *VBWD core is agnostic — only plugins are gnostic.* The
> core fe-user app (`vue/src/`) has no plan/subscription views or stores. This
> plugin registers everything via the SDK and the core registries.

| | |
|---|---|
| **Plugin id** | `subscription` |
| **Export** | named `subscriptionPlugin` (loader also falls back to first `install`-bearing export) |
| **Consumes from core** | `vbwd-view-component` (SDK, `useCartStore`, `eventBus`), `@/plugins/userNavRegistry`, `@/registries/checkoutSourceRegistry` |
| **Backend** | [`vbwd-backend/plugins/subscription`](../../../vbwd-backend/plugins/subscription) |
| **Admin sibling** | [`vbwd-fe-admin/plugins/subscription-admin`](../../../vbwd-fe-admin/plugins/subscription-admin) |

## Documentation map

| Doc | Audience | Contents |
|---|---|---|
| **README.md** (this file) | everyone | What it is, structure, key flows |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | humans | Routes, stores, checkout source, cart-backed checkout, i18n |
| [`docs/EXTENDING.md`](docs/EXTENDING.md) | humans | Recipes: add a view, a store action, a checkout item, translations |
| [`docs/LLM_GUIDE.md`](docs/LLM_GUIDE.md) | LLMs / agents | Compact file map, contracts, invariants, gotchas |

## What it does

- **Catalog browsing**: `/dashboard/plans`, plan detail, `/dashboard/add-ons`.
- **My subscription**: `/dashboard/subscription` (status, active/previous add-ons).
- **Checkout**: `/dashboard/checkout/:planSlug` and `/dashboard/checkout/cart`,
  plus a `CheckoutSource` so the generic public `/checkout` page can buy a plan.
- **Cart-backed checkout**: the selected plan + token bundles + add-ons live in
  the shared `useCartStore` (persisted), so selections survive navigation and
  logout/login and appear in the cart icon/popup.

## Layout

```
plugins/subscription/
├── index.ts                    # plugin: routes, nav, checkout source, i18n
├── config.json                 # display flags (show_billing_period, …)
├── admin-config.json           # admin settings UI schema (Display tab)
├── locales/                    # en/de/es/fr/ja/ru/th/zh translations (plugin-owned)
├── docs/                       # ← you are here
├── tests/unit/                 # Vitest unit tests (checkout store)
└── subscription/               # source package (plugin id, not "src")
    ├── views/                  # Plans, PlanDetailView, TarifPlanDetail,
    │                           #   Subscription, AddOns, AddonDetail,
    │                           #   AddonInfoView, Checkout
    ├── stores/                 # checkout, plans, subscription (Pinia)
    └── components/checkout/    # EmailBlock, BillingAddressBlock,
                                #   PaymentMethodsBlock, PlanCheckoutSummary,
                                #   TermsCheckbox
```

## Key concepts

- **Routes** are registered in `index.ts` via `sdk.addRoute(...)`, each gated by
  `meta.requiredUserPermission` (mostly `subscription.plans.view`). Invoices stay
  in the core router.
- **Sidebar nav** is registered via `userNavRegistry` (Subscription as a
  top-level link; Plans + Add-Ons in the core "store" group). Core no longer
  hardcodes a subscription nav group.
- **Checkout source** (`checkoutSourceRegistry`): the plugin wraps its checkout
  store as a `CheckoutSource { matches, load, getLineItems, getOrderTotal,
  submit, reset, summaryComponent }` so the agnostic core checkout store can
  drive it on `/checkout` without knowing about subscriptions.
- **Stores** (Pinia): `useSubscriptionCheckoutStore` (id `subscription-checkout`),
  `usePlansStore` (id `plans`), `useSubscriptionStore` (id `subscription`).
- **i18n**: the plugin owns its translations and registers them with
  `sdk.addTranslations(locale, json)` for all 8 locales.

## Develop

```bash
cd vbwd-fe-user
npm run test                    # Vitest unit tests
npx vitest run plugins/subscription/tests/unit/checkout-store.spec.ts
npm run lint                    # ESLint (always full project)
E2E_BASE_URL=http://localhost:8080 npx playwright test vue/tests/e2e/cart-checkout-persistence.spec.ts
```

> **HMR gotcha:** the dev container bind-mounts this plugin; Vite can serve a
> stale module after edits. Run `docker compose restart dev` before e2e.

## Engineering requirements (binding)

TDD-first · SOLID · DRY · clean code · **no overengineering**. Gate:
`bin/pre-commit-check.sh --full` green on the repo.

## Documentation

Full platform documentation lives at **[vbwd.cc/docs](https://vbwd.cc/docs)**.

- [Frontend plugins](https://vbwd.cc/docs-frontend-plugins) — how fe-admin / fe-user plugins are built and mounted
- [Subscriptions](https://vbwd.cc/docs-core-subscription) — documentation for this plugin's domain
- [Architecture](https://vbwd.cc/docs-architecture) — platform layering and the core-agnosticism rule
- [Getting started](https://vbwd.cc/docs-getting-started) — install a VBWD instance and enable plugins
