# Subscription Plugin — Architecture (fe-user)

How the user-facing subscription plugin works and how it plugs into the agnostic
`vbwd-fe-user` core app.

- [1. Agnostic-core contract](#1-agnostic-core-contract)
- [2. Plugin registration (`index.ts`)](#2-plugin-registration-indexts)
- [3. Routes & navigation](#3-routes--navigation)
- [4. Stores](#4-stores)
- [5. The checkout source (public /checkout)](#5-the-checkout-source-public-checkout)
- [6. Cart-backed checkout](#6-cart-backed-checkout)
- [7. Checkout components](#7-checkout-components)
- [8. i18n & config](#8-i18n--config)
- [9. Backend API used](#9-backend-api-used)

---

## 1. Agnostic-core contract

The core app exposes registries and an SDK; the plugin reaches into them:

| Core seam | Module | Used for |
|---|---|---|
| `IPlatformSDK` | `vbwd-view-component` | `addRoute`, `addTranslations` |
| `userNavRegistry` | `@/plugins/userNavRegistry` | sidebar links |
| `checkoutSourceRegistry` | `@/registries/checkoutSourceRegistry` | public `/checkout` integration |
| `useCartStore` | `vbwd-view-component` | persisted cart (single source of truth for selections) |
| `eventBus` / `AppEvents` | `vbwd-view-component` | toast notifications (e.g. "added to cart") |

Core has no plan/subscription view or store. Removing this plugin removes all
subscription UI; the app still runs.

## 2. Plugin registration (`index.ts`)

`subscriptionPlugin: IPlugin` with `install(sdk)`, `activate()`, `deactivate()`:

- `install`: registers translations (8 locales), all routes, three nav entries,
  and the checkout source.
- `deactivate`: `userNavRegistry.unregister('subscription')` +
  `checkoutSourceRegistry.unregister('subscription')`.

> Plugins use **named exports**; the core `pluginLoader` falls back to the first
> named export with an `install` method if there's no `default`.

## 3. Routes & navigation

Registered with `sdk.addRoute` (all gated by `meta.requiredUserPermission`,
mostly `subscription.plans.view`):

| Path | Name | View |
|---|---|---|
| `/dashboard/plans` | `plans` | `Plans.vue` |
| `/dashboard/plans/:planId` | `plan-detail` | `PlanDetailView.vue` |
| `/dashboard/plan/:planSlug` | `plan-detail-slug` | `TarifPlanDetail.vue` |
| `/dashboard/subscription` | `subscription` | `Subscription.vue` |
| `/dashboard/add-ons` | `add-ons` | `AddOns.vue` |
| `/dashboard/add-ons/info/:addonId` | `addon-info` | `AddonInfoView.vue` |
| `/dashboard/add-ons/:id` | `addon-detail` | `AddonDetail.vue` |
| `/dashboard/checkout/cart` | `checkout-cart` | `Checkout.vue` |
| `/dashboard/checkout/:planSlug` | `checkout` | `Checkout.vue` |

Invoices live in the **core** router (`vue/src/router/index.ts`). Nav entries
(`userNavRegistry.register`): `Subscription` (top-level) + `Plans` / `Add-Ons`
(group `store`). They intentionally carry no `requiredUserPermission` (matching
the old unconditional nav); the routes keep their own meta as defense-in-depth.

## 4. Stores

| Store | id | Responsibility | Backend |
|---|---|---|---|
| `useSubscriptionCheckoutStore` | `subscription-checkout` | the checkout selection + submit | `POST /user/checkout` |
| `usePlansStore` | `plans` | catalog list/detail; subscribe | `GET /tarif-plans`, `POST /subscriptions` |
| `useSubscriptionStore` | `subscription` | current subscription, usage, add-ons, cancel/upgrade | `GET /user/subscriptions*`, `/user/addons*`, `/user/usage` |

The distinct `subscription-checkout` id avoids colliding with the core generic
`checkout` store.

## 5. The checkout source (public /checkout)

So the generic public `/checkout` page can buy a plan without core knowing about
subscriptions, the plugin registers a `CheckoutSource`:

```ts
const subscriptionCheckoutSource: CheckoutSource = {
  id: 'subscription',
  matches: (ctx) => !!ctx.planSlug || ctx.cartType === 'subscription',
  load:  (ctx) => store.loadPlan(ctx.planSlug),     // throws on store.error
  getLineItems: () => store.lineItems,
  getOrderTotal: () => store.orderTotal,
  submit: (pm) => { store.setPaymentMethod(pm); return store.submitCheckout(); },
  reset: () => store.reset(),
  summaryComponent: () => import('.../PlanCheckoutSummary.vue'),
};
checkoutSourceRegistry.register(subscriptionCheckoutSource);
```

The core checkout store picks whichever source `matches` the route context and
drives it — it only knows "some source matched".

## 6. Cart-backed checkout

`useSubscriptionCheckoutStore` (id `subscription-checkout`) treats the persisted
fe-core `useCartStore` as the **single source of truth** for the whole selection
— plan, token bundles, and add-ons. Why: selections then survive navigation away
from the checkout view AND logout/login, and stay in sync with the cart
icon/popup.

- `plan` is a **computed** reconstructed from the cart's single `PLAN` item
  (rich fields in `metadata`; `metadata.plan_id` is the UUID sent on submit).
- `selectedBundles` / `selectedAddons` are **computeds** over
  `cart.getItemsByType('TOKEN_BUNDLE' | 'ADD_ON')`.
- `loadPlan(slug)` (called on entering checkout = "Select plan") mirrors the plan
  into the cart, **replacing** any existing PLAN item (one plan at a time).
- `addBundle`/`addAddon` → `cart.addItem(...)` (idempotent);
  `removeBundle`/`removeAddon` → `cart.removeItem(...)`.
- `reset()` clears only ephemeral state — it must **not** clear the cart (or
  navigation loses the selection). `Checkout.vue`'s `onUnmounted` calls `reset()`.
- `submitCheckout()` clears the cart on any successful checkout; cart items are
  typed `PLAN` / `TOKEN_BUNDLE` / `ADD_ON`.

`vbwd_cart` localStorage is not auth-scoped — `UserLayout.logout()` removes only
the auth keys — so the cart survives logout/login.

Tests: unit `tests/unit/checkout-store.spec.ts` (reactive in-memory cart mock);
e2e `vue/tests/e2e/cart-checkout-persistence.spec.ts`.

## 7. Checkout components

`subscription/components/checkout/`:

| Component | Role |
|---|---|
| `EmailBlock.vue` | email + inline auth for unauthenticated checkout |
| `BillingAddressBlock.vue` | billing address (read-only when authenticated) |
| `PaymentMethodsBlock.vue` | choose a payment method (emits selection) |
| `PlanCheckoutSummary.vue` | the source's `summaryComponent` for public /checkout |
| `TermsCheckbox.vue` | terms acceptance |

## 8. i18n & config

- The plugin owns its translations under `locales/` and registers each with
  `sdk.addTranslations(locale, json)`. Add new keys there, not in core locales.
- `config.json`: `show_billing_period`, `show_plan_features` (display flags);
  `admin-config.json` is the Settings UI schema (Display tab).

## 9. Backend API used

`GET /tarif-plans[/<slug_or_id>]`, `GET /addons[/<id>]`, `POST /subscriptions`,
`POST /user/checkout`, `GET /user/subscriptions[/active|/active-all]`,
`GET /user/usage`, `GET /user/addons[/<id>]`, `POST /user/subscriptions/<id>/{cancel,upgrade}`,
`POST /user/addons/<id>/cancel`. (All served by the backend subscription plugin.)

See [`EXTENDING.md`](EXTENDING.md) and [`LLM_GUIDE.md`](LLM_GUIDE.md).
