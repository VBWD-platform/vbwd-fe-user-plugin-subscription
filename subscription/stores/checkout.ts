/**
 * Subscription checkout store (plugin-owned, gnostic).
 *
 * Holds all subscription-domain checkout state — plan, token bundles, add-ons —
 * and submits to `/user/checkout`. Used directly by the subscription dashboard
 * Checkout view, and wrapped as a `CheckoutSource` (id 'subscription') so the
 * generic core checkout store can drive it on the public `/checkout` page.
 *
 * Distinct Pinia id (`subscription-checkout`) so it never collides with the
 * core generic `checkout` store.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api';
import { useCartStore } from 'vbwd-view-component';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  display_price?: number;
  price_float?: number;
  currency: string;
  billing_period: string;
}

export interface TokenBundle {
  id: string;
  name: string;
  token_amount: number;
  price: number;
  currency: string;
  is_active: boolean;
}

export interface AddOn {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  billing_period: string;
  is_active: boolean;
}

export interface LineItem {
  type: 'subscription' | 'token_bundle' | 'add_on';
  id: string;
  name: string;
  price: number;
  description?: string;
  total_price?: string;
  token_amount?: number;
}

export interface CheckoutResult {
  subscription?: {
    id: string;
    status: string;
    plan: Plan;
  };
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    amount: string;
    total_amount: string;
    currency: string;
    line_items: LineItem[];
  };
  token_bundles?: Array<{
    id: string;
    bundle_id: string;
    status: string;
  }>;
  add_ons?: Array<{
    id: string;
    addon_id: string;
    status: string;
  }>;
  message: string;
}

export const useSubscriptionCheckoutStore = defineStore('subscription-checkout', () => {
  // The persisted shopping cart (fe-core) is the single source of truth for the
  // whole checkout selection — plan, token bundles and add-ons. Deriving them
  // from it means they survive navigation away from the checkout view AND
  // logout/login, and stay in sync with the cart icon/popup — no separate
  // ephemeral copy to drift or lose.
  const cart = useCartStore();

  // State
  const availableBundles = ref<TokenBundle[]>([]);
  const availableAddons = ref<AddOn[]>([]);
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const checkoutResult = ref<CheckoutResult | null>(null);
  const isCartCheckout = ref(false);
  const paymentMethodCode = ref<string | null>(null);

  // Plan derived from the cart's single PLAN item (rich fields kept in metadata,
  // refreshed by loadPlan). The cart item id is the plan slug so it can be
  // reloaded from the cart route; metadata.plan_id holds the UUID used on submit.
  const plan = computed<Plan | null>(() => {
    const item = cart.getItemsByType('PLAN')[0];
    if (!item) return null;
    const meta = item.metadata ?? {};
    return {
      id: (meta.plan_id as string) || item.id,
      name: item.name,
      slug: (meta.slug as string) || item.id,
      description: meta.description as string | undefined,
      price: item.price,
      display_price: meta.display_price as number | undefined,
      currency: (meta.currency as string) || 'USD',
      billing_period: (meta.billing_period as string) || 'monthly',
    };
  });

  // Selections derived from the persisted cart (single source of truth).
  const selectedBundles = computed<TokenBundle[]>(() =>
    cart.getItemsByType('TOKEN_BUNDLE').map((item) => ({
      id: item.id,
      name: item.name,
      token_amount: (item.metadata?.token_amount as number) || 0,
      price: item.price,
      currency: (item.metadata?.currency as string) || 'USD',
      is_active: true,
    }))
  );

  const selectedAddons = computed<AddOn[]>(() =>
    cart.getItemsByType('ADD_ON').map((item) => ({
      id: item.id,
      name: item.name,
      slug: (item.metadata?.slug as string) || item.name.toLowerCase().replace(/\s+/g, '-'),
      description: (item.metadata?.description as string) || '',
      price: item.price,
      currency: (item.metadata?.currency as string) || 'USD',
      billing_period: (item.metadata?.billing_period as string) || 'monthly',
      is_active: true,
    }))
  );

  // Computed
  const orderTotal = computed(() => {
    let total = Number(plan.value?.price || plan.value?.display_price || 0);
    total += selectedBundles.value.reduce((sum, b) => sum + Number(b.price), 0);
    total += selectedAddons.value.reduce((sum, a) => sum + Number(a.price), 0);
    return total;
  });

  const lineItems = computed(() => {
    const items: LineItem[] = [];
    if (plan.value) {
      items.push({
        type: 'subscription',
        id: plan.value.id,
        name: plan.value.name,
        price: plan.value.price || plan.value.display_price || 0,
      });
    }
    selectedBundles.value.forEach((b) => {
      items.push({
        type: 'token_bundle',
        id: b.id,
        name: b.name,
        price: b.price,
        token_amount: b.token_amount,
      });
    });
    selectedAddons.value.forEach((a) => {
      items.push({
        type: 'add_on',
        id: a.id,
        name: a.name,
        price: a.price,
      });
    });
    return items;
  });

  // Actions
  function normalizePrice(raw: unknown): number {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') return parseFloat(raw) || 0;
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (obj.price_decimal) return parseFloat(String(obj.price_decimal)) || 0;
    }
    return 0;
  }

  async function loadPlan(slug: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get(`/tarif-plans/${slug}`) as { plan: Plan } & Plan;
      const rawPlan = response.plan || response as unknown as Plan;
      // API may return price as {currency_code, price_decimal} object; normalize to number
      rawPlan.price = normalizePrice(rawPlan.price_float ?? rawPlan.display_price ?? rawPlan.price);
      // Mirror the selected plan into the cart as the single PLAN item (replacing
      // any previously chosen plan — you subscribe to one plan at a time). This
      // makes "Select plan" add the plan to the persisted cart icon/popup too.
      cart.getItemsByType('PLAN').forEach((item) => cart.removeItem(item.id));
      cart.addItem({
        type: 'PLAN',
        id: rawPlan.slug || slug,
        name: rawPlan.name,
        price: Number(rawPlan.price) || 0,
        metadata: {
          plan_id: rawPlan.id,
          slug: rawPlan.slug || slug,
          description: rawPlan.description,
          display_price: rawPlan.display_price,
          billing_period: rawPlan.billing_period,
          currency: rawPlan.currency,
        },
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      error.value = err.response?.data?.error || err.message || 'Failed to load plan';
    } finally {
      loading.value = false;
    }
  }

  async function loadOptions() {
    try {
      const [bundlesRes, addonsRes] = await Promise.all([
        api.get('/token-bundles').catch(() => ({ bundles: [] })),
        api.get('/addons').catch(() => ({ addons: [] })),
      ]) as [{ bundles: TokenBundle[] }, { addons: AddOn[] }];
      availableBundles.value = (bundlesRes.bundles || []).filter(b => b.is_active);
      availableAddons.value = (addonsRes.addons || []).filter(a => a.is_active);
    } catch {
      // Options are optional, don't fail the checkout
    }
  }

  function addBundle(bundle: TokenBundle) {
    // Idempotent — one of each bundle in the cart (the UI toggles selection).
    if (cart.getItemById(bundle.id)) return;
    cart.addItem({
      type: 'TOKEN_BUNDLE',
      id: bundle.id,
      name: bundle.name,
      price: Number(bundle.price),
      metadata: { token_amount: bundle.token_amount, currency: bundle.currency },
    });
  }

  function removeBundle(bundleId: string) {
    cart.removeItem(bundleId);
  }

  function addAddon(addon: AddOn) {
    if (cart.getItemById(addon.id)) return;
    cart.addItem({
      type: 'ADD_ON',
      id: addon.id,
      name: addon.name,
      price: Number(addon.price),
      metadata: {
        slug: addon.slug,
        description: addon.description,
        billing_period: addon.billing_period,
        currency: addon.currency,
      },
    });
  }

  function removeAddon(addonId: string) {
    cart.removeItem(addonId);
  }

  async function loadFromCart() {
    loading.value = true;
    error.value = null;
    isCartCheckout.value = true;

    try {
      const cartItems = cart.items;

      if (cartItems.length === 0) {
        error.value = 'Cart is empty';
        return;
      }

      // Token bundles and add-ons derive from the cart automatically
      // (see selectedBundles / selectedAddons). Only the plan needs loading
      // into the rich `plan` ref for display.
      const planItem = cartItems.find(item => item.type === 'PLAN');
      if (planItem) {
        await loadPlan(planItem.id);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      error.value = err.response?.data?.error || err.message || 'Failed to load cart';
    } finally {
      loading.value = false;
    }
  }

  function setPaymentMethod(code: string) {
    paymentMethodCode.value = code;
  }

  async function submitCheckout() {
    if (!plan.value && selectedBundles.value.length === 0 && selectedAddons.value.length === 0) {
      error.value = 'No items selected';
      return;
    }

    submitting.value = true;
    error.value = null;

    try {
      const payload: Record<string, unknown> = {
        token_bundle_ids: selectedBundles.value.map((b) => b.id),
        add_on_ids: selectedAddons.value.map((a) => a.id),
      };

      if (plan.value) {
        payload.plan_id = plan.value.id;
      }

      if (paymentMethodCode.value) {
        payload.payment_method_code = paymentMethodCode.value;
      }

      const response = await api.post('/user/checkout', payload) as CheckoutResult;
      checkoutResult.value = response;

      // Selections live in the cart now, so clear it after any successful
      // checkout — the chosen bundles/add-ons have been purchased.
      cart.clearCart();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      error.value = err.response?.data?.error || err.message || 'Checkout failed';
    } finally {
      submitting.value = false;
    }
  }

  function reset() {
    availableBundles.value = [];
    availableAddons.value = [];
    error.value = null;
    checkoutResult.value = null;
    loading.value = false;
    submitting.value = false;
    isCartCheckout.value = false;
    paymentMethodCode.value = null;
    // NOTE: the plan + selected bundles/add-ons are intentionally NOT cleared
    // here — they live in the persisted cart so they survive navigation away
    // from the checkout view (Checkout.vue's onUnmounted calls reset()). They are
    // cleared only on a successful checkout (submitCheckout) or by the user via
    // the cart.
  }

  return {
    // State
    plan,
    selectedBundles,
    selectedAddons,
    availableBundles,
    availableAddons,
    loading,
    submitting,
    error,
    checkoutResult,
    isCartCheckout,
    paymentMethodCode,
    // Computed
    orderTotal,
    lineItems,
    // Actions
    loadPlan,
    loadOptions,
    loadFromCart,
    setPaymentMethod,
    addBundle,
    removeBundle,
    addAddon,
    removeAddon,
    submitCheckout,
    reset,
  };
});
