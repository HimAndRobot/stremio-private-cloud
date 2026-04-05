<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { searchCinemeta, addContent } from '../api/client.js'

const router = useRouter()
const query = ref('')
const results = ref([])
const searching = ref(false)
const adding = ref(null)
let debounce = null

function onSearch() {
  clearTimeout(debounce)
  if (!query.value.trim()) { results.value = []; return }
  debounce = setTimeout(async () => {
    searching.value = true
    try {
      results.value = await searchCinemeta(query.value)
    } catch { results.value = [] }
    searching.value = false
  }, 400)
}

async function add(item) {
  adding.value = item.imdb_id
  try {
    await addContent(item.imdb_id, item.type)
    router.push(`/content/${item.imdb_id}`)
  } catch (e) {
    if (e.message.includes('Already')) {
      router.push(`/content/${item.imdb_id}`)
    } else {
      alert(e.message)
    }
  }
  adding.value = null
}
</script>

<template>
  <div class="add-content">
    <div class="page-header">
      <button class="btn-ghost" @click="router.push('/')">&#8592; Back</button>
      <h1>Add Content</h1>
    </div>

    <div class="search-box">
      <input
        v-model="query"
        @input="onSearch"
        placeholder="Search movies and series... (e.g. Breaking Bad, Inception)"
        autofocus
      />
      <div v-if="searching" class="search-hint">Searching...</div>
    </div>

    <div v-if="results.length" class="search-results">
      <div v-for="item in results" :key="item.imdb_id" class="result-card">
        <div class="result-poster">
          <img v-if="item.poster" :src="item.poster" :alt="item.name" />
          <div v-else class="result-placeholder">{{ item.name[0] }}</div>
        </div>
        <div class="result-info">
          <div class="result-title">{{ item.name }}</div>
          <div class="result-meta">
            <span class="result-type">{{ item.type }}</span>
            <span v-if="item.year">{{ item.year }}</span>
            <span class="result-imdb">{{ item.imdb_id }}</span>
          </div>
        </div>
        <button
          class="btn-primary"
          @click="add(item)"
          :disabled="adding === item.imdb_id"
        >
          {{ adding === item.imdb_id ? 'Adding...' : '+ Add' }}
        </button>
      </div>
    </div>

    <div v-else-if="query && !searching" class="empty-state">
      <p>No results found. Try a different search term.</p>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}
.page-header h1 {
  font-size: 28px;
  font-weight: 700;
}

.search-box {
  position: relative;
  margin-bottom: 24px;
}
.search-box input {
  width: 100%;
  padding: 14px 20px;
  font-size: 16px;
  border-radius: var(--radius);
  background: var(--bg-secondary);
  border: 2px solid var(--border);
}
.search-box input:focus { border-color: var(--accent); }
.search-hint {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 13px;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 0.2s;
}
.result-card:hover { border-color: var(--accent); }

.result-poster {
  width: 48px;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-card);
}
.result-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.result-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 20px;
}

.result-info { flex: 1; min-width: 0; }
.result-title {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.result-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.result-type {
  text-transform: uppercase;
  font-weight: 600;
  color: var(--accent);
  font-size: 11px;
  background: var(--accent-glow);
  padding: 2px 6px;
  border-radius: 4px;
}
.result-imdb { font-family: monospace; }

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}
</style>
