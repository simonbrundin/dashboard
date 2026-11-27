import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appDir = fileURLToPath(new URL('../app/', import.meta.url))

const CANDIDATES = ['.ts', '.tsx', '.mts', '.js', '/index.ts']

/**
 * Löser "~/..." och "~~/..." (Nuxt-aliasen) till filer under app/.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '~' || specifier.startsWith('~/') || specifier.startsWith('~~/')) {
    const relative = specifier.replace(/^~{1,2}\//, '')
    const base = path.join(appDir, relative)
    const resolved = resolveWithExtension(base)
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context)
  }

  // Relativa importer utan filändelse (t.ex. '../../shared/utils/modelEffort')
  // fungerar i Nuxt men inte i Node - lägg till ändelsen här.
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd()
    const base = path.resolve(path.dirname(parentPath), specifier)
    const resolved = resolveWithExtension(base)
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context)
  }

  return nextResolve(specifier, context)
}

function resolveWithExtension(base) {
  for (const suffix of CANDIDATES) {
    const candidate = base + suffix
    if (existsSync(candidate)) return candidate
  }
  return null
}
