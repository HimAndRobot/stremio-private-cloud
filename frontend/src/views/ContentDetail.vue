<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getContent, deleteContent } from '../api/client.js'
import LinkModal from '../components/LinkModal.vue'
import FileRow from '../components/FileRow.vue'

const props = defineProps({ imdbId: String })
const router = useRouter()

const content = ref(null)
const files = ref([])
const meta = ref(null)
const loading = ref(true)

const showModal = ref(false)
const modalTarget = ref('')

// Group episodes by season from Cinemeta metadata
const seasons = computed(() => {
  if (!meta.value?.videos) return {}
  const grouped = {}
  for (const v of meta.value.videos) {
    if (v.season === undefined || v.season === 0) continue
    if (!grouped[v.season]) grouped[v.season] = []
    grouped[v.season].push(v)
  }
  for (const s of Object.values(grouped)) {
    s.sort((a, b) => a.episode - b.episode)
  }
  return grouped
})

const seasonNumbers = computed(() => Object.keys(seasons.value).map(Number).sort((a, b) => a - b))
const activeSeason = ref(1)

// Map of imdb video IDs to their files
const fileMap = computed(() => {
  const map = {}
  for (const f of files.value) {
    if (!map[f.imdb_id]) map[f.imdb_id] = []
    map[f.imdb_id].push(f)
  }
  return map
})

async function load() {
  loading.value = true
  try {
    const data = await getContent(props.imdbId)
    content.value = data
    files.value = data.files || []
    meta.value = data.meta || null
    if (seasonNumbers.value.length) activeSeason.value = seasonNumbers.value[0]
  } catch {
    content.value = null
  }
  loading.value = false
}

async function remove() {
  if (!confirm(`Remove "${content.value.name}" and all files from your library?`)) return
  await deleteContent(props.imdbId)
  router.push('/')
}

function onFileDeleted(fileId) {
  files.value = files.value.filter(f => f.id !== fileId)
}

function onFileUpdated(updated) {
  const idx = files.value.findIndex(f => f.id === updated.id)
  if (idx >= 0) files.value[idx] = updated
}

function openLink(videoId) {
  modalTarget.value = videoId
  showModal.value = true
}

function onLinked(result) {
  files.value.push(result)
  showModal.value = false
}

function formatSize(bytes) {
  if (!bytes) return '—'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}

onMounted(load)
</script>

