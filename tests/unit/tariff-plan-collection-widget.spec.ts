/**
 * TariffPlanCollection CMS vue-component widget.
 *
 * A searchable / sortable / card-or-table collection of tariff plans that a CMS
 * editor drops into a layout. The widget receives the single ``config`` prop
 * (``{ ...widget.config, widget_slug }``) the CmsWidgetRenderer passes, fetches
 * plans through the subscription plans store, and pushes to checkout on select.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  afterEach(() => {
    document
      .querySelectorAll('[data-tariff-plan-collection-css]')
      .forEach((el) => el.remove());
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

  it('pushes to the PUBLIC checkout with the plan slug when a plan is selected', async () => {
    const wrapper = await mountWidget({});
    await wrapper.get('[data-testid="select-plan-gamma"]').trigger('click');
    // Public widget → public checkout (?tarif_plan_id=…), never the dashboard
    // checkout route (/dashboard/checkout/:planSlug).
    expect(routerPush).toHaveBeenCalledWith({
      name: 'checkout-public',
      query: { tarif_plan_id: 'gamma' },
    });
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

  it('injects the admin CSS-tab override (config.css) into <head>', async () => {
    await mountWidget({ css: '.tariff-plan-collection { background: rebeccapurple; }' });
    const styleEl = document.head.querySelector('[data-tariff-plan-collection-css]');
    expect(styleEl).not.toBeNull();
    expect(styleEl!.textContent).toContain('rebeccapurple');
  });

  it('injects nothing when config.css is empty', async () => {
    await mountWidget({});
    expect(document.head.querySelector('[data-tariff-plan-collection-css]')).toBeNull();
  });

  it('removes its injected style on unmount', async () => {
    const wrapper = await mountWidget({ css: '.tariff-plan-collection { color: red; }' });
    expect(document.head.querySelector('[data-tariff-plan-collection-css]')).not.toBeNull();
    wrapper.unmount();
    expect(document.head.querySelector('[data-tariff-plan-collection-css]')).toBeNull();
  });
});

/**
 * Follow-up: the same admin-configurable presentation controls that
 * NativePricingPlans / Landing1View expose (theme, image, features, emphasized
 * plan, badge, subtitle, cta_label). Config keys match NativePricingPlans
 * EXACTLY so an operator's config is portable between the two widgets.
 *
 * The shared i18n harness uses ``missing: (_locale, key) => key`` so an absent
 * translation resolves to its key — the fallback assertions check for the key
 * string, which proves the widget routes blank values through i18n.
 */
