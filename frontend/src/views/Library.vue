<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getLibrary, deleteContent, getFolders, getFolderPath, createFolder, deleteFolder, moveContentToFolder, moveFolderToFolder } from '../api/client.js'

const router = useRouter()
const route = useRoute()

const items = ref([])
const folders = ref([])
const breadcrumb = ref([])
const filter = ref('all')
const loading = ref(true)
const addonUrl = ref('')
const copied = ref(false)
const showNewFolder = ref(false)
const newFolderName = ref('')

// Drag state
const dragging = ref(null)
const dragType = ref('')
const dragPos = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const dragActive = ref(false)
const dropTarget = ref(null)

const currentFolderId = computed(() => route.query.folder || null)

const installUrl = computed(() => {
  if (!addonUrl.value) return ''
  return `https://web.stremio.com/#/addons?addon=${encodeURIComponent(addonUrl.value)}`
})

const filtered = computed(() => {
  if (filter.value === 'all') return items.value
  return items.value.filter(i => i.type === filter.value)
})

function copyUrl() {
  try { navigator.clipboard.writeText(addonUrl.value) }
  catch {
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
  const fid = currentFolderId.value
  items.value = await getLibrary(null, fid)
  folders.value = await getFolders(fid)
  if (fid) {
    breadcrumb.value = await getFolderPath(fid)
  } else {
    breadcrumb.value = []
  }
  try {
    const res = await fetch('/api/server-info')
    addonUrl.value = (await res.json()).addonUrl
  } catch {}
  loading.value = false
}

async function remove(imdbId) {
  if (!confirm('Remove this from your library?')) return
  await deleteContent(imdbId)
  items.value = items.value.filter(i => i.imdb_id !== imdbId)
}

async function removeFolder(folderId) {
  if (!confirm('Delete this folder? Content inside will move to root.')) return
  await deleteFolder(folderId)
  folders.value = folders.value.filter(f => f.id !== folderId)
}

function navigateFolder(folderId) {
  router.push({ path: '/', query: folderId ? { folder: folderId } : {} })
}

async function addFolder() {
  if (!newFolderName.value.trim()) return
  const folder = await createFolder(newFolderName.value.trim(), currentFolderId.value)
  folders.value.push(folder)
  newFolderName.value = ''
  showNewFolder.value = false
}

// Drag & drop
function startDrag(e, item, type) {
  e.preventDefault()
  const rect = e.currentTarget.getBoundingClientRect()
  dragging.value = item
  dragType.value = type
  dragOffset.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  dragPos.value = { x: e.clientX, y: e.clientY }
  dragActive.value = true
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e) {
  dragPos.value = { x: e.clientX, y: e.clientY }

  const els = document.elementsFromPoint(e.clientX, e.clientY)
  const folderEl = els.find(el => el.closest?.('[data-folder-id]'))?.closest('[data-folder-id]')
  const breadEl = els.find(el => el.closest?.('[data-breadcrumb-id]'))?.closest('[data-breadcrumb-id]')

  if (folderEl) {
    const fid = folderEl.getAttribute('data-folder-id')
    if (dragType.value === 'folder' && dragging.value.id === fid) {
      dropTarget.value = null
    } else {
      dropTarget.value = fid
    }
  } else if (breadEl) {
    dropTarget.value = breadEl.getAttribute('data-breadcrumb-id')
  } else {
    dropTarget.value = null
  }
}

async function onDragEnd() {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)

  if (dropTarget.value && dragging.value) {
    const targetId = dropTarget.value === 'root' ? null : dropTarget.value
    if (dragType.value === 'content') {
      await moveContentToFolder(dragging.value.imdb_id, targetId)
    } else {
      await moveFolderToFolder(dragging.value.id, targetId)
    }
    await load()
  }

  dragActive.value = false
  dragging.value = null
  dragType.value = ''
  dropTarget.value = null
}

function isDragging(item, type) {
  return dragActive.value && dragging.value === item && dragType.value === type
}

onMounted(load)

// Reload on route query change (folder navigation)
import { watch } from 'vue'
watch(() => route.query.folder, () => load())
</script>

