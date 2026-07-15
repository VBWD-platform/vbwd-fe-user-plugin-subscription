/**
 * Plans.vue — the /dashboard/plans host.
 *
 * The page is now a thin host that renders the TariffPlanCollection CMS widget,
 * selecting the widget by a slug stored in the subscription BACKEND config
 * (``GET /api/v1/subscription/config``). It:
 *   - reads ``dashboard_plans_widget_slug`` from the subscription config,
 *   - when set, fetches that widget (``GET /cms/widgets/by-slug/<slug>``) and
 *     renders the widget with the merged config + ``checkout_target: 'dashboard'``,
 *   - when the widget lookup 404s (the slug is a tarif-plan CATEGORY slug, not a
 *     widget slug), resolves category mode ``{ source_mode: 'category',
 *     category: <slug>, checkout_target: 'dashboard' }`` so the category renders
 *     directly (no silent all-plans fallback for a set slug),
 *   - on empty slug, a config-fetch error, OR a NON-404 widget-fetch error,
 *     falls back to ``{ checkout_target: 'dashboard' }`` (the "all plans" mode).
 *
 * The TariffPlanCollection child is stubbed so we can inspect the ``config``
 * prop the host resolves — no store/i18n wiring needed here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { api } from '@/api';
import Plans from '../../subscription/views/Plans.vue';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>;

// Capture the config prop the host passes to the widget.
const TariffPlanCollectionStub = {
  name: 'TariffPlanCollection',
  props: ['config'],
  template: '<div data-testid="tariff-plan-collection-stub" />',
};

async function mountPlans() {
  const wrapper = mount(Plans, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        TariffPlanCollection: TariffPlanCollectionStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function widgetConfig(wrapper: Awaited<ReturnType<typeof mountPlans>>) {
  return wrapper.findComponent(TariffPlanCollectionStub).props('config') as Record<string, unknown>;
}

describe('Plans.vue widget host', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the widget with its merged config + dashboard checkout_target when a slug is configured and the widget is found', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/subscription/config') {
        return { dashboard_plans_widget_slug: 'my-plans' };
      }
      if (url === '/cms/widgets/by-slug/my-plans') {
        return {
          id: 'w1',
          slug: 'my-plans',
          name: 'My Plans',
          widget_type: 'vue-component',
          config: { heading: 'Choose a plan', source_mode: 'category', category: 'pro' },
          is_active: true,
        };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const wrapper = await mountPlans();

    expect(wrapper.findComponent(TariffPlanCollectionStub).exists()).toBe(true);
    expect(widgetConfig(wrapper)).toEqual({
      heading: 'Choose a plan',
      source_mode: 'category',
      category: 'pro',
      widget_slug: 'my-plans',
      checkout_target: 'dashboard',
    });
  });

  it('falls back to the all-plans config ({ checkout_target: dashboard }) when the slug is empty', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/subscription/config') {
        return { dashboard_plans_widget_slug: '' };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const wrapper = await mountPlans();

    expect(widgetConfig(wrapper)).toEqual({ checkout_target: 'dashboard' });
    // No widget fetch should be attempted for an empty slug.
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith('/subscription/config');
  });

  it('resolves category mode when the widget lookup 404s (slug is a tarif-plan category slug)', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/subscription/config') {
        return { dashboard_plans_widget_slug: 'subscription-plans' };
      }
      if (url === '/cms/widgets/by-slug/subscription-plans') {
        throw Object.assign(new Error('Not Found'), { status: 404 });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const wrapper = await mountPlans();

    expect(widgetConfig(wrapper)).toEqual({
      source_mode: 'category',
      category: 'subscription-plans',
      checkout_target: 'dashboard',
    });
  });

  it('falls back to the all-plans config when the widget fetch rejects with a non-404 error', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/subscription/config') {
        return { dashboard_plans_widget_slug: 'missing' };
      }
      if (url === '/cms/widgets/by-slug/missing') {
        throw Object.assign(new Error('Server error'), { status: 500 });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const wrapper = await mountPlans();

    expect(widgetConfig(wrapper)).toEqual({ checkout_target: 'dashboard' });
    expect(widgetConfig(wrapper).source_mode).toBeUndefined();
  });

  it('falls back to the all-plans config when the config fetch itself rejects', async () => {
    mockedGet.mockRejectedValue(new Error('network down'));

    const wrapper = await mountPlans();

    expect(widgetConfig(wrapper)).toEqual({ checkout_target: 'dashboard' });
  });

  it('shows a loading placeholder until the config resolves', async () => {
    let resolveConfig: (value: unknown) => void = () => {};
    mockedGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfig = resolve;
        }),
    );

    const wrapper = mount(Plans, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { TariffPlanCollection: TariffPlanCollectionStub },
      },
    });
    // Before resolution: placeholder shown, widget absent.
    expect(wrapper.find('[data-testid="plans-loading"]').exists()).toBe(true);
    expect(wrapper.findComponent(TariffPlanCollectionStub).exists()).toBe(false);

    resolveConfig({ dashboard_plans_widget_slug: '' });
    await flushPromises();

    expect(wrapper.find('[data-testid="plans-loading"]').exists()).toBe(false);
    expect(wrapper.findComponent(TariffPlanCollectionStub).exists()).toBe(true);
  });
});
