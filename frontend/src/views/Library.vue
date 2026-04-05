<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getLibrary, deleteContent, getFolders, getFolderPath, createFolder, deleteFolder, renameFolder, moveContentToFolder, moveFolderToFolder } from '../api/client.js'
import MoveModal from '../components/MoveModal.vue'

const router = useRouter()
const route = useRoute()

const items = ref([])
const folders = ref([])
const breadcrumb = ref([])
const loading = ref(true)
const addonUrl = ref('')
const copied = ref(false)
const showNewFolder = ref(false)
const newFolderName = ref('')
const showFilter = ref(false)
const showRenameModal = ref(false)
const renameTarget = ref(null)
const renameValue = ref('')
const showMoveModal = ref(false)
const moveItem = ref(null)
const moveItemType = ref('')
let backDropTimer = null
const backDropProgress = ref(0)
let backDropInterval = null

// Per-folder filter state
const filterState = ref({})
const filter = computed({
  get: () => filterState.value[currentFolderId.value || '_root']?.type || 'all',
  set: (v) => {
    const key = currentFolderId.value || '_root'
    if (!filterState.value[key]) filterState.value[key] = {}
    filterState.value[key] = { ...filterState.value[key], type: v }
  }
})
const searchQuery = computed({
  get: () => filterState.value[currentFolderId.value || '_root']?.search || '',
  set: (v) => {
    const key = currentFolderId.value || '_root'
    if (!filterState.value[key]) filterState.value[key] = {}
    filterState.value[key] = { ...filterState.value[key], search: v }
  }
})

function clearFilters() {
  const key = currentFolderId.value || '_root'
  delete filterState.value[key]
}

const hasActiveFilter = computed(() => filter.value !== 'all' || searchQuery.value)

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

const filteredFolders = computed(() => {
  if (!searchQuery.value.trim()) return folders.value
  const q = searchQuery.value.toLowerCase()
  return folders.value.filter(f => f.name.toLowerCase().includes(q))
})