describe('TariffPlanCollection presentation config', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const ALLOWED_THEMES = ['default', 'light', 'dark', 'teal', 'indigo', 'emerald'];

  function badgeIn(wrapper: ReturnType<typeof mount>, slug: string) {
    return wrapper
      .find(`[data-testid="tariff-plan-card-${slug}"]`)
      .find('[data-testid="tariff-plan-badge"]');
  }

  it.each(ALLOWED_THEMES)('applies the "%s" theme class to the root', async (theme) => {
    const wrapper = await mountWidget({ theme });
    expect(wrapper.find('.tariff-plan-collection').classes()).toContain(
      `tariff-plan-collection--${theme}`,
    );
  });

  it('falls back to the default theme class for an unknown theme value', async () => {
    const wrapper = await mountWidget({ theme: 'neon-glow' });
    expect(wrapper.find('.tariff-plan-collection').classes()).toContain(
      'tariff-plan-collection--default',
    );
  });

  it('marks the featured card and renders its badge when highlight_slug matches', async () => {
    const wrapper = await mountWidget({ highlight_slug: 'beta', highlight_badge: 'Top pick' });
    const card = wrapper.find('[data-testid="tariff-plan-card-beta"]');
    expect(card.classes()).toContain('tariff-plan-card--featured');
    expect(badgeIn(wrapper, 'beta').exists()).toBe(true);
    expect(badgeIn(wrapper, 'beta').text()).toBe('Top pick');
    // Non-emphasized cards carry neither the modifier nor a badge.
    expect(wrapper.find('[data-testid="tariff-plan-card-alpha"]').classes()).not.toContain(
      'tariff-plan-card--featured',
    );
    expect(badgeIn(wrapper, 'alpha').exists()).toBe(false);
  });

  it('falls back to the i18n badge label when highlight_badge is blank', async () => {
    const wrapper = await mountWidget({ highlight_slug: 'beta' });
    expect(badgeIn(wrapper, 'beta').text()).toBe('plans.mostPopular');
  });

  it('renders no featured badge when no highlight_slug is configured', async () => {
    const wrapper = await mountWidget({});
    expect(wrapper.find('[data-testid="tariff-plan-badge"]').exists()).toBe(false);
  });

  it('renders the features checklist on every card when features is non-empty', async () => {
    const wrapper = await mountWidget({ features: ['2000 MB Bandwidth', '5 GB Space'] });
    const lists = wrapper.findAll('[data-testid="tariff-plan-features"]');
    expect(lists.length).toBe(3);
    expect(lists[0].findAll('li').length).toBe(2);
    expect(lists[0].text()).toContain('2000 MB Bandwidth');
  });

  it('renders no features list when features is empty or absent', async () => {
    const emptyList = await mountWidget({ features: [] });
    expect(emptyList.find('[data-testid="tariff-plan-features"]').exists()).toBe(false);
    const absent = await mountWidget({});
    expect(absent.find('[data-testid="tariff-plan-features"]').exists()).toBe(false);
  });

  it('renders a card image on every card when image_url is set', async () => {
    const wrapper = await mountWidget({ image_url: 'https://cdn.example/icon.png' });
    const images = wrapper.findAll('[data-testid="tariff-plan-image"]');
    expect(images.length).toBe(3);
    expect(images[0].attributes('src')).toBe('https://cdn.example/icon.png');
  });

  it('renders no card image when image_url is absent', async () => {
    const wrapper = await mountWidget({});
    expect(wrapper.find('[data-testid="tariff-plan-image"]').exists()).toBe(false);
  });

  it('uses the configured heading / subtitle / cta_label overrides', async () => {
    const wrapper = await mountWidget({
      heading: 'Our Plans',
      subtitle: 'Pick the one for you',
      cta_label: 'Buy now',
    });
    expect(wrapper.find('[data-testid="tariff-plan-collection-heading"]').text()).toBe('Our Plans');
    expect(wrapper.find('[data-testid="tariff-plan-collection-subtitle"]').text()).toBe(
      'Pick the one for you',
    );
    expect(wrapper.find('[data-testid="select-plan-gamma"]').text()).toBe('Buy now');
  });

  it('falls back to i18n for heading / subtitle / cta_label when blank', async () => {
    const wrapper = await mountWidget({});
    expect(wrapper.find('[data-testid="tariff-plan-collection-heading"]').text()).toBe('plans.title');
    expect(wrapper.find('[data-testid="tariff-plan-collection-subtitle"]').text()).toBe(
      'plans.subtitle',
    );
    expect(wrapper.find('[data-testid="select-plan-gamma"]').text()).toBe('plans.selectPlan');
  });

  it('overrides the plan button label in the table view too', async () => {
    const wrapper = await mountWidget({ default_view: 'table', cta_label: 'Buy now' });
    expect(wrapper.find('[data-testid="select-plan-gamma"]').text()).toBe('Buy now');
  });

  it('keeps image, features and badge out of the compact table view', async () => {
    const wrapper = await mountWidget({
      default_view: 'table',
      image_url: 'https://cdn.example/icon.png',
      features: ['A', 'B'],
      highlight_slug: 'beta',
    });
    expect(wrapper.find('[data-testid="tariff-plan-table"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tariff-plan-image"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tariff-plan-features"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tariff-plan-badge"]').exists()).toBe(false);
  });

  it('backward compatible: a heading + default_view-only config keeps the cards structure', async () => {
    const wrapper = await mountWidget({ heading: 'Legacy heading', default_view: 'cards' });
    expect(cardSlugs(wrapper)).toEqual(['gamma', 'beta', 'alpha']);
    expect(wrapper.find('[data-testid="tariff-plan-collection-heading"]').text()).toBe(
      'Legacy heading',
    );
    expect(wrapper.find('.tariff-plan-collection').classes()).toContain(
      'tariff-plan-collection--default',
    );
    expect(wrapper.find('[data-testid="tariff-plan-features"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tariff-plan-image"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tariff-plan-badge"]').exists()).toBe(false);
  });
});
