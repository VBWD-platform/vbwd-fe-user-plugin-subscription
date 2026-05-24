import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSubscriptionCheckoutStore } from '../../subscription/stores/checkout';
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

let mockCartItems: Array<{ type: string; id: string; name: string; price: number; quantity: number; metadata?: Record<string, unknown> }> = [];
const mockClearCart = vi.fn();

vi.mock('vbwd-view-component', () => ({
  useCartStore: () => ({
    get items() { return mockCartItems; },
    clearCart: mockClearCart,
  }),
}));

describe('SubscriptionCheckoutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockCartItems = [];
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

  describe('loadFromCart', () => {
    it('populates bundles and addons from cart', async () => {
      mockCartItems = [
        {
          type: 'TOKEN_BUNDLE',
          id: 'bundle-1',
          name: '1000 Tokens',
          price: 10,
          quantity: 1,
          metadata: { token_amount: 1000, currency: 'USD' }
        },
        {
          type: 'ADD_ON',
          id: 'addon-1',
          name: 'Priority Support',
          price: 15,
          quantity: 1,
          metadata: { slug: 'priority-support', description: 'Priority support addon', currency: 'USD', billing_period: 'monthly' }
        },
      ];

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
      mockCartItems = [
        {
          type: 'PLAN',
          id: 'plan-slug-1',
          name: 'Pro Plan',
          price: 29,
          quantity: 1,
        },
      ];

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
      mockCartItems = [];

      const store = useSubscriptionCheckoutStore();
      await store.loadFromCart();

      expect(store.error).toBe('Cart is empty');
    });
  });

  describe('submitCheckout', () => {
    it('works without plan (bundles only)', async () => {
      const store = useSubscriptionCheckoutStore();
      store.selectedBundles = [
        { id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true }
      ];

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
      store.plan = { id: 'p1', name: 'Pro', slug: 'pro', price: 29, currency: 'USD', billing_period: 'MONTHLY' };
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

    it('clears cart after successful cart checkout', async () => {
      const store = useSubscriptionCheckoutStore();
      store.isCartCheckout = true;
      store.selectedBundles = [
        { id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true }
      ];

      vi.mocked(api.post).mockResolvedValueOnce({
        invoice: { id: 'inv-1', invoice_number: 'INV-001', status: 'pending', amount: '10.00', total_amount: '10.00', currency: 'USD', line_items: [] },
        token_bundles: [],
        add_ons: [],
        message: 'Checkout created. Awaiting payment.',
      });

      await store.submitCheckout();

      expect(mockClearCart).toHaveBeenCalled();
    });
  });

  describe('orderTotal and lineItems', () => {
    it('computes correctly without plan', () => {
      const store = useSubscriptionCheckoutStore();
      store.selectedBundles = [
        { id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true },
        { id: 'b2', name: '5000 Tokens', token_amount: 5000, price: 40, currency: 'USD', is_active: true },
      ];
      store.selectedAddons = [
        { id: 'a1', name: 'Support', slug: 'support', description: '', price: 15, currency: 'USD', billing_period: 'monthly', is_active: true },
      ];

      expect(store.orderTotal).toBe(65);
      expect(store.lineItems).toHaveLength(3);
      expect(store.lineItems[0].type).toBe('token_bundle');
      expect(store.lineItems[1].type).toBe('token_bundle');
      expect(store.lineItems[2].type).toBe('add_on');
    });

    it('includes plan in total when present', () => {
      const store = useSubscriptionCheckoutStore();
      store.plan = { id: 'p1', name: 'Pro', slug: 'pro', price: 29, currency: 'USD', billing_period: 'MONTHLY' };
      store.selectedBundles = [
        { id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'USD', is_active: true },
      ];

      expect(store.orderTotal).toBe(39);
      expect(store.lineItems).toHaveLength(2);
      expect(store.lineItems[0].type).toBe('subscription');
      expect(store.lineItems[1].type).toBe('token_bundle');
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
    it('resets all state including cart checkout fields', () => {
      const store = useSubscriptionCheckoutStore();
      store.plan = { id: 'p1', name: 'Pro', slug: 'pro', price: 29, currency: 'USD', billing_period: 'MONTHLY' };
      store.isCartCheckout = true;
      store.paymentMethodCode = 'stripe';
      store.error = 'some error';

      store.reset();

      expect(store.plan).toBeNull();
      expect(store.isCartCheckout).toBe(false);
      expect(store.paymentMethodCode).toBeNull();
      expect(store.error).toBeNull();
    });
  });
});
