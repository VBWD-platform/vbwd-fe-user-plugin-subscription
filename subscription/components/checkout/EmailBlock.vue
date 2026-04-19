<template>
  <div
    :class="[
      'email-block',
      { 'success': isLoggedIn, 'error': emailCheck.state.value === 'error' }
    ]"
    :data-testid="isLoggedIn ? 'email-block-success' : 'email-block'"
  >
    <h3>{{ $t('components.emailBlock.title') }}</h3>

    <!-- Email Input -->
    <div class="form-group">
      <input
        v-model="emailInput"
        type="email"
        :placeholder="$t('components.emailBlock.emailPlaceholder')"
        data-testid="email-input"
        :disabled="isLoggedIn"
        @input="debouncedCheck"
      >
      <span
        v-if="emailCheck.isChecking.value"
        data-testid="email-checking"
        class="checking"
      >
        {{ $t('components.emailBlock.checking') }}
      </span>
    </div>

    <!-- New User: Register -->
    <div
      v-if="emailCheck.isNewUser.value && !isLoggedIn"
      data-testid="email-new-user"
      class="new-user-form"
    >
      <p class="hint">
        {{ $t('components.emailBlock.newUser.hint') }}
      </p>
      <input
        v-model="password"
        type="password"
        :placeholder="$t('components.emailBlock.newUser.passwordPlaceholder')"
        data-testid="password-input"
      >
      <!-- Password Strength Indicator -->
      <div
        class="password-strength"
        data-testid="password-strength"
      >
        <div :class="['strength-bar', passwordStrength]" />
        <span :class="['strength-label', passwordStrength]">{{ passwordStrengthLabel }}</span>
      </div>
      <!-- Password Confirmation -->
      <input
        v-model="passwordConfirm"
        type="password"
        :placeholder="$t('components.emailBlock.newUser.confirmPlaceholder')"
        data-testid="password-confirm-input"
      >
      <p
        v-if="passwordMismatch"
        class="error-message"
        data-testid="password-mismatch"
      >
        {{ $t('components.emailBlock.newUser.passwordMismatch') }}
      </p>
      <button
        data-testid="signup-button"
        class="btn primary"
        :disabled="!canRegister || submitting"
        @click="handleRegister"
      >
        {{ submitting ? $t('components.emailBlock.newUser.signingUp') : $t('components.emailBlock.newUser.signUpButton') }}
      </button>
    </div>

    <!-- Existing User: Login -->
    <div
      v-if="emailCheck.isExistingUser.value && !isLoggedIn"
      data-testid="email-existing-user"
      class="login-form"
    >
      <p
        data-testid="login-hint"
        class="hint text-red"
      >
        {{ $t('components.emailBlock.existingUser.hint') }}
      </p>
      <input
        v-model="password"
        type="password"
        :placeholder="$t('components.emailBlock.existingUser.passwordPlaceholder')"
        data-testid="password-input"
      >
      <a
        href="#"
        class="forgot-password-link"
        data-testid="forgot-password-link"
        @click.prevent="handleForgotPassword"
      >
        {{ $t('components.emailBlock.existingUser.forgotPassword') }}
      </a>
      <button
        data-testid="login-button"
        class="btn primary"
        :disabled="!canLogin || submitting"
        @click="handleLogin"
      >
        {{ submitting ? $t('components.emailBlock.existingUser.loggingIn') : $t('components.emailBlock.existingUser.loginButton') }}
      </button>
    </div>

    <!-- Logged In Success -->
    <div
      v-if="isLoggedIn"
      class="logged-in"
      data-testid="logged-in-state"
    >
      <div class="logged-in-info">
        <span class="checkmark">✓</span>
        <span v-if="userName">{{ $t('components.emailBlock.loggedIn.loggedInAsName', { name: userName, email: displayEmail }) }}</span>
        <span v-else>{{ $t('components.emailBlock.loggedIn.loggedInAs', { email: displayEmail }) }}</span>
      </div>
      <button
        class="btn secondary logout-btn"
        data-testid="logout-button"
        @click="handleLogout"
      >
        {{ $t('components.emailBlock.loggedIn.logoutButton') }}
      </button>
    </div>

    <!-- Error -->
    <p
      v-if="authError"
      class="error-message"
    >
      {{ authError }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEmailCheck } from '@/composables/useEmailCheck';
