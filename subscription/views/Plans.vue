<template>
  <div class="plans">
    <div
      v-if="!resolvedConfig"
      class="plans-loading"
      data-testid="plans-loading"
    >
      <div class="spinner" />
      <p>{{ $t('plans.loading') }}</p>
    </div>

    <TariffPlanCollection
      v-else
      :config="resolvedConfig"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Plans.vue — the /dashboard/plans host.
 *
 * Presentation is owned by the reusable TariffPlanCollection CMS widget; this
 * view only resolves WHICH widget config to render:
 *   1. read ``dashboard_plans_widget_slug`` from the subscription backend config
 *      (``GET /api/v1/subscription/config``),
 *   2. if a slug is set, fetch that widget (``GET /cms/widgets/by-slug/<slug>``)
 *      and render it with its own config merged in,
 *   3. if the widget lookup 404s, treat the slug as a tarif-plan CATEGORY slug
 *      and render category mode directly (an operator can naturally paste a
 *      category slug here; a definitive 404 means it is not a widget slug, so we
 *      resolve the category instead of silently showing all plans),
 *   4. on empty slug, a config-fetch failure, OR a NON-404 widget-fetch failure
 *      (network/5xx), fall back to the widget's default "all plans" mode.
 *
 * In every branch the resolved config carries ``checkout_target: 'dashboard'``
 * so the widget routes "select plan" to the in-dashboard checkout. We only make
 * HTTP calls here (no CmsWidgetRenderer import) to avoid a hard cms-plugin
 * runtime dependency.
 */
import { ref, onMounted } from 'vue';
import { api } from '@/api';
import TariffPlanCollection from '../components/widgets/TariffPlanCollection.vue';

interface SubscriptionPublicConfig {
  dashboard_plans_widget_slug?: string;
}

interface CmsWidgetRecord {
  slug: string;
  config?: Record<string, unknown>;
}

type ResolvedWidgetConfig = Record<string, unknown> & { checkout_target: 'dashboard' };

// Null until resolved so the template can show a loading placeholder.
const resolvedConfig = ref<ResolvedWidgetConfig | null>(null);

// The all-plans fallback: no widget config, dashboard checkout target. Renders
// every plan via the widget's default category mode (preserves prior behaviour).
const FALLBACK_CONFIG: ResolvedWidgetConfig = { checkout_target: 'dashboard' };

const HTTP_NOT_FOUND = 404;

// The api client throws an ApiError whose numeric ``status`` is set. We detect
// it structurally (not via an imported class, which the package may not export).
function isNotFoundError(error: unknown): boolean {
  return (error as { status?: number })?.status === HTTP_NOT_FOUND;
}

async function resolveWidgetConfig(): Promise<ResolvedWidgetConfig> {
  let slug = '';
  try {
    const config = (await api.get('/subscription/config')) as SubscriptionPublicConfig;
    slug = (config.dashboard_plans_widget_slug ?? '').trim();
  } catch {
    return FALLBACK_CONFIG;
  }

  if (!slug) {
    return FALLBACK_CONFIG;
  }

  try {
    const widget = (await api.get(`/cms/widgets/by-slug/${slug}`)) as CmsWidgetRecord;
    return {
      ...(widget.config ?? {}),
      widget_slug: widget.slug,
      checkout_target: 'dashboard',
    };
  } catch (error) {
    // A definitive 404 means the slug is not a CMS widget — treat it as a
    // tarif-plan category slug and render that category directly. Any other
    // failure (network/5xx) is unsafe to interpret, so fall back to all plans.
    if (isNotFoundError(error)) {
      return { source_mode: 'category', category: slug, checkout_target: 'dashboard' };
    }
    return FALLBACK_CONFIG;
  }
}

onMounted(async () => {
  resolvedConfig.value = await resolveWidgetConfig();
});
</script>

<style scoped>
.plans {
  max-width: 1200px;
}

.plans-loading {
  text-align: center;
  padding: 60px 20px;
  color: var(--vbwd-text-muted, #666);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--vbwd-border-light, #f3f3f3);
  border-top: 3px solid var(--vbwd-color-primary, #3498db);
  border-radius: 50%;
  animation: plans-spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes plans-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
