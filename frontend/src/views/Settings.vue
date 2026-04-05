<script setup>
import { ref, onMounted } from 'vue'
import { getIntegrations, saveTelegram, removeTelegram, telegramSendCode, telegramVerifyCode, telegramLogout } from '../api/client.js'

const integrations = ref(null)
const loading = ref(true)

// Telegram setup
const tgApiId = ref('')
const tgApiHash = ref('')
const tgSaving = ref(false)
const tgError = ref('')
const tgSuccess = ref('')

// Telegram login
const tgPhone = ref('')
const tgCode = ref('')
const tgCodeHash = ref('')
const tgLoginStep = ref('phone')
const tgLoginLoading = ref(false)
const tgLoginError = ref('')

async function load() {
  loading.value = true
  integrations.value = await getIntegrations()
  if (integrations.value.telegram.api_id) {
    tgApiId.value = integrations.value.telegram.api_id
  }
  loading.value = false
}

async function saveTg() {
  tgSaving.value = true
  tgError.value = ''
  tgSuccess.value = ''
  try {
    await saveTelegram(tgApiId.value, tgApiHash.value)
    tgSuccess.value = 'Credentials saved! Now login with your phone number below.'
    tgApiHash.value = ''
    await load()
  } catch (err) {
    tgError.value = err.message
  }
  tgSaving.value = false
}

async function removeTg() {
  if (!confirm('Remove Telegram integration? This will disconnect your account.')) return
  await removeTelegram()
  tgApiId.value = ''
  tgApiHash.value = ''
  tgSuccess.value = ''
  tgLoginStep.value = 'phone'
  await load()
}

async function sendCode() {
  tgLoginLoading.value = true
  tgLoginError.value = ''
  try {
    const result = await telegramSendCode(tgPhone.value)
    tgCodeHash.value = result.phoneCodeHash
    tgLoginStep.value = 'code'
  } catch (err) {
    tgLoginError.value = err.message
  }
  tgLoginLoading.value = false
}

async function verifyCode() {
  tgLoginLoading.value = true
  tgLoginError.value = ''
  try {
    await telegramVerifyCode(tgPhone.value, tgCode.value, tgCodeHash.value)
    tgLoginStep.value = 'phone'
    tgCode.value = ''
    await load()
  } catch (err) {
    tgLoginError.value = err.message
  }
  tgLoginLoading.value = false
}

async function logoutTg() {
  await telegramLogout()
  await load()
}

onMounted(load)
</script>

