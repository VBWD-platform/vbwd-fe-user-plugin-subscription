# Subscription Plugin — Extending (fe-user)

Recipes for changing the user-facing subscription plugin **without touching the
core app**. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) first.

Golden rules:

1. **Never edit `vbwd-fe-user/vue/src/`** for subscription behaviour. Use the
   SDK and core registries from `index.ts`.
2. **TDD-first.** Add/extend a Vitest unit test before the change; cover
   user-visible flows with a Playwright e2e where it matters.
3. **Plugin owns its i18n** — add keys under `locales/`, never to core locales.
4. Run `npm run lint` (full project) + `bin/pre-commit-check.sh --quick` while
   iterating; `--full` before done.

---

## Recipe: add a new page/view

1. Create `subscription/views/MyView.vue`.
2. Register it in `index.ts` `install()`:
   ```ts
   sdk.addRoute({
     path: '/dashboard/my-thing',
     name: 'my-thing',
     component: () => import('./subscription/views/MyView.vue'),
     meta: { requiredUserPermission: 'subscription.plans.view' },
   });
   ```
3. If it needs a sidebar link, `userNavRegistry.register({ pluginName:
   'subscription', to, labelKey, testId, group? })` and add the label to every
   `locales/*.json`.

## Recipe: add an item type to checkout (e.g. a new purchasable)

The checkout selection is **cart-backed**. To add a new line type:

1. Decide its cart `type` string (e.g. `'TOKEN_BUNDLE'`, `'ADD_ON'`, or a new one).
2. Add it to the cart via `cart.addItem({ type, id, name, price, metadata })`
   from the relevant view (mirror `Tokens.vue` / `AddOns.vue`).
3. In `subscription/stores/checkout.ts`, derive a computed selection from
   `cart.getItemsByType('<TYPE>')` and include it in `lineItems` / `orderTotal`,
   and map its ids into the `submitCheckout` payload.
4. Keep `reset()` from clearing the cart; idempotent add via `cart.getItemById`.
5. Unit-test in `tests/unit/checkout-store.spec.ts` (reactive cart mock pattern).

## Recipe: add a store action / call a new endpoint

Add the method to the relevant store (`plans.ts`, `subscription.ts`, or
`checkout.ts`) using `api.get/post/...`. Keep network types explicit. Don't put
subscription API calls in core stores.

## Recipe: change the public /checkout behaviour for plans

Edit `subscriptionCheckoutSource` in `index.ts` (its `matches` / `load` /
`getLineItems` / `getOrderTotal` / `submit` / `summaryComponent`). The core
checkout store consumes this contract — don't special-case subscriptions in core.

## Recipe: add / change translations

Edit each file in `locales/` (en is the fallback). Use `$t('subscription.…')` in
templates and `t('…')` in `<script setup>`. Toasts use
`eventBus.emit(AppEvents.NOTIFICATION_SHOW, { type, message: t('cart.addedToCart',
{ name }), duration })`.

## Recipe: add a config flag

Add the key + default to `config.json`, and a field to `admin-config.json`
(correct tab/component). Read it where the UI needs it.

## Checklist before "done"

- [ ] Vitest unit test added/updated and green.
- [ ] e2e added/updated for user-visible flows; `docker compose restart dev`
      before running e2e (HMR can serve stale plugin modules).
- [ ] No core `vue/src/` file touched; translations only in `locales/`.
- [ ] `npm run lint` clean; `bin/pre-commit-check.sh --full` green.
