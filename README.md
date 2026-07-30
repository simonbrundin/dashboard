# Dashboard

## Arkitektur

```mermaid
flowchart TB
    subgraph Client["Klient (Browser)"]
        app["app.vue"]
        layout["layouts/default.vue"]
        page["pages/index.vue"]
        budget["components/MinimaxBudget.vue"]
        composable["composables/useDashboard.ts"]
    end

    subgraph Server["Server (Nuxt Server)"]
        api["server/api/minimax/budget.get.ts"]
        miniMaxAPI["MiniMax API\napi.minimax.io"]
    end

    app --> layout
    app --> composable
    layout --> page
    page --> budget
    page --> statusCheck["Status Checker\n(plan.simonbrundin.com)"]
    budget --> api
    composable --> composable

    api --> miniMaxAPI

    style miniMaxAPI fill:#ff6b6b,color:#fff
    style statusCheck fill:#4ecdc4,color:#fff
```

### Dataflöde

```mermaid
sequenceDiagram
    participant User as Användare
    participant Page as pages/index.vue
    participant Budget as MinimaxBudget.vue
    participant API as budget.get.ts
    participant MiniMax as MiniMax API

    User->>Page: Öppnar sidan
    Page->>Budget: Renderar
    Budget->>API: useFetch('/api/minimax/budget')
    API->>MiniMax: GET /v1/token_plan/remains
    MiniMax-->>API: { quota, used, remaining }
    API-->>Budget: { quota, used, remaining, percentage }
    Budget-->>User: Visar budget-ring
```

## Beslut

Det här projektet använder **nub** som package manager i Nuxt i stället för
npm/yarn/pnpm.

## Idéer

- Få med Flux status
- Få med DORA metrics per applikation
- Få med Talos status
- Få med Longhorn status
