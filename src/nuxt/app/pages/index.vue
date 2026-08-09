<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 home-content">
        <div class="flex flex-col gap-4 w-full">
          <HomeUptimeKuma />
          <HomeFluxStatus />
        </div>
        <div class="self-start">
          <HomeTokenUsage />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.home-content {
  overflow: visible !important;
}

.home-content > * {
  overflow: visible !important;
  max-height: none !important;
}
</style>
