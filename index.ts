import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { defineAsyncComponent } from 'vue';
import { userNavRegistry } from '@/plugins/userNavRegistry';
import {
  checkoutSourceRegistry,
  type CheckoutSource,
  type CheckoutResult,
} from '@/registries/checkoutSourceRegistry';
import { useSubscriptionCheckoutStore } from './subscription/stores/checkout';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ru from './locales/ru.json';
import th from './locales/th.json';
import zh from './locales/zh.json';

/**
 * Checkout source for subscription-plan purchases on the generic public
 * /checkout page. Wraps the subscription checkout store so the core checkout
 * store stays agnostic — it only knows "some source matched this route".
 */
const subscriptionCheckoutSource: CheckoutSource = {
  id: 'subscription',
  matches: (ctx) => !!ctx.planSlug || ctx.cartType === 'subscription',
  async load(ctx) {
    const store = useSubscriptionCheckoutStore();
    if (ctx.planSlug) {
      await store.loadPlan(ctx.planSlug);
      if (store.error) throw new Error(store.error);
    }
  },
  getLineItems: () => useSubscriptionCheckoutStore().lineItems,
  getOrderTotal: () => useSubscriptionCheckoutStore().orderTotal,
  getDiscountAmount: () => useSubscriptionCheckoutStore().discountAmount,
  applyCoupon: (code: string) => useSubscriptionCheckoutStore().applyCoupon(code),
  clearCoupon: () => useSubscriptionCheckoutStore().clearCoupon(),
  async submit(paymentMethodCode) {
    const store = useSubscriptionCheckoutStore();
    if (paymentMethodCode) store.setPaymentMethod(paymentMethodCode);
    await store.submitCheckout();
    if (store.error) throw new Error(store.error);
    return store.checkoutResult as CheckoutResult;
  },
  reset: () => useSubscriptionCheckoutStore().reset(),
  summaryComponent: defineAsyncComponent(
    () => import('./subscription/components/checkout/PlanCheckoutSummary.vue')
  ),
};

export const subscriptionPlugin: IPlugin = {
  name: 'subscription',
  version: '1.0.0',
  description: 'Subscription management — plans, subscriptions, add-ons, checkout',

  install(sdk: IPlatformSDK) {
    // i18n — the subscription plugin owns its translations (nav labels +
    // subscription/plans/addons/addonInfo/planDetail content). Moved out of
    // core locales (Sprint 07).
    sdk.addTranslations('en', en);
    sdk.addTranslations('de', de);
    sdk.addTranslations('es', es);
    sdk.addTranslations('fr', fr);
    sdk.addTranslations('ja', ja);
    sdk.addTranslations('ru', ru);
    sdk.addTranslations('th', th);
    sdk.addTranslations('zh', zh);

    // Routes
    sdk.addRoute({
      path: '/dashboard/plans',
      name: 'plans',
      component: () => import('./subscription/views/Plans.vue'),
      meta: { requiredUserPermission: 'subscription.plans.view' },
    });
    sdk.addRoute({
      path: '/dashboard/plans/:planId',
      name: 'plan-detail',
      component: () => import('./subscription/views/PlanDetailView.vue'),
      meta: { requiredUserPermission: 'subscription.plans.view' },
    });
    sdk.addRoute({
      path: '/dashboard/plan/:planSlug',
      name: 'plan-detail-slug',
      component: () => import('./subscription/views/TarifPlanDetail.vue'),
      meta: { requiredUserPermission: 'subscription.plans.view' },
    });
    sdk.addRoute({
      path: '/dashboard/subscription',
      name: 'subscription',
      // Any logged-in user may VIEW their own subscription page (the nav shows
      // it unconditionally). It only requires the baseline view permission the
      // "Logged In" access level grants — not subscription.manage, which would
      // lock out every regular user. Management actions inside the page can be
      // gated separately.
      component: () => import('./subscription/views/Subscription.vue'),
      meta: { requiredUserPermission: 'subscription.plans.view' },
    });
    sdk.addRoute({
      path: '/dashboard/add-ons',
      name: 'add-ons',
      component: () => import('./subscription/views/AddOns.vue'),
      meta: { requiredUserPermission: 'subscription.plans.view' },
    });
    sdk.addRoute({
      path: '/dashboard/add-ons/info/:addonId',
      name: 'addon-info',
      component: () => import('./subscription/views/AddonInfoView.vue'),
      meta: { requiredUserPermission: 'subscription.plans.view' },
    });
    sdk.addRoute({
      path: '/dashboard/add-ons/:id',
      name: 'addon-detail',
      component: () => import('./subscription/views/AddonDetail.vue'),
      meta: { requiredUserPermission: 'subscription.plans.view' },
    });
    // Invoices route is in core router (vue/src/router/index.ts)
    sdk.addRoute({
      path: '/dashboard/checkout/cart',
      name: 'checkout-cart',
      component: () => import('./subscription/views/Checkout.vue'),
    });
    sdk.addRoute({
      path: '/dashboard/checkout/:planSlug',
      name: 'checkout',
      component: () => import('./subscription/views/Checkout.vue'),
    });

    // Sidebar nav — owned by the plugin (core no longer hardcodes a
    // subscription nav group). Plans/Add-Ons join the core "Store" group;
    // Subscription is a top-level sidebar link. Invoices stays core.
    // No requiredUserPermission: the old hardcoded nav showed these
    // unconditionally (E2 — behaviour preserved). The routes keep their own
    // meta.requiredUserPermission as defense-in-depth.
    userNavRegistry.register({
      pluginName: 'subscription',
      to: '/dashboard/subscription',
      labelKey: 'nav.subscription',
      testId: 'nav-subscription',
    });
    userNavRegistry.register({
      pluginName: 'subscription',
      to: '/dashboard/plans',
      labelKey: 'nav.plans',
      testId: 'nav-plans',
      group: 'store',
    });
    userNavRegistry.register({
      pluginName: 'subscription',
      to: '/dashboard/add-ons',
      labelKey: 'nav.addons',
      testId: 'nav-addons',
      group: 'store',
    });

    // Register the subscription checkout source so the generic public /checkout
    // page can purchase plans without core knowing about subscriptions.
    checkoutSourceRegistry.register(subscriptionCheckoutSource);
  },

  activate() {
    // Plugin activated
  },

  deactivate() {
    userNavRegistry.unregister('subscription');
    checkoutSourceRegistry.unregister('subscription');
  },
};
