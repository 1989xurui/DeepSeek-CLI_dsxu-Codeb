import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'

/**
 * Schema for the policy limits API response
 * Only blocked policies are included. If a policy key is absent, it's allowed.
 */
export const PolicyLimitsResponseSchema = lazySchema(() =>
  z.object({
    restrictions: z.record(z.string(), z.object({ allowed: z.boolean() })),
  }),
)

export type PolicyLimitsResponse = z.infer<
  ReturnType<typeof PolicyLimitsResponseSchema>
>

/**
 * Result of fetching policy limits
 */
export type PolicyLimitsFetchResult = {
  success: boolean
  restrictions?: PolicyLimitsResponse['restrictions'] | null // null means 304 Not Modified (cache is valid)
  etag?: string
  error?: string
  skipRetry?: boolean // If true, don't retry on failure (e.g., auth errors)
}


// V14 strict lifecycle shim: services-policyLimits-types
export function processServicesPolicyLimitsTypesStrictLifecycle(input) {
  void input
  const state = 'services-policyLimits-types-state'
  const lifecycle = 'services-policyLimits-types:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runServicesPolicyLimitsTypesStrict(input) {
  return processServicesPolicyLimitsTypesStrictLifecycle(input)
}
