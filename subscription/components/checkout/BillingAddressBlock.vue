<template>
  <div
    class="billing-address-block"
    data-testid="billing-address-block"
  >
    <h3>{{ $t('components.billingAddress.title') }}</h3>

    <div
      v-if="loading"
      class="loading"
    >
      {{ $t('components.billingAddress.loading') }}
    </div>

    <div v-else>
      <!-- First Name + Last Name -->
      <div class="form-row">
        <div class="form-group">
          <label for="firstName">{{ $t('components.billingAddress.firstNameLabel') }} *</label>
          <input
            id="firstName"
            v-model="address.firstName"
            type="text"
            :placeholder="$t('components.billingAddress.firstNamePlaceholder')"
            data-testid="billing-first-name"
            :disabled="props.readonly"
            :class="{ error: touched.firstName && errors.firstName, disabled: props.readonly }"
            @blur="touched.firstName = true; validate()"
          >
          <span
            v-if="touched.firstName && errors.firstName"
            data-testid="billing-first-name-error"
            class="error-text"
          >
            {{ errors.firstName }}
          </span>
        </div>

        <div class="form-group">
          <label for="lastName">{{ $t('components.billingAddress.lastNameLabel') }} *</label>
          <input
            id="lastName"
            v-model="address.lastName"
            type="text"
            :placeholder="$t('components.billingAddress.lastNamePlaceholder')"
            data-testid="billing-last-name"
            :disabled="props.readonly"
            :class="{ error: touched.lastName && errors.lastName, disabled: props.readonly }"
            @blur="touched.lastName = true; validate()"
          >
          <span
            v-if="touched.lastName && errors.lastName"
            data-testid="billing-last-name-error"
            class="error-text"
          >
            {{ errors.lastName }}
          </span>
        </div>
      </div>

      <!-- Company (optional) -->
      <div class="form-group">
        <label for="company">{{ $t('components.billingAddress.companyLabel') }}</label>
        <input
          id="company"
          v-model="address.company"
          type="text"
          :placeholder="$t('components.billingAddress.companyPlaceholder')"
          data-testid="billing-company"
          :disabled="props.readonly"
          :class="{ disabled: props.readonly }"
        >
      </div>

      <!-- Street -->
      <div class="form-group">
        <label for="street">{{ $t('components.billingAddress.streetLabel') }}</label>
        <input
          id="street"
          v-model="address.street"
          type="text"
          :placeholder="$t('components.billingAddress.streetPlaceholder')"
          data-testid="billing-street"
          :disabled="props.readonly"
          :class="{ error: touched.street && errors.street, disabled: props.readonly }"
          @blur="touched.street = true; validate()"
        >
        <span
          v-if="touched.street && errors.street"
          data-testid="billing-street-error"
          class="error-text"
        >
          {{ errors.street }}
        </span>
      </div>

      <!-- City + ZIP -->
      <div class="form-row city-zip">
        <div class="form-group">
          <label for="city">{{ $t('components.billingAddress.cityLabel') }}</label>
          <input
            id="city"
            v-model="address.city"
            type="text"
            :placeholder="$t('components.billingAddress.cityPlaceholder')"
            data-testid="billing-city"
            :disabled="props.readonly"
            :class="{ error: touched.city && errors.city, disabled: props.readonly }"
            @blur="touched.city = true; validate()"
          >
          <span
            v-if="touched.city && errors.city"
            data-testid="billing-city-error"
            class="error-text"
          >
            {{ errors.city }}
          </span>
        </div>

        <div class="form-group">
          <label for="zip">{{ $t('components.billingAddress.zipLabel') }}</label>
          <input
            id="zip"
            v-model="address.zip"
            type="text"
            :placeholder="$t('components.billingAddress.zipPlaceholder')"
            data-testid="billing-zip"
            :disabled="props.readonly"
            :class="{ error: touched.zip && errors.zip, disabled: props.readonly }"
            @blur="touched.zip = true; validate()"
          >
          <span
            v-if="touched.zip && errors.zip"
            data-testid="billing-zip-error"
            class="error-text"
          >
            {{ errors.zip }}
          </span>
        </div>
      </div>

      <!-- Country -->
      <div class="form-group">
        <label for="country">{{ $t('components.billingAddress.countryLabel') }}</label>
        <select
          id="country"
          v-model="address.country"
          data-testid="billing-country"
          :disabled="props.readonly"
          :class="{ error: touched.country && errors.country, disabled: props.readonly }"
          @blur="touched.country = true; validate()"
        >
          <option value="">
            {{ $t('components.billingAddress.countryPlaceholder') }}
          </option>
          <option
            v-for="country in countries"
            :key="country.code"
            :value="country.code"
          >
            {{ country.name }}
          </option>
        </select>
        <span
          v-if="touched.country && errors.country"
          data-testid="billing-country-error"
          class="error-text"
        >
          {{ errors.country }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { api, isAuthenticated } from '@/api';

export interface BillingAddressData {
  firstName: string;
  lastName: string;
  company: string;
  street: string;
  city: string;
  zip: string;
  country: string;
}

interface Country {
  code: string;
  name: string;
}

const props = defineProps<{
  readonly?: boolean;
}>();

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'change', address: BillingAddressData): void;
  (e: 'valid', isValid: boolean): void;
}>();

