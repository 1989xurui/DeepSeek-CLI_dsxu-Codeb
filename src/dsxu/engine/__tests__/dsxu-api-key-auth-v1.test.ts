import { afterEach, describe, expect, test } from 'bun:test'
import {
  getProviderApiKeyWithSource,
  isProviderAuthEnabled,
} from '../../../services/auth/dsxuProviderAuth'

const SAVED_ENV = {
  DSXU_CODE_MODE: process.env.DSXU_CODE_MODE,
  DSXU_API_KEY: process.env.DSXU_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  DSXU_DEEPSEEK_API_KEY: process.env.DSXU_DEEPSEEK_API_KEY,
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(SAVED_ENV)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

describe('DSXU API key auth V1', () => {
  afterEach(restoreEnv)

  test('treats DeepSeek env keys as valid DSXU direct model credentials', () => {
    process.env.DSXU_CODE_MODE = '1'
    delete process.env.DSXU_API_KEY
    process.env.DEEPSEEK_API_KEY = 'sk-test-deepseek'
    delete process.env.DSXU_DEEPSEEK_API_KEY

    const source = getProviderApiKeyWithSource({
      skipRetrievingKeyFromApiKeyHelper: true,
    })

    expect(source.source).toBe('DEEPSEEK_API_KEY')
    expect(source.key).toBe('sk-test-deepseek')
    expect(isProviderAuthEnabled()).toBe(false)
  })

  test('uses DSXU_API_KEY before provider-specific aliases in DSXU mode', () => {
    process.env.DSXU_CODE_MODE = '1'
    process.env.DSXU_API_KEY = 'sk-test-dsxu'
    process.env.DEEPSEEK_API_KEY = 'sk-test-deepseek'
    process.env.DSXU_DEEPSEEK_API_KEY = 'sk-test-dsxu-deepseek'

    const source = getProviderApiKeyWithSource({
      skipRetrievingKeyFromApiKeyHelper: true,
    })

    expect(source.source).toBe('DSXU_API_KEY')
    expect(source.key).toBe('sk-test-dsxu')
  })
})
