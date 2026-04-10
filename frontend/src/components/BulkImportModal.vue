<script setup>
import { ref, computed } from 'vue'
import { linkGdrive, linkMega, linkTelegram, linkYoutube } from '../api/client.js'

const props = defineProps({
  imdbId: String,
  season: Number,
  episodes: Array,
})
const emit = defineEmits(['close', 'imported'])

const step = ref('source')
const source = ref('')
const linksText = ref('')
const saveLocal = ref(false)
const startEpisode = ref(1)
const quality = ref('1080p')
const importing = ref(false)
const importProgress = ref(0)
const error = ref('')
const episodeStatus = ref({})
const currentDownload = ref({ progress: 0, total: 0 })

const parsedLinks = computed(() =>
  linksText.value.split('\n').map(l => l.trim()).filter(l => l.length > 0)
)

const assignments = computed(() => {
  const start = startEpisode.value
  return parsedLinks.value.map((link, i) => {
    const epNum = start + i
    const ep = props.episodes?.find(e => e.episode === epNum)
    return {
      link,
      episode: epNum,
      title: ep ? (ep.name || ep.title || `Episode ${epNum}`) : `Episode ${epNum}`,
      videoId: `${props.imdbId}:${props.season}:${epNum}`,
    }
  })
})

const canImport = computed(() => parsedLinks.value.length > 0)

function selectSource(s) {
  source.value = s
  step.value = 'links'
}

function goToPreview() {
  if (!canImport.value) return
  error.value = ''
  step.value = 'preview'
}

