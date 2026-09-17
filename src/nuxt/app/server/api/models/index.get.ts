import { readFile } from 'fs/promises'
import { join } from 'path'

interface LiveModelData {
  source: string
  updatedAt: string
  totalModels: number
  models: any[]
}

export default defineEventHandler(async (event) => {
  try {
    // Try to read live data first
    const liveDataPath = join(process.cwd(), 'app', 'data', 'models-live.json')
    
    try {
      const liveData = await readFile(liveDataPath, 'utf-8')
      const data: LiveModelData = JSON.parse(liveData)
      return data
    } catch {
      // Fallback: return null if no live data exists
      return {
        source: null,
        updatedAt: null,
        totalModels: 0,
        models: [],
        needsRefresh: true,
        message: 'No cached data available. Click "Update Data" to fetch from Artificial Analysis.'
      }
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to read models data'
    })
  }
})
