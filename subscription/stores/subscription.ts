import { defineStore } from 'pinia';
import { api } from '@/api';

export interface PlanCategory {
  id: string;
  slug: string;
  name: string;
  is_single: boolean;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  billing_period: string;
  description?: string;
  categories?: PlanCategory[];
}

export interface Subscription {
  id: string;
  user_id: string;
  tarif_plan_id: string;
  pending_plan_id: string | null;
  status: 'ACTIVE' | 'CANCELLED' | 'PAUSED' | 'EXPIRED' | 'PENDING';
  is_valid: boolean;
  days_remaining: number;
  started_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  paused_at: string | null;
  created_at: string | null;
  plan?: Plan;
  pending_plan?: Plan;
}

export interface Usage {
  apiCalls: { used: number; limit: number };
  storage: { used: number; limit: number; unit: string };
}

export interface AddonSubscription {
  id: string;
  addon_id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  created_at: string | null;
  addon?: {
    name: string;
    slug: string;
    description?: string;
    price?: string;
    billing_period?: string;
  };
}

export interface TokenTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string | null;
}

export const useSubscriptionStore = defineStore('subscription', {
  state: () => ({
    subscription: null as Subscription | null,
    activeSubscriptions: [] as Subscription[],
    usage: null as Usage | null,
    loading: false,
    error: null as string | null,
    history: [] as Subscription[],
    historyLoading: false,
    historyError: null as string | null,
    addonSubscriptions: [] as AddonSubscription[],
    addonsLoading: false,
    addonsError: null as string | null
  }),

  getters: {
    currentPeriodEnd(): string | null {
      return this.subscription?.expires_at || null;
    },
    planName(): string {
      return this.subscription?.plan?.name || 'No Plan';
    },
    planId(): string | null {
      return this.subscription?.plan?.id || this.subscription?.tarif_plan_id || null;
    },
    activeAddons(): AddonSubscription[] {
      return this.addonSubscriptions.filter(a => a.status === 'ACTIVE');
    },
    inactiveAddons(): AddonSubscription[] {
      return this.addonSubscriptions.filter(a => a.status !== 'ACTIVE' && a.status !== 'PENDING');
    }
  },

  actions: {
    async fetchSubscription() {
      this.loading = true;
      this.error = null;

      try {
        const response = await api.get('/user/subscriptions/active') as { subscription: Subscription | null };
        this.subscription = response.subscription;
        return response;
      } catch (error) {
        this.error = (error as Error).message || 'Failed to fetch subscription';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchActiveSubscriptions() {
      this.loading = true;
      this.error = null;

      try {
        const response = await api.get('/user/subscriptions/active-all') as { subscriptions: Subscription[] };
        this.activeSubscriptions = response.subscriptions || [];
        return response;
      } catch (error) {
        this.error = (error as Error).message || 'Failed to fetch active subscriptions';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchUsage() {
      this.loading = true;
      this.error = null;

      try {
        const response = await api.get('/user/usage');
        this.usage = response as Usage;
        return response;
      } catch (error) {
        this.error = (error as Error).message || 'Failed to fetch usage';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async cancelSubscription(subscriptionId?: string) {
      const id = subscriptionId || this.subscription?.id;
      if (!id) {
        throw new Error('No active subscription to cancel');
      }

      this.loading = true;
      this.error = null;

      try {
        const response = await api.post(`/user/subscriptions/${id}/cancel`);
        // Refetch to get updated state
        await Promise.all([
          this.fetchSubscription().catch(() => null),
          this.fetchActiveSubscriptions().catch(() => null),
        ]);
        return response as { subscription: Subscription; message: string };
      } catch (error) {
        this.error = (error as Error).message || 'Failed to cancel subscription';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async changePlan(planId: string) {
      if (!this.subscription?.id) {
        throw new Error('No active subscription to change');
      }

      this.loading = true;
      this.error = null;

      try {
        const response = await api.post(`/user/subscriptions/${this.subscription.id}/upgrade`, { plan_id: planId });
        // Refetch subscription to get updated data
        await this.fetchSubscription();
        return response;
      } catch (error) {
        this.error = (error as Error).message || 'Failed to change plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchHistory() {
      this.historyLoading = true;
      this.historyError = null;

      try {
        const response = await api.get('/user/subscriptions') as { subscriptions: Subscription[] };
        this.history = (response.subscriptions || [])
          .sort((a, b) => {
            const aTime = new Date(b.started_at || b.created_at || 0).getTime();
            const bTime = new Date(a.started_at || a.created_at || 0).getTime();
            return aTime - bTime;
          });
        return response;
      } catch (error) {
        this.historyError = (error as Error).message || 'Failed to fetch history';
        throw error;
      } finally {
        this.historyLoading = false;
      }
    },

    async fetchAddonDetail(addonSubId: string) {
      this.addonsLoading = true;
      this.addonsError = null;

      try {
        const response = await api.get(`/user/addons/${addonSubId}`) as { addon_subscription: AddonSubscription };
        return response.addon_subscription;
      } catch (error) {
        this.addonsError = (error as Error).message || 'Failed to fetch add-on detail';
        throw error;
      } finally {
        this.addonsLoading = false;
      }
    },

    async cancelAddon(addonSubId: string) {
      this.addonsLoading = true;
      this.addonsError = null;

      try {
        const response = await api.post(`/user/addons/${addonSubId}/cancel`);
        // Refetch addons to get updated status
        await this.fetchUserAddons();
        return response;
      } catch (error) {
        this.addonsError = (error as Error).message || 'Failed to cancel add-on';
        throw error;
      } finally {
        this.addonsLoading = false;
      }
    },

    async fetchUserAddons() {
      this.addonsLoading = true;
      this.addonsError = null;

      try {
        const response = await api.get('/user/addons') as { addon_subscriptions: AddonSubscription[] };
        this.addonSubscriptions = response.addon_subscriptions || [];
        return response;
      } catch (error) {
        this.addonsError = (error as Error).message || 'Failed to fetch add-ons';
        throw error;
      } finally {
        this.addonsLoading = false;
      }
    },

    reset() {
      this.subscription = null;
      this.activeSubscriptions = [];
      this.usage = null;
      this.error = null;
      this.loading = false;
      this.history = [];
      this.historyError = null;
      this.historyLoading = false;
      this.addonSubscriptions = [];
      this.addonsError = null;
      this.addonsLoading = false;
    }
  }
});
