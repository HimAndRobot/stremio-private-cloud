<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-logo" @click="router.push('/')">
        <div class="logo-icon">&#9729;</div>
        <span class="logo-text">Private Cloud</span>
      </div>
      <div class="sidebar-nav">
        <router-link to="/" class="nav-item">
          <span class="nav-icon">&#9776;</span>
          Library
        </router-link>
        <router-link to="/add" class="nav-item">
          <span class="nav-icon">&#43;</span>
          Add Content
        </router-link>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 4px 8px;
}

.logo-icon {
  font-size: 28px;
  color: var(--accent);
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  text-decoration: none;
}
.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.nav-item.router-link-exact-active {
  background: var(--accent-glow);
  color: var(--accent);
}

.nav-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.main-content {
  flex: 1;
  margin-left: 240px;
  padding: 32px 40px;
  min-height: 100vh;
}
</style>
