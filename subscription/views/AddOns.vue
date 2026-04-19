<template>
  <div class="addons-page">
    <!-- Breadcrumb -->
    <nav class="breadcrumb">
      <router-link
        to="/dashboard/plans"
        data-testid="breadcrumb-plans"
      >
        {{ $t('addons.breadcrumbPlans') }}
      </router-link>
      <span class="separator">/</span>
      <span>{{ $t('addons.breadcrumbAddons') }}</span>
    </nav>

    <div class="page-header">
      <h1>{{ $t('addons.title') }}</h1>
      <p class="subtitle">
        {{ $t('addons.subtitle') }}
      </p>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-state"
      data-testid="addons-loading"
    >
      <div class="spinner" />
      <p>{{ $t('addons.loading') }}</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="error-state"
      data-testid="addons-error"
    >
      <p>{{ error }}</p>
      <button
        class="retry-btn"
        @click="loadAddons"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- Add-ons Content -->
    <div
      v-else
      class="addons-content"
    >
      <!-- Subscription-Dependent Add-ons -->
      <section
        class="addons-section"
        data-testid="subscription-addons-section"
      >
        <h2>{{ $t('addons.subscriptionAddons.title') }}</h2>
        <p class="section-description">
          {{ $t('addons.subscriptionAddons.description') }}
        </p>

        <div
          v-if="subscriptionAddons.length === 0"
          class="no-addons"
        >
          <p>{{ $t('addons.subscriptionAddons.noAddons') }}</p>
        </div>

        <div
          v-else
          class="addons-grid"
        >
          <div
            v-for="addon in subscriptionAddons"
            :key="addon.id"
            class="addon-card"
            :data-testid="`addon-card-${addon.id}`"
          >
            <h3
              class="addon-name"
              data-testid="addon-name"
            >
              {{ addon.name }}
            </h3>
            <div
              class="addon-price"
              data-testid="addon-price"
            >
              {{ formatPrice(addon.price) }}
              <span class="billing-period">/{{ formatBillingPeriod(addon.billing_period) }}</span>
            </div>
            <p
              class="addon-description"
              data-testid="addon-description"
            >
              {{ addon.description }}
            </p>
            <button
              class="add-to-cart-btn"
              :data-testid="`add-to-cart-addon-${addon.id}`"
              :disabled="!hasActiveSubscription"
              @click="addToCart(addon)"
            >
              {{ hasActiveSubscription ? $t('addons.addToCart') : $t('addons.requiresSubscription') }}
            </button>
          </div>
        </div>
      </section>

      <!-- Subscription-Independent Add-ons -->
      <section
        class="addons-section"
        data-testid="global-addons-section"
      >
        <h2>{{ $t('addons.globalAddons.title') }}</h2>
        <p class="section-description">
          {{ $t('addons.globalAddons.description') }}
        </p>

        <div
          v-if="globalAddons.length === 0"
          class="no-addons"
        >
          <p>{{ $t('addons.globalAddons.noAddons') }}</p>
        </div>

        <div
          v-else
          class="addons-grid"
        >
          <div
            v-for="addon in globalAddons"
            :key="addon.id"
            class="addon-card"
            :data-testid="`addon-card-${addon.id}`"
          >
            <h3
              class="addon-name"
              data-testid="addon-name"
            >
              {{ addon.name }}
            </h3>
            <div
              class="addon-price"
              data-testid="addon-price"
            >
              {{ formatPrice(addon.price) }}
              <span
                v-if="addon.billing_period"
                class="billing-period"
              >
                /{{ formatBillingPeriod(addon.billing_period) }}
              </span>
            </div>
            <p
              class="addon-description"
              data-testid="addon-description"
            >
              {{ addon.description }}
            </p>
            <button
              class="add-to-cart-btn"
              :data-testid="`add-to-cart-addon-${addon.id}`"
              @click="addToCart(addon)"
            >
              {{ $t('addons.addToCart') }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Back to Plans -->
    <div class="page-footer">
      <router-link
        to="/dashboard/plans"
        class="back-link"
        data-testid="back-to-plans"
      >
        &larr; {{ $t('addons.backToPlans') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import { useSubscriptionStore } from '../stores/subscription';
import { useCartStore } from 'vbwd-view-component';

interface AddOn {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number | string;
  currency: string;
  billing_period: string;
  is_active: boolean;
  tarif_plan_ids?: string[];
  tarif_plans?: { id: string; name: string }[];
  conditions?: {
    subscription_parent?: string | null;
  };
}

const { t } = useI18n();
const cartStore = useCartStore();

const allAddons = ref<AddOn[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const subscriptionStore = useSubscriptionStore();

const hasActiveSubscription = computed(() => {
  return subscriptionStore.subscription?.status === 'ACTIVE';
});

// Plan-specific add-ons (bound to one or more tariff plans)
const subscriptionAddons = computed(() => {
  return allAddons.value.filter(addon =>
    addon.tarif_plan_ids && addon.tarif_plan_ids.length > 0
  );
});

// Independent add-ons (available to all users, no plan restriction)
const globalAddons = computed(() => {
  return allAddons.value.filter(addon =>
    !addon.tarif_plan_ids || addon.tarif_plan_ids.length === 0
  );
});

async function loadAddons() {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.get('/addons') as { addons: AddOn[] };
    allAddons.value = (response.addons || []).filter(a => a.is_active);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string };
    error.value = err.response?.data?.error || err.message || t('addons.errors.failedToLoad');
  } finally {
    loading.value = false;
  }
}

function addToCart(addon: AddOn) {
  const numPrice = typeof addon.price === 'string' ? parseFloat(addon.price) : addon.price;
  cartStore.addItem({
    type: 'ADD_ON',
    id: addon.id,
    name: addon.name,
    price: numPrice,
    metadata: {
      billing_period: addon.billing_period,
      slug: addon.slug,
    },
  });
}

function formatPrice(price: number | string): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numPrice);
}