<template>
  <div class="library">
    <!-- Addon URL bar -->
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

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button
        class="crumb"
        :class="{ active: !breadcrumb.length, 'drop-hover': dropTarget === 'root' }"
        data-breadcrumb-id="root"
        @click="navigateFolder(null)"
      >
        Library
      </button>
      <template v-for="(folder, i) in breadcrumb" :key="folder.id">
        <span class="crumb-sep">/</span>
        <button
          class="crumb"
          :data-breadcrumb-id="folder.id"
          :class="{ active: i === breadcrumb.length - 1, 'drop-hover': dropTarget === folder.id }"
          @click="navigateFolder(folder.id)"
        >
          {{ folder.name }}
        </button>
      </template>
    </div>

    <!-- Header -->
    <div class="library-header">
      <div class="header-left">
        <button v-if="currentFolderId" class="back-btn" @click="navigateFolder(breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null)">&#8592;</button>
        <h1>{{ breadcrumb.length ? breadcrumb[breadcrumb.length - 1].name : 'My Library' }}</h1>
      </div>
      <div class="header-actions">
        <div class="filter-tabs">
          <button :class="{ active: filter === 'all' }" @click="filter = 'all'">All</button>
          <button :class="{ active: filter === 'movie' }" @click="filter = 'movie'">Movies</button>
          <button :class="{ active: filter === 'series' }" @click="filter = 'series'">Series</button>
        </div>
        <button class="btn-ghost" @click="showNewFolder = true">+ Folder</button>
        <button class="btn-primary" @click="router.push({ path: '/add', query: currentFolderId ? { folder: currentFolderId } : {} })">+ Add Content</button>
      </div>
    </div>

    <!-- empty placeholder to keep spacing -->

    <div v-if="loading" class="empty-state">Loading...</div>

    <div v-else-if="folders.length === 0 && filtered.length === 0" class="empty-state">
      <div class="empty-icon">&#127909;</div>
      <h2>{{ breadcrumb.length ? 'Empty folder' : 'No content yet' }}</h2>
      <p>{{ breadcrumb.length ? 'Add content or create subfolders.' : 'Add movies and series to start building your private library.' }}</p>
      <button class="btn-primary" @click="router.push({ path: '/add', query: currentFolderId ? { folder: currentFolderId } : {} })" style="margin-top: 16px">
        + Add Content
      </button>
    </div>

    <div v-else class="poster-grid">
      <!-- Folders -->
      <div
        v-for="folder in folders"
        :key="'f_' + folder.id"
        class="poster-card folder-card"
        :data-folder-id="folder.id"
        :class="{ 'ghost': isDragging(folder, 'folder'), 'drop-hover': dropTarget === folder.id }"
        @click="navigateFolder(folder.id)"
      >
        <div class="poster-image folder-image">
          <div class="folder-preview">
            <div v-if="folder.preview?.posters?.length || folder.preview?.subfolderCount" class="folder-grid">
              <div v-for="(p, i) in folder.preview.posters.slice(0, 4 - folder.preview.subfolderCount)" :key="'p'+i" class="folder-thumb">
                <img :src="p" />
              </div>
              <div v-for="n in Math.min(folder.preview.subfolderCount, 4 - (folder.preview.posters?.length || 0))" :key="'s'+n" class="folder-thumb subfolder-thumb">
                <span>&#128193;</span>
              </div>
            </div>
            <div v-else class="folder-empty-icon">&#128193;</div>
          </div>
          <div class="poster-overlay folder-hover-overlay">
            <div class="overlay-top">
              <span class="type-badge folder-badge">Folder</span>
              <div class="overlay-right">
                <div class="move-handle" @mousedown.stop="startDrag($event, folder, 'folder')" @click.stop title="Move">&#9776;</div>
                <button class="delete-btn" @click.stop="removeFolder(folder.id)" title="Delete folder">&#10005;</button>
              </div>
            </div>
            <div class="overlay-bottom">
              <span v-if="folder.preview?.stats?.movies">{{ folder.preview.stats.movies }} movie{{ folder.preview.stats.movies > 1 ? 's' : '' }}</span>
              <span v-if="folder.preview?.stats?.series">{{ folder.preview.stats.series }} series</span>
              <span v-if="folder.preview?.stats?.folders">{{ folder.preview.stats.folders }} folder{{ folder.preview.stats.folders > 1 ? 's' : '' }}</span>
              <span v-if="!folder.preview?.stats?.movies && !folder.preview?.stats?.series && !folder.preview?.stats?.folders" class="empty-hint">Empty</span>
            </div>
          </div>
        </div>
        <div class="poster-info">
          <div class="poster-title">{{ folder.name }}</div>
          <div class="poster-year">Folder</div>
        </div>
      </div>

      <!-- Content -->
      <div
        v-for="item in filtered"
        :key="item.imdb_id"
        class="poster-card"
        :class="{ 'ghost': isDragging(item, 'content') }"
        @click="router.push(`/content/${item.imdb_id}`)"
      >
        <div class="poster-image">
          <img v-if="item.poster" :src="item.poster" :alt="item.name" />
          <div v-else class="poster-placeholder">
            <span>{{ item.name[0] }}</span>
          </div>
          <div class="poster-overlay content-hover-overlay">
            <div class="overlay-top">
              <span class="type-badge">{{ item.type }}</span>
              <div class="overlay-right">
                <div class="move-handle" @mousedown.stop="startDrag($event, item, 'content')" @click.stop title="Move">&#9776;</div>
                <button class="delete-btn" @click.stop="remove(item.imdb_id)" title="Remove">&#10005;</button>
              </div>
            </div>
            <div class="overlay-bottom">
              <span v-if="item.year">{{ item.year }}</span>
              <span>{{ item.imdb_id }}</span>
            </div>
          </div>
        </div>
        <div class="poster-info">
          <div class="poster-title">{{ item.name }}</div>
          <div class="poster-year">{{ item.year || '—' }}</div>
        </div>
      </div>
    </div>

    <!-- New folder modal -->
    <div v-if="showNewFolder" class="modal-overlay" @click.self="showNewFolder = false">
      <div class="modal">
        <div class="modal-header">
          <h3>New Folder</h3>
          <button class="modal-close" @click="showNewFolder = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Folder name</label>
            <input
              v-model="newFolderName"
              placeholder="e.g. Anime, Movies 2024..."
              autofocus
              @keydown.enter="addFolder"
              @keydown.escape="showNewFolder = false"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showNewFolder = false">Cancel</button>
          <button class="btn-primary" @click="addFolder" :disabled="!newFolderName.trim()">Create Folder</button>
        </div>
      </div>
    </div>

    <!-- Drag ghost -->
    <div
      v-if="dragActive && dragging"
      class="drag-ghost"
      :style="{
        left: (dragPos.x - dragOffset.x) + 'px',
        top: (dragPos.y - dragOffset.y) + 'px'
      }"
    >
      <div class="drag-ghost-inner">
        <template v-if="dragType === 'content'">
          <img v-if="dragging.poster" :src="dragging.poster" class="drag-poster" />
          <div v-else class="drag-placeholder">{{ dragging.name[0] }}</div>
        </template>
        <template v-else>
          <div class="drag-folder-icon">&#128193;</div>
        </template>
        <div class="drag-name">{{ dragType === 'content' ? dragging.name : dragging.name }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Addon bar */
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
.addon-url { font-size: 13px; color: var(--accent); word-break: break-all; background: none; padding: 0; }
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

/* Breadcrumb */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 16px;
  font-size: 13px;
}
.breadcrumb { margin-left: -8px; }
.crumb {
  background: none;
  color: var(--text-muted);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}
