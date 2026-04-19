import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';

export const subscriptionPlugin: IPlugin = {
  name: 'subscription',
  version: '1.0.0',
  description: 'Subscription management — plans, subscriptions, add-ons, checkout',

  install(sdk: IPlatformSDK) {
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
      component: () => import('./subscription/views/Subscription.vue'),
      meta: { requiredUserPermission: 'subscription.manage' },
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

  },

  activate() {
    // Plugin activated
  },

  deactivate() {
    // Plugin deactivated
  },
};