function formatBillingPeriod(period?: string): string {
  if (!period) return t('common.billingPeriods.oneTime');
  const periodMap: Record<string, string> = {
    monthly: t('common.billingPeriods.month'),
    yearly: t('common.billingPeriods.year'),
    annual: t('common.billingPeriods.year'),
    weekly: t('common.billingPeriods.week'),
  };
  return periodMap[period.toLowerCase()] || period;
}

onMounted(async () => {
  // Load subscription status to check if user can purchase subscription-dependent add-ons
  try {
    await subscriptionStore.fetchSubscription();
  } catch {
    // No active subscription
  }
  await loadAddons();
});
</script>

<style scoped>
.addons-page {
  max-width: 1200px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.breadcrumb a {
  color: #3498db;
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.breadcrumb .separator {
  color: #999;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.subtitle {
  color: #666;
  font-size: 1rem;
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

.retry-btn {
  margin-top: 15px;
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.addons-content {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.addons-section {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.addons-section h2 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.section-description {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.no-addons {
  text-align: center;
  padding: 2rem;
  color: #999;
}

.addons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.addon-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.addon-card:hover {
  border-color: #3498db;
  transform: translateY(-2px);
}

.addon-name {
  font-size: 1.125rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.addon-price {
  font-size: 1.5rem;
  font-weight: 700;
  color: #3498db;
  margin-bottom: 0.75rem;
}

.billing-period {
  font-size: 0.875rem;
  font-weight: 400;
  color: #666;
}

.addon-description {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.add-to-cart-btn {
  width: 100%;
  padding: 10px;
  background-color: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-to-cart-btn:hover:not(:disabled) {
  background-color: #219a52;
}

.add-to-cart-btn:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.page-footer {
  padding-top: 2rem;
}

.back-link {
  color: #3498db;
  text-decoration: none;
  font-size: 0.875rem;
}

.back-link:hover {
  text-decoration: underline;
}
</style>
