/**
 * S77 — the public add-on detail card renders tags + custom fields.
 *
 * `GET /api/v1/addons/<id>` now appends `tags`, `custom_fields`, and
 * `custom_field_defs` (the core serializer helper). AddonInfoView reads those
 * keys straight off the payload and mounts the shared fe-core read-only display
 * components — same pattern as the tarif card + product card.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { TagChips, CustomFieldsDisplay } from 'vbwd-view-component';
import AddonInfoView from '../../subscription/views/AddonInfoView.vue';
import { api } from '@/api';

vi.mock('@/api', () => ({ api: { get: vi.fn() } }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { addonId: 'addon-1' } }),
}));

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: { en: {} },
});

const baseAddon = {
  id: 'addon-1',
  name: 'Priority Support',
  price: 9.99,
  billing_period: 'monthly',
  is_active: true,
};

async function mountWith(payload: Record<string, unknown>) {
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ addon: payload });
  const wrapper = mount(AddonInfoView, { global: { plugins: [i18n] } });
  await flushPromises();
  return wrapper;
}

describe('AddonInfoView — S77 tags + custom fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders TagChips + CustomFieldsDisplay from the payload keys', async () => {
    const wrapper = await mountWith({
      ...baseAddon,
      tags: ['popular'],
      custom_fields: { sla: '24h' },
      custom_field_defs: [{ key: 'sla', label: 'SLA', type: 'text' }],
    });

    expect(wrapper.find('[data-testid="addon-tags-custom-fields"]').exists()).toBe(true);
    const tagChips = wrapper.findComponent(TagChips);
    expect(tagChips.exists()).toBe(true);
    expect((tagChips.props() as { tags: string[] }).tags).toEqual(['popular']);
    const cfDisplay = wrapper.findComponent(CustomFieldsDisplay);
    expect(cfDisplay.exists()).toBe(true);
    expect((cfDisplay.props() as { customFields: Record<string, unknown> }).customFields).toEqual({ sla: '24h' });
  });

  it('hides the block when no tags or custom fields are present', async () => {
    const wrapper = await mountWith({ ...baseAddon, tags: [], custom_fields: {} });

    expect(wrapper.find('[data-testid="addon-tags-custom-fields"]').exists()).toBe(false);
  });
});
