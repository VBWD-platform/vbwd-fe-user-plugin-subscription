<template>
  <div class="subscription">
    <h1>{{ $t('subscription.title') }}</h1>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-state"
      data-testid="subscription-loading"
    >
      <div class="spinner" />
      <p>{{ $t('subscription.loading') }}</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="error-state"
      data-testid="subscription-error"
    >
      <p>{{ error }}</p>
      <button
        class="retry-btn"
        @click="loadData"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <div
      v-else
      class="subscription-content"
    >
      <!-- Active Subscriptions Table -->
      <div
        class="card subscription-card"
        data-testid="current-subscription"
      >
        <h2>{{ $t('subscription.activeSubscriptions.title') }}</h2>
        <div
          v-if="activeSubscriptions.length > 0"
          class="active-subs-table-wrap"
        >
          <table class="active-subs-table">
            <thead>
              <tr>
                <th>{{ $t('subscription.activeSubscriptions.plan') }}</th>
                <th>{{ $t('subscription.activeSubscriptions.nextPayment') }}</th>
                <th>{{ $t('subscription.activeSubscriptions.price') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="sub in activeSubscriptions"
                :key="sub.id"
                data-testid="active-sub-row"
                style="cursor: pointer"
                @click="goToPlan(sub)"
              >
                <td>
                  <span
                    class="plan-name-cell"
                    data-testid="plan-name"
                  >{{ sub.plan?.name || $t('subscription.currentPlan.noPlan') }}</span>
                  <span
                    class="plan-status"
                    :class="sub.status.toLowerCase()"
                    data-testid="plan-status"
                  >{{ formatStatus(sub.status) }}</span>
                </td>
                <td>{{ formatDate(sub.expires_at) }}</td>
                <td>
                  <PriceDisplay
                    :effective-display-mode="sub.plan?.effective_display_mode"
                    :global-mode="sub.plan?.prices_display_mode"
                    :net-amount="planNetAmount(sub.plan)"
                    :gross-amount="planGrossAmount(sub.plan)"
                    :currency="sub.plan?.currency || appConfig.defaultCurrency"
                    :account-type="authStore.user?.account_type"
                  /> / {{ sub.plan?.billing_period || 'month' }}
                </td>
                <td
                  class="actions-cell"
                  @click.stop
                >
                  <!-- Cancellable for any non-terminal status. The category
                       "is_single" guard on checkout rejects new subs while
                       ACTIVE *or* TRIALING is in flight, so trialing users
                       must be able to cancel here to switch plans. -->
                  <button
                    v-if="isCancellableStatus(sub.status)"
                    class="btn danger small"
                    data-testid="cancel-subscription"
                    @click="requestCancel(sub)"
                  >
                    {{ $t('subscription.manage.cancelSubscription') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-else
          class="no-subscription"
          data-testid="no-subscription"
        >
          <p>{{ $t('subscription.activeSubscriptions.noSubscriptions') }}</p>
          <router-link
            to="/dashboard/plans"
            class="btn primary"
          >
            {{ $t('common.browsePlans') }}
          </router-link>
        </div>
      </div>

      <!-- Token Balance Card -->
      <div
        class="card token-card"
        data-testid="token-balance-card"
      >
        <h2>{{ $t('subscription.tokenBalance.title') }}</h2>
        <div class="token-info">
          <div class="balance-display">
            <span
              class="balance-amount"
              data-testid="token-balance"
            >{{ formatNumber(tokenBalance) }}</span>
            <span class="balance-label">{{ $t('common.tokenUnit') }}</span>
          </div>
          <p class="balance-desc">
            {{ $t('subscription.tokenBalance.description') }}
          </p>
          <button
            class="btn primary"
            data-testid="purchase-tokens-btn"
            @click="goToPurchaseTokens"
          >
            {{ $t('subscription.tokenBalance.purchaseTokens') }}
          </button>
        </div>
      </div>

      <!-- Add-ons Section -->
      <div
        class="card addons-card"
        data-testid="addons-section"
      >
        <h2>{{ $t('subscription.addons.title') }}</h2>

        <div
          v-if="addonsLoading"
          class="no-subscription"
        >
          {{ $t('common.loading') }}
        </div>

        <template v-else>
          <h3 class="addons-subhead">
            {{ $t('subscription.addons.active') }}
          </h3>
          <div
            v-if="activeAddons.length > 0"
            class="active-subs-table-wrap"
          >
            <table class="active-subs-table">
              <thead>
                <tr>
                  <th>{{ $t('subscription.addons.name') }}</th>
                  <th>{{ $t('subscription.addons.price') }}</th>
                  <th>{{ $t('subscription.addons.renews') }}</th>
                  <th>{{ $t('subscription.addons.status') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="addon in activeAddons"
                  :key="addon.id"
                  data-testid="active-addon-row"
                  style="cursor: pointer"
                  @click="goToAddon(addon)"
                >
                  <td>{{ addon.addon?.name || '—' }}</td>
                  <td>
                    <template v-if="addon.addon?.price">
                      {{ formatPrice(addon.addon.price) }}<span v-if="addon.addon?.billing_period"> / {{ addon.addon.billing_period }}</span>
                    </template>
                    <template v-else>
                      —
                    </template>
                  </td>
                  <td>{{ formatDate(addon.expires_at) }}</td>
                  <td>
                    <span
                      class="plan-status"
                      :class="addon.status.toLowerCase()"
                    >{{ formatStatus(addon.status) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-else
            class="no-subscription"
            data-testid="no-active-addons"
          >
            {{ $t('subscription.addons.noActive') }}
            <router-link
              to="/dashboard/add-ons"
              class="addons-link"
            >
              {{ $t('subscription.addons.browse') }}
            </router-link>
          </p>

          <template v-if="inactiveAddons.length > 0">
            <h3 class="addons-subhead">
              {{ $t('subscription.addons.previous') }}
            </h3>
            <div class="active-subs-table-wrap">
              <table class="active-subs-table">
                <thead>
                  <tr>
                    <th>{{ $t('subscription.addons.name') }}</th>
                    <th>{{ $t('subscription.addons.ended') }}</th>
                    <th>{{ $t('subscription.addons.status') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="addon in inactiveAddons"
                    :key="addon.id"
                    data-testid="previous-addon-row"
                    style="cursor: pointer"
                    @click="goToAddon(addon)"
                  >
                    <td>{{ addon.addon?.name || '—' }}</td>
                    <td>{{ formatDate(addon.cancelled_at || addon.expires_at) }}</td>
                    <td>
                      <span
                        class="plan-status"
                        :class="addon.status.toLowerCase()"
                      >{{ formatStatus(addon.status) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>
      </div>

      <!-- Invoices Section -->
      <div
        class="card invoices-card"
        data-testid="invoices-section"
      >
        <div class="section-header">
          <h2>{{ $t('subscription.invoices.title') }}</h2>
          <div class="search-box">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('subscription.invoices.searchPlaceholder')"
              data-testid="invoice-search"
            >
          </div>
        </div>

        <div
          v-if="filteredInvoices.length > 0"
          class="invoices-table-container"
        >
          <table
            class="invoices-table"
            data-testid="invoices-table"
          >
            <thead>
              <tr>
                <th
                  class="sortable"
                  @click="sortBy('invoice_number')"
                >
                  {{ $t('subscription.invoices.tableHeaders.invoiceNumber') }}
                  <span
                    v-if="sortField === 'invoice_number'"
                    class="sort-icon"
                  >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th
                  class="sortable"
                  @click="sortBy('invoiced_at')"
                >
                  {{ $t('subscription.invoices.tableHeaders.date') }}
                  <span
                    v-if="sortField === 'invoiced_at'"
                    class="sort-icon"
                  >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th
                  class="sortable"
                  @click="sortBy('amount')"
                >
                  {{ $t('subscription.invoices.tableHeaders.amount') }}
                  <span
                    v-if="sortField === 'amount'"
                    class="sort-icon"
                  >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th
                  class="sortable"
                  @click="sortBy('status')"
                >
                  {{ $t('subscription.invoices.tableHeaders.status') }}
                  <span
                    v-if="sortField === 'status'"
                    class="sort-icon"
                  >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th>{{ $t('subscription.invoices.tableHeaders.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="invoice in paginatedInvoices"
                :key="invoice.id"
                data-testid="invoice-row"
              >
                <td class="invoice-number">
                  {{ invoice.invoice_number }}
                </td>
                <td>{{ formatDate(invoice.invoiced_at) }}</td>
                <td class="invoice-amount">
                  {{ formatPrice(invoice.amount, invoice.currency) }}
                </td>
                <td>
                  <span
                    class="status-badge"
                    :class="invoice.status.toLowerCase()"
                  >
                    {{ invoice.status }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button
                    class="action-btn view"
                    data-testid="view-invoice"
                    @click="viewInvoice(invoice)"
                  >
                    {{ $t('common.view') }}
                  </button>
                  <button
                    class="action-btn download"
                    data-testid="download-invoice"
                    @click="downloadInvoice(invoice.id)"
                  >
                    {{ $t('common.pdf') }}
                  </button>
                  <button
                    v-if="invoice.status === 'PENDING'"
                    class="action-btn pay"
                    data-testid="pay-invoice"
                    @click="payInvoice(invoice)"
                  >
                    {{ $t('common.pay') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div
            v-if="totalPages > 1"
            class="pagination"
            data-testid="invoices-pagination"
          >
            <button
              class="page-btn"
              :disabled="currentPage <= 1"
              @click="currentPage--"
            >
              {{ $t('common.previous') }}
            </button>
            <span class="page-info">{{ $t('common.pageInfo', { currentPage, totalPages }) }}</span>
            <button
              class="page-btn"
              :disabled="currentPage >= totalPages"
              @click="currentPage++"
            >
              {{ $t('common.next') }}
            </button>
          </div>
        </div>

        <div
          v-else
          class="no-invoices"
          data-testid="no-invoices"
        >
          <p>{{ searchQuery ? $t('subscription.invoices.noInvoicesSearch') : $t('subscription.invoices.noInvoices') }}</p>
        </div>
      </div>
    </div>

    <!-- Cancel Modal -->
    <div
      v-if="showCancelModal"
      class="modal-overlay"
    >
      <div
        class="modal"
        data-testid="cancel-modal"
      >
        <h3>{{ $t('subscription.cancelModal.title') }}</h3>
        <p>{{ $t('subscription.cancelModal.confirmMessage') }}</p>
        <p class="warning">
          {{ $t('subscription.cancelModal.accessWarning', { date: formatDate(subscriptionToCancel?.expires_at) }) }}
        </p>
        <div class="modal-actions">
          <button
            class="btn"
            @click="showCancelModal = false; subscriptionToCancel = null"
          >
            {{ $t('subscription.cancelModal.keepSubscription') }}
          </button>
          <button
            class="btn danger"
            data-testid="confirm-cancel"
            :disabled="cancelling"
            @click="confirmCancel"
          >
            {{ cancelling ? $t('subscription.cancelModal.cancelling') : $t('subscription.cancelModal.confirmCancellation') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Invoice Detail Modal -->
    <div
      v-if="selectedInvoice"
      class="modal-overlay"
    >
      <div
        class="modal invoice-modal"
        data-testid="invoice-modal"
      >
        <h3>Invoice {{ selectedInvoice.invoice_number }}</h3>
        <div class="invoice-detail">
          <div class="detail-row">
            <span class="label">{{ $t('subscription.invoiceModal.date') }}</span>
            <span class="value">{{ formatDate(selectedInvoice.invoiced_at || selectedInvoice.created_at) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">{{ $t('subscription.invoiceModal.status') }}</span>
            <span class="value">
              <span
                class="status-badge"
                :class="selectedInvoice.status.toLowerCase()"
              >
                {{ selectedInvoice.status }}
              </span>
            </span>
          </div>
          <div class="detail-row">
            <span class="label">{{ $t('subscription.invoiceModal.amount') }}</span>
            <span class="value amount">{{ formatPrice(selectedInvoice.amount, selectedInvoice.currency) }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button
            class="btn"
            @click="selectedInvoice = null"
          >
            {{ $t('common.close') }}
          </button>
          <button
            class="btn primary"
            @click="downloadInvoice(selectedInvoice.id)"
          >
            {{ $t('subscription.invoices.downloadPdf') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Cancellation Notice -->
    <div
      v-if="cancellationNotice"
      class="cancellation-notice"
      data-testid="cancellation-notice"
    >
      {{ t('subscription.messages.subscriptionCancelled') }}
    </div>

    <!-- Success/Error Toast -->
    <div
      v-if="successMessage"
      class="toast success"
    >
      {{ successMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore, formatMoney } from 'vbwd-view-component';
import { useSubscriptionStore, type Plan } from '../stores/subscription';
import { useInvoicesStore, type Invoice } from '@/stores/invoices';
import { useAppConfigStore } from '@/stores/appConfig';
import { api } from '@/api';
import PriceDisplay from '@/components/PriceDisplay.vue';

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();
const invoicesStore = useInvoicesStore();
const appConfig = useAppConfigStore();

// FLAG: the dashboard subscription plan payload carries only the gross ``price``
// (no net/gross split) — net falls back to the same number. The business-viewer
// overlay still flips the side via PriceDisplay's accountType.
function planGrossAmount(plan?: Plan): number {
  return Number(plan?.gross_price ?? plan?.price ?? 0);
}

function planNetAmount(plan?: Plan): number {
  return Number(plan?.net_price ?? plan?.price ?? 0);
}

const loading = ref(true);
const error = ref<string | null>(null);
const showCancelModal = ref(false);
const cancelling = ref(false);
const successMessage = ref('');
const selectedInvoice = ref<Invoice | null>(null);
const tokenBalance = ref(0);
const cancellationNotice = ref(false);
const subscriptionToCancel = ref<{ id: string; expires_at: string | null } | null>(null);

// Invoice search and sorting
const searchQuery = ref('');
const sortField = ref<string>('invoiced_at');
const sortDirection = ref<'asc' | 'desc'>('desc');
const currentPage = ref(1);
const pageSize = 10;

// Computed
const activeSubscriptions = computed(() => subscriptionStore.activeSubscriptions);
const activeAddons = computed(() => subscriptionStore.activeAddons);
const inactiveAddons = computed(() => subscriptionStore.inactiveAddons);
const addonsLoading = computed(() => subscriptionStore.addonsLoading);

const filteredInvoices = computed(() => {
  let result = [...invoicesStore.invoices];

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(inv =>
      inv.invoice_number.toLowerCase().includes(query) ||
      inv.status.toLowerCase().includes(query)
    );
  }

  // Sort
  result.sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (sortField.value) {
      case 'invoice_number':
        aVal = a.invoice_number;
        bVal = b.invoice_number;
        break;
      case 'invoiced_at':
        aVal = a.invoiced_at || '';
        bVal = b.invoiced_at || '';
        break;
      case 'amount':
        aVal = parseFloat(a.amount) || 0;
        bVal = parseFloat(b.amount) || 0;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
    }

    if (sortDirection.value === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  return result;
});

const totalPages = computed(() => Math.ceil(filteredInvoices.value.length / pageSize));

const paginatedInvoices = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredInvoices.value.slice(start, start + pageSize);
});

// Methods
async function loadData(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    await Promise.all([
      subscriptionStore.fetchSubscription().catch(() => null),
      subscriptionStore.fetchActiveSubscriptions().catch(() => null),
      subscriptionStore.fetchAddons().catch(() => null),
      invoicesStore.fetchInvoices().catch(() => null),
      fetchTokenBalance(),
    ]);
  } catch (err) {
    error.value = (err as Error).message || t('subscription.errors.failedToLoad');
  } finally {
    loading.value = false;
  }
}

async function fetchTokenBalance(): Promise<void> {
  try {
    const response = await api.get('/user/tokens/balance') as { balance: number };
    tokenBalance.value = response.balance || 0;
  } catch {
    // Token balance is optional, don't fail the page load
    tokenBalance.value = 0;
  }
}

function sortBy(field: string): void {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = 'desc';
  }
  currentPage.value = 1;
}

function requestCancel(sub: { id: string; expires_at: string | null }): void {
  subscriptionToCancel.value = sub;
  showCancelModal.value = true;
}

async function confirmCancel(): Promise<void> {
  cancelling.value = true;

  try {
    await subscriptionStore.cancelSubscription(subscriptionToCancel.value?.id);
    showCancelModal.value = false;
    subscriptionToCancel.value = null;
    cancellationNotice.value = true;
    showSuccess(t('subscription.messages.subscriptionCancelled'));
  } catch (err) {
    error.value = (err as Error).message || t('subscription.errors.failedToCancel');
  } finally {
    cancelling.value = false;
  }
}

function viewInvoice(invoice: Invoice): void {
  router.push(`/dashboard/invoice/${invoice.id}`);
}

async function downloadInvoice(invoiceId: string): Promise<void> {
  try {
    const invoice = invoicesStore.getInvoiceById(invoiceId);
    await invoicesStore.downloadInvoice(invoiceId, invoice?.invoice_number);
    showSuccess(t('subscription.messages.invoiceDownloadInitiated'));
  } catch (err) {
    error.value = (err as Error).message || t('subscription.errors.failedToDownload');
  }
}

function payInvoice(invoice: Invoice): void {
  // Navigate to invoice payment page
  router.push(`/dashboard/subscription/invoices/${invoice.id}/pay`);
}

function goToPurchaseTokens(): void {
  // Navigate to tokens page where users can purchase token bundles
  router.push('/dashboard/tokens');
}

function showSuccess(message: string): void {
  successMessage.value = message;
  setTimeout(() => {
    successMessage.value = '';
  }, 3000);
}

function goToPlan(sub: { plan?: { slug?: string } }): void {
  if (sub.plan?.slug) {
    router.push(`/dashboard/plan/${sub.plan.slug}`)
  }
}

function goToAddon(addon: { id: string }): void {
  router.push(`/dashboard/add-ons/${addon.id}`);
}

function formatStatus(status: string): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : '-';
}

// Any non-terminal status is cancellable; the model's ``cancel()`` is
// idempotent at the backend so we don't need a finer-grained predicate.
// Without TRIALING here, a user on a free-trial plan could neither cancel
// nor switch (the category ``is_single`` guard rejects new sub creation).
const CANCELLABLE_STATUSES = new Set(['ACTIVE', 'TRIALING', 'PAUSED', 'PENDING']);
function isCancellableStatus(status: string | undefined | null): boolean {
  return !!status && CANCELLABLE_STATUSES.has(status.toUpperCase());
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

function formatPrice(amount: string | number | null | undefined, currency?: string): string {
  if (amount === null || amount === undefined) return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  // Resolve: the value's own currency, else the operating currency (S99).
  return formatMoney(num, { currency });
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.subscription {
  max-width: 1000px;
}

h1 {
  margin-bottom: 30px;
  color: #2c3e50;
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

.subscription-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.card h2 {
  margin-bottom: 20px;
  color: #2c3e50;
  font-size: 1.2rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

/* Subscription Card */
.plan-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.plan-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.plan-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  text-transform: capitalize;
}

.plan-status.active {
  background: #d4edda;
  color: #155724;
}

.plan-status.cancelled,
.plan-status.cancelling {
  background: #f8d7da;
  color: #721c24;
}

.plan-description {
  color: #666;
  margin-bottom: 20px;
}

.plan-details,
.invoice-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-row .label {
  color: #666;
}

.detail-row .value {
  font-weight: 500;
  color: #2c3e50;
}

.no-subscription {
  text-align: center;
  padding: 30px;
  color: #666;
}

/* Token Card */
.token-info {
  text-align: center;
}

.balance-display {
  margin-bottom: 15px;
}

.balance-amount {
  font-size: 2.5rem;
  font-weight: 700;
  color: #27ae60;
}

.balance-label {
  font-size: 1.2rem;
  color: #666;
  margin-left: 5px;
}

.balance-desc {
  color: #666;
  margin-bottom: 20px;
}

/* Active Subscriptions Table */
.active-subs-table-wrap {
  overflow-x: auto;
}

.active-subs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.active-subs-table th,
.active-subs-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.active-subs-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.active-subs-table tbody tr:hover {
  background: #f8f9fa;
}

.plan-name-cell {
  font-weight: 600;
  color: #2c3e50;
  margin-right: 8px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  text-align: center;
  transition: all 0.2s;
}

.btn.primary {
  background-color: #3498db;
  color: white;
}

.btn.primary:hover {
  background-color: #2980b9;
}

.btn.secondary {
  background-color: #6c757d;
  color: white;
}

.btn.secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn.danger {
  background-color: #e74c3c;
  color: white;
}

.btn.danger:hover:not(:disabled) {
  background-color: #c0392b;
}

.btn:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.btn.small {
  padding: 6px 12px;
  font-size: 0.85rem;
}

/* Invoices Section */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.section-header h2 {
  margin: 0;
  border: none;
  padding: 0;
}

.search-box input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  width: 200px;
}

.invoices-table-container {
  overflow-x: auto;
}

.invoices-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.invoices-table th,
.invoices-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.invoices-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.invoices-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.invoices-table th.sortable:hover {
  background: #e9ecef;
}

.sort-icon {
  margin-left: 5px;
}

.invoices-table tbody tr:hover {
  background: #f8f9fa;
}

.invoice-number {
  font-weight: 500;
  color: #3498db;
}

.invoice-amount {
  font-weight: 500;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  text-transform: capitalize;
}

.status-badge.paid {
  background: #d4edda;
  color: #155724;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.overdue {
  background: #f8d7da;
  color: #721c24;
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.action-btn.view {
  background: #e3f2fd;
  color: #1976d2;
}

.action-btn.download {
  background: #e8f5e9;
  color: #388e3c;
}

.action-btn.pay {
  background: #fff3e0;
  color: #f57c00;
}

.action-btn:hover {
  opacity: 0.8;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.page-btn {
  padding: 8px 16px;
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: #e9ecef;
}

.page-btn:disabled {
  color: #aaa;
  cursor: not-allowed;
}

.no-invoices {
  text-align: center;
  padding: 30px;
  color: #666;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 450px;
  width: 90%;
}

.modal h3 {
  margin-bottom: 15px;
  color: #2c3e50;
}

.modal p {
  color: #666;
  margin-bottom: 10px;
}

.modal .warning {
  color: #856404;
  background: #fff3cd;
  padding: 10px;
  border-radius: 4px;
  font-size: 0.9rem;
}

.invoice-modal .invoice-detail {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.invoice-modal .amount {
  font-size: 1.2rem;
  color: #27ae60;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

/* Cancellation Notice */
.cancellation-notice {
  background: #fff3cd;
  color: #856404;
  padding: 15px 25px;
  border-radius: 4px;
  margin-top: 20px;
  text-align: center;
  font-weight: 500;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 25px;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1001;
}

.toast.success {
  background-color: #27ae60;
  color: white;
}

@media (max-width: 768px) {
  .subscription {
    max-width: 100%;
  }

  .card {
    padding: 16px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .search-box input {
    width: 100%;
  }

  .no-subscription {
    padding: 20px 10px;
  }

  .no-subscription p {
    word-break: break-word;
  }

  .no-subscription .btn {
    width: 100%;
    margin-top: 10px;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-actions .btn {
    width: 100%;
  }

  .plan-header {
    flex-wrap: wrap;
  }

  .detail-row {
    flex-wrap: wrap;
    gap: 4px;
  }

  .detail-row .value {
    word-break: break-all;
  }

  .pagination {
    flex-wrap: wrap;
    gap: 8px;
  }
}

.addons-subhead {
  margin: 18px 0 10px;
  font-size: 0.95rem;
  color: #555;
}

.addons-subhead:first-of-type {
  margin-top: 4px;
}

.addons-link {
  margin-left: 6px;
  color: #2563eb;
  font-weight: 600;
}
</style>
