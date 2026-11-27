// Laddar en resolver-hook som översätter Nuxt-aliasen "~/..." till riktiga
// filer. Node (och Bun) kan inte resolvinga aliasen utan Nuxt byggmiljön,
// vilket gjorde att alla enhetstester föll med:
//   Error [ERR_MODULE_NOT_FOUND]: Cannot find package '~' imported from app/utils/subscriptions.ts
import { register } from 'node:module'

register('./nuxt-alias-hooks.mjs', import.meta.url)
