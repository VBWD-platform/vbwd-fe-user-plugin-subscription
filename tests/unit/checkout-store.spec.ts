import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSubscriptionCheckoutStore } from '../../subscription/stores/checkout';
import { useCartStore } from 'vbwd-view-component';
import { api } from '@/api';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  isAuthenticated: vi.fn(() => true)
}));

// Reactive in-memory fake of the fe-core cart store. Mirrors the real public
// contract (addItem/removeItem/getItemById/getItemsByType/items/clearCart) so
// the checkout store's cart-backed selections are exercised faithfully — the
// computeds need a reactive `items` to recompute on mutation.
vi.mock('vbwd-view-component', async () => {
  const { reactive } = await import('vue');
  const items = reactive<Array<{ type: string; id: string; name: string; price: number; quantity: number; metadata?: Record<string, unknown> }>>([]);
  const clearCart = vi.fn(() => { items.splice(0, items.length); });
  const cart = {
    items,
    get isEmpty() { return items.length === 0; },
    addItem(input: { type: string; id: string; name: string; price: number; metadata?: Record<string, unknown> }) {
      const i = items.findIndex((it) => it.id === input.id && it.type === input.type);
      if (i >= 0) items[i].quantity += 1;
      else items.push({ ...input, quantity: 1 });
    },
    removeItem(id: string) {
      const i = items.findIndex((it) => it.id === id);
      if (i >= 0) items.splice(i, 1);
    },
    getItemById(id: string) { return items.find((it) => it.id === id); },
    getItemsByType(type: string) { return items.filter((it) => it.type === type); },
    clearCart,
  };
  return { useCartStore: () => cart };
});

const cart = () => useCartStore();

