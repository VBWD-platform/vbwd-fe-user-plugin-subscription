/**
 * S85.4 gap #2 — PlanCheckoutSummary renders the real net/gross split + tax
 * disclosure from the plan pricing the checkout store now carries (from
 * /tarif-plans), and applies the business-viewer overlay (D9) — instead of
 * falling back to net == gross.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import PlanCheckoutSummary from '../../subscription/components/checkout/PlanCheckoutSummary.vue';

vi.mock('@/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const shared = vi.hoisted(() => ({ accountType: null as 'private' | 'business' | null }));

vi.mock('vbwd-view-component', async () => {
  const { reactive } = await import('vue');
  // The plan is derived by the checkout store from the single cart PLAN item;
  // its pricing fields live in the item metadata. We seed exactly that.
  const items = reactive([
    {
      type: 'PLAN',
      id: 'pro',
      name: 'Pro',
      price: 119,
      quantity: 1,
      metadata: {
        plan_id: 'plan-1',
        slug: 'pro',
        billing_period: 'monthly',
        currency: 'EUR',
        net_price: 100,
        gross_price: 119,
        effective_display_mode: 'brutto',
        prices_display_mode: 'brutto',
        price_obj: {
          netto: 100,
          taxes: [{ code: 'VAT_DE', rate: 19, amount: 19 }],
          brutto: 119,
          currency: 'EUR',
        },
      },
    },
  ]);
  // A selected add-on lives in the same cart (single source of truth). It is
  // summed into the order total, so the summary must render it too (S93). It
  // carries its own Price VO at a DIFFERENT rate (7%) than the plan's 19% — so
  // the order is heterogeneous and per-line breakdowns render.
  items.push({
    type: 'ADD_ON',
    id: 'addon-priority',
    name: 'Priority Support',
    price: 15,
    quantity: 1,
    metadata: {
      slug: 'priority-support',
      currency: 'EUR',
      price_obj: {
        netto: 14,
        taxes: [{ code: 'VAT_REDUCED', rate: 7, amount: 1 }],
        brutto: 15,
        currency: 'EUR',
      },
    },
  } as unknown as (typeof items)[number]);
  const cart = {
    items,
    getItemById: (id: string) => items.find((it) => it.id === id),
    getItemsByType: (type: string) => items.filter((it) => it.type === type),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
  };
  return {
    useCartStore: () => cart,
    useAuthStore: () => ({ user: shared.accountType ? { account_type: shared.accountType } : null }),
    formatMoney: (amount: number, opts: { currency?: string } = {}) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: opts.currency || 'USD' }).format(amount),
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
      },
      common: { billingPeriods: { month: 'month' } },
    },
  },
});

function mountSummary() {
  return mount(PlanCheckoutSummary, { global: { plugins: [i18n] } });
}

describe('PlanCheckoutSummary pricing', () => {
  beforeEach(() => {
    shared.accountType = null;
    setActivePinia(createPinia());
  });

  it('renders the gross amount under a brutto global', () => {
    const wrapper = mountSummary();
    expect(wrapper.find('[data-testid="price-amount"]').text()).toContain('119');
  });

  it('renders the net amount for a business viewer (D9 overlay)', () => {
    shared.accountType = 'business';
    const wrapper = mountSummary();
    expect(wrapper.find('[data-testid="price-amount"]').text()).toContain('100');
  });

  it('renders per-line tax breakdowns in a HETEROGENEOUS order (plan 19% + add-on 7%)', () => {
    // The seeded plan (VAT_DE 19%) + add-on (VAT_REDUCED 7%) span two rates →
    // heterogeneous → each line shows its own per-rate breakdown.
    const wrapper = mountSummary();
    const taxLines = wrapper.findAll('[data-testid="price-breakdown-tax-line"]');
    expect(taxLines.length).toBe(2);
    expect(wrapper.text()).toContain('VAT_DE');
    expect(wrapper.text()).toContain('VAT_REDUCED');
  });

  it('renders a row for each selected add-on so the summary matches the Total (S93)', () => {
    // The +€15 add-on must appear in the summary — otherwise the visible
    // breakdown (plan only) understates the Total the checkout view shows.
    const wrapper = mountSummary();
    const addonRows = wrapper.findAll('[data-testid="summary-add-on"]');
    expect(addonRows.length).toBe(1);
    expect(addonRows[0].text()).toContain('Priority Support');
    expect(addonRows[0].text()).toContain('15');
  });
});
