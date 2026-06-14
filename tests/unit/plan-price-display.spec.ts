/**
 * S72.4 — netto/brutto wiring in the subscription plan price surfaces.
 *
 * Plans.vue renders the shared <PriceDisplay> in both the card and table views,
 * fed by each plan's top-level net_price/gross_price + effective/global display
 * modes from /tarif-plans. These oracle tests assert the net-vs-gross choice and
 * the "netto price" tag for the three modes, using the real Plans component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import Plans from '../../subscription/views/Plans.vue';
import { usePlansStore, type Plan } from '../../subscription/stores/plans';
import { useSubscriptionStore } from '../../subscription/stores/subscription';

vi.mock('@/api', () => ({ api: { get: vi.fn().mockResolvedValue({}), post: vi.fn() } }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Plans.vue now reads the viewer account_type via useAuthStore (S85.4). Keep the
// real fe-core exports (e.g. formatMoney) and only stub the store — fe-core ships
// its own pinia instance, which the test's root pinia can't satisfy.
vi.mock('vbwd-view-component', async () => {
  const actual = await vi.importActual<typeof import('vbwd-view-component')>('vbwd-view-component');
  return { ...actual, useAuthStore: () => ({ user: null }) };
});

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: { en: { price: { nettoTag: 'netto price' } } },
});

function makePlan(overrides: Partial<Plan>): Plan {
  return {
    id: 'plan-1',
    name: 'Pro',
    slug: 'pro',
    display_currency: 'EUR',
    display_price: 100,
    billing_period: 'monthly',
    is_active: true,
    net_price: 100,
    gross_price: 119,
    ...overrides,
  };
}

async function mountWithPlan(overrides: Partial<Plan>) {
  const plansStore = usePlansStore();
  plansStore.plans = [makePlan(overrides)];
  // Pre-empt the onMounted loadPlans() refetch so the seeded plan survives.
  vi.spyOn(plansStore, 'fetchPlans').mockResolvedValue(undefined as never);
  const subStore = useSubscriptionStore();
  vi.spyOn(subStore, 'fetchSubscription').mockResolvedValue(undefined as never);

  const wrapper = mount(Plans, {
    global: {
      plugins: [i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('Plans price display (S72.4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('shows the NET amount + netto tag for a netto plan under a brutto global', async () => {
    const wrapper = await mountWithPlan({
      effective_display_mode: 'netto',
      prices_display_mode: 'brutto',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(amount).not.toContain('119');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(true);
  });

  it('shows the GROSS amount and no tag for a brutto plan', async () => {
    const wrapper = await mountWithPlan({
      effective_display_mode: 'brutto',
      prices_display_mode: 'brutto',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('119');
    expect(amount).not.toContain('100');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(false);
  });

  it('shows net everywhere and no tag under a global netto', async () => {
    const wrapper = await mountWithPlan({
      effective_display_mode: 'netto',
      prices_display_mode: 'netto',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(false);
  });
});