describe('SubscriptionCheckoutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    cart().items.splice(0, cart().items.length);
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('initializes with default values', () => {
      const store = useSubscriptionCheckoutStore();

      expect(store.plan).toBeNull();
      expect(store.selectedBundles).toEqual([]);
      expect(store.selectedAddons).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.submitting).toBe(false);
      expect(store.error).toBeNull();
      expect(store.checkoutResult).toBeNull();
      expect(store.isCartCheckout).toBe(false);
      expect(store.paymentMethodCode).toBeNull();
    });
  });

  // The persistence contract: selections are backed by the persisted cart, so
  // they survive navigation (reset) and show up in the cart icon/popup.
  describe('cart-backed selections (persistence)', () => {
    it('addBundle writes the bundle to the persisted cart', () => {
      const store = useSubscriptionCheckoutStore();
      store.addBundle({ id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true });

      expect(cart().getItemsByType('TOKEN_BUNDLE')).toHaveLength(1);
      expect(store.selectedBundles).toHaveLength(1);
      expect(store.selectedBundles[0].id).toBe('b1');
      expect(store.selectedBundles[0].token_amount).toBe(1000);
    });

    it('addAddon writes the add-on to the persisted cart', () => {
      const store = useSubscriptionCheckoutStore();
      store.addAddon({ id: 'a1', name: 'Priority Support', slug: 'priority-support', description: 'Fast help', price: 15, currency: 'USD', billing_period: 'monthly', is_active: true });

      expect(cart().getItemsByType('ADD_ON')).toHaveLength(1);
      expect(store.selectedAddons).toHaveLength(1);
      expect(store.selectedAddons[0].id).toBe('a1');
      expect(store.selectedAddons[0].slug).toBe('priority-support');
    });

    it('does not duplicate when the same item is added twice', () => {
      const store = useSubscriptionCheckoutStore();
      const bundle = { id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true };
      store.addBundle(bundle);
      store.addBundle(bundle);

      expect(store.selectedBundles).toHaveLength(1);
      expect(cart().getItemsByType('TOKEN_BUNDLE')).toHaveLength(1);
    });

    it('removeBundle / removeAddon delete from the cart', () => {
      const store = useSubscriptionCheckoutStore();
      store.addBundle({ id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true });
      store.addAddon({ id: 'a1', name: 'Support', slug: 'support', description: '', price: 15, currency: 'USD', billing_period: 'monthly', is_active: true });

      store.removeBundle('b1');
      store.removeAddon('a1');

      expect(store.selectedBundles).toHaveLength(0);
      expect(store.selectedAddons).toHaveLength(0);
      expect(cart().items).toHaveLength(0);
    });

    it('selections survive reset() (navigation away from checkout)', () => {
      const store = useSubscriptionCheckoutStore();
      store.addBundle({ id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true });
      store.addAddon({ id: 'a1', name: 'Support', slug: 'support', description: '', price: 15, currency: 'USD', billing_period: 'monthly', is_active: true });

      store.reset();

      // The persisted cart still holds the selections, so a remounted checkout
      // view re-derives them — they are not lost on navigation.
      expect(cart().items).toHaveLength(2);
      expect(store.selectedBundles).toHaveLength(1);
      expect(store.selectedAddons).toHaveLength(1);
    });
  });

  describe('loadPlan (Select plan adds to cart)', () => {
    it('adds the selected plan to the persisted cart', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        plan: { id: 'plan-uuid-1', name: 'Pro Plan', slug: 'pro', price: 29, currency: 'USD', billing_period: 'MONTHLY' }
      });

      const store = useSubscriptionCheckoutStore();
      await store.loadPlan('pro');

      const planItems = cart().getItemsByType('PLAN');
      expect(planItems).toHaveLength(1);
      expect(planItems[0].id).toBe('pro');           // cart id == slug
      expect(planItems[0].metadata?.plan_id).toBe('plan-uuid-1');
      expect(store.plan?.name).toBe('Pro Plan');
      expect(store.plan?.id).toBe('plan-uuid-1');     // UUID used on submit
    });

    it('keeps a single plan in the cart (new selection replaces the old)', async () => {
      const store = useSubscriptionCheckoutStore();

      vi.mocked(api.get).mockResolvedValueOnce({
        plan: { id: 'uuid-basic', name: 'Basic', slug: 'basic', price: 9, currency: 'USD', billing_period: 'MONTHLY' }
      });
      await store.loadPlan('basic');

      vi.mocked(api.get).mockResolvedValueOnce({
        plan: { id: 'uuid-pro', name: 'Pro', slug: 'pro', price: 29, currency: 'USD', billing_period: 'MONTHLY' }
      });
      await store.loadPlan('pro');

      expect(cart().getItemsByType('PLAN')).toHaveLength(1);
      expect(store.plan?.slug).toBe('pro');
    });
  });

  describe('loadFromCart', () => {
    it('derives bundles and addons from the cart', async () => {
      cart().addItem({ type: 'TOKEN_BUNDLE', id: 'bundle-1', name: '1000 Tokens', price: 10, metadata: { token_amount: 1000, currency: 'USD' } });
      cart().addItem({ type: 'ADD_ON', id: 'addon-1', name: 'Priority Support', price: 15, metadata: { slug: 'priority-support', description: 'Priority support addon', currency: 'USD', billing_period: 'monthly' } });

      const store = useSubscriptionCheckoutStore();
      await store.loadFromCart();

      expect(store.isCartCheckout).toBe(true);
      expect(store.selectedBundles).toHaveLength(1);
      expect(store.selectedBundles[0].id).toBe('bundle-1');
      expect(store.selectedBundles[0].name).toBe('1000 Tokens');
      expect(store.selectedBundles[0].price).toBe(10);
      expect(store.selectedAddons).toHaveLength(1);
      expect(store.selectedAddons[0].id).toBe('addon-1');
      expect(store.selectedAddons[0].name).toBe('Priority Support');
    });

    it('loads plan from cart when present', async () => {
      cart().addItem({ type: 'PLAN', id: 'plan-slug-1', name: 'Pro Plan', price: 29 });

      vi.mocked(api.get).mockResolvedValueOnce({
        plan: { id: 'plan-uuid-1', name: 'Pro Plan', slug: 'plan-slug-1', price: 29, currency: 'USD', billing_period: 'MONTHLY' }
      });

      const store = useSubscriptionCheckoutStore();
      await store.loadFromCart();

      expect(api.get).toHaveBeenCalledWith('/tarif-plans/plan-slug-1');
      expect(store.plan).not.toBeNull();
      expect(store.plan?.name).toBe('Pro Plan');
    });

    it('sets error when cart is empty', async () => {
      const store = useSubscriptionCheckoutStore();
      await store.loadFromCart();

      expect(store.error).toBe('Cart is empty');
    });
  });

  describe('submitCheckout', () => {
    it('works without plan (bundles only)', async () => {
      const store = useSubscriptionCheckoutStore();
      store.addBundle({ id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true });

      vi.mocked(api.post).mockResolvedValueOnce({
        invoice: { id: 'inv-1', invoice_number: 'INV-001', status: 'pending', amount: '10.00', total_amount: '10.00', currency: 'USD', line_items: [] },
        token_bundles: [{ id: 'bp-1', bundle_id: 'b1', status: 'pending' }],
        add_ons: [],
        message: 'Checkout created. Awaiting payment.',
      });

      await store.submitCheckout();

      expect(api.post).toHaveBeenCalledWith('/user/checkout', {
        token_bundle_ids: ['b1'],
        add_on_ids: [],
      });
      expect(store.checkoutResult).not.toBeNull();
      expect(store.error).toBeNull();
    });

    it('sends payment_method_code when set', async () => {
      const store = useSubscriptionCheckoutStore();
      cart().addItem({ type: 'PLAN', id: 'pro', name: 'Pro', price: 29, metadata: { plan_id: 'p1', slug: 'pro', billing_period: 'MONTHLY', currency: 'USD' } });
      store.setPaymentMethod('stripe');

      vi.mocked(api.post).mockResolvedValueOnce({
        subscription: { id: 's1', status: 'pending', plan: { id: 'p1', name: 'Pro', slug: 'pro' } },
        invoice: { id: 'inv-1', invoice_number: 'INV-001', status: 'pending', amount: '29.00', total_amount: '29.00', currency: 'USD', line_items: [] },
        token_bundles: [],
        add_ons: [],
        message: 'Checkout created. Awaiting payment.',
      });

      await store.submitCheckout();

      expect(api.post).toHaveBeenCalledWith('/user/checkout', {
        plan_id: 'p1',
        token_bundle_ids: [],
        add_on_ids: [],
        payment_method_code: 'stripe',
      });
    });

    it('errors when no items selected', async () => {
      const store = useSubscriptionCheckoutStore();

      await store.submitCheckout();

      expect(store.error).toBe('No items selected');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('clears the cart after a successful checkout', async () => {
      const store = useSubscriptionCheckoutStore();
      store.addBundle({ id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true });

      vi.mocked(api.post).mockResolvedValueOnce({
        invoice: { id: 'inv-1', invoice_number: 'INV-001', status: 'pending', amount: '10.00', total_amount: '10.00', currency: 'USD', line_items: [] },
        token_bundles: [],
        add_ons: [],
        message: 'Checkout created. Awaiting payment.',
      });

      await store.submitCheckout();

      expect(cart().clearCart).toHaveBeenCalled();
    });
  });

  describe('orderTotal and lineItems', () => {
    it('computes correctly without plan', () => {
      const store = useSubscriptionCheckoutStore();
      store.addBundle({ id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true });
      store.addBundle({ id: 'b2', name: '5000 Tokens', token_amount: 5000, price: 40, currency: 'USD', is_active: true });
      store.addAddon({ id: 'a1', name: 'Support', slug: 'support', description: '', price: 15, currency: 'USD', billing_period: 'monthly', is_active: true });

      expect(store.orderTotal).toBe(65);
      expect(store.lineItems).toHaveLength(3);
      expect(store.lineItems[0].type).toBe('token_bundle');
      expect(store.lineItems[1].type).toBe('token_bundle');
      expect(store.lineItems[2].type).toBe('add_on');
    });

    it('includes plan in total when present', () => {
      const store = useSubscriptionCheckoutStore();
      cart().addItem({ type: 'PLAN', id: 'pro', name: 'Pro', price: 29, metadata: { plan_id: 'p1', slug: 'pro', billing_period: 'MONTHLY', currency: 'USD' } });
      store.addBundle({ id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true });

      expect(store.orderTotal).toBe(39);
      expect(store.lineItems).toHaveLength(2);
      expect(store.lineItems[0].type).toBe('subscription');
      expect(store.lineItems[1].type).toBe('token_bundle');
    });

    // S93 root cause: the cart `price` for the plan is the GROSS amount (from
    // the computed Price VO), so the order total equals the plan gross plus any
    // selected add-ons/bundles. The summary's "Gross" line uses the same
    // gross_price, so Total === plan-gross + add-ons (no net/gross mixing).
    it('orderTotal equals the plan GROSS plus selected add-ons (== breakdown gross)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        plan: {
          id: 'plan-uuid-pro',
          name: 'Pro',
          slug: 'pro',
          display_price: 29.99,
          billing_period: 'MONTHLY',
          effective_display_mode: 'brutto',
          prices_display_mode: 'brutto',
          price: {
            netto: 29.99,
            taxes: [{ code: 'VAT_DE', rate: 19, amount: 5.6981 }],
            brutto: 35.6881,
            currency: 'EUR',
          },
        },
      });
      const store = useSubscriptionCheckoutStore();
      await store.loadPlan('pro');

      // Plan gross alone — the cart price is the gross, matching the summary.
      expect(store.plan?.price).toBeCloseTo(35.6881, 4);
      expect(store.plan?.gross_price).toBeCloseTo(35.6881, 4);
      expect(store.grossTotal).toBeCloseTo(35.6881, 4);
      expect(store.orderTotal).toBeCloseTo(35.6881, 4);

      // Add the +€15 Priority Support add-on (the invisible-in-summary line).
      store.addAddon({ id: 'a1', name: 'Priority Support', slug: 'priority-support', description: '', price: 15, currency: 'EUR', billing_period: 'monthly', is_active: true });

      // Total = plan gross + add-on; both are visible in the summary now.
      expect(store.orderTotal).toBeCloseTo(50.6881, 4);
    });
  });

  describe('setPaymentMethod', () => {
    it('sets the payment method code', () => {
      const store = useSubscriptionCheckoutStore();
      store.setPaymentMethod('paypal');

      expect(store.paymentMethodCode).toBe('paypal');
    });
  });

  describe('reset', () => {
    it('resets ephemeral state but keeps the persisted cart', () => {
      const store = useSubscriptionCheckoutStore();
      cart().addItem({ type: 'PLAN', id: 'pro', name: 'Pro', price: 29, metadata: { plan_id: 'p1', slug: 'pro', billing_period: 'MONTHLY', currency: 'USD' } });
      store.isCartCheckout = true;
      store.paymentMethodCode = 'stripe';
      store.error = 'some error';
      store.addBundle({ id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true });

      store.reset();

      expect(store.isCartCheckout).toBe(false);
      expect(store.paymentMethodCode).toBeNull();
      expect(store.error).toBeNull();
      // Cart-backed plan + selections persist across reset (navigation).
      expect(store.plan).not.toBeNull();
      expect(store.selectedBundles).toHaveLength(1);
    });
  });

  describe('orderPrice (order-level tax aggregation)', () => {
    function seedPlan(priceObj?: Record<string, unknown>) {
      cart().addItem({
        type: 'PLAN',
        id: 'pro',
        name: 'Pro',
        price: 119,
        metadata: {
          plan_id: 'p1',
          slug: 'pro',
          billing_period: 'MONTHLY',
          currency: 'EUR',
          gross_price: 119,
          net_price: 100,
          price_obj: priceObj,
        },
      });
    }

    it('is a single tax group for a plan-only order (homogeneous)', () => {
      const store = useSubscriptionCheckoutStore();
      seedPlan({ netto: 100, taxes: [{ code: 'VAT_DE', rate: 19, amount: 19 }], brutto: 119, currency: 'EUR' });
      expect(store.orderPrice.taxes).toHaveLength(1);
      expect(store.orderPrice.netto).toBe(100);
      expect(store.orderPrice.brutto).toBe(119);
      expect(store.orderPrice.taxes[0].amount).toBe(19);
    });

    it('merges a same-rate add-on into one tax group (homogeneous)', () => {
      const store = useSubscriptionCheckoutStore();
      seedPlan({ netto: 100, taxes: [{ code: 'VAT', rate: 19, amount: 19 }], brutto: 119, currency: 'EUR' });
      store.addAddon({
        id: 'a1', name: 'Priority', slug: 'priority', description: '', price: 23.8,
        currency: 'EUR', billing_period: 'monthly', is_active: true,
        price_obj: { netto: 20, taxes: [{ code: 'VAT', rate: 19, amount: 3.8 }], brutto: 23.8, currency: 'EUR' },
      });
      expect(store.orderPrice.taxes).toHaveLength(1);
      expect(store.orderPrice.taxes[0].amount).toBeCloseTo(22.8, 5);
      expect(store.orderPrice.netto).toBe(120);
    });

    it('keeps a different-rate add-on as a separate group (heterogeneous)', () => {
      const store = useSubscriptionCheckoutStore();
      seedPlan({ netto: 100, taxes: [{ code: 'VAT', rate: 19, amount: 19 }], brutto: 119, currency: 'EUR' });
      store.addAddon({
        id: 'a1', name: 'Reduced', slug: 'reduced', description: '', price: 107,
        currency: 'EUR', billing_period: 'monthly', is_active: true,
        price_obj: { netto: 100, taxes: [{ code: 'VAT', rate: 7, amount: 7 }], brutto: 107, currency: 'EUR' },
      });
      expect(store.orderPrice.taxes).toHaveLength(2);
      expect(store.orderPrice.netto).toBe(200);
    });

    it('falls back to net == gross for an add-on without a price_obj', () => {
      const store = useSubscriptionCheckoutStore();
      seedPlan({ netto: 100, taxes: [{ code: 'VAT', rate: 19, amount: 19 }], brutto: 119, currency: 'EUR' });
      store.addAddon({
        id: 'a1', name: 'Legacy', slug: 'legacy', description: '', price: 50,
        currency: 'EUR', billing_period: 'monthly', is_active: true,
      });
      expect(store.orderPrice.taxes).toHaveLength(1);
      expect(store.orderPrice.netto).toBe(150);
      expect(store.orderPrice.brutto).toBe(169);
    });
  });
});
