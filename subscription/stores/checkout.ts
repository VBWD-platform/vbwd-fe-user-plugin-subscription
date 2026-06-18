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
import { useAppConfigStore } from '@/stores/appConfig';
import { aggregatePrice } from '@/utils/aggregatePrice';
import type { PriceVO } from '@/utils/priceDisplay';

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
  // S85.4 — the computed net/gross split + display-mode pair carried from
  // /tarif-plans so the checkout summary shows the tax disclosure and the
  // correct (business-overlay-aware) side instead of net == gross.
  net_price?: number;
  gross_price?: number;
  effective_display_mode?: 'netto' | 'brutto';
  prices_display_mode?: 'netto' | 'brutto';
  price_obj?: { netto: number; taxes: { code: string; rate: number; amount: number }[]; brutto: number; currency: string };
}

/**
 * The /tarif-plans/<slug> payload shape relevant to checkout pricing. The
 * assigned-tax path emits ``price`` (the VO) + ``net_amount``/``gross_amount``;
 * the country path emits ``net_price``/``gross_price``. Both carry the
 * display-mode pair.
 */
interface PlanDetailResponse {
  plan?: PlanDetailResponse;
  id: string;
  name: string;
  slug?: string;
  description?: string;
  price?: { netto: number; taxes: { code: string; rate: number; amount: number }[]; brutto: number; currency: string };
  display_price?: number;
  price_float?: number;
  currency?: string;
  billing_period?: string;
  effective_display_mode?: 'netto' | 'brutto';
  prices_display_mode?: 'netto' | 'brutto';
  net_amount?: number | string;
  gross_amount?: number | string;
  net_price?: number | string;
  gross_price?: number | string;
}

export interface TokenBundle {
  id: string;
  name: string;
  token_amount: number;
  price: number;
  currency: string;
  is_active: boolean;
  // S85.4 — the computed net/gross/taxes split preserved from /token-bundles so
  // the bundle contributes its tax to the order-level breakdown (display only).
  price_obj?: PriceVO;
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
  // S85.4 — the computed split preserved from /addons (see TokenBundle.price_obj).
  price_obj?: PriceVO;
}

/** The per-item ``price_info`` block on /addons and /token-bundles rows. */
interface PriceInfo {
  price?: PriceVO;
}

export interface LineItem {
  type: 'subscription' | 'token_bundle' | 'add_on';
  id: string;
  name: string;
  price: number;
  description?: string;
  total_price?: string;
  token_amount?: number;
  // S99.2 — each line carries its own resolved currency so the agnostic core
  // checkout store (which reads lineItems[0].currency) resolves the SAME
  // currency the lines render in — the fix for the $/€ line-vs-Total mismatch.
  currency?: string;
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
  // The billing currency (the `default_currency` core setting, S84/S99) — the
  // last-resort currency when an item carries none. Never a hardcoded literal.
  const appConfig = useAppConfigStore();

