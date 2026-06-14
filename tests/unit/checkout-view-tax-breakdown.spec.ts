/**
 * S85.4 follow-up — the SUBSCRIPTION dashboard Checkout view
 * (`/dashboard/checkout/:planSlug`) must show the same tax disclosure +
 * correct-currency formatting the generic PublicCheckoutView already got:
 *
 *  1. Pre-payment Order Summary: the plan price via <PriceDisplay> (viewer-aware,
 *     business ⇒ netto) plus a per-rate <PriceBreakdown> when the plan carries
 *     taxes; every amount formatted via formatMoney (right currency symbol, 2dp).
 *  2. Post-payment success/pending block: invoice line items + totals via
 *     formatMoney (no literal "$"); a <PriceBreakdown> built from the persisted
 *     per-line `tax_breakdown` (display-sum only, no recompute). Taxless ⇒ no
 *     tax lines, net == gross.
 *  3. Guard: no literal "$" left in the rendered summary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { nextTick } from 'vue';
import Checkout from '../../subscription/views/Checkout.vue';
import { useSubscriptionCheckoutStore } from '../../subscription/stores/checkout';
import { useCartStore } from 'vbwd-view-component';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  isAuthenticated: vi.fn(() => true),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {}, name: 'checkout' }),
  useRouter: () => ({ push: vi.fn() }),
}));

const shared = vi.hoisted(() => ({
  accountType: null as 'private' | 'business' | null,
}));

// Reactive in-memory cart so the store's cart-backed `plan` computed recomputes.
vi.mock('vbwd-view-component', async () => {
  const { reactive } = await import('vue');
  const items = reactive<Array<{ type: string; id: string; name: string; price: number; quantity: number; metadata?: Record<string, unknown> }>>([]);
  const cart = {
    items,
    getItemById: (id: string) => items.find((it) => it.id === id),
    getItemsByType: (type: string) => items.filter((it) => it.type === type),
    addItem: (input: { type: string; id: string; name: string; price: number; metadata?: Record<string, unknown> }) => {
      items.push({ ...input, quantity: 1 });
    },
    removeItem: vi.fn(),
    clearCart: vi.fn(),
  };
  return {
    useCartStore: () => cart,
    useAuthStore: () => ({ user: shared.accountType ? { account_type: shared.accountType } : null }),
    formatMoney: (amount: number, opts: { currency?: string } = {}) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: opts.currency || 'USD' }).format(amount),
    isZeroTotal: (value: number) => Number(value) === 0,
    payButtonLabelOverride: null,
    CouponInput: { name: 'CouponInput', template: '<div />' },
  };
});

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale: string, key: string) => key,
  messages: {
    en: {
      price: {
        nettoTag: 'netto price',
        net: 'Net',
        gross: 'Gross',
        taxLine: '{name} {rate}%',
        totalNet: 'Total netto',
        totalTax: 'Total taxes',
        totalTaxWithRate: 'Total taxes ({rate}%)',
        totalGross: 'Total brutto to pay',
      },
      common: { billingPeriods: { month: 'month' }, remove: 'Remove' },
      checkout: {
        title: 'Checkout',
        orderSummary: { title: 'Order Summary', total: 'Total:', finalPrice: 'Final price:', youSaved: 'You saved' },
        success: {
          title: 'Success',
          invoiceItems: 'Invoice Items',
          totalLabel: 'Total:',
          invoiceLabel: 'Invoice',
          paymentRequired: 'Payment required',
          paymentComplete: 'Complete',
        },
        payButton: 'Pay {amount}',
        submitting: 'Submitting',
        activateFree: 'Activate',
      },
    },
  },
});

// Child blocks are irrelevant to the pricing disclosure under test — stub them.
const stubs = {
  EmailBlock: true,
  PaymentMethodsBlock: true,
  TermsCheckbox: true,
  BillingAddressBlock: true,
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
};

function mountCheckout() {
  return mount(Checkout, { global: { plugins: [i18n], stubs } });
}

// Add a PLAN item to the (mocked) cart so `store.plan` materialises with the
// S85.4 pricing fields (incl. the EUR order currency).
function seed(): ReturnType<typeof useSubscriptionCheckoutStore> {
  const store = useSubscriptionCheckoutStore();
  useCartStore().addItem({
    type: 'PLAN',
    id: 'basic',
    name: 'Basic',
    price: 11.89,
    metadata: {
      plan_id: 'plan-1',
      slug: 'basic',
      billing_period: 'monthly',
      currency: 'EUR',
      net_price: 9.99,
      gross_price: 11.89,
      effective_display_mode: 'brutto',
      prices_display_mode: 'brutto',
      price_obj: {
        netto: 9.99,
        taxes: [{ code: 'VAT_DE', rate: 19, amount: 1.9 }],
        brutto: 11.89,
        currency: 'EUR',
      },
    },
  });
  return store;
}

describe('Checkout.vue pre-payment order summary', () => {
  beforeEach(() => {
    shared.accountType = null;
    setActivePinia(createPinia());
  });

  it('renders the plan gross via PriceDisplay in the plan currency (no literal $)', async () => {
    seed();
    const wrapper = mountCheckout();
    await nextTick();
    const summary = wrapper.find('[data-testid="order-summary"]');
    const price = summary.find('[data-testid="price-amount"]');
    expect(price.text()).toContain('€11.89');
    expect(summary.text()).not.toContain('$');
  });

  it('renders the net amount for a business viewer (D9 overlay)', async () => {
    shared.accountType = 'business';
    seed();
    const wrapper = mountCheckout();
    await nextTick();
    const price = wrapper.find('[data-testid="order-summary"] [data-testid="price-amount"]');
    expect(price.text()).toContain('€9.99');
  });

  it('renders the order-level homogeneous tax block when the plan carries taxes', async () => {
    // Plan-only order = one tax group (homogeneous): no per-line plan breakdown
    // (the order-level <OrderTaxSummary> covers it), and the order block shows
    // "Total taxes (19%)" with the €1.90 tax amount.
    seed();
    const wrapper = mountCheckout();
    await nextTick();
    // No per-line plan breakdown in the homogeneous case.
    expect(wrapper.find('[data-testid="order-summary"] [data-testid="price-breakdown-tax-line"]').exists()).toBe(false);
    // The order-level block discloses net / total-taxes / gross.
    expect(wrapper.find('[data-testid="order-tax-net"]').text()).toContain('€9.99');
    const totalTax = wrapper.find('[data-testid="order-tax-total"]');
    expect(totalTax.text()).toContain('19');
    expect(totalTax.text()).toContain('€1.90');
    expect(wrapper.find('[data-testid="order-tax-gross"]').text()).toContain('€11.89');
  });

  it('renders per-line breakdowns + summed order taxes for a HETEROGENEOUS order', async () => {
    const store = seed();
    // Add a reduced-rate (7%) add-on so the order spans two rates.
    useCartStore().addItem({
      type: 'ADD_ON',
      id: 'reduced',
      name: 'Reduced',
      price: 10.7,
      metadata: {
        slug: 'reduced',
        currency: 'EUR',
        price_obj: { netto: 10, taxes: [{ code: 'VAT_RED', rate: 7, amount: 0.7 }], brutto: 10.7, currency: 'EUR' },
      },
    });
    void store;
    const wrapper = mountCheckout();
    await nextTick();
    // Heterogeneous → per-line breakdowns render (plan 19% + add-on 7%).
    const perLine = wrapper.findAll('[data-testid="order-summary"] [data-testid="price-breakdown-tax-line"]');
    expect(perLine.length).toBe(2);
    // The order block sums both taxes: 1.90 + 0.70 = 2.60 (generic label).
    const totalTax = wrapper.find('[data-testid="order-tax-total"]');
    expect(totalTax.text()).toContain('€2.60');
  });
});

describe('Checkout.vue token-bundle / add-on picker cards (Fix B)', () => {
  beforeEach(() => {
    shared.accountType = null;
    setActivePinia(createPinia());
  });

  it('formats picker-card prices in the order currency (no literal $)', async () => {
    const store = seed();
    // Plain (non-cart) checkout still offers the bundle / add-on picker cards.
    store.availableBundles = [
      { id: 'b1', name: 'Starter', token_amount: 500, price: 5, is_active: true },
    ] as unknown as typeof store.availableBundles;
    store.availableAddons = [
      { id: 'a1', name: 'Priority Support', description: 'Faster help', price: 15, is_active: true },
    ] as unknown as typeof store.availableAddons;

    const wrapper = mountCheckout();
    await nextTick();

    const bundlePrice = wrapper.find('[data-testid="token-bundle-500"] .option-price');
    expect(bundlePrice.text()).toContain('€5');
    expect(bundlePrice.text()).not.toContain('$');

    const addonPrice = wrapper.find('[data-testid="addon-priority-support-price"]');
    expect(addonPrice.text()).toContain('€15');
    expect(addonPrice.text()).not.toContain('$');
  });
});

describe('Checkout.vue post-payment success block', () => {
  beforeEach(() => {
    shared.accountType = null;
    setActivePinia(createPinia());
  });

  function withInvoice(lineItems: unknown[], totals: Record<string, unknown>) {
    const store = useSubscriptionCheckoutStore();
    store.checkoutResult = {
      invoice: {
        id: 'inv-1',
        invoice_number: 'INV-001',
        status: 'PAID',
        amount: String(totals.total_amount),
        currency: 'EUR',
        line_items: lineItems as never,
        ...totals,
      },
      message: 'ok',
    } as never;
    return store;
  }

  it('renders invoice line items + total via formatMoney with the right currency (no literal $)', async () => {
    withInvoice(
      [{ type: 'subscription', description: 'Basic', total_price: '11.8881' }],
      { subtotal: '9.99', tax_amount: '1.90', total_amount: '11.89' },
    );
    const wrapper = mountCheckout();
    await nextTick();
    const block = wrapper.find('[data-testid="invoice-line-items"]');
    expect(block.text()).toContain('€11.89');
    expect(block.text()).not.toContain('11.8881');
    expect(block.text()).not.toContain('$');
  });

  it('renders the tax breakdown from per-line tax_breakdown using the tax NAME', async () => {
    withInvoice(
      [{
        type: 'subscription',
        description: 'Basic',
        total_price: '11.89',
        tax_breakdown: [{ code: 'VAT_DE', name: 'VAT Germany', rate: 19, amount: 1.9 }],
      }],
      { subtotal: '9.99', tax_amount: '1.90', total_amount: '11.89' },
    );
    const wrapper = mountCheckout();
    await nextTick();
    const taxLines = wrapper.findAll('[data-testid="invoice-line-items"] [data-testid="price-breakdown-tax-line"]');
    expect(taxLines.length).toBe(1);
    // The human-readable name is shown (e.g. "VAT Germany 19%"), not the code.
    expect(taxLines[0].text()).toContain('VAT Germany');
    expect(taxLines[0].text()).not.toContain('VAT_DE');
    const net = wrapper.find('[data-testid="invoice-line-items"] [data-testid="price-breakdown-net"]');
    expect(net.text()).toContain('€9.99');
  });

  it('renders no tax lines when the invoice is taxless (net == gross)', async () => {
    withInvoice(
      [{ type: 'subscription', description: 'Free', total_price: '0.00' }],
      { subtotal: '0.00', tax_amount: '0.00', total_amount: '0.00' },
    );
    const wrapper = mountCheckout();
    await nextTick();
    const taxLines = wrapper.findAll('[data-testid="invoice-line-items"] [data-testid="price-breakdown-tax-line"]');
    expect(taxLines.length).toBe(0);
  });
});
