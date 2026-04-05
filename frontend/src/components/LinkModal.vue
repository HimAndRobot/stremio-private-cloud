<script setup>
import { ref, computed } from 'vue'
import { linkGdrive, uploadLocal } from '../api/client.js'

const props = defineProps({ targetId: String })
const emit = defineEmits(['close', 'linked'])

const step = ref('choose')
const source = ref('')
const quality = ref('1080p')
const loading = ref(false)
const error = ref('')

// Google Drive
const driveUrl = ref('')

// Local file
const selectedFile = ref(null)
const fileInputRef = ref(null)

const canSubmit = computed(() => {
  if (source.value === 'gdrive') return driveUrl.value.trim().length > 0
  if (source.value === 'local') return selectedFile.value !== null
  return false
})

function selectSource(s) {
  source.value = s
  step.value = 'form'
  error.value = ''
  if (s === 'local') {
    setTimeout(() => fileInputRef.value?.click(), 100)
  }
}

function goBack() {
  step.value = 'choose'
  source.value = ''
  error.value = ''
  selectedFile.value = null
}

function onFileSelect(e) {
  const file = e.target.files[0]
  if (file) selectedFile.value = file
}

function browseFile() {
  fileInputRef.value?.click()
}

function formatSize(bytes) {
  if (!bytes) return ''
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}

async function submit() {
  loading.value = true
  error.value = ''

  try {
    let result
    if (source.value === 'gdrive') {
      result = await linkGdrive(props.targetId, driveUrl.value, quality.value)
    } else {
      result = await uploadLocal(props.targetId, selectedFile.value, quality.value)
    }
    emit('linked', result)
  } catch (err) {
    error.value = err.message
  }

  loading.value = false
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title-row">
          <button v-if="step === 'form'" class="back-btn" @click="goBack">&larr;</button>
          <h3>
            {{ step === 'choose' ? 'Add File' : source === 'gdrive' ? 'Google Drive' : 'Local File' }}
          </h3>
        </div>
        <button class="modal-close" @click="emit('close')">&times;</button>
      </div>

      <!-- Step 1: Choose source -->
      <div v-if="step === 'choose'" class="modal-body">
        <p class="modal-hint">How do you want to add this file?</p>
        <div class="source-options">
          <button class="source-card" @click="selectSource('local')">
            <div class="source-icon">&#128193;</div>
            <div class="source-label">Local File</div>
            <div class="source-desc">Select a video file from your computer</div>
          </button>
          <button class="source-card" @click="selectSource('gdrive')">
            <div class="source-icon">&#9729;</div>
            <div class="source-label">Google Drive</div>
            <div class="source-desc">Link a shared file from Google Drive</div>
          </button>
        </div>
      </div>

      <!-- Step 2: Form -->
      <div v-else class="modal-body">
        <div v-if="error" class="error-banner">{{ error }}</div>

        <!-- Google Drive form -->
        <template v-if="source === 'gdrive'">
          <p class="modal-hint">Paste a Google Drive shared link. The file must be accessible to "Anyone with the link".</p>
          <div class="form-group">
            <label>Google Drive URL</label>
            <input
              v-model="driveUrl"
              placeholder="https://drive.google.com/file/d/.../view"
              autofocus
              @keydown.enter="canSubmit && submit()"
            />
          </div>
        </template>

        <!-- Local file form -->
        <template v-if="source === 'local'">
          <input
            ref="fileInputRef"
            type="file"
            accept="video/*,.mkv,.avi,.m4v,.ts,.m2ts"
            hidden
            @change="onFileSelect"
          />

          <div v-if="selectedFile" class="selected-file">
            <div class="selected-file-icon">&#127909;</div>
            <div class="selected-file-info">
              <div class="selected-file-name">{{ selectedFile.name }}</div>
              <div class="selected-file-size">{{ formatSize(selectedFile.size) }}</div>
            </div>
            <button class="btn-ghost btn-sm" @click="browseFile">Change</button>
          </div>
          <div v-else class="drop-zone" @click="browseFile">
            <div class="drop-icon">&#128193;</div>
            <div class="drop-text">Click to select a video file</div>
          </div>
        </template>

        <div class="form-group">
          <label>Quality</label>
          <select v-model="quality">
            <option>480p</option>
            <option>720p</option>
            <option>1080p</option>
            <option>2160p</option>
          </select>
        </div>

        <div class="form-row">
          <span class="form-label">Linking to: <code>{{ targetId }}</code></span>
        </div>
      </div>

      <!-- Footer (only on step 2) -->
      <div v-if="step === 'form'" class="modal-footer">
        <button class="btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn-primary" @click="submit" :disabled="loading || !canSubmit">
          {{ loading ? (source === 'local' ? 'Uploading...' : 'Linking...') : (source === 'local' ? 'Upload File' : 'Link File') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}
.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 480px;
  max-width: 90vw;
  box-shadow: var(--shadow);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}
.modal-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.modal-title-row h3 { font-size: 16px; font-weight: 600; margin: 0; }
.back-btn {
  background: none;
  color: var(--text-muted);
  font-size: 18px;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}
.back-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.modal-close {
  background: none;
  color: var(--text-muted);
  font-size: 22px;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}
.modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }

.modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.modal-hint {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.source-options { display: flex; gap: 12px; }
.source-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  background: var(--bg-card);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.source-card:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
}
.source-icon { font-size: 32px; }
.source-label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.source-desc { font-size: 11px; color: var(--text-muted); line-height: 1.4; }

.error-banner {
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: 13px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 2px solid var(--accent);
  border-radius: var(--radius);
}
.selected-file-icon { font-size: 28px; }
.selected-file-info { flex: 1; min-width: 0; }
.selected-file-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.selected-file-size { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px;
  background: var(--bg-card);
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s;
}
.drop-zone:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
}
.drop-icon { font-size: 32px; }
.drop-text { font-size: 13px; color: var(--text-muted); }

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.form-row { font-size: 12px; color: var(--text-muted); }
.form-row code {
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.btn-sm { padding: 6px 14px; font-size: 12px; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}
</style>
