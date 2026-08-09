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
      <div class="flex flex-col gap-4 home-content">
        <HomeFluxStatus />
        <HomeUptimeKuma />
        <HomeTokenUsage />
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
