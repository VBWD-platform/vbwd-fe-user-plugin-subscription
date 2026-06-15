/**
 * TariffPlanCollection CMS vue-component widget.
 *
 * A searchable / sortable / card-or-table collection of tariff plans that a CMS
 * editor drops into a layout. The widget receives the single ``config`` prop
 * (``{ ...widget.config, widget_slug }``) the CmsWidgetRenderer passes, fetches
 * plans through the subscription plans store, and pushes to checkout on select.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import TariffPlanCollection from '../../subscription/components/widgets/TariffPlanCollection.vue';
import { usePlansStore, type Plan } from '../../subscription/stores/plans';

const routerPush = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerPush }) }));

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
    id: `plan-${overrides.slug}`,
    name: 'Plan',
    slug: 'plan',
    description: '',
    display_currency: 'EUR',
    display_price: 10,
    billing_period: 'monthly',
    is_active: true,
    net_price: 10,
    gross_price: 12,
    effective_display_mode: 'brutto',
    prices_display_mode: 'brutto',
    ...overrides,
  };
}

const PLANS: Plan[] = [
  makePlan({ slug: 'gamma', name: 'Gamma', description: 'cheapest', net_price: 5, gross_price: 6 }),
  makePlan({ slug: 'alpha', name: 'Alpha', description: 'enterprise', net_price: 30, gross_price: 36 }),
  makePlan({ slug: 'beta', name: 'Beta', description: 'business', net_price: 15, gross_price: 18 }),
];

async function mountWidget(config: Record<string, unknown>, plans: Plan[] = PLANS) {
  const plansStore = usePlansStore();
  vi.spyOn(plansStore, 'fetchPlans').mockImplementation(async () => {
    plansStore.plans = plans;
    return { plans, currency: 'EUR', country: null };
  });
  const wrapper = mount(TariffPlanCollection, {
    props: { config: { component_name: 'TariffPlanCollection', widget_slug: 'plans-1', ...config } },
    global: { plugins: [i18n] },
  });
  await flushPromises();
  return wrapper;
}

function cardSlugs(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper
    .findAll('[data-testid^="tariff-plan-card-"]')
    .map((node) => node.attributes('data-testid')!.replace('tariff-plan-card-', ''));
}

describe('TariffPlanCollection widget', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('renders plan cards from fetched data, sorted by ascending net price', async () => {
    const wrapper = await mountWidget({});
    expect(cardSlugs(wrapper)).toEqual(['gamma', 'beta', 'alpha']);
  });

  it('honours config.default_view = table by rendering rows', async () => {
    const wrapper = await mountWidget({ default_view: 'table' });
    expect(wrapper.find('[data-testid="tariff-plan-table"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid^="tariff-plan-row-"]').length).toBe(3);
  });

  it('filters the list by the search input (name + description)', async () => {
    const wrapper = await mountWidget({});
    await wrapper.get('[data-testid="collection-search"]').setValue('enterprise');
    expect(cardSlugs(wrapper)).toEqual(['alpha']);
  });

  it('flips the price sort from ascending to descending on toggle', async () => {
    const wrapper = await mountWidget({});
    await wrapper.get('[data-testid="collection-sort-toggle"]').trigger('click');
    expect(cardSlugs(wrapper)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('toggles to the table view at runtime', async () => {
    const wrapper = await mountWidget({ default_view: 'cards' });
    expect(wrapper.find('[data-testid="tariff-plan-table"]').exists()).toBe(false);
    await wrapper.get('[data-testid="collection-view-table"]').trigger('click');
    expect(wrapper.find('[data-testid="tariff-plan-table"]').exists()).toBe(true);
  });

  it('pushes to checkout with the plan slug when a plan is selected', async () => {
    const wrapper = await mountWidget({});
    await wrapper.get('[data-testid="select-plan-gamma"]').trigger('click');
    expect(routerPush).toHaveBeenCalledWith({ name: 'checkout', params: { planSlug: 'gamma' } });
  });

  it('keeps only the configured slugs in slugs mode', async () => {
    const wrapper = await mountWidget({ source_mode: 'slugs', plan_slugs: ['beta', 'gamma'] });
    expect(cardSlugs(wrapper).sort()).toEqual(['beta', 'gamma']);
  });

  it('passes the configured category to the plans store in category mode', async () => {
    const plansStore = usePlansStore();
    const wrapper = await mountWidget({ source_mode: 'category', category: 'pro-plans' });
    expect(plansStore.fetchPlans).toHaveBeenCalled();
    const callArgs = (plansStore.fetchPlans as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(callArgs).toContain('pro-plans');
    expect(cardSlugs(wrapper).length).toBe(3);
  });
});