import { useAnalytics } from '@/composables/useAnalytics';
import { api, isAuthenticated as checkApiAuth, clearApiAuth } from '@/api';
import { debounce } from '@/utils/debounce';

const props = defineProps<{
  initialEmail?: string;
  isAuthenticated?: boolean;
}>();

const emit = defineEmits<{
  (e: 'authenticated', userId: string): void;
  (e: 'logout'): void;
  (e: 'forgot-password', email: string): void;
}>();

const { t } = useI18n();
const emailCheck = useEmailCheck();
const analytics = useAnalytics();

const emailInput = ref('');
const password = ref('');
const passwordConfirm = ref('');
const isLoggedIn = ref(false);
const authError = ref<string | null>(null);
const submitting = ref(false);
const userName = ref('');

const displayEmail = computed(() => emailCheck.email.value || emailInput.value);

// Password strength calculation
const passwordStrength = computed(() => {
  const p = password.value;
  if (p.length < 8) return 'weak';
  const hasLetters = /[a-zA-Z]/.test(p);
  const hasNumbers = /[0-9]/.test(p);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(p);
  if (p.length >= 12 && hasLetters && hasNumbers && hasSpecial) return 'strong';
  if (hasLetters && hasNumbers) return 'medium';
  return 'weak';
});

const passwordStrengthLabel = computed(() => {
  const labels: Record<string, string> = { weak: t('components.emailBlock.passwordStrength.weak'), medium: t('components.emailBlock.passwordStrength.medium'), strong: t('components.emailBlock.passwordStrength.strong') };
  return labels[passwordStrength.value];
});

const passwordMismatch = computed(() =>
  passwordConfirm.value.length > 0 && password.value !== passwordConfirm.value
);

const canRegister = computed(() =>
  password.value.length >= 8 &&
  password.value === passwordConfirm.value &&
  passwordStrength.value !== 'weak'
);

const canLogin = computed(() => password.value.length > 0);

// Debounced email check (500ms per Q&A decision)
const debouncedCheck = debounce(async () => {
  if (!emailInput.value) return;
  await emailCheck.checkEmail(emailInput.value);
  analytics.track('email-checked', {
    email_exists: emailCheck.isExistingUser.value,
  });
}, 500);

const handleLogin = async () => {
  authError.value = null;
  submitting.value = true;
  analytics.track('login-started', { timestamp: Date.now() });

  try {
    const response = await api.post('/auth/login', {
      email: emailCheck.email.value,
      password: password.value,
    }) as { success?: boolean; token?: string; user_id?: string; user?: { email: string }; error?: string };

    if (response.token) {
      api.setToken(response.token);
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user_email', response.user?.email || emailCheck.email.value);
      if (response.user_id) {
        localStorage.setItem('user_id', response.user_id);
      }
      isLoggedIn.value = true;
      analytics.track('login-success', { timestamp: Date.now() });
      emit('authenticated', response.user_id || '');
    } else {
      analytics.track('login-failed', { error_type: response.error });
      authError.value = response.error || t('common.errors.loginFailed');
    }
  } catch (e) {
    analytics.track('login-failed', { error_type: 'network_error' });
    authError.value = t('common.errors.loginFailedRetry');
  } finally {
    submitting.value = false;
  }
};

