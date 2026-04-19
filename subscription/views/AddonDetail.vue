<template>
  <div class="addon-detail">
    <router-link
      to="/dashboard"
      class="back-link"
      data-testid="back-to-dashboard"
    >
      &larr; {{ $t('addons.detail.backToDashboard') }}
    </router-link>

    <div
      v-if="loading"
      class="loading-state"
      data-testid="addon-loading"
    >
      <div class="spinner" />
      <p>{{ $t('common.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="error-state"
      data-testid="addon-error"
    >
      <p>{{ error }}</p>
    </div>

    <div
      v-else-if="addonSub"
      class="addon-content"
      data-testid="addon-content"
    >
      <h1>{{ $t('addons.detail.title') }}</h1>

      <div class="detail-card">
        <div class="detail-header">
          <h2 data-testid="addon-name">
            {{ addonSub.addon?.name || 'Add-on' }}
          </h2>
          <span
            class="status-badge"
            :class="addonSub.status.toLowerCase()"
            data-testid="addon-status"
          >
            {{ formatStatus(addonSub.status) }}
          </span>
        </div>

        <p
          v-if="addonSub.addon?.description"
          class="addon-description"
          data-testid="addon-description"
        >
          {{ addonSub.addon.description }}
        </p>

        <div class="detail-grid">
          <div class="detail-item">
            <span class="label">{{ $t('addons.detail.price') }}</span>
            <span class="value">{{ addonSub.addon?.price ? formatPrice(addonSub.addon.price) : '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">{{ $t('addons.detail.billingPeriod') }}</span>
            <span class="value">{{ addonSub.addon?.billing_period || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">{{ $t('addons.detail.status') }}</span>
            <span class="value">{{ formatStatus(addonSub.status) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">{{ $t('addons.detail.startDate') }}</span>
            <span class="value">{{ formatDate(addonSub.starts_at) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">{{ $t('addons.detail.expiryDate') }}</span>
            <span class="value">{{ formatDate(addonSub.expires_at) }}</span>
          </div>
          <div
            v-if="addonSub.cancelled_at"
            class="detail-item"
          >
            <span class="label">{{ $t('addons.detail.cancelledDate') }}</span>
            <span class="value">{{ formatDate(addonSub.cancelled_at) }}</span>
          </div>
        </div>

        <!-- Invoice info -->
        <div
          v-if="addonSub.invoice"
          class="invoice-section"
        >
          <h3>{{ $t('addons.detail.invoice') }}</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">#</span>
              <span class="value">{{ addonSub.invoice.invoice_number }}</span>
            </div>
            <div class="detail-item">
              <span class="label">{{ $t('addons.detail.status') }}</span>
              <span
                class="status-badge small"
                :class="addonSub.invoice.status.toLowerCase()"
              >
                {{ addonSub.invoice.status }}
              </span>
            </div>
            <div class="detail-item">
              <span class="label">{{ $t('addons.detail.price') }}</span>
              <span class="value">{{ formatPrice(addonSub.invoice.amount) }} {{ addonSub.invoice.currency }}</span>
            </div>
          </div>
        </div>

        <!-- Cancel notice -->
        <div
          v-if="addonSub.status === 'CANCELLED'"
          class="cancel-notice"
          data-testid="cancel-notice"
        >
          <p>{{ $t('addons.detail.alreadyCancelled') }}</p>
        </div>

        <!-- Cancel button -->
        <div
          v-if="canCancel"
          class="actions"
        >
          <button
            v-if="!showCancelConfirm"
            class="cancel-btn"
            data-testid="cancel-addon-btn"
            @click="showCancelConfirm = true"
          >
            {{ $t('addons.detail.cancelAddon') }}
          </button>
          <div
            v-else
            class="cancel-confirm"
            data-testid="cancel-confirm"
          >
            <p>{{ $t('addons.detail.cancelConfirm') }}</p>
            <div class="confirm-actions">
              <button
                class="confirm-yes"
                data-testid="confirm-cancel-btn"
                :disabled="cancelling"
                @click="handleCancel"
              >
                {{ cancelling ? $t('common.processing') : $t('common.confirm') }}
              </button>
              <button
                class="confirm-no"
                @click="showCancelConfirm = false"
              >
                {{ $t('common.back') }}
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="cancelSuccess"
          class="success-message"
          data-testid="cancel-success"
        >
          <p>{{ $t('addons.detail.cancelSuccess') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useSubscriptionStore } from '../stores/subscription';

const route = useRoute();
const subscriptionStore = useSubscriptionStore();

const addonSubId = route.params.id as string;

interface AddonSubInvoice {
  invoice_number: string;
  status: string;
  amount: string | number;
  currency: string;
}

interface AddonSubscription {
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  addon?: {
    name: string;
    description?: string | null;
    price?: string | number;
    billing_period?: string;
  };
  invoice?: AddonSubInvoice;
}

const loading = ref(true);
const error = ref<string | null>(null);
const addonSub = ref<AddonSubscription | null>(null);
const showCancelConfirm = ref(false);
const cancelling = ref(false);
const cancelSuccess = ref(false);

const canCancel = computed(() => {
  return addonSub.value &&
    (addonSub.value.status === 'ACTIVE' || addonSub.value.status === 'PENDING') &&
    !cancelSuccess.value;
});

async function fetchDetail(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    addonSub.value = await subscriptionStore.fetchAddonDetail(addonSubId);
  } catch (err) {
    error.value = (err as Error).message || 'Failed to load add-on details';
  } finally {
    loading.value = false;
  }
}

async function handleCancel(): Promise<void> {
  cancelling.value = true;
  try {
    await subscriptionStore.cancelAddon(addonSubId);
    cancelSuccess.value = true;
    showCancelConfirm.value = false;
    // Refetch to get updated status
    await fetchDetail();
  } catch (err) {
    error.value = (err as Error).message || 'Failed to cancel add-on';
  } finally {
    cancelling.value = false;
  }
}

function formatStatus(status: string): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : '-';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatPrice(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

onMounted(() => {
  fetchDetail();
});
</script>

<style scoped>
.addon-detail {
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

.status-badge.small {
  padding: 2px 8px;
  font-size: 0.75rem;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.cancelled {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.expired {
  background: #e2e3e5;
  color: #383d41;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.paid {
  background: #d4edda;
  color: #155724;
}

.invoice-section {
  border-top: 1px solid #eee;
  padding-top: 20px;
  margin-top: 10px;
}

.invoice-section h3 {
  margin-bottom: 15px;
  color: #2c3e50;
  font-size: 1rem;
}

.cancel-notice {
  background: #f8d7da;
  color: #721c24;
  padding: 12px 15px;
  border-radius: 4px;
  margin-top: 20px;
}

.actions {
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.cancel-btn {
  padding: 10px 20px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn:hover {
  background: #c0392b;
}

.cancel-confirm {
  background: #fff3cd;
  padding: 15px;
  border-radius: 4px;
}

.cancel-confirm p {
  margin-bottom: 12px;
  color: #856404;
}

.confirm-actions {
  display: flex;
  gap: 10px;
}

.confirm-yes {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-yes:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.confirm-no {
  padding: 8px 16px;
  background: #e9ecef;
  color: #495057;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.success-message {
  background: #d4edda;
  color: #155724;
  padding: 12px 15px;
  border-radius: 4px;
  margin-top: 15px;
}
</style>