<template>
  <div class="settings">
    <h1>Settings</h1>

    <div v-if="loading" class="loading">Loading...</div>

    <template v-else>
      <section class="settings-section">
        <div class="section-title">
          <h2>Integrations</h2>
          <p class="section-desc">Connect external services to use as file sources.</p>
        </div>

        <!-- Telegram -->
        <div class="integration-card">
          <div class="integration-header">
            <div class="integration-icon">&#9992;</div>
            <div class="integration-info">
              <div class="integration-name">Telegram</div>
              <div class="integration-status">
                <span v-if="integrations.telegram.logged_in" class="status-badge connected">Connected</span>
                <span v-else-if="integrations.telegram.configured" class="status-badge pending">Credentials saved — login required</span>
                <span v-else class="status-badge disconnected">Not configured</span>
              </div>
            </div>
          </div>

          <!-- Step 1: Not configured — setup credentials -->
          <div v-if="!integrations.telegram.configured" class="integration-setup">
            <div class="setup-steps">
              <div class="step">
                <div class="step-number">1</div>
                <div class="step-content">
                  <p>Create a Telegram application to get your API credentials:</p>
                  <a href="https://my.telegram.org/apps" target="_blank" class="step-link">
                    &#8594; Open my.telegram.org/apps
                  </a>
                  <p class="step-hint">Log in with your phone number. Click "API development tools". Fill any app name and create it.</p>
                </div>
              </div>
              <div class="step">
                <div class="step-number">2</div>
                <div class="step-content">
                  <p>Copy <strong>App api_id</strong> and <strong>App api_hash</strong> and paste below:</p>
                </div>
              </div>
            </div>

            <div class="form-row-inline">
              <div class="form-group">
                <label>API ID</label>
                <input v-model="tgApiId" placeholder="12345678" />
              </div>
              <div class="form-group">
                <label>API Hash</label>
                <input v-model="tgApiHash" type="password" placeholder="abc123def456..." />
              </div>
            </div>

            <div v-if="tgError" class="error-banner">{{ tgError }}</div>
            <div v-if="tgSuccess" class="success-banner">{{ tgSuccess }}</div>

            <div class="integration-actions">
              <button class="btn-primary" @click="saveTg" :disabled="tgSaving || !tgApiId || !tgApiHash">
                {{ tgSaving ? 'Saving...' : 'Save Credentials' }}
              </button>
            </div>
          </div>

          <!-- Step 2: Configured but not logged in — login flow -->
          <div v-else-if="!integrations.telegram.logged_in" class="integration-setup">
            <div class="configured-info">
              <div class="configured-row">
                <span class="configured-label">API ID</span>
                <span class="configured-value">{{ integrations.telegram.api_id }}</span>
              </div>
            </div>

            <!-- Phone input -->
            <div v-if="tgLoginStep === 'phone'" class="login-form">
              <p class="modal-hint">Enter your phone number to login. A code will be sent to your Telegram app.</p>
              <div class="form-group">
                <label>Phone number (with country code)</label>
                <input
                  v-model="tgPhone"
                  placeholder="+5511999999999"
                  @keydown.enter="tgPhone && sendCode()"
                />
              </div>
              <div v-if="tgLoginError" class="error-banner">{{ tgLoginError }}</div>
              <div class="integration-actions">
                <button class="btn-danger" @click="removeTg">Remove</button>
                <button class="btn-primary" @click="sendCode" :disabled="tgLoginLoading || !tgPhone">
                  {{ tgLoginLoading ? 'Sending...' : 'Send Code' }}
                </button>
              </div>
            </div>

            <!-- Code input -->
            <div v-if="tgLoginStep === 'code'" class="login-form">
              <p class="modal-hint">A code was sent to your Telegram app. Enter it below.</p>
              <div class="form-group">
                <label>Verification code</label>
                <input
                  v-model="tgCode"
                  placeholder="12345"
                  autofocus
                  @keydown.enter="tgCode && verifyCode()"
                />
              </div>
              <div v-if="tgLoginError" class="error-banner">{{ tgLoginError }}</div>
              <div class="integration-actions">
                <button class="btn-ghost" @click="tgLoginStep = 'phone'">Back</button>
                <button class="btn-primary" @click="verifyCode" :disabled="tgLoginLoading || !tgCode">
                  {{ tgLoginLoading ? 'Verifying...' : 'Verify Code' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Step 3: Fully connected -->
          <div v-else class="integration-configured">
            <div class="configured-info">
              <div class="configured-row">
                <span class="configured-label">Status</span>
                <span class="configured-value connected-text">&#10003; Logged in and ready</span>
              </div>
              <div class="configured-row">
                <span class="configured-label">API ID</span>
                <span class="configured-value">{{ integrations.telegram.api_id }}</span>
              </div>
            </div>

            <div class="integration-actions">
              <button class="btn-ghost" @click="logoutTg">Logout</button>
              <button class="btn-danger" @click="removeTg">Remove Integration</button>
            </div>
          </div>
        </div>

        <!-- Future integrations -->
        <div class="integration-card coming-soon">
          <div class="integration-header">
            <div class="integration-icon">&#128279;</div>
            <div class="integration-info">
              <div class="integration-name">More providers</div>
              <div class="integration-status">
                <span class="status-badge coming">Coming soon</span>
              </div>
            </div>
          </div>
          <p class="coming-text">Additional storage providers will be added in future updates.</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
h1 { font-size: 28px; font-weight: 700; margin-bottom: 32px; }

.settings-section { margin-bottom: 40px; }
.section-title { margin-bottom: 20px; }
.section-title h2 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
.section-desc { font-size: 13px; color: var(--text-muted); }

.integration-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 12px;
}
.integration-card.coming-soon { opacity: 0.6; }

.integration-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.integration-icon { font-size: 28px; }
.integration-name { font-size: 16px; font-weight: 600; }
.integration-status { margin-top: 2px; }

.status-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 4px;
}
.status-badge.connected { background: #1a3a2a; color: #22c55e; }
.status-badge.pending { background: #3a2a1a; color: #f59e0b; }
.status-badge.disconnected { background: #3a1a1a; color: #f87171; }
.status-badge.coming { background: var(--bg-card); color: var(--text-muted); }

.setup-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}
.step { display: flex; gap: 14px; }
.step-number {
  width: 28px;
  height: 28px;
  background: var(--accent-glow);
  color: var(--accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.step-content { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
.step-content p { margin-bottom: 6px; }
.step-content strong { color: var(--text-primary); }
.step-link {
  display: inline-block;
  padding: 6px 14px;
  background: var(--accent-glow);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  color: var(--accent);
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 6px;
}
.step-link:hover { background: var(--accent); color: white; }
.step-hint { font-size: 12px; color: var(--text-muted); }

.form-row-inline {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.form-row-inline .form-group { flex: 1; }
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.modal-hint {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 12px;
}

.error-banner {
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: 13px;
  margin-bottom: 12px;
}
.success-banner {
  padding: 10px 14px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid var(--success);
  border-radius: var(--radius-sm);
  color: var(--success);
  font-size: 13px;
  margin-bottom: 12px;
}

.integration-actions {
  display: flex;
  gap: 8px;
}

.configured-info {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.configured-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.configured-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}
.configured-value {
  font-size: 14px;
  font-family: monospace;
  color: var(--text-primary);
}
.connected-text { color: #22c55e; font-family: inherit; }

.login-form { margin-top: 4px; }

.coming-text { font-size: 13px; color: var(--text-muted); }

.loading {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-secondary);
}
</style>