const handleRegister = async () => {
  authError.value = null;
  submitting.value = true;
  analytics.track('registration-started', { timestamp: Date.now() });

  try {
    const response = await api.post('/auth/register', {
      email: emailCheck.email.value,
      password: password.value,
    }) as { success?: boolean; token?: string; user_id?: string; user?: { email: string }; error?: string };

    if (response.token) {
      api.setToken(response.token);
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user_email', response.user?.email || emailCheck.email.value);
      if (response.user_id) {
        localStorage.setItem('user_id', response.user_id);
      }
      isLoggedIn.value = true;
      analytics.track('registration-success', { timestamp: Date.now() });
      emit('authenticated', response.user_id || '');
    } else {
      analytics.track('registration-failed', { error_type: response.error });
      authError.value = response.error || t('common.errors.registrationFailed');
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : t('common.errors.registrationFailedRetry');
    analytics.track('registration-failed', { error_type: errorMessage });
    authError.value = errorMessage;
  } finally {
    submitting.value = false;
  }
};

const handleForgotPassword = () => {
  analytics.track('forgot-password-clicked', { timestamp: Date.now() });
  emit('forgot-password', emailCheck.email.value);
};

const handleLogout = () => {
  analytics.track('logout-clicked', { timestamp: Date.now() });
  clearApiAuth();
  isLoggedIn.value = false;
  userName.value = '';
  emailCheck.reset();
  emailInput.value = '';
  password.value = '';
  passwordConfirm.value = '';
  emit('logout');
};

// Check if already logged in on mount
onMounted(async () => {
  if (props.isAuthenticated || checkApiAuth()) {
    isLoggedIn.value = true;
    emailInput.value = props.initialEmail || localStorage.getItem('user_email') || '';
    // Fetch user name for display
    try {
      const details = await api.get('/user/details') as Record<string, string | null>;
      const parts = [details.first_name, details.last_name].filter(Boolean);
      if (parts.length > 0) userName.value = parts.join(' ');
      if (details.email) emailInput.value = details.email;
    } catch {
      // Not critical, email-only display is fine
    }
  }
});

// Watch for external auth state changes
watch(() => props.isAuthenticated, (newVal) => {
  if (newVal !== undefined) {
    isLoggedIn.value = newVal;
  }
});
</script>

<style scoped>
.email-block {
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
}

.email-block.success {
  border-color: #27ae60;
  background: #e8f8f0;
}

.email-block.error {
  border-color: #e74c3c;
}

h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
}

.form-group {
  position: relative;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  margin-bottom: 10px;
  box-sizing: border-box;
}

input:disabled {
  background: #f5f5f5;
  color: #666;
}

.checking {
  position: absolute;
  right: 12px;
  top: 12px;
  color: #666;
  font-size: 0.875rem;
}

.hint {
  margin: 10px 0;
  font-size: 0.9rem;
  color: #666;
}

.text-red {
  color: #e74c3c;
}

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 10px;
}

.btn.primary {
  background: #3498db;
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn.primary:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.btn.secondary {
  background: #ecf0f1;
  color: #333;
}

.btn.secondary:hover {
  background: #bdc3c7;
}

.error-message {
  color: #e74c3c;
  margin-top: 10px;
  font-size: 0.875rem;
}

/* Password Strength Indicator */
.password-strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.strength-bar {
  height: 4px;
  flex: 1;
  border-radius: 2px;
  transition: background-color 0.3s;
}

.strength-bar.weak {
  background: linear-gradient(90deg, #e74c3c 33%, #ddd 33%);
}

.strength-bar.medium {
  background: linear-gradient(90deg, #f39c12 66%, #ddd 66%);
}

.strength-bar.strong {
  background: #27ae60;
}

.strength-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: 600;
}

.strength-label.weak { color: #e74c3c; }
.strength-label.medium { color: #f39c12; }
.strength-label.strong { color: #27ae60; }

/* Forgot Password Link */
.forgot-password-link {
  display: block;
  text-align: right;
  font-size: 0.875rem;
  color: #3498db;
  margin-bottom: 5px;
}

.forgot-password-link:hover {
  text-decoration: underline;
}

/* Logged In State */
.logged-in {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.logged-in-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #27ae60;
  font-weight: 500;
}

.checkmark {
  font-size: 1.5rem;
}

.logout-btn {
  width: auto;
  padding: 8px 16px;
  margin-top: 0;
}
</style>
