import { defineStore } from 'pinia';
import { api } from '@/api';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  display_currency: string;
  display_price: number;
  billing_period?: string;
  is_active?: boolean;
  net_price?: number;
  tax_amount?: number;
  gross_price?: number;
  tax_rate?: number;
  // UI helpers
  features?: string[];
  popular?: boolean;
}

export interface PlansResponse {
  plans: Plan[];
  currency: string;
  country: string | null;
}

export const usePlansStore = defineStore('plans', {
  state: () => ({
    plans: [] as Plan[],
    selectedPlan: null as Plan | null,
    currency: 'EUR',
    loading: false,
    error: null as string | null
  }),

  actions: {
    async fetchPlans(currency?: string, country?: string) {
      this.loading = true;
      this.error = null;

      try {
        const params = new URLSearchParams();
        if (currency) params.append('currency', currency);
        if (country) params.append('country', country);

        const url = params.toString() ? `/tarif-plans?${params}` : '/tarif-plans';
        const response = await api.get(url) as PlansResponse;

        this.plans = response.plans || [];
        this.currency = response.currency || 'EUR';
        return response;
      } catch (error) {
        this.error = (error as Error).message || 'Failed to fetch plans';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    selectPlan(planId: string) {
      this.selectedPlan = this.plans.find(p => p.id === planId) || null;
    },

    getPlanById(planId: string): Plan | undefined {
      return this.plans.find(p => p.id === planId);
    },

    getPlanBySlug(slug: string): Plan | undefined {
      return this.plans.find(p => p.slug === slug);
    },

    async subscribe(planId: string) {
      this.loading = true;
      this.error = null;

      try {
        const response = await api.post('/subscriptions', { plan_id: planId });
        return response as { subscription_id: string; checkout_url?: string };
      } catch (error) {
        this.error = (error as Error).message || 'Failed to subscribe';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    reset() {
      this.plans = [];
      this.selectedPlan = null;
      this.error = null;
      this.loading = false;
    }
  }
});
