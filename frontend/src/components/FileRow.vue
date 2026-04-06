<script setup>
import { ref } from 'vue'
import { renameFile, deleteFile } from '../api/client.js'

const props = defineProps({
  file: Object,
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['deleted', 'updated'])

const editing = ref(false)
const editName = ref('')

function startEdit() {
  editName.value = props.file.file_name
  editing.value = true
}

async function submitEdit() {
  if (!editName.value.trim()) return
  const updated = await renameFile(props.file.id, editName.value.trim())
  editing.value = false
  emit('updated', updated)
}

async function remove() {
  await deleteFile(props.file.id)
  emit('deleted', props.file.id)
}

function formatSize(bytes) {
  if (!bytes) return '—'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}
</script>

<template>
  <div class="file-row" :class="{ compact }">
    <div class="file-icon">&#128196;</div>
    <div class="file-info">
      <div v-if="editing" class="file-name-edit">
        <input v-model="editName" @keydown.enter="submitEdit" @keydown.escape="editing = false" autofocus />
        <button class="btn-primary btn-xs" @click="submitEdit">Save</button>
        <button class="btn-ghost btn-xs" @click="editing = false">Cancel</button>
      </div>
      <div v-else class="file-name">{{ file.file_name }}</div>
      <div class="file-meta">
        <span v-if="file.source_type === 'gdrive'" class="source-badge gdrive">GDrive</span>
        <span v-else-if="file.source_type === 'mega'" class="source-badge mega">MEGA</span>
        <span v-else-if="file.source_type === 'telegram'" class="source-badge telegram">Telegram</span>
        <span v-else-if="file.source_type === 'youtube'" class="source-badge youtube">YouTube</span>
        <span v-else-if="file.source_type === 'upload'" class="source-badge upload">Storage</span>
        <span v-else class="source-badge local">Local</span>
        {{ file.quality || '—' }} &middot; {{ formatSize(file.file_size) }}
      </div>
    </div>
    <div class="file-actions">
      <button class="btn-ext btn-sm" @click="startEdit" title="Rename">&#9998;</button>
      <a v-if="file.source_type !== 'local' && file.source_type !== 'upload'" :href="file.file_path" target="_blank" class="btn-ext btn-sm" title="Open source link">&#8599;</a>
      <button class="btn-danger btn-sm" @click="remove">Delete</button>
    </div>
  </div>
</template>

<style scoped>
.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.file-row.compact { padding: 8px 12px; background: var(--bg-card); }

.file-icon { font-size: 20px; flex-shrink: 0; }
.file-info { flex: 1; min-width: 0; }
.file-name {
  font-size: 13px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.file-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.source-badge {
  display: inline-block;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  padding: 1px 6px; border-radius: 3px; margin-right: 4px;
}
.source-badge.local { background: #1a3a2a; color: #22c55e; }
.source-badge.gdrive { background: #1a2a3a; color: #60a5fa; }
.source-badge.mega { background: #3a1a1a; color: #f87171; }
.source-badge.telegram { background: #1a2a3a; color: #38bdf8; }
.source-badge.youtube { background: #3a1a1a; color: #ef4444; }
.source-badge.upload { background: #2a1a3a; color: #c084fc; }

.file-actions { display: flex; gap: 6px; flex-shrink: 0; }
.btn-ext {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 6px 10px;
  background: var(--bg-card); color: var(--text-secondary);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-size: 14px; text-decoration: none; transition: all 0.2s;
  cursor: pointer;
}
.btn-ext:hover { background: var(--bg-hover); color: var(--accent); }
.btn-sm { padding: 6px 14px; font-size: 12px; }
.btn-xs { padding: 4px 10px; font-size: 11px; }

.file-name-edit { display: flex; gap: 6px; align-items: center; }
.file-name-edit input {
  flex: 1; padding: 4px 8px; font-size: 13px;
  background: var(--bg-input); border: 1px solid var(--accent);
  border-radius: 4px; color: var(--text-primary); outline: none;
  font-family: inherit;
}
</style>