.crumb:hover { color: var(--text-primary); background: var(--bg-hover); }
.crumb.active { color: var(--text-primary); font-weight: 600; }
.crumb.drop-hover { background: var(--accent-glow); color: var(--accent); transform: scale(1.05); }
.crumb-sep { color: var(--text-muted); }

/* Header */
.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.library-header h1 { font-size: 28px; font-weight: 700; }
.back-btn {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-secondary);
  font-size: 18px; cursor: pointer; transition: all 0.2s;
  padding: 0;
}
.back-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.header-actions { display: flex; align-items: center; gap: 10px; }
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
.filter-tabs button.active { background: var(--accent); color: white; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; backdrop-filter: blur(4px);
}
.modal {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius); width: 400px; max-width: 90vw;
  box-shadow: var(--shadow);
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px; border-bottom: 1px solid var(--border);
}
.modal-header h3 { font-size: 16px; font-weight: 600; margin: 0; }
.modal-close {
  background: none; color: var(--text-muted); font-size: 22px; padding: 0;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; cursor: pointer;
}
.modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.modal-body { padding: 20px 24px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.modal-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 16px 24px; border-top: 1px solid var(--border);
}

/* Grid */
.poster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 24px;
}

/* Poster card */
.poster-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
}
.poster-card:hover { transform: translateY(-4px); }
.poster-card.ghost { opacity: 0.3; pointer-events: none; }