const loading = ref(true);
const countries = ref<Country[]>([]);

const address = reactive<BillingAddressData>({
  firstName: '',
  lastName: '',
  company: '',
  street: '',
  city: '',
  zip: '',
  country: '',
});

const touched = reactive({
  firstName: false,
  lastName: false,
  street: false,
  city: false,
  zip: false,
  country: false,
});

const errors = reactive<Record<string, string>>({});

const isValid = computed(() =>
  !errors.firstName && !errors.lastName && !errors.street && !errors.city && !errors.zip && !errors.country &&
  address.firstName && address.lastName && address.street && address.city && address.zip && address.country
);

const validate = () => {
  // Only validate required fields
  errors.firstName = !address.firstName ? t('components.billingAddress.errors.firstNameRequired') : '';
  errors.lastName = !address.lastName ? t('components.billingAddress.errors.lastNameRequired') : '';
  errors.street = !address.street ? t('components.billingAddress.errors.streetRequired') : '';
  errors.city = !address.city ? t('components.billingAddress.errors.cityRequired') : '';
  errors.zip = !address.zip ? t('components.billingAddress.errors.zipRequired') : '';
  errors.country = !address.country ? t('components.billingAddress.errors.countryRequired') : '';

  emit('valid', !!isValid.value);
  return isValid.value;
};

const loadCountries = async () => {
  try {
    const response = await api.get('/settings/countries') as { countries: Country[] };
    countries.value = response.countries;
  } catch {
    // Fallback to hardcoded list
    countries.value = [
      { code: 'DE', name: 'Germany' },
      { code: 'AT', name: 'Austria' },
      { code: 'CH', name: 'Switzerland' },
      { code: 'US', name: 'United States' },
      { code: 'GB', name: 'United Kingdom' },
    ];
  }
};

const loadSavedAddress = async () => {
  if (!isAuthenticated()) return;

  try {
    const saved = await api.get('/user/details') as Record<string, string | null>;
    address.firstName = saved.first_name || '';
    address.lastName = saved.last_name || '';
    address.company = saved.company || '';
    address.street = saved.address_line_1 || '';
    address.city = saved.city || '';
    address.zip = saved.postal_code || '';
    address.country = saved.country || '';

    // Auto-validate when address was loaded from server
    if (address.street || address.city || address.firstName) {
      touched.firstName = true;
      touched.lastName = true;
      touched.street = true;
      touched.city = true;
      touched.zip = true;
      touched.country = true;
      validate();
    }
  } catch {
    // No saved address, that's fine
  }
};

// Emit changes
watch(address, () => {
  emit('change', { ...address });
  if (touched.street || touched.city || touched.zip || touched.country) {
    validate();
  }
}, { deep: true });

onMounted(async () => {
  await loadCountries();
  await loadSavedAddress();
  loading.value = false;
});
</script>

<style scoped>
.billing-address-block {
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
}

h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.form-group {
  margin-bottom: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-row.city-zip {
  grid-template-columns: 2fr 1fr;
}

@media (max-width: 480px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #333;
  font-size: 0.95rem;
}

input,
select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

input:focus,
select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.1);
}

input.error,
select.error {
  border-color: #e74c3c;
}

.error-text {
  color: #e74c3c;
  font-size: 0.85rem;
  margin-top: 4px;
  display: block;
}

input.disabled,
select.disabled {
  background-color: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}
</style>
