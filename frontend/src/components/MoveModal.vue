<script setup>
import { ref, onMounted, computed } from 'vue'
import { getFolders, getFolderPath } from '../api/client.js'

const props = defineProps({
  itemName: String,
  currentFolderId: { type: String, default: null },
})
const emit = defineEmits(['close', 'move'])

const browsing = ref(null)
const browsingFolders = ref([])
const breadcrumb = ref([])
const loading = ref(false)

const browsingLabel = computed(() => {
  if (!breadcrumb.value.length) return 'Library'
  return breadcrumb.value[breadcrumb.value.length - 1].name
})

async function navigate(folderId) {
  loading.value = true
  browsing.value = folderId
  browsingFolders.value = await getFolders(folderId)
  if (folderId) {
    breadcrumb.value = await getFolderPath(folderId)
  } else {
    breadcrumb.value = []
  }
  loading.value = false
}

function goUp() {
  if (breadcrumb.value.length > 1) {
    navigate(breadcrumb.value[breadcrumb.value.length - 2].id)
  } else {
    navigate(null)
  }
}

function selectFolder(folderId) {
  emit('move', folderId)
}

onMounted(() => navigate(null))
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal move-modal">
      <div class="modal-header">
        <h3>Move "{{ itemName }}"</h3>
        <button class="modal-close" @click="emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <p class="move-hint">Select a destination folder:</p>

        <!-- Breadcrumb inside modal -->
        <div class="move-breadcrumb">
          <button class="move-crumb" :class="{ active: !browsing }" @click="navigate(null)">Library</button>
          <template v-for="(f, i) in breadcrumb" :key="f.id">
            <span class="move-sep">/</span>
            <button
              class="move-crumb"
              :class="{ active: i === breadcrumb.length - 1 }"
              @click="navigate(f.id)"
            >{{ f.name }}</button>
          </template>
        </div>

        <!-- Move here button -->
        <button
          class="move-here-btn"
          :class="{ disabled: browsing === currentFolderId }"
          :disabled="browsing === currentFolderId"
          @click="selectFolder(browsing)"
        >
          &#8594; Move here{{ browsing === currentFolderId ? ' (current location)' : '' }}
        </button>

        <!-- Folder list -->
        <div v-if="loading" class="move-loading">Loading...</div>
        <div v-else class="move-folder-list">
          <div v-if="browsing" class="move-folder-item back" @click="goUp">
            <span class="move-folder-icon">&#8592;</span>
            <span>Back</span>
          </div>
          <div
            v-for="f in browsingFolders"
            :key="f.id"
            class="move-folder-item"
            :class="{ current: f.id === currentFolderId }"
          >
            <div class="move-folder-row" @click="navigate(f.id)">
              <span class="move-folder-icon">&#128193;</span>
              <span class="move-folder-name">{{ f.name }}</span>
              <span class="move-folder-arrow">&#8250;</span>
            </div>
            <button
              class="move-select-btn"
              :class="{ disabled: f.id === currentFolderId }"
              :disabled="f.id === currentFolderId"
              @click.stop="selectFolder(f.id)"
            >
              {{ f.id === currentFolderId ? 'Current' : 'Move here' }}
            </button>
          </div>
          <div v-if="!browsingFolders.length && !browsing" class="move-empty">No folders yet</div>
          <div v-if="!browsingFolders.length && browsing" class="move-empty">No subfolders</div>
        </div>
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
.move-modal {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius); width: 440px; max-width: 90vw;
  box-shadow: var(--shadow); max-height: 80vh; display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px; border-bottom: 1px solid var(--border);
}
.modal-header h3 {
  font-size: 16px; font-weight: 600; margin: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 340px;
}
.modal-close {
  background: none; color: var(--text-muted); font-size: 22px; padding: 0;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; cursor: pointer;
}
.modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }

.modal-body {
  padding: 16px 24px 20px;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px;
}
.move-hint { font-size: 13px; color: var(--text-muted); }

.move-breadcrumb {
  display: flex; align-items: center; gap: 2px;
  font-size: 12px; flex-wrap: wrap;
}
.move-crumb {
  background: none; color: var(--text-muted); padding: 3px 6px;
  border-radius: 4px; cursor: pointer; font-size: 12px;
}
.move-crumb:hover { color: var(--text-primary); background: var(--bg-hover); }
.move-crumb.active { color: var(--text-primary); font-weight: 600; }
.move-sep { color: var(--text-muted); font-size: 12px; }

.move-here-btn {
  width: 100%; padding: 10px;
  background: var(--accent-glow); color: var(--accent);
  border: 1px dashed var(--accent); border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.2s;
}
.move-here-btn:hover:not(.disabled) { background: var(--accent); color: white; border-style: solid; }
.move-here-btn.disabled { opacity: 0.4; cursor: not-allowed; }

.move-folder-list {
  display: flex; flex-direction: column; gap: 4px;
}

.move-folder-item {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-sm); overflow: hidden;
  transition: border-color 0.2s;
}
.move-folder-item:hover { border-color: var(--accent); }
.move-folder-item.current { opacity: 0.5; }
.move-folder-item.back {
  cursor: pointer; padding: 10px 14px;
  gap: 10px; font-size: 13px; color: var(--text-secondary);
}
.move-folder-item.back:hover { color: var(--text-primary); }

.move-folder-row {
  flex: 1; display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer;
  font-size: 13px; min-width: 0;
}
.move-folder-icon { font-size: 16px; flex-shrink: 0; }
.move-folder-name {
  flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-weight: 500;
}
.move-folder-arrow { color: var(--text-muted); font-size: 16px; }

.move-select-btn {
  padding: 6px 12px; margin-right: 8px;
  background: var(--bg-secondary); color: var(--text-secondary);
  border: 1px solid var(--border); border-radius: 6px;
  font-size: 11px; font-weight: 500; cursor: pointer;
  white-space: nowrap; flex-shrink: 0;
  transition: all 0.15s;
}
.move-select-btn:hover:not(.disabled) { background: var(--accent); color: white; border-color: var(--accent); }
.move-select-btn.disabled { opacity: 0.4; cursor: not-allowed; }

.move-empty { text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px; }
.move-loading { text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px; }
</style>
