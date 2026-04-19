<template>
  <div class="tarif-plan-detail">
    <div class="plan-nav-actions">
      <button
        class="btn-back"
        data-testid="back-link"
        @click="router.go(-1)"
      >
        &larr; {{ $t('common.back') }}
      </button>
    </div>

    <div
      v-if="loading"
      class="loading-state"
      data-testid="plan-loading"
    >
      Loading...
    </div>
    <div
      v-else-if="error"
      class="error-state"
      data-testid="plan-error"
    >
      {{ error }}
    </div>

    <template v-else-if="plan">
      <div class="plan-header">
        <h1
          class="page-title"
          data-testid="plan-name"
        >
          {{ plan.name }}
        </h1>
        <span
          class="status-badge"
          :class="plan.is_active ? 'status-badge--active' : 'status-badge--inactive'"
          data-testid="plan-status"
        >
          {{ plan.is_active ? 'Active' : 'Inactive' }}
        </span>
      </div>

      <div class="pf-tabs">
        <div class="pf-tabs__bar">
          <button
            type="button"
            class="pf-tabs__tab"
            :class="{ 'pf-tabs__tab--active': activeTab === 'plan-description' }"
            data-testid="tab-plan-description"
            @click="activeTab = 'plan-description'"
          >
            Plan Description
          </button>
          <button
            v-for="tab in visibleTabs"
            :key="tab.id"
            type="button"
            class="pf-tabs__tab"
            :class="{ 'pf-tabs__tab--active': activeTab === tab.id }"
            :data-testid="`tab-${tab.id}`"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="pf-tabs__panel">
          <template v-if="activeTab === 'plan-description'">
            <!-- Core fields grid -->
            <div
              class="plan-meta-grid"
              data-testid="plan-meta"
            >
              <div class="meta-item">
                <span class="meta-label">Price</span>
                <span
                  class="meta-value"
                  data-testid="plan-price"
                >{{ formatPrice(plan) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Billing Period</span>
                <span
                  class="meta-value"
                  data-testid="plan-billing-period"
                >{{ plan.billing_period || '—' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Trial Days</span>
                <span
                  class="meta-value"
                  data-testid="plan-trial-days"
                >{{ plan.trial_days ?? '—' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Recurring</span>
                <span
                  class="meta-value"
                  data-testid="plan-recurring"
                >{{ plan.is_recurring ? 'Yes' : 'No' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Slug</span>
                <span
                  class="meta-value meta-value--mono"
                  data-testid="plan-slug"
                >{{ plan.slug }}</span>
              </div>
            </div>

            <!-- Description -->
            <div
              v-if="plan.description"
              class="plan-section"
            >
              <h3 class="section-label">
                Description
              </h3>
              <p
                class="plan-description"
                data-testid="plan-description"
              >
                {{ plan.description }}
              </p>
            </div>

            <!-- Features table -->
            <div
              class="plan-section"
            >
              <h3 class="section-label">
                Features
              </h3>
              <table
                v-if="planFeatures.length"
                class="plan-features-table"
                data-testid="plan-features"
              >
                <tbody>
                  <tr
                    v-for="f in planFeatures"
                    :key="f"
                  >
                    <td class="feature-check">
                      ✓
                    </td>
                    <td>{{ f }}</td>
                  </tr>
                </tbody>
              </table>
              <p
                v-else
                class="plan-description"
                data-testid="plan-features-empty"
              >
                —
              </p>
            </div>

            <!-- Categories -->
            <div
              v-if="plan.categories && plan.categories.length"
              class="plan-section"
            >
              <h3 class="section-label">
                Categories
              </h3>
              <div
                class="category-tags"
                data-testid="plan-categories"
              >
                <span
                  v-for="cat in plan.categories"
                  :key="cat.id || cat.slug"
                  class="category-tag"
                >
                  {{ cat.name }}
                </span>
              </div>
            </div>
          </template>

          <component
            :is="activeTabDef && activeTabDef.component"
            v-else-if="activeTabDef"
            :plan-slug="planSlug"
            :plan-id="plan?.id"
          />
        </div>
      </div>

      <!-- Plan actions -->
      <div
        v-if="plan.is_active"
        class="plan-actions"
        data-testid="plan-actions"
      >
        <router-link
          :to="`/dashboard/checkout/${plan.slug}`"
          class="btn-select-plan"
          data-testid="select-plan-btn"
        >
          {{ $t('plans.selectPlan') || 'Select Plan' }}
        </router-link>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { planDetailTabRegistry, type PlanDetailTab } from '@/utils/planDetailTabRegistry';

const router = useRouter();

interface PlanCategory {
  id?: string;
  slug?: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price?: { price_decimal: string; currency_code: string } | number | string;
  display_price?: number | string;
  display_currency?: string;
  billing_period?: string;
  trial_days?: number;
  description?: string;
  features?: string[];
  categories?: PlanCategory[];
  is_active?: boolean;
  is_recurring?: boolean;
}

const route = useRoute();

const loading = ref(true);
const error = ref<string | null>(null);
const plan = ref<Plan | null>(null);
const activeTab = ref('plan-description');
const visibleTabs = ref<PlanDetailTab[]>([]);

const planSlug = computed(() => route.params.planSlug as string);

const activeTabDef = computed(() =>
  visibleTabs.value.find(t => t.id === activeTab.value) ?? null
);

// Normalize features: handle null, string (JSON), or array
const planFeatures = computed((): string[] => {
  const f = plan.value?.features;
  if (!f) return [];
  if (Array.isArray(f)) return f as string[];
  if (typeof f === 'string') {
    try { return JSON.parse(f) as string[]; } catch { return [f]; }
  }
  return [];
});

onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.get(`/tarif-plans/${planSlug.value}`) as { plan: Plan } | Plan;
    plan.value = (response as { plan: Plan }).plan ?? (response as Plan);

    // Evaluate each registered tab's condition against the loaded plan id.
    // Tabs without a condition are always shown.
    const planId = plan.value.id;
    const results = await Promise.all(
      planDetailTabRegistry.tabs.value.map(async (tab) => {
        if (!tab.condition) return { tab, show: true };
        try {
          const show = await tab.condition(planId);
          return { tab, show };
        } catch {
          return { tab, show: false };
        }
      })
    );
    visibleTabs.value = results.filter(r => r.show).map(r => r.tab);
  } catch (err) {
    error.value = (err as Error).message || 'Failed to load plan';
  } finally {
    loading.value = false;
  }
});

function formatPrice(p: Plan): string {
  const displayPrice = p.display_price;
  const currency = p.display_currency || 'USD';
  if (displayPrice !== null && displayPrice !== undefined) {
    const num = typeof displayPrice === 'string' ? parseFloat(displayPrice) : (displayPrice as number);
    if (!isNaN(num)) return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
  }
  // fallback to price object
  const priceObj = p.price as { price_decimal?: string; currency_code?: string } | undefined;
  if (priceObj?.price_decimal) {
    const num = parseFloat(priceObj.price_decimal);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: priceObj.currency_code || 'USD' }).format(num);
  }
  return '—';
}
</script>

<style scoped>
.tarif-plan-detail {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}
.plan-nav-actions {
  margin-bottom: 20px;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--vbwd-color-primary, #3498db);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 6px 0;
  text-decoration: none;
}
.btn-back:hover { text-decoration: underline; }

.plan-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-select-plan {
  display: inline-block;
  padding: 12px 32px;
  background: var(--vbwd-color-primary, #3498db);
  color: #fff;
  border: none;
  border-radius: var(--vbwd-radius-md, 4px);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  transition: background var(--vbwd-transition-normal, 0.2s);
}
.btn-select-plan:hover {
  background: var(--vbwd-color-primary-dark, #2980b9);
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.page-title {
  font-size: 1.6rem;
  color: var(--vbwd-text-heading, #2c3e50);
  margin: 0;
}
.status-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}
.status-badge--active { background: var(--vbwd-color-success, #27ae60); color: #fff; }
.status-badge--inactive { background: var(--vbwd-color-danger, #e74c3c); color: #fff; }

.loading-state,
.error-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--vbwd-text-muted, #666);
}
.error-state { color: var(--vbwd-color-danger, #e74c3c); }

/* pf-tabs pattern */
.pf-tabs {
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 8px;
  overflow: hidden;
}
.pf-tabs__bar {
  display: flex;
  background: var(--vbwd-card-bg, #f8f9fa);
  border-bottom: 1px solid var(--vbwd-border-color, #ddd);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.pf-tabs__bar::-webkit-scrollbar {
  display: none;
}
.pf-tabs__tab {
  padding: 12px 20px;
  background: none;
  border: none;
  border-right: 1px solid var(--vbwd-border-light, #eee);
  cursor: pointer;
  font-size: 14px;
  color: var(--vbwd-text-body, #555);
  white-space: nowrap;
  flex-shrink: 0;
}
.pf-tabs__tab:hover { background: var(--vbwd-border-light, #f0f0f0); }
.pf-tabs__tab--active {
  background: var(--vbwd-card-bg, #fff);
  color: var(--vbwd-text-heading, #2c3e50);
  font-weight: 600;
  border-bottom: 2px solid var(--vbwd-color-primary, #3498db);
  margin-bottom: -1px;
}
.pf-tabs__panel {
  padding: 24px;
  background: var(--vbwd-card-bg, #fff);
  min-height: 200px;
}

/* Plan description tab */
.plan-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.meta-item { display: flex; flex-direction: column; gap: 4px; }
.meta-label {
  font-size: 0.75rem;
  color: var(--vbwd-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.meta-value {
  font-weight: 500;
  color: var(--vbwd-text-heading, #2c3e50);
  font-size: 0.95rem;
}
.meta-value--mono {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--vbwd-text-muted, #666);
}

.plan-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--vbwd-border-light, #eee);
}
.section-label {
  font-size: 0.82rem;
  color: var(--vbwd-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  margin: 0 0 10px;
}

.plan-description {
  color: var(--vbwd-text-body, #333);
  line-height: 1.6;
  margin: 0;
}

.plan-features-table {
  border-collapse: collapse;
  width: 100%;
}
.plan-features-table td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--vbwd-border-light, #eee);
  color: var(--vbwd-text-body, #333);
  font-size: 0.9rem;
}
.feature-check {
  color: var(--vbwd-color-success, #27ae60);
  font-weight: 700;
  width: 28px;
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.category-tag {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 500;
  background: color-mix(in srgb, var(--vbwd-color-primary, #3498db) 12%, transparent);
  color: var(--vbwd-color-primary, #3498db);
  border: 1px solid color-mix(in srgb, var(--vbwd-color-primary, #3498db) 30%, transparent);
}

@media (max-width: 768px) {
  .tarif-plan-detail {
    max-width: 100%;
    padding: 12px;
  }

  .plan-header {
    flex-wrap: wrap;
  }

  .page-title {
    font-size: 1.3rem;
  }

  .pf-tabs__panel {
    padding: 16px;
  }

  .plan-meta-grid {
    grid-template-columns: 1fr 1fr;
  }

  .btn-select-plan {
    width: 100%;
  }
}
</style>