function formatSize(bytes) {
  if (!bytes) return '0 MB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}

function waitForDownload(downloadId, episode) {
  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/files/download-progress/${downloadId}`)
    es.onmessage = (e) => {
      const p = JSON.parse(e.data)
      currentDownload.value = { progress: p.progress || 0, total: p.total || 0 }
      if (p.status === 'done') { es.close(); resolve() }
      if (p.status === 'error') { es.close(); reject(new Error(p.error || 'Download failed')) }
    }
    es.onerror = () => { es.close(); reject(new Error('Connection lost')) }
  })
}

async function doImport() {
  importing.value = true
  importProgress.value = 0
  error.value = ''

  const sl = saveLocal.value
  const linkFn = source.value === 'gdrive' ? (id, url, q) => linkGdrive(id, url, q, sl)
    : source.value === 'mega' ? (id, url, q) => linkMega(id, url, q, sl)
    : source.value === 'youtube' ? (id, url, q) => linkYoutube(id, url, q, sl)
    : (id, url, q) => linkTelegram(id, url, q, sl)

  const results = []
  for (let i = 0; i < assignments.value.length; i++) {
    const a = assignments.value[i]
    episodeStatus.value[a.episode] = 'downloading'
    currentDownload.value = { progress: 0, total: 0 }

    try {
      const result = await linkFn(a.videoId, a.link, quality.value)

      if (result.downloading && result.downloadId) {
        await waitForDownload(result.downloadId, a.episode)
      }

      episodeStatus.value[a.episode] = 'done'
      results.push(result)
    } catch (err) {
      episodeStatus.value[a.episode] = 'error'
      error.value = `Failed on episode ${a.episode}: ${err.message}`
      break
    }
    importProgress.value = ((i + 1) / assignments.value.length) * 100
  }

  importing.value = false

  if (results.length > 0) {
    emit('imported', results)
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal bulk-modal">
      <div class="modal-header">
        <div class="modal-title-row">
          <button v-if="step !== 'source'" class="back-btn" @click="step = step === 'preview' ? 'links' : 'source'">&larr;</button>
          <h3>{{ step === 'source' ? 'Bulk Import' : step === 'links' ? 'Paste Links' : 'Review & Import' }}</h3>
        </div>
        <button class="modal-close" @click="emit('close')">&times;</button>
      </div>

      <!-- Step 1: Choose source -->
      <div v-if="step === 'source'" class="modal-body">
        <p class="hint">Select the source type for all links:</p>
        <div class="source-options">
          <button class="source-card" @click="selectSource('gdrive')">
            <span class="source-icon" style="color: #4285f4">&#9729;</span>
            <span class="source-label">Google Drive</span>
          </button>
          <button class="source-card" @click="selectSource('mega')">
            <span class="source-icon" style="color: #d9272e">&#9889;</span>
            <span class="source-label">MEGA</span>
          </button>
          <button class="source-card" @click="selectSource('youtube')">
            <span class="source-icon" style="color: #ff0000">&#9654;</span>
            <span class="source-label">YouTube</span>
          </button>
          <button class="source-card" @click="selectSource('telegram')">
            <span class="source-icon" style="color: #2aabee">&#9992;</span>
            <span class="source-label">Telegram</span>
          </button>
        </div>
      </div>

      <!-- Step 2: Paste links -->
      <div v-if="step === 'links'" class="modal-body">
        <p class="hint">Paste one link per line. Each line will be assigned to an episode in order.</p>

        <textarea
          v-model="linksText"
          class="links-input"
          placeholder="https://drive.google.com/file/d/.../view
https://drive.google.com/file/d/.../view
https://drive.google.com/file/d/.../view"
          rows="8"
        ></textarea>

        <div class="links-config">
          <div class="config-group">
            <label>Season</label>
            <input type="number" :value="season" disabled class="config-input" />
          </div>
          <div class="config-group">
            <label>Start from episode</label>
            <input type="number" v-model.number="startEpisode" min="1" class="config-input" />
          </div>
          <div class="config-group">
            <label>Quality</label>
            <select v-model="quality" class="config-input">
              <option>480p</option>
              <option>720p</option>
              <option>1080p</option>
              <option>2160p</option>
            </select>
          </div>
        </div>

        <div class="save-local-row" @click="saveLocal = !saveLocal">
          <div class="toggle-switch" :class="{ on: saveLocal }">
            <div class="toggle-knob"></div>
          </div>
          <span class="toggle-text">Save locally</span>
          <div class="info-wrap">
            <div class="info-icon">&#9432;</div>
            <div class="info-tooltip">Download files to server storage instead of streaming from external source.</div>
          </div>
        </div>

        <div class="links-count">{{ parsedLinks.length }} link{{ parsedLinks.length !== 1 ? 's' : '' }} detected</div>
      </div>

      <!-- Step 3: Preview -->
      <div v-if="step === 'preview'" class="modal-body">
        <div v-if="error" class="error-banner">{{ error }}</div>

        <div v-if="importing" class="progress-bar">
          <div class="progress-fill" :style="{ width: importProgress + '%' }"></div>
          <span class="progress-text">{{ Math.round(importProgress) }}%</span>
        </div>

        <div class="assignment-list">
          <div v-for="(a, i) in assignments" :key="i" class="assignment-row" :class="{ 'row-done': episodeStatus[a.episode] === 'done', 'row-active': episodeStatus[a.episode] === 'downloading', 'row-error': episodeStatus[a.episode] === 'error' }">
            <div class="assignment-ep">
              <span class="ep-badge">S{{ String(season).padStart(2, '0') }}E{{ String(a.episode).padStart(2, '0') }}</span>
              <span class="ep-name">{{ a.title }}</span>
            </div>
            <div v-if="episodeStatus[a.episode] === 'downloading' && saveLocal" class="assignment-progress">
              <div class="mini-progress-bar">
                <div class="mini-progress-fill" :style="{ width: (currentDownload.total ? (currentDownload.progress / currentDownload.total * 100) : 0) + '%' }"></div>
              </div>
              <span class="mini-progress-text">{{ formatSize(currentDownload.progress) }}{{ currentDownload.total ? ' / ' + formatSize(currentDownload.total) : '' }}</span>
            </div>
            <div v-else-if="episodeStatus[a.episode] === 'downloading'" class="assignment-status downloading">Linking...</div>
            <div v-else-if="episodeStatus[a.episode] === 'done'" class="assignment-status done">&#10003;</div>
            <div v-else-if="episodeStatus[a.episode] === 'error'" class="assignment-status err">&#10005;</div>
            <div v-else class="assignment-link">{{ a.link.length > 50 ? a.link.slice(0, 50) + '...' : a.link }}</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="step === 'links'" class="modal-footer">
        <button class="btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn-primary" @click="goToPreview" :disabled="!canImport">
          Preview ({{ parsedLinks.length }})
        </button>
      </div>

      <div v-if="step === 'preview'" class="modal-footer">
        <button class="btn-ghost" @click="emit('close')" :disabled="importing">Cancel</button>
        <button class="btn-primary" @click="doImport" :disabled="importing">
          {{ importing ? 'Importing...' : `Import ${assignments.length} episodes` }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; backdrop-filter: blur(4px);
}
.bulk-modal {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius); width: 560px; max-width: 90vw;
  box-shadow: var(--shadow); max-height: 80vh; display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px; border-bottom: 1px solid var(--border);
}
.modal-title-row { display: flex; align-items: center; gap: 10px; }
.modal-title-row h3 { font-size: 16px; font-weight: 600; margin: 0; }
.back-btn {
  background: none; color: var(--text-muted); font-size: 18px; padding: 0;
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; cursor: pointer;
}
.back-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.modal-close {
  background: none; color: var(--text-muted); font-size: 22px; padding: 0;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; cursor: pointer;
}
.modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }

.modal-body {
  padding: 20px 24px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 16px;
}
.hint { font-size: 13px; color: var(--text-muted); line-height: 1.5; }

.source-options { display: flex; gap: 12px; }
.source-card {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 20px 12px; background: var(--bg-card); border: 2px solid var(--border);
  border-radius: var(--radius); cursor: pointer; transition: all 0.2s; text-align: center;
}
.source-card:hover { border-color: var(--accent); background: var(--accent-glow); }
.source-icon { font-size: 24px; }
.source-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }

.links-input {
  width: 100%; font-family: monospace; font-size: 12px; line-height: 1.6;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
  color: var(--text-primary); padding: 12px; resize: vertical; outline: none;
}
.links-input:focus { border-color: var(--accent); }
.links-input::placeholder { color: var(--text-muted); }

.links-config { display: flex; gap: 12px; }
.config-group { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.config-group label {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.config-input {
  padding: 6px 10px; font-size: 13px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary);
  outline: none; width: 100%; font-family: inherit;
}
.config-input:focus { border-color: var(--accent); }
.config-input:disabled { opacity: 0.5; }

.save-local-row {
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; user-select: none;
}
.toggle-switch {
  width: 36px; height: 20px; background: var(--border);
  border-radius: 10px; position: relative; transition: background 0.2s; flex-shrink: 0;
}
.toggle-switch.on { background: var(--accent); }
.toggle-knob {
  width: 16px; height: 16px; background: white; border-radius: 50%;
  position: absolute; top: 2px; left: 2px; transition: left 0.2s;
}
.toggle-switch.on .toggle-knob { left: 18px; }
.toggle-text { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.info-wrap { margin-left: auto; position: relative; }
.info-icon { font-size: 16px; color: var(--text-muted); cursor: help; }
.info-tooltip {
  display: none; position: absolute; bottom: calc(100% + 8px); right: 0;
  width: 220px; padding: 10px 12px; background: var(--bg-secondary);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  box-shadow: var(--shadow); font-size: 12px; color: var(--text-secondary);
  line-height: 1.5; z-index: 10;
}
.info-wrap:hover .info-tooltip { display: block; }
.links-count { font-size: 12px; color: var(--text-muted); text-align: right; }

.error-banner {
  padding: 10px 14px; background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--danger); border-radius: var(--radius-sm);
  color: var(--danger); font-size: 13px;
}

.progress-bar {
  position: relative; height: 24px; background: var(--bg-card);
  border-radius: 12px; overflow: hidden; border: 1px solid var(--border);
}
.progress-fill {
  position: absolute; inset: 0; right: auto;
  background: var(--accent); border-radius: 12px;
  transition: width 0.3s;
}
.progress-text {
  position: relative; z-index: 1; display: flex; align-items: center;
  justify-content: center; height: 100%; font-size: 11px; font-weight: 600; color: white;
}

.assignment-list { display: flex; flex-direction: column; gap: 6px; }
.assignment-row.row-done { border-color: var(--success); opacity: 0.7; }
.assignment-row.row-active { border-color: var(--accent); }
.assignment-row.row-error { border-color: var(--danger); }
.assignment-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
}
.assignment-ep { display: flex; align-items: center; gap: 8px; flex-shrink: 0; min-width: 160px; }
.ep-badge {
  font-size: 11px; font-weight: 700; color: var(--accent);
  background: var(--accent-glow); padding: 3px 8px; border-radius: 4px;
}
.ep-name { font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.assignment-link {
  font-size: 11px; color: var(--text-muted); font-family: monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
}
.assignment-progress {
  display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;
}
.mini-progress-bar {
  flex: 1; height: 4px; background: var(--bg-secondary);
  border-radius: 2px; overflow: hidden;
}
.mini-progress-fill {
  height: 100%; background: var(--accent);
  border-radius: 2px; transition: width 0.3s;
}
.mini-progress-text {
  font-size: 10px; color: var(--accent); white-space: nowrap; flex-shrink: 0;
}
.assignment-status {
  font-size: 12px; font-weight: 600; flex-shrink: 0;
}
.assignment-status.downloading { color: var(--accent); }
.assignment-status.done { color: var(--success); }
.assignment-status.err { color: var(--danger); }

.modal-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 16px 24px; border-top: 1px solid var(--border);
}
</style>
