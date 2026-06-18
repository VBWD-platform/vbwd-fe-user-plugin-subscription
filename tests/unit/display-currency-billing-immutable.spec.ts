/**
 * S99.4 regression — the contract crux.
 *
 * The view-only display-currency switch must NEVER reach the checkout submit
 * payload (core hard rule: checkout charges the billing currency). This test
 * loads a plan, switches the display currency to a non-billing one, submits,
 * and asserts the payload is byte-for-byte the billing-currency payload —
 * carrying no display currency and unchanged item references.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSubscriptionCheckoutStore } from '../../subscription/stores/checkout';
import { useCartStore } from 'vbwd-view-component';
import { api } from '@/api';
import { useAppConfigStore } from '@/stores/appConfig';
import { useDisplayCurrencyStore } from '@/stores/displayCurrency';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  isAuthenticated: vi.fn(() => true),
}));

vi.mock('vbwd-view-component', async () => {
  const { reactive } = await import('vue');
  const items = reactive<
    Array<{ type: string; id: string; name: string; price: number; quantity: number; metadata?: Record<string, unknown> }>
  >([]);
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
    clearCart: vi.fn(() => { items.splice(0, items.length); }),
  };
  return {
    useCartStore: () => cart,
    setOperatingCurrency: vi.fn(),
  };
});

async function seedConfig(): Promise<void> {
  vi.mocked(api.get).mockResolvedValue({
    default_currency: 'EUR',
    prices_display_mode: 'brutto',
    prices_mode_in_db: 'NETTO',
    base_currency: 'EUR',
    active_currencies: ['EUR', 'USD'],
    currency_rates: { EUR: '1', USD: '1.1' },
  });
  await useAppConfigStore().load();
}

describe('display switch never reaches the checkout payload (S99.4)', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.clear();
    const cart = useCartStore();
    cart.items.splice(0, cart.items.length);
    vi.clearAllMocks();
    await seedConfig();
  });

  it('submits the billing-currency payload regardless of the display switch', async () => {
    const store = useSubscriptionCheckoutStore();
    store.addBundle({ id: 'b1', name: '1000 Tokens', token_amount: 1000, price: 10, currency: 'EUR', is_active: true });

    // User switches the DISPLAY currency to USD (view-only).
    const display = useDisplayCurrencyStore();
    display.setCurrency('USD');
    expect(display.code).toBe('USD');

    vi.mocked(api.post).mockResolvedValueOnce({
      invoice: { id: 'inv-1', status: 'pending', amount: '10.00', total_amount: '10.00', currency: 'EUR', line_items: [] },
      token_bundles: [{ id: 'bp-1', bundle_id: 'b1', status: 'pending' }],
      add_ons: [],
      message: 'ok',
    });

    await store.submitCheckout();

    // The payload is exactly the billing-currency payload — no display currency,
    // no currency field at all (the backend bills in default_currency).
    expect(api.post).toHaveBeenCalledWith('/user/checkout', {
      token_bundle_ids: ['b1'],
      add_on_ids: [],
    });
    const payload = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain('USD');
    expect(payload).not.toHaveProperty('currency');

    // The created invoice keeps its billing currency, untouched by the switch.
    expect(store.checkoutResult?.invoice?.currency).toBe('EUR');
  });
});