.poster-image {
  position: relative;
  aspect-ratio: 2/3;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg-card);
}
.poster-image img { width: 100%; height: 100%; object-fit: cover; }
.poster-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 48px; font-weight: 700; color: var(--text-muted);
  background: linear-gradient(135deg, var(--bg-card), var(--bg-secondary));
}

.poster-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 35%, transparent 60%, rgba(0,0,0,0.75) 100%);
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
}
.poster-card:hover .poster-overlay { opacity: 1; }

.overlay-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.overlay-bottom {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: rgba(255,255,255,0.8);
  font-weight: 500;
}
.overlay-bottom .empty-hint { color: rgba(255,255,255,0.4); }
.overlay-right { display: flex; gap: 6px; align-items: center; }

.type-badge {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  background: var(--accent); color: white;
  padding: 3px 8px; border-radius: 4px;
}
.delete-btn {
  width: 28px; height: 28px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(239, 68, 68, 0.8); color: white;
  border-radius: 50%; font-size: 12px;
}
.delete-btn:hover { background: var(--danger); }

.move-handle {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.2);
  border-radius: 50%; font-size: 12px; color: white;
  cursor: grab; user-select: none;
}
.move-handle:hover { background: rgba(255,255,255,0.4); }
.move-handle:active { cursor: grabbing; }

.poster-info { padding: 10px 4px; }
.poster-title {
  font-size: 14px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.poster-year { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

/* Folder card */
.folder-card.drop-hover .folder-image {
  transform: scale(1.08);
  border: 2px solid var(--accent);
  box-shadow: 0 0 20px var(--accent-glow);
}

.folder-image {
  background: linear-gradient(135deg, #1a1b28, #12131a);
  transition: transform 0.2s, border 0.2s, box-shadow 0.2s;
}

.folder-preview {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}

.folder-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  width: 100%; height: 100%;
}
.folder-thumb {
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-card);
}
.folder-thumb img { width: 100%; height: 100%; object-fit: cover; }

.folder-empty-icon {
  font-size: 56px;
  opacity: 0.4;
}

.folder-badge { background: #334155; }

.subfolder-thumb {
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1e1f2e, #16171f);
  font-size: 24px;
}

/* Drag ghost */
.drag-ghost {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
  transition: none;
}
.drag-ghost-inner {
  width: 120px;
  background: var(--bg-secondary);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  padding: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  transform: rotate(-3deg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.drag-poster {
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
  border-radius: 6px;
}
.drag-placeholder {
  width: 100%; aspect-ratio: 2/3;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-card); border-radius: 6px;
  font-size: 28px; font-weight: 700; color: var(--text-muted);
}
.drag-folder-icon {
  font-size: 40px;
  padding: 12px 0;
}
.drag-name {
  font-size: 11px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%; text-align: center;
}

/* Empty */
.empty-state {
  text-align: center; padding: 80px 20px; color: var(--text-secondary);
}
.empty-icon { font-size: 64px; margin-bottom: 16px; }
.empty-state h2 { font-size: 22px; color: var(--text-primary); margin-bottom: 8px; }
</style>
