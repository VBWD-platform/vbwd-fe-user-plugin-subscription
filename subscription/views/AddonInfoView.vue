<template>
  <div class="addon-info-view">
    <div
      v-if="loading"
      class="loading-state"
      data-testid="addon-info-loading"
    >
      <div class="spinner" />
      <p>{{ $t('addonInfo.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="error-state"
      data-testid="addon-info-error"
    >
      <p>{{ error }}</p>
      <button
        class="btn secondary"
        @click="$router.back()"
      >
        {{ $t('common.back') }}
      </button>
    </div>

    <template v-else-if="addon">
      <a
        href="#"
        class="back-link"
        data-testid="back-link"
        @click.prevent="$router.back()"
      >
        &larr; {{ $t('addonInfo.backLink') }}
      </a>

      <h1>{{ $t('addonInfo.title') }}</h1>

      <div
        class="detail-card"
        data-testid="addon-info-content"
      >
        <div class="detail-header">
          <h2 data-testid="addon-info-name">
            {{ addon.name }}
          </h2>
        </div>

        <p
          v-if="addon.description"
          class="addon-description"
        >
          {{ addon.description }}
        </p>

        <div class="detail-grid">
          <div class="detail-item">
            <span class="label">{{ $t('addonInfo.price') }}</span>
            <span class="value">{{ formatPrice(addon.price) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">{{ $t('addonInfo.billingPeriod') }}</span>
            <span class="value">{{ addon.billing_period || '-' }}</span>
          </div>
          <div
            v-if="addon.currency"
            class="detail-item"
          >
            <span class="label">{{ $t('addonInfo.currency') }}</span>
            <span class="value">{{ addon.currency }}</span>
          </div>
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

interface AddonDetail {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  price: string | number;
  currency?: string;
  billing_period?: string;
  is_active?: boolean;
}

const route = useRoute();
const { t } = useI18n();

const loading = ref(true);
const error = ref<string | null>(null);
const addon = ref<AddonDetail | null>(null);

onMounted(async () => {
  loading.value = true;
  error.value = null;

  try {
    const addonId = route.params.addonId as string;
    const response = await api.get(`/addons/${addonId}`) as { addon: AddonDetail } | AddonDetail;
    addon.value = (response as { addon: AddonDetail }).addon || response as AddonDetail;
  } catch (err) {
    error.value = (err as Error).message || t('addonInfo.error');
  } finally {
    loading.value = false;
  }
});

function formatPrice(price: string | number | null | undefined): string {
  if (price === null || price === undefined) return '-';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}
</script>

<style scoped>
.addon-info-view {
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

.addon-description {
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
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
