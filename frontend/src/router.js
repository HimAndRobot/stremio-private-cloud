import { createRouter, createWebHistory } from 'vue-router'
import Library from './views/Library.vue'
import ContentDetail from './views/ContentDetail.vue'
import AddContent from './views/AddContent.vue'
import Settings from './views/Settings.vue'

const routes = [
  { path: '/', name: 'library', component: Library },
  { path: '/content/:imdbId', name: 'content', component: ContentDetail, props: true },
  { path: '/add', name: 'add', component: AddContent },
  { path: '/settings', name: 'settings', component: Settings },
]

export default createRouter({
  history: createWebHistory('/admin/'),
  routes,
})
