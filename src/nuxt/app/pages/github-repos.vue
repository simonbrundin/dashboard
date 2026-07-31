<script setup lang="ts">
import type { GitHubRepo } from '~/types'

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UIcon = resolveComponent('UIcon')

const toast = useToast()

const { data, error } = await useFetch<GitHubRepo[]>('/api/github-repos', {
  lazy: true
})

const searchQuery = ref('')

const filteredRepos = computed(() => {
  if (!data.value) {
    return []
  }

  const query = searchQuery.value.toLowerCase()
  if (!query) {
    return data.value
  }

  return data.value.filter(
    repo =>
      repo.name.toLowerCase().includes(query)
      || repo.description?.toLowerCase().includes(query)
      || repo.language?.toLowerCase().includes(query)
      || repo.topics.some(t => t.toLowerCase().includes(query))
  )
})

const languageStats = computed(() => {
  if (!data.value) {
    return []
  }

  const langs: Record<string, number> = {}
  for (const repo of data.value) {
    if (repo.language) {
      langs[repo.language] = (langs[repo.language] || 0) + 1
    }
  }

  return Object.entries(langs)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

function getTopicColor(topic: string): 'primary' | 'success' | 'info' | 'warning' | 'error' {
  const colors: Array<'primary' | 'success' | 'info' | 'warning' | 'error'> = [
    'primary',
    'success',
    'info',
    'warning',
    'error'
  ]
  const index = topic.length % colors.length
  return colors[index]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function getRowActions(repo: GitHubRepo) {
  return [
    {
      type: 'label' as const,
      label: 'Actions'
    },
    {
      label: 'View on GitHub',
      icon: 'i-lucide-external-link',
      onSelect() {
        window.open(repo.html_url, '_blank')
      }
    },
    {
      label: 'Copy clone URL',
      icon: 'i-lucide-clipboard',
      onSelect() {
        navigator.clipboard.writeText(`git clone https://github.com/${repo.full_name}.git`)
        toast.add({
          title: 'Copied to clipboard',
          description: 'Clone URL copied to clipboard'
        })
      }
    },
    {
      label: 'Copy repo name',
      icon: 'i-lucide-copy',
      onSelect() {
        navigator.clipboard.writeText(repo.name)
        toast.add({
          title: 'Copied to clipboard',
          description: 'Repo name copied to clipboard'
        })
      }
    }
  ]
}
</script>

<template>
  <UDashboardPanel id="github-repos">
    <template #header>
      <UDashboardNavbar title="GitHub Repositories">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UBadge
            v-if="data"
            :label="`${data.length} repositories`"
            variant="subtle"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="error"
        class="flex flex-col items-center justify-center py-12 gap-4"
      >
        <UIcon name="i-lucide-alert-circle" class="size-12 text-error" />
        <p class="text-muted">
          Failed to load repositories
        </p>
        <p class="text-sm text-muted">
          {{ error.message }}
        </p>
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-1.5 mb-4">
          <UInput
            v-model="searchQuery"
            class="max-w-sm"
            icon="i-lucide-search"
            placeholder="Search repositories..."
          />

          <div class="flex items-center gap-2">
            <div class="text-sm text-muted">
              {{ filteredRepos.length }}
              {{ filteredRepos.length === 1 ? 'repository' : 'repositories' }}
            </div>
          </div>
        </div>

        <div v-if="languageStats.length > 0" class="flex flex-wrap gap-2 mb-4">
          <UBadge
            v-for="lang in languageStats"
            :key="lang.name"
            variant="outline"
            size="sm"
          >
            {{ lang.name }}: {{ lang.count }}
          </UBadge>
        </div>

        <div class="space-y-2">
          <div
            v-for="repo in filteredRepos"
            :key="repo.id"
            class="flex items-start justify-between p-4 rounded-lg border border-default hover:bg-elevated/50 transition-colors"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <UIcon
                  :name="repo.private ? 'i-lucide-lock' : 'i-lucide-globe'"
                  class="size-4 text-muted"
                />
                <a
                  :href="repo.html_url"
                  target="_blank"
                  class="font-medium text-highlighted hover:underline truncate"
                >
                  {{ repo.name }}
                </a>
                <UBadge
                  v-if="repo.private"
                  label="Private"
                  size="xs"
                  color="warning"
                />
              </div>

              <p v-if="repo.description" class="text-sm text-muted line-clamp-2 mb-2">
                {{ repo.description }}
              </p>

              <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
                <span v-if="repo.language" class="flex items-center gap-1">
                  {{ repo.language }}
                </span>

                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-star" class="size-4 text-yellow-500" />
                  {{ repo.stargazers_count }}
                </span>

                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-git-fork" class="size-4" />
                  {{ repo.forks_count }}
                </span>

                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-clock" class="size-4" />
                  {{ formatDate(repo.updated_at) }}
                </span>
              </div>

              <div v-if="repo.topics.length > 0" class="flex flex-wrap gap-1 mt-2">
                <UBadge
                  v-for="topic in repo.topics.slice(0, 8)"
                  :key="topic"
                  size="sm"
                  variant="subtle"
                  :color="getTopicColor(topic)"
                >
                  {{ topic }}
                </UBadge>
                <UBadge
                  v-if="repo.topics.length > 8"
                  size="sm"
                  variant="subtle"
                >
                  +{{ repo.topics.length - 8 }} more
                </UBadge>
              </div>
            </div>

            <UDropdownMenu
              :items="getRowActions(repo)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                class="ml-2 shrink-0"
              />
            </UDropdownMenu>
          </div>
        </div>

        <div
          v-if="filteredRepos.length === 0 && searchQuery"
          class="flex flex-col items-center justify-center py-12"
        >
          <UIcon name="i-lucide-search-x" class="size-12 text-muted mb-4" />
          <p class="text-muted">
            No repositories match your search
          </p>
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
