<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getLibrary, deleteContent } from '../api/client.js'

const router = useRouter()
const items = ref([])
const filter = ref('all')
const loading = ref(true)
const addonUrl = ref('')
const copied = ref(false)

const installUrl = computed(() => {
  if (!addonUrl.value) return ''
  return `https://web.stremio.com/#/addons?addon=${encodeURIComponent(addonUrl.value)}`
})

const filtered = computed(() => {
  if (filter.value === 'all') return items.value
  return items.value.filter(i => i.type === filter.value)
})

function copyUrl() {
  try {
    navigator.clipboard.writeText(addonUrl.value)
  } catch {
    const el = document.createElement('textarea')
    el.value = addonUrl.value
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

async function load() {
  loading.value = true
  items.value = await getLibrary()
  try {
    const res = await fetch('/api/server-info')
    const info = await res.json()
    addonUrl.value = info.addonUrl
  } catch { /* ignore */ }
  loading.value = false
}

async function remove(imdbId) {
  if (!confirm('Remove this from your library? All linked files will be unlinked.')) return
  await deleteContent(imdbId)
  items.value = items.value.filter(i => i.imdb_id !== imdbId)
}

onMounted(load)
</script>

<template>
  <div class="library">
    <div v-if="addonUrl" class="addon-bar">
      <div class="addon-left">
        <span class="addon-label">Addon URL</span>
        <code class="addon-url">{{ addonUrl }}</code>
      </div>
      <div class="addon-actions">
        <button class="btn-copy" @click="copyUrl">{{ copied ? 'Copied!' : 'Copy' }}</button>
        <a :href="'stremio://' + addonUrl.replace('https://','')" class="btn-install">Install</a>
        <a :href="installUrl" class="btn-install web" target="_blank">Web</a>
      </div>
    </div>

    <div class="library-header">
      <h1>My Library</h1>
      <div class="header-actions">
        <div class="filter-tabs">
          <button :class="{ active: filter === 'all' }" @click="filter = 'all'">All</button>
          <button :class="{ active: filter === 'movie' }" @click="filter = 'movie'">Movies</button>
          <button :class="{ active: filter === 'series' }" @click="filter = 'series'">Series</button>
        </div>
        <button class="btn-primary" @click="router.push('/add')">+ Add Content</button>
      </div>
    </div>

    <div v-if="loading" class="empty-state">Loading...</div>

    <div v-else-if="filtered.length === 0" class="empty-state">
      <div class="empty-icon">&#127909;</div>
      <h2>No content yet</h2>
      <p>Add movies and series to start building your private library.</p>
      <button class="btn-primary" @click="router.push('/add')" style="margin-top: 16px">
        + Add Content
      </button>
    </div>

    <div v-else class="poster-grid">
      <div
        v-for="item in filtered"
        :key="item.imdb_id"
        class="poster-card"
        @click="router.push(`/content/${item.imdb_id}`)"
      >
        <div class="poster-image">
          <img v-if="item.poster" :src="item.poster" :alt="item.name" />
          <div v-else class="poster-placeholder">
            <span>{{ item.name[0] }}</span>
          </div>
          <div class="poster-overlay">
            <span class="type-badge">{{ item.type }}</span>
            <button class="delete-btn" @click.stop="remove(item.imdb_id)" title="Remove">&#10005;</button>
          </div>
        </div>
        <div class="poster-info">
          <div class="poster-title">{{ item.name }}</div>
          <div class="poster-year">{{ item.year || '—' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.addon-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 24px;
}
.addon-left { display: flex; flex-direction: column; gap: 4px; }
.addon-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; }
.addon-url {
  font-size: 13px;
  color: var(--accent);
  word-break: break-all;
  background: none;
  padding: 0;
}
.addon-actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn-copy {
  padding: 8px 16px;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-copy:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-install {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s;
}
.btn-install:hover { background: var(--accent-hover); color: white; }
.btn-install.web { background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border); }
.btn-install.web:hover { background: var(--bg-hover); color: var(--text-primary); }

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}
.library-header h1 {
  font-size: 28px;
  font-weight: 700;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.filter-tabs {
  display: flex;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  overflow: hidden;
}
.filter-tabs button {
  padding: 8px 16px;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 0;
  font-size: 13px;
}
.filter-tabs button:hover { color: var(--text-primary); }
.filter-tabs button.active {
  background: var(--accent);
  color: white;
}

.poster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 24px;
}

.poster-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.poster-card:hover {
  transform: translateY(-4px);
}

.poster-image {
  position: relative;
  aspect-ratio: 2/3;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg-card);
}
.poster-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 700;
  color: var(--text-muted);
  background: linear-gradient(135deg, var(--bg-card), var(--bg-secondary));
}

.poster-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.7) 100%);
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
}
.poster-card:hover .poster-overlay { opacity: 1; }

.type-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: var(--accent);
  color: white;
  padding: 3px 8px;
  border-radius: 4px;
}
.delete-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.8);
  color: white;
  border-radius: 50%;
  font-size: 12px;
}
.delete-btn:hover { background: var(--danger); }

.poster-info {
  padding: 10px 4px;
}
.poster-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.poster-year {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-secondary);
}
.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}
.empty-state h2 {
  font-size: 22px;
  color: var(--text-primary);
  margin-bottom: 8px;
}
</style>
