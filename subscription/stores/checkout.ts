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

export const useCheckoutStore = defineStore('checkout', () => {
  // State
  const plan = ref<Plan | null>(null);
  const selectedBundles = ref<TokenBundle[]>([]);
  const selectedAddons = ref<AddOn[]>([]);
  const availableBundles = ref<TokenBundle[]>([]);
  const availableAddons = ref<AddOn[]>([]);
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const checkoutResult = ref<CheckoutResult | null>(null);
  const isCartCheckout = ref(false);
  const paymentMethodCode = ref<string | null>(null);

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
      plan.value = rawPlan;
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
    if (!selectedBundles.value.find((b) => b.id === bundle.id)) {
      selectedBundles.value = [...selectedBundles.value, bundle];
    }
  }

  function removeBundle(bundleId: string) {
    selectedBundles.value = selectedBundles.value.filter((b) => b.id !== bundleId);
  }

  function addAddon(addon: AddOn) {
    if (!selectedAddons.value.find((a) => a.id === addon.id)) {
      selectedAddons.value = [...selectedAddons.value, addon];
    }
  }

  function removeAddon(addonId: string) {
    selectedAddons.value = selectedAddons.value.filter((a) => a.id !== addonId);
  }

  async function loadFromCart() {
    loading.value = true;
    error.value = null;
    isCartCheckout.value = true;

    try {
      const cartStore = useCartStore();
      const cartItems = cartStore.items;

      if (cartItems.length === 0) {
        error.value = 'Cart is empty';
        return;
      }

      // Map cart items to checkout selections
      const planItem = cartItems.find(item => item.type === 'PLAN');
      const bundleItems = cartItems.filter(item => item.type === 'TOKEN_BUNDLE');
      const addonItems = cartItems.filter(item => item.type === 'ADD_ON');

      // If cart has a plan, load the full plan data
      if (planItem) {
        await loadPlan(planItem.id);
      }

      // Map token bundles from cart
      selectedBundles.value = bundleItems.map(item => ({
        id: item.id,
        name: item.name,
        token_amount: (item.metadata?.token_amount as number) || 0,
        price: item.price,
        currency: (item.metadata?.currency as string) || 'USD',
        is_active: true,
      }));

      // Map addons from cart
      selectedAddons.value = addonItems.map(item => ({
        id: item.id,
        name: item.name,
        slug: (item.metadata?.slug as string) || item.name.toLowerCase().replace(/\s+/g, '-'),
        description: (item.metadata?.description as string) || '',
        price: item.price,
        currency: (item.metadata?.currency as string) || 'USD',
        billing_period: (item.metadata?.billing_period as string) || 'monthly',
        is_active: true,
      }));
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

      // Clear cart after successful checkout
      if (isCartCheckout.value) {
        const cartStore = useCartStore();
        cartStore.clearCart();
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      error.value = err.response?.data?.error || err.message || 'Checkout failed';
    } finally {
      submitting.value = false;
    }
  }

  function reset() {
    plan.value = null;
    selectedBundles.value = [];
    selectedAddons.value = [];
    availableBundles.value = [];
    availableAddons.value = [];
    error.value = null;
    checkoutResult.value = null;
    loading.value = false;
    submitting.value = false;
    isCartCheckout.value = false;
    paymentMethodCode.value = null;
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