const filtered = computed(() => {
  let result = items.value
  if (filter.value !== 'all') result = result.filter(i => i.type === filter.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(i => i.name.toLowerCase().includes(q))
  }
  return result
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

function openRename(folder) {
  renameTarget.value = folder
  renameValue.value = folder.name
  showRenameModal.value = true
}

async function submitRename() {
  if (!renameValue.value.trim() || !renameTarget.value) return
  await renameFolder(renameTarget.value.id, renameValue.value.trim())
  showRenameModal.value = false
  await load()
}

function openMoveModal(item, type) {
  moveItem.value = item
  moveItemType.value = type
  showMoveModal.value = true
}

async function onMove(targetFolderId) {
  if (moveItemType.value === 'content') {
    await moveContentToFolder(moveItem.value.imdb_id, targetFolderId)
  } else {
    await moveFolderToFolder(moveItem.value.id, targetFolderId)
  }
  showMoveModal.value = false
  moveItem.value = null
  await load()
}

function clearBackDrop() {
  clearTimeout(backDropTimer)
  clearInterval(backDropInterval)
  backDropTimer = null
  backDropInterval = null
  backDropProgress.value = 0
}

async function addFolder() {
  if (!newFolderName.value.trim()) return
  const folder = await createFolder(newFolderName.value.trim(), currentFolderId.value)
  folders.value.push(folder)
  newFolderName.value = ''
  showNewFolder.value = false
}

// Combined move/drag handler - click opens modal, drag starts dragging
// Card: click opens view, drag starts dragging
function startCardAction(e, item, type, clickAction) {
  if (e.target.closest('button, a, .edit-btn, .move-btn, .delete-btn')) return
  const startX = e.clientX
  const startY = e.clientY
  const rect = e.currentTarget.getBoundingClientRect()

  function onMove(ev) {
    if (Math.abs(ev.clientX - startX) > 6 || Math.abs(ev.clientY - startY) > 6) {
      cleanup()
      dragging.value = item
      dragType.value = type
      dragOffset.value = { x: startX - rect.left, y: startY - rect.top }
      dragPos.value = { x: startX, y: startY }
      dragActive.value = true
      document.addEventListener('mousemove', onDragMove)
      document.addEventListener('mouseup', onDragEnd)
    }
  }
  function onUp() {
    cleanup()
    clickAction()
  }
  function cleanup() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function startMoveOrDrag(e, item, type) {
  e.preventDefault()
  e.stopPropagation()
  const startX = e.clientX
  const startY = e.clientY
  const rect = e.currentTarget.getBoundingClientRect()

  function onMove(ev) {
    if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) {
      cleanup()
      dragging.value = item
      dragType.value = type
      dragOffset.value = { x: startX - rect.left, y: startY - rect.top }
      dragPos.value = { x: startX, y: startY }
      dragActive.value = true
      document.addEventListener('mousemove', onDragMove)
      document.addEventListener('mouseup', onDragEnd)
    }
  }
  function onUp() {
    cleanup()
    openMoveModal(item, type)
  }
  function cleanup() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
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
  const backEl = els.find(el => el.closest?.('[data-back-drop]'))?.closest('[data-back-drop]')

  let newTarget = null

  if (backEl) {
    newTarget = '_back'
  } else if (folderEl) {
    const fid = folderEl.getAttribute('data-folder-id')
    if (!(dragType.value === 'folder' && dragging.value.id === fid)) {
      newTarget = fid
    }
  } else if (breadEl) {
    newTarget = breadEl.getAttribute('data-breadcrumb-id')
  }

  if (newTarget !== dropTarget.value) {
    clearBackDrop()
    dropTarget.value = newTarget

    if (newTarget === '_back') {
      backDropProgress.value = 0
      const startTime = Date.now()
      backDropInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        if (elapsed < 1000) {
          backDropProgress.value = 0
        } else {
          backDropProgress.value = Math.min((elapsed - 1000) / 2000, 1)
        }
      }, 30)
      backDropTimer = setTimeout(() => {
        clearInterval(backDropInterval)
        backDropInterval = null
        backDropProgress.value = 1
      }, 3000)
    }
  }
}

