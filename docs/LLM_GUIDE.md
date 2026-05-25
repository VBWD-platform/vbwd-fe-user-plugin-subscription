# Subscription Plugin — LLM Guide (fe-user)

Compact map for agents. Pair with [`ARCHITECTURE.md`](ARCHITECTURE.md) and
[`EXTENDING.md`](EXTENDING.md). Paths relative to
`vbwd-fe-user/plugins/subscription/`.

## Identity
- plugin id: `subscription`; named export `subscriptionPlugin` (no default).
- package dir: `subscription/` (NOT `src/`).
- Pinia store ids: `subscription-checkout`, `plans`, `subscription`.

## Invariants
1. Never edit `vbwd-fe-user/vue/src/` for subscription behaviour — use the SDK +
   registries from `index.ts`.
2. Checkout selection is cart-backed: `useCartStore` (from `vbwd-view-component`)
   is the single source of truth. `plan`/`selectedBundles`/`selectedAddons` are
   **computeds**; do not reintroduce ephemeral selection refs.
3. `checkout.ts::reset()` must NOT clear the cart (it's called by
   `Checkout.vue` `onUnmounted` and by the CheckoutSource).
4. `loadPlan(slug)` keeps a single `PLAN` cart item (replace, not append).
5. i18n keys live in `locales/*.json`, never core locales.
6. Invoices are core-owned (core router) — don't add invoice views here.

## File map (where to change X)
| Goal | File |
|---|---|
| Routes, nav, checkout source, i18n registration | `index.ts` |
| Checkout state/submit (cart-backed) | `subscription/stores/checkout.ts` |
| Catalog list/detail, subscribe | `subscription/stores/plans.ts` |
| Current subscription, usage, add-ons, cancel/upgrade | `subscription/stores/subscription.ts` |
| Checkout page | `subscription/views/Checkout.vue` |
| Plan list / detail | `subscription/views/{Plans,PlanDetailView,TarifPlanDetail}.vue` |
| My subscription page | `subscription/views/Subscription.vue` |
| Add-ons list/detail | `subscription/views/{AddOns,AddonDetail,AddonInfoView}.vue` |
| Checkout sub-blocks | `subscription/components/checkout/*.vue` |
| Display flags | `config.json` + `admin-config.json` |
| Translations | `locales/*.json` |

## Checkout store contract (`useSubscriptionCheckoutStore`)
- state (refs): `availableBundles`, `availableAddons`, `loading`, `submitting`,
  `error`, `checkoutResult`, `isCartCheckout`, `paymentMethodCode`.
- computeds: `plan` (from cart PLAN item), `selectedBundles`/`selectedAddons`
  (from cart), `orderTotal`, `lineItems`.
- actions: `loadPlan(slug)`, `loadOptions()`, `loadFromCart()`,
  `addBundle(b)`/`removeBundle(id)`, `addAddon(a)`/`removeAddon(id)`,
  `setPaymentMethod(code)`, `submitCheckout()`, `reset()`.
- submit payload: `{ plan_id?, token_bundle_ids[], add_on_ids[], payment_method_code? }`.
- cart item types: `PLAN`, `TOKEN_BUNDLE`, `ADD_ON`.

## CheckoutSource contract (registered in `index.ts`)
`{ id:'subscription', matches(ctx), load(ctx), getLineItems(), getOrderTotal(),
submit(pm), reset(), summaryComponent }` — registered on
`checkoutSourceRegistry`, unregistered in `deactivate()`.

## Routes (all under /dashboard, perm `subscription.plans.view`)
`plans`, `plans/:planId`, `plan/:planSlug`, `subscription`, `add-ons`,
`add-ons/info/:addonId`, `add-ons/:id`, `checkout/cart`, `checkout/:planSlug`.
(Invoices = core router.)

## Tests
- unit: `tests/unit/checkout-store.spec.ts` (mocks `vbwd-view-component` with a
  reactive in-memory cart; `@/api` mocked).
- e2e: `vue/tests/e2e/cart-checkout-persistence.spec.ts`
  (`E2E_BASE_URL=http://localhost:8080`).
- gate: `npm run lint` + `bin/pre-commit-check.sh --full`.

## Gotchas
- `plugins/` is gitignored in the fe-user core repo; this plugin is its own repo.
- HMR can serve stale plugin modules — `docker compose restart dev` before e2e.
- The dev container mounts the TOP-LEVEL `../vbwd-fe-core` over the submodule; the
  app uses built `dist/` of `vbwd-view-component`.
- `common.status` is an object, not a string — use specific label keys.
