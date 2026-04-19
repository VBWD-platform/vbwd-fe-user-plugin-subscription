<template>
  <div
    class="terms-checkbox"
    data-testid="terms-checkbox"
  >
    <label class="checkbox-label">
      <input
        v-model="accepted"
        type="checkbox"
        @change="$emit('change', accepted)"
      >
      <span>
        {{ $t('components.termsCheckbox.agreeText') }}
        <a
          href="#"
          data-testid="terms-link"
          @click.prevent="showPopup = true"
        >
          {{ $t('components.termsCheckbox.termsLink') }}
        </a>
      </span>
    </label>

    <!-- Popup Modal -->
    <div
      v-if="showPopup"
      class="popup-overlay"
      data-testid="terms-popup"
      @click.self="showPopup = false"
    >
      <div class="popup-content">
        <div class="popup-header">
          <h3>{{ terms?.title || $t('components.termsCheckbox.popupTitle') }}</h3>
          <button
            data-testid="terms-popup-close"
            class="close-btn"
            @click="showPopup = false"
          >
            &times;
          </button>
        </div>
        <div
          v-if="loading"
          class="popup-body loading"
        >
          {{ $t('components.termsCheckbox.popupLoading') }}
        </div>
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-else
          data-testid="terms-content"
          class="popup-body"
          v-html="renderedContent"
        />
        <!-- eslint-enable vue/no-v-html -->
        <div class="popup-footer">
          <button
            class="btn primary"
            @click="showPopup = false"
          >
            {{ $t('components.termsCheckbox.popupClose') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';

defineEmits<{
  (e: 'change', value: boolean): void;
}>();

const { t } = useI18n();

const accepted = ref(false);
const showPopup = ref(false);
const loading = ref(false);
const terms = ref<{ title: string; content: string } | null>(null);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Sanitize then apply markdown-like rendering (headers, paragraphs, lists)
const renderedContent = computed(() => {
  if (!terms.value) return 'Loading...';

  const sanitized = escapeHtml(terms.value.content);
  return sanitized
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
});

const loadTerms = async () => {
  loading.value = true;
  try {
    terms.value = await api.get('/settings/terms') as { title: string; content: string };
  } catch {
    terms.value = {
      title: t('components.termsCheckbox.popupTitle'),
      content: t('components.termsCheckbox.failedToLoad'),
    };
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadTerms();
});
</script>

<style scoped>
.terms-checkbox {
  margin: 15px 0;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  font-size: 0.95rem;
}

.checkbox-label input {
  margin-top: 3px;
  cursor: pointer;
}

.checkbox-label a {
  color: #3498db;
  text-decoration: underline;
}

.checkbox-label a:hover {
  color: #2980b9;
}

/* Popup styles */
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup-content {
  background: white;
  border-radius: 8px;
  max-width: 600px;
  max-height: 80vh;
  width: 90%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}

.popup-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

.popup-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  line-height: 1.6;
  color: #333;
}

.popup-body.loading {
  text-align: center;
  color: #666;
}

.popup-body :deep(h3) {
  margin-top: 20px;
  margin-bottom: 10px;
  color: #2c3e50;
}

.popup-body :deep(h4) {
  margin-top: 15px;
  margin-bottom: 8px;
  color: #2c3e50;
}

.popup-body :deep(li) {
  margin-left: 20px;
  margin-bottom: 5px;
}

.popup-body :deep(p) {
  margin-bottom: 10px;
}

.popup-footer {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  text-align: right;
}

.btn.primary {
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn.primary:hover {
  background: #2980b9;
}
</style>