<template>
  <div class="content-detail">
    <div v-if="loading" class="loading">Loading...</div>

    <template v-else-if="content">
      <!-- Hero -->
      <div class="hero">
        <button class="btn-ghost back-btn" @click="router.push('/')">&#8592; Library</button>
        <div class="hero-inner">
          <div class="hero-poster">
            <img v-if="content.poster" :src="content.poster" :alt="content.name" />
          </div>
          <div class="hero-info">
            <span class="type-badge">{{ content.type }}</span>
            <h1>{{ content.name }}</h1>
            <div class="hero-meta">
              <span v-if="content.year">{{ content.year }}</span>
              <span class="imdb-id">{{ content.imdb_id }}</span>
            </div>
            <p v-if="meta?.videos?.[0]?.overview || meta?.description" class="hero-description">
              {{ meta.description || meta.videos[0].overview }}
            </p>
            <div class="hero-actions">
              <a :href="`https://www.imdb.com/title/${content.imdb_id}`" target="_blank" class="btn-external" title="Open on IMDB">
                &#8599; IMDB
              </a>
              <button class="btn-danger" @click="remove">Remove from Library</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Movie: single file -->
      <div v-if="content.type === 'movie'" class="section">
        <div class="section-header">
          <h2>Files</h2>
          <button class="btn-primary" @click="openLink(content.imdb_id)">+ Add File</button>
        </div>
        <div v-if="fileMap[content.imdb_id]?.length" class="file-list">
          <FileRow
            v-for="f in fileMap[content.imdb_id]"
            :key="f.id"
            :file="f"
            @deleted="onFileDeleted"
            @updated="onFileUpdated"
          />
        </div>
        <div v-else class="no-files">No files yet. Click "+ Add File" to link one.</div>
      </div>

      <!-- Series: seasons / episodes -->
      <div v-if="content.type === 'series'" class="section">
        <div class="section-header">
          <h2>Episodes</h2>
        </div>

        <div v-if="seasonNumbers.length" class="season-tabs">
          <button
            v-for="s in seasonNumbers"
            :key="s"
            :class="{ active: activeSeason === s }"
            @click="activeSeason = s"
          >
            Season {{ s }}
          </button>
        </div>

        <div v-if="seasons[activeSeason]" class="episode-list">
          <div
            v-for="ep in seasons[activeSeason]"
            :key="ep.id"
            class="episode-card"
          >
            <div class="ep-header">
              <div class="ep-number">E{{ String(ep.episode).padStart(2, '0') }}</div>
              <div class="ep-info">
                <div class="ep-title">{{ ep.name || ep.title || `Episode ${ep.episode}` }}</div>
                <div v-if="ep.overview" class="ep-overview">{{ ep.overview }}</div>
              </div>
              <button
                class="btn-primary btn-sm"
                @click="openLink(`${content.imdb_id}:${ep.season}:${ep.episode}`)"
              >
                + Add File
              </button>
            </div>

            <!-- Files for this episode -->
            <div v-if="fileMap[`${content.imdb_id}:${ep.season}:${ep.episode}`]?.length" class="ep-files">
              <FileRow
                v-for="f in fileMap[`${content.imdb_id}:${ep.season}:${ep.episode}`]"
                :key="f.id"
                :file="f"
                compact
                @deleted="onFileDeleted"
                @updated="onFileUpdated"
              />
            </div>
          </div>
        </div>

        <div v-else class="no-files">
          No episode data available from Cinemeta.
        </div>
      </div>
    </template>

    <div v-else class="loading">Content not found.</div>

    <!-- Link Modal -->
    <LinkModal
      v-if="showModal"
      :target-id="modalTarget"
      @close="showModal = false"
      @linked="onLinked"
    />
  </div>
</template>

<style scoped>
.hero { margin-bottom: 32px; }
.back-btn { margin-bottom: 20px; }

.hero-inner { display: flex; gap: 32px; }
.hero-poster {
  width: 200px;
  flex-shrink: 0;
  border-radius: var(--radius);
  overflow: hidden;
  aspect-ratio: 2/3;
  background: var(--bg-card);
}
.hero-poster img { width: 100%; height: 100%; object-fit: cover; }
.hero-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}
.hero-info h1 { font-size: 32px; font-weight: 700; margin: 0; }
.type-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: var(--accent);
  color: white;
  padding: 3px 10px;
  border-radius: 4px;
  width: fit-content;
}
.hero-meta {
  display: flex;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
}
.imdb-id { font-family: monospace; color: var(--text-muted); }
.hero-description {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 500px;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hero-actions { margin-top: 12px; display: flex; gap: 8px; }
.btn-external {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
}
.btn-external:hover { background: var(--bg-hover); color: var(--text-primary); }

.section { margin-bottom: 32px; }
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.section-header h2 { font-size: 20px; font-weight: 600; }

.season-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 4px;
  width: fit-content;
  border: 1px solid var(--border);
}
.season-tabs button {
  padding: 8px 16px;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  font-size: 13px;
}
.season-tabs button:hover { color: var(--text-primary); }
.season-tabs button.active { background: var(--accent); color: white; }

.episode-list { display: flex; flex-direction: column; gap: 8px; }

.episode-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  transition: border-color 0.2s;
}
.episode-card:hover { border-color: var(--accent); }

.ep-header { display: flex; align-items: center; gap: 16px; }
.ep-number {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-glow);
  padding: 6px 10px;
  border-radius: 6px;
  flex-shrink: 0;
}
.ep-info { flex: 1; min-width: 0; }
.ep-title { font-weight: 600; font-size: 14px; }
.ep-overview {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ep-files {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-list { display: flex; flex-direction: column; gap: 8px; }

.no-files {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border-radius: var(--radius);
  border: 1px dashed var(--border);
}

.loading {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-secondary);
}
</style>
