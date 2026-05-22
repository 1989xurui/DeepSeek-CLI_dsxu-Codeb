export type IncidentSeverity = 'info' | 'warning' | 'critical'
export type IncidentCategory = 'test-failure' | 'cost-overrun' | 'runtime' | 'release'

export type Incident = {
  id: string
  severity: IncidentSeverity
  category: IncidentCategory
  module: string
  summary: string
  details: Record<string, unknown>
  timestamp: number
  resolved: boolean
  resolution?: string
  resolvedAt?: number
}

export type IncidentReporterOptions = {
  mockMode?: boolean
}

export class IncidentReporter {
  private incidents: Incident[] = []

  constructor(private readonly options: IncidentReporterOptions = {}) {}

  async report(input: Omit<Incident, 'id' | 'timestamp' | 'resolved'>): Promise<Incident> {
    const incident: Incident = {
      ...input,
      id: `INC-${Date.now().toString(36)}-${(this.incidents.length + 1)
        .toString()
        .padStart(4, '0')}`,
      timestamp: Date.now(),
      resolved: false,
    }
    this.incidents.push(incident)
    return incident
  }

  async list(filter?: {
    category?: IncidentCategory
    severity?: IncidentSeverity
    resolved?: boolean
  }): Promise<Incident[]> {
    return this.incidents.filter((incident) => {
      if (filter?.category && incident.category !== filter.category) return false
      if (filter?.severity && incident.severity !== filter.severity) return false
      if (filter?.resolved !== undefined && incident.resolved !== filter.resolved) return false
      return true
    })
  }

  async resolve(id: string, resolution: string): Promise<Incident | null> {
    const incident = this.incidents.find((item) => item.id === id)
    if (!incident) return null
    incident.resolved = true
    incident.resolution = resolution
    incident.resolvedAt = Date.now()
    return incident
  }

  async stats(): Promise<{
    total: number
    open: number
    bySeverity: Record<string, number>
    mockMode: boolean
  }> {
    const bySeverity: Record<string, number> = {}
    for (const incident of this.incidents) {
      bySeverity[incident.severity] = (bySeverity[incident.severity] ?? 0) + 1
    }
    return {
      total: this.incidents.length,
      open: this.incidents.filter((incident) => !incident.resolved).length,
      bySeverity,
      mockMode: this.options.mockMode === true,
    }
  }
}

export async function reportTestFailure(
  reporter: IncidentReporter,
  module: string,
  details: Record<string, unknown>
): Promise<Incident> {
  return reporter.report({
    severity: 'warning',
    category: 'test-failure',
    module,
    summary: `Test failure in ${module}`,
    details,
  })
}

export async function reportCostOverrun(
  reporter: IncidentReporter,
  module: string,
  actual: number,
  budget: number
): Promise<Incident> {
  return reporter.report({
    severity: 'critical',
    category: 'cost-overrun',
    module,
    summary: `Cost overrun in ${module}`,
    details: {
      actual,
      budget,
      overage: actual - budget,
    },
  })
}
