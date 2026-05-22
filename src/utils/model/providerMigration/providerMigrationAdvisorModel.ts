export function isArchivedAdvisorCapableModel(model: string): boolean {
  const m = model.toLowerCase()
  return (
    m.includes('opus-4-6') ||
    m.includes('sonnet-4-6') ||
    process.env.USER_TYPE === 'ant'
  )
}

export const isProviderMigrationAdvisorCapableModel = isArchivedAdvisorCapableModel