async function onDragEnd() {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  const wasReady = backDropProgress.value >= 1
  clearBackDrop()

  if (dropTarget.value && dragging.value) {
    if (dropTarget.value === '_back' && wasReady) {
      openMoveModal(dragging.value, dragType.value)
      dragActive.value = false
      dragging.value = null
      dropTarget.value = null
      return
    }

    let targetId = null
    if (dropTarget.value === '_back') {
      targetId = breadcrumb.value.length > 1
        ? breadcrumb.value[breadcrumb.value.length - 2].id
        : null
    } else if (dropTarget.value === 'root') {
      targetId = null
    } else {
      targetId = dropTarget.value
    }

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

function closeFilter(e) {
  if (showFilter.value && !e.target.closest('.filter-wrapper')) {
    showFilter.value = false
  }
}

onMounted(() => {
  load()
  document.addEventListener('click', closeFilter)
})

// Reload on route query change (folder navigation)
import { watch } from 'vue'
watch(() => route.query.folder, () => {
  showFilter.value = false
  load()
})
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
        <h1>{{ breadcrumb.length ? breadcrumb[breadcrumb.length - 1].name : 'My Library' }}</h1>
        <button v-if="breadcrumb.length" class="header-edit-btn" @click="openRename(breadcrumb[breadcrumb.length - 1])" title="Rename folder">&#9998;</button>
      </div>
      <div class="header-actions">
        <div class="filter-wrapper">
          <button class="btn-filter" :class="{ active: hasActiveFilter }" @click="showFilter = !showFilter">
            &#9776; Filter
            <span v-if="hasActiveFilter" class="filter-dot"></span>
          </button>
          <div v-if="showFilter" class="filter-dropdown" @click.stop>
            <div class="filter-section">
              <label class="filter-label">Type</label>
              <div class="filter-options">
                <button :class="{ active: filter === 'all' }" @click="filter = 'all'">All</button>
                <button :class="{ active: filter === 'movie' }" @click="filter = 'movie'">Movies</button>
                <button :class="{ active: filter === 'series' }" @click="filter = 'series'">Series</button>
              </div>
            </div>
            <div class="filter-section">
              <label class="filter-label">Search</label>
              <input v-model="searchQuery" placeholder="Filter by name..." class="filter-input" />
            </div>
            <button v-if="hasActiveFilter" class="filter-clear" @click="clearFilters()">Clear filters</button>
          </div>
        </div>
        <button class="btn-ghost" @click="showNewFolder = true">+ Folder</button>
        <button class="btn-primary" @click="router.push({ path: '/add', query: currentFolderId ? { folder: currentFolderId } : {} })">+ Add Content</button>
      </div>
    </div>

    <!-- empty placeholder to keep spacing -->

    <div v-if="loading" class="empty-state">Loading...</div>

    <div v-else-if="filteredFolders.length === 0 && filtered.length === 0" class="empty-state">
      <div class="empty-icon">&#127909;</div>
      <h2>{{ breadcrumb.length ? 'Empty folder' : 'No content yet' }}</h2>
      <p>{{ breadcrumb.length ? 'Add content or create subfolders.' : 'Add movies and series to start building your private library.' }}</p>
      <button class="btn-primary" @click="router.push({ path: '/add', query: currentFolderId ? { folder: currentFolderId } : {} })" style="margin-top: 16px">
        + Add Content
      </button>
    </div>

    <div v-else class="poster-grid">
      <!-- Back card (always visible inside a folder) -->
      <div
        v-if="currentFolderId"
        class="poster-card back-drop-card"
        :class="{ 'drop-hover': dropTarget === '_back', 'ready': backDropProgress >= 1 }"
        data-back-drop
        @click="!dragActive && navigateFolder(breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null)"
      >
        <div class="poster-image back-drop-image">
          <div class="back-drop-content">
            <div class="back-drop-icon-wrap">
              <svg v-if="dropTarget === '_back' && backDropProgress > 0 && backDropProgress < 1" class="back-drop-ring" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="21" fill="none" stroke="var(--border)" stroke-width="2" />
                <circle cx="24" cy="24" r="21" fill="none" stroke="var(--accent)" stroke-width="2"
                  :stroke-dasharray="`${backDropProgress * 131.9} 131.9`"
                  stroke-linecap="round" transform="rotate(-90 24 24)" />
              </svg>
              <div v-if="backDropProgress >= 1" class="back-drop-icon">&#8596;</div>
              <div v-else class="back-drop-icon">&#8592;</div>
            </div>
            <div class="back-drop-label">{{ backDropProgress >= 1 ? 'Move to...' : 'Back' }}</div>
          </div>
        </div>
      </div>

      <!-- Folders -->
      <div
        v-for="folder in filteredFolders"
        :key="'f_' + folder.id"
        class="poster-card folder-card"
        :data-folder-id="folder.id"
        :class="{ 'ghost': isDragging(folder, 'folder'), 'drop-hover': dropTarget === folder.id }"
        @mousedown="startCardAction($event, folder, 'folder', () => navigateFolder(folder.id))"
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
                <button class="edit-btn" @click.stop="openRename(folder)" title="Rename">&#9998;</button>
                <button class="move-btn" @click.stop="openMoveModal(folder, 'folder')" title="Move to...">&#8596;</button>
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
        @mousedown="startCardAction($event, item, 'content', () => router.push(`/content/${item.imdb_id}`))"
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
                <button class="move-btn" @click.stop="openMoveModal(item, 'content')" title="Move to...">&#8596;</button>
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

    <!-- Rename modal -->
    <div v-if="showRenameModal" class="modal-overlay" @click.self="showRenameModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>Rename Folder</h3>
          <button class="modal-close" @click="showRenameModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Folder name</label>
            <input
              v-model="renameValue"
              autofocus
              @keydown.enter="submitRename"
              @keydown.escape="showRenameModal = false"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showRenameModal = false">Cancel</button>
          <button class="btn-primary" @click="submitRename" :disabled="!renameValue.trim()">Rename</button>
        </div>
      </div>
    </div>

    <!-- Move modal -->
    <MoveModal
      v-if="showMoveModal && moveItem"
      :item-name="moveItemType === 'content' ? moveItem.name : moveItem.name"
      :current-folder-id="currentFolderId"
      @close="showMoveModal = false"
      @move="onMove"
    />

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
.filter-wrapper { position: relative; }
.btn-filter {
  padding: 8px 14px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.btn-filter:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-filter.active { border-color: var(--accent); color: var(--accent); }
.filter-dot {
  width: 6px; height: 6px;
  background: var(--accent);
  border-radius: 50%;
  position: absolute;
  top: 6px; right: 6px;
}

.filter-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  z-index: 50;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filter-section { display: flex; flex-direction: column; gap: 6px; }
.filter-label {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.filter-options { display: flex; gap: 4px; }
.filter-options button {
  flex: 1;
  padding: 6px 0;
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-options button:hover { color: var(--text-primary); }
.filter-options button.active { background: var(--accent); color: white; border-color: var(--accent); }
.filter-input {
  padding: 7px 10px;
  font-size: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  outline: none;
}
.filter-input:focus { border-color: var(--accent); }
.filter-input::placeholder { color: var(--text-muted); }
.filter-clear {
  padding: 6px;
  background: none;
  color: var(--danger);
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  border-radius: 4px;
}
.filter-clear:hover { background: rgba(239, 68, 68, 0.1); }

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
.poster-card, .poster-card * {
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
}
.poster-card {
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
}
.poster-card img { pointer-events: none; }
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
  gap: 8px;
  width: 100%; height: 100%;
}
.folder-thumb {
  border-radius: 6px;
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

/* Edit button */
.edit-btn {
  width: 28px; height: 28px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.2); color: white;
  border-radius: 50%; font-size: 14px; cursor: pointer;
}
.edit-btn:hover { background: rgba(255,255,255,0.4); }

.header-edit-btn {
  background: none; color: var(--text-muted);
  font-size: 18px; padding: 4px 8px;
  border-radius: var(--radius-sm); cursor: pointer;
}
.header-edit-btn:hover { color: var(--accent); background: var(--bg-hover); }

/* Move button */
.move-btn {
  width: 28px; height: 28px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(124, 92, 252, 0.6); color: white;
  border-radius: 50%; font-size: 14px; cursor: pointer;
}
.move-btn:hover { background: var(--accent); }

/* Back drop card */
.back-drop-card { pointer-events: auto; }
.back-drop-image {
  background: linear-gradient(135deg, #1a1b28, #12131a);
  display: flex; align-items: center; justify-content: center;
}
.back-drop-content {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.back-drop-icon-wrap {
  position: relative;
  width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
}
.back-drop-icon {
  font-size: 28px; color: var(--text-muted);
  transition: all 0.3s;
  z-index: 1;
}
.back-drop-card.drop-hover .back-drop-icon { color: var(--accent); }
.back-drop-card.ready .back-drop-icon { color: var(--accent); font-size: 32px; }
.back-drop-label {
  font-size: 13px; color: var(--text-muted); font-weight: 500;
  transition: color 0.2s;
}
.back-drop-card.drop-hover .back-drop-label { color: var(--text-primary); }
.back-drop-card.drop-hover .back-drop-image {
  border: 2px dashed var(--accent);
  border-radius: var(--radius);
}
.back-drop-card:not(.drop-hover):not(.ready) { cursor: pointer; }
.back-drop-card:not(.drop-hover):not(.ready):hover .back-drop-icon { color: var(--accent); }
.back-drop-card:not(.drop-hover):not(.ready):hover .back-drop-label { color: var(--text-primary); }
.back-drop-ring {
  position: absolute;
  width: 48px; height: 48px;
  top: 0; left: 0;
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
