<template>
  <div class="plan-detail-view">
    <div
      v-if="loading"
      class="loading-state"
      data-testid="plan-detail-loading"
    >
      <div class="spinner" />
      <p>{{ $t('planDetail.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="error-state"
      data-testid="plan-detail-error"
    >
      <p>{{ error }}</p>
      <button
        class="btn secondary"
        @click="$router.back()"
      >
        {{ $t('common.back') }}
      </button>
    </div>

    <template v-else-if="plan">
      <a
        href="#"
        class="back-link"
        data-testid="back-link"
        @click.prevent="$router.back()"
      >
        &larr; {{ $t('planDetail.backLink') }}
      </a>

      <h1>{{ $t('planDetail.title') }}</h1>

      <div
        class="detail-card"
        data-testid="plan-detail-content"
      >
        <div class="detail-header">
          <h2 data-testid="plan-name">
            {{ plan.name }}
          </h2>
          <span
            class="status-badge"
            :class="plan.is_active ? 'active' : 'archived'"
          >
            {{ plan.is_active ? $t('planDetail.active') : $t('planDetail.archived') }}
          </span>
        </div>

        <p
          v-if="plan.description"
          class="plan-description"
        >
          {{ plan.description }}
        </p>

        <div class="detail-grid">
          <div class="detail-item">
            <span class="label">{{ $t('planDetail.price') }}</span>
            <span class="value">{{ formatPrice(plan.display_price || plan.price) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">{{ $t('planDetail.billingPeriod') }}</span>
            <span class="value">{{ plan.billing_period || '-' }}</span>
          </div>
        </div>

        <div
          v-if="plan.features && plan.features.length > 0"
          class="features-section"
          data-testid="plan-features"
        >
          <h3>{{ $t('planDetail.features') }}</h3>
          <ul class="features-list">
            <li
              v-for="feature in plan.features"
              :key="feature"
            >
              {{ feature }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';

interface PlanDetail {
  id: string;
  name: string;
  slug: string;
  price?: number;
  display_price?: number;
  display_currency?: string;
  billing_period?: string;
  description?: string;
  features?: string[];
  is_active?: boolean;
}

const route = useRoute();
const { t } = useI18n();

const loading = ref(true);
const error = ref<string | null>(null);
const plan = ref<PlanDetail | null>(null);

onMounted(async () => {
  loading.value = true;
  error.value = null;

  try {
    const planId = route.params.planId as string;
    const response = await api.get(`/tarif-plans/${planId}`) as { plan: PlanDetail } | PlanDetail;
    plan.value = (response as { plan: PlanDetail }).plan || response as PlanDetail;
  } catch (err) {
    error.value = (err as Error).message || t('planDetail.error');
  } finally {
    loading.value = false;
  }
});

function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return '-';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}
</script>

<style scoped>
.plan-detail-view {
  max-width: 800px;
}

.back-link {
  display: inline-block;
  margin-bottom: 20px;
  color: #3498db;
  text-decoration: none;
  font-size: 0.9rem;
}

.back-link:hover {
  text-decoration: underline;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

h1 {
  margin-bottom: 20px;
  color: #2c3e50;
}

.detail-card {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;
}

.detail-header h2 {
  margin: 0;
  color: #2c3e50;
}

.plan-description {
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item .label {
  font-size: 0.85rem;
  color: #666;
}

.detail-item .value {
  font-weight: 500;
  color: #2c3e50;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.archived {
  background: #e2e3e5;
  color: #383d41;
}

.features-section {
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.features-section h3 {
  font-size: 1rem;
  color: #2c3e50;
  margin-bottom: 12px;
}

.features-list {
  list-style: none;
  padding: 0;
}

.features-list li {
  padding: 8px 0;
  color: #666;
  border-bottom: 1px solid #eee;
}

.features-list li:last-child {
  border-bottom: none;
}

.features-list li::before {
  content: "\2713";
  color: #27ae60;
  margin-right: 8px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
}

.btn.secondary {
  background-color: #ecf0f1;
  color: #2c3e50;
}
</style>