  // State
  const availableBundles = ref<TokenBundle[]>([]);
  const availableAddons = ref<AddOn[]>([]);
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const checkoutResult = ref<CheckoutResult | null>(null);
  const isCartCheckout = ref(false);
  const paymentMethodCode = ref<string | null>(null);
  const couponCode = ref<string | null>(null);
  const discountAmount = ref(0);

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
      currency: (meta.currency as string) || appConfig.defaultCurrency,
      billing_period: (meta.billing_period as string) || 'monthly',
      // S85.4 — the computed split + display-mode pair preserved from loadPlan.
      net_price: meta.net_price as number | undefined,
      gross_price: meta.gross_price as number | undefined,
      effective_display_mode: meta.effective_display_mode as 'netto' | 'brutto' | undefined,
      prices_display_mode: meta.prices_display_mode as 'netto' | 'brutto' | undefined,
      price_obj: meta.price_obj as Plan['price_obj'] | undefined,
    };
  });

  // Selections derived from the persisted cart (single source of truth).
  const selectedBundles = computed<TokenBundle[]>(() =>
    cart.getItemsByType('TOKEN_BUNDLE').map((item) => ({
      id: item.id,
      name: item.name,
      token_amount: (item.metadata?.token_amount as number) || 0,
      price: item.price,
      currency: (item.metadata?.currency as string) || appConfig.defaultCurrency,
      is_active: true,
      price_obj: item.metadata?.price_obj as PriceVO | undefined,
    }))
  );

  const selectedAddons = computed<AddOn[]>(() =>
    cart.getItemsByType('ADD_ON').map((item) => ({
      id: item.id,
      name: item.name,
      slug: (item.metadata?.slug as string) || item.name.toLowerCase().replace(/\s+/g, '-'),
      description: (item.metadata?.description as string) || '',
      price: item.price,
      currency: (item.metadata?.currency as string) || appConfig.defaultCurrency,
      billing_period: (item.metadata?.billing_period as string) || 'monthly',
      is_active: true,
      price_obj: item.metadata?.price_obj as PriceVO | undefined,
    }))
  );

  // Computed — gross (pre-discount) sum, then the net order total.
  const grossTotal = computed(() => {
    let total = Number(plan.value?.price || plan.value?.display_price || 0);
    total += selectedBundles.value.reduce((sum, b) => sum + Number(b.price), 0);
    total += selectedAddons.value.reduce((sum, a) => sum + Number(a.price), 0);
    return total;
  });
  // Net total exposed to the agnostic core checkout store (discount subtracted).
  const orderTotal = computed(() => Math.max(0, grossTotal.value - discountAmount.value));

  // Order-level tax breakdown across plan + bundles + add-ons, summed via the
  // shared aggregator. Each item contributes its preserved Price VO (or net ==
  // gross fallback when none). Display only — no tax math here.
  // Resolve order: the value's own currency (plan VO → plan), else the billing
  // default. The selectedBundles/selectedAddons resolve to the same default when
  // they carry none, so every line and the Total share one currency (S99.2).
  const orderCurrency = computed<string>(
    () => plan.value?.price_obj?.currency || plan.value?.currency || appConfig.defaultCurrency
  );
  const orderPrice = computed<PriceVO>(() => {
    const items = [];
    if (plan.value) {
      items.push({
        priceVO: plan.value.price_obj ?? null,
        grossFallback: Number(plan.value.gross_price ?? plan.value.price ?? 0),
        quantity: 1,
        currency: plan.value.currency,
      });
    }
    for (const bundle of selectedBundles.value) {
      items.push({
        priceVO: bundle.price_obj ?? null,
        grossFallback: Number(bundle.price),
        quantity: 1,
        currency: bundle.currency,
      });
    }
    for (const addon of selectedAddons.value) {
      items.push({
        priceVO: addon.price_obj ?? null,
        grossFallback: Number(addon.price),
        quantity: 1,
        currency: addon.currency,
      });
    }
    return aggregatePrice(items, orderCurrency.value);
  });

  const lineItems = computed(() => {
    const items: LineItem[] = [];
    if (plan.value) {
      items.push({
        type: 'subscription',
        id: plan.value.id,
        name: plan.value.name,
        price: plan.value.price || plan.value.display_price || 0,
        currency: plan.value.price_obj?.currency || plan.value.currency,
      });
    }
    selectedBundles.value.forEach((b) => {
      items.push({
        type: 'token_bundle',
        id: b.id,
        name: b.name,
        price: b.price,
        token_amount: b.token_amount,
        currency: b.price_obj?.currency || b.currency,
      });
    });
    selectedAddons.value.forEach((a) => {
      items.push({
        type: 'add_on',
        id: a.id,
        name: a.name,
        price: a.price,
        currency: a.price_obj?.currency || a.currency,
      });
    });
    return items;
  });

  // Actions
  function toNumber(raw: unknown): number | undefined {
    if (raw === undefined || raw === null) return undefined;
    const value = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

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
      const response = await api.get(`/tarif-plans/${slug}`) as PlanDetailResponse;
      const rawPlan = (response.plan || response) as unknown as PlanDetailResponse;
      // S85.4 — the computed Price split lives on the /tarif-plans payload. The
      // assigned-tax path emits ``price`` (the VO) + net/gross_amount; the
      // country path emits net/gross_price. Read the VO first, then the amounts,
      // then fall back to the bare number — the fe never computes tax itself.
      const priceObj = rawPlan.price;
      const netPrice = priceObj?.netto ?? toNumber(rawPlan.net_amount ?? rawPlan.net_price);
      const grossPrice = priceObj?.brutto ?? toNumber(rawPlan.gross_amount ?? rawPlan.gross_price);
      // The bare cart ``price`` (used for gross-total math) prefers the explicit
      // gross from the split, then the legacy display price / float fields.
      const numericPrice =
        grossPrice ?? normalizePrice(rawPlan.price_float ?? rawPlan.display_price);
      // Mirror the selected plan into the cart as the single PLAN item (replacing
      // any previously chosen plan — you subscribe to one plan at a time). This
      // makes "Select plan" add the plan to the persisted cart icon/popup too.
      cart.getItemsByType('PLAN').forEach((item) => cart.removeItem(item.id));
      cart.addItem({
        type: 'PLAN',
        id: rawPlan.slug || slug,
        name: rawPlan.name,
        price: Number(numericPrice) || 0,
        metadata: {
          plan_id: rawPlan.id,
          slug: rawPlan.slug || slug,
          description: rawPlan.description,
          display_price: rawPlan.display_price,
          billing_period: rawPlan.billing_period,
          currency: priceObj?.currency ?? rawPlan.currency,
          net_price: netPrice,
          gross_price: grossPrice,
          effective_display_mode: rawPlan.effective_display_mode,
          prices_display_mode: rawPlan.prices_display_mode,
          price_obj: priceObj,
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
      ]) as [
        { bundles: Array<TokenBundle & { price_info?: PriceInfo }> },
        { addons: Array<AddOn & { price_info?: PriceInfo }> },
      ];
      // S85.4 — preserve each row's computed Price VO (``price_info.price``) so
      // the bundle/add-on contributes its tax to the order-level breakdown.
      availableBundles.value = (bundlesRes.bundles || [])
        .filter(b => b.is_active)
        .map(({ price_info, ...bundle }) => ({ ...bundle, price_obj: price_info?.price }));
      availableAddons.value = (addonsRes.addons || [])
        .filter(a => a.is_active)
        .map(({ price_info, ...addon }) => ({ ...addon, price_obj: price_info?.price }));
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
      metadata: {
        token_amount: bundle.token_amount,
        currency: bundle.currency,
        price_obj: bundle.price_obj,
      },
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
        price_obj: addon.price_obj,
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

      if (couponCode.value) {
        payload.coupon_code = couponCode.value;
      }

      const response = await api.post('/user/checkout', payload) as CheckoutResult;
      checkoutResult.value = response;

      // Selections live in the cart now, so clear it after any successful
      // checkout — the chosen bundles/add-ons have been purchased.
      cart.clearCart();
      couponCode.value = null;
      discountAmount.value = 0;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      error.value = err.response?.data?.error || err.message || 'Checkout failed';
    } finally {
      submitting.value = false;
    }
  }

  async function applyCoupon(code: string): Promise<{ valid: boolean; discountAmount: number; error?: string }> {
    const response = await api.post('/coupons/validate', {
      code,
      cart_total: grossTotal.value,
      scope: 'SUBSCRIPTION',
    }) as { valid: boolean; discount_amount?: string; error?: string };
    if (response.valid) {
      discountAmount.value = Number(response.discount_amount || 0);
      couponCode.value = code;
      return { valid: true, discountAmount: discountAmount.value };
    }
    discountAmount.value = 0;
    couponCode.value = null;
    return { valid: false, discountAmount: 0, error: response.error };
  }

  function clearCoupon(): void {
    discountAmount.value = 0;
    couponCode.value = null;
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
    couponCode.value = null;
    discountAmount.value = 0;
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
    couponCode,
    discountAmount,
    // Computed
    grossTotal,
    orderTotal,
    orderCurrency,
    orderPrice,
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
    applyCoupon,
    clearCoupon,
    submitCheckout,
    reset,
  };
});
