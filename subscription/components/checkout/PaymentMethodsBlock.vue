<template>
  <div
    class="payment-methods-block"
    data-testid="payment-methods-block"
  >
    <h3>{{ $t('components.paymentMethods.title') }}</h3>

    <div
      v-if="loading"
      class="loading"
      data-testid="payment-methods-loading"
    >
      {{ $t('components.paymentMethods.loading') }}
    </div>

    <div
      v-else-if="error"
      class="error"
      data-testid="payment-methods-error"
    >
      {{ error }}
    </div>

    <div
      v-else-if="methods.length === 0"
      class="empty"
    >
      {{ $t('components.paymentMethods.noMethods') }}
    </div>

    <div
      v-else
      class="methods-list"
    >
      <div
        v-for="method in methods"
        :key="method.code"
        :class="['method-option', { selected: selectedMethodCode === method.code }]"
        :data-testid="`payment-method-${method.code}`"
        @click="handleSelect(method.code)"
      >
        <div class="method-header">
          <input
            :id="`method-${method.code}`"
            type="radio"
            :checked="selectedMethodCode === method.code"
            name="payment-method"
            @change="handleSelect(method.code)"
          >
          <label
            :for="`method-${method.code}`"
            class="method-name"
          >
            {{ method.name }}
          </label>
        </div>
        <p
          v-if="method.short_description || method.description"
          :data-testid="`payment-method-${method.code}-description`"
          class="method-description"
        >
          {{ method.short_description || method.description }}
        </p>
      </div>
    </div>

    <!-- Instructions for selected method -->
    <div
      v-if="selectedMethod?.instructions"
      class="method-instructions"
      data-testid="payment-method-instructions"
    >
      <p>{{ selectedMethod.instructions }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { usePaymentMethods } from '@/composables/usePaymentMethods';

const props = defineProps<{
  locale?: string;
  currency?: string;
  country?: string;
}>();

const emit = defineEmits<{
  (e: 'selected', methodCode: string): void;
}>();

const {
  methods,
  loading,
  error,
  selectedMethodCode,
  selectedMethod,
  loadMethods,
  selectMethod,
} = usePaymentMethods();

const handleSelect = (methodCode: string) => {
  selectMethod(methodCode);
  emit('selected', methodCode);
};

onMounted(async () => {
  await loadMethods(props.locale, props.currency, props.country);
  // Emit initial selection if auto-selected
  if (selectedMethodCode.value) {
    emit('selected', selectedMethodCode.value);
  }
});

// Reload if filters change
watch([() => props.locale, () => props.currency, () => props.country], async () => {
  await loadMethods(props.locale, props.currency, props.country);
});
</script>

<style scoped>
.payment-methods-block {
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
}

h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
}

.methods-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.method-option {
  padding: 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.method-option:hover {
  border-color: #3498db;
}

.method-option.selected {
  border-color: #3498db;
  background: #f0f7ff;
}

.method-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.method-header input[type="radio"] {
  margin: 0;
  cursor: pointer;
}

.method-name {
  font-weight: 600;
  cursor: pointer;
  color: #2c3e50;
}

.method-description {
  margin: 8px 0 0 26px;
  color: #666;
  font-size: 0.9rem;
}

.method-instructions {
  margin-top: 15px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #495057;
}

.method-instructions p {
  margin: 0;
}

.loading,
.error,
.empty {
  padding: 20px;
  text-align: center;
  color: #666;
}

.error {
  color: #e74c3c;
}
</style>
