import { afterEach, describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  evaluateProductCoreGuard,
  getProductCoreGuardRootsFromEnv,
} from '../workspace-policy.js'
import { checkPathSafetyForAutoEdit } from '../../../utils/permissions/filesystem.js'

const OLD_ENV = {
  DSXU_PRODUCT_CORE_ROOT: process.env.DSXU_PRODUCT_CORE_ROOT,
  DSXU_PRODUCT_CORE_ROOTS: process.env.DSXU_PRODUCT_CORE_ROOTS,
  DSXU_INSTALL_ROOT: process.env.DSXU_INSTALL_ROOT,
  DSXU_ALLOW_PRODUCT_CORE_MUTATION: process.env.DSXU_ALLOW_PRODUCT_CORE_MUTATION,
  DSXU_DEV_ALLOW_CORE_MUTATION: process.env.DSXU_DEV_ALLOW_CORE_MUTATION,
}

afterEach(() => {
  for (const [key, value] of Object.entries(OLD_ENV)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

describe('Product Core Guard', () => {
  test('blocks write actions inside DSXU product core roots', () => {
    const root = resolve(tmpdir(), 'dsxu-product-core')
    const decision = evaluateProductCoreGuard({
      path: join(root, 'src', 'query.ts'),
      action: 'write',
      protectedRoots: [root],
    })

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('Product Core Guard')
    expect(decision.matchedRoot).toBe(root)
  })

  test('allows read actions and paths outside product core roots', () => {
    const root = resolve(tmpdir(), 'dsxu-product-core')
    const project = resolve(tmpdir(), 'user-project')

    expect(evaluateProductCoreGuard({
      path: join(root, 'src', 'query.ts'),
      action: 'read',
      protectedRoots: [root],
    }).allowed).toBe(true)
    expect(evaluateProductCoreGuard({
      path: join(project, 'src', 'feature.ts'),
      action: 'write',
      protectedRoots: [root],
    }).allowed).toBe(true)
  })

  test('honors explicit product-core mutation override', () => {
    const root = resolve(tmpdir(), 'dsxu-product-core')
    const decision = evaluateProductCoreGuard({
      path: join(root, 'src', 'query.ts'),
      action: 'write',
      protectedRoots: [root],
      allowCoreMutation: true,
    })

    expect(decision.allowed).toBe(true)
    expect(decision.reason).toContain('override')
  })

  test('threads Product Core Guard into FileEdit/FileWrite safety checks', () => {
    const root = resolve(tmpdir(), 'dsxu-product-core')
    process.env.DSXU_PRODUCT_CORE_ROOTS = root
    delete process.env.DSXU_ALLOW_PRODUCT_CORE_MUTATION
    delete process.env.DSXU_DEV_ALLOW_CORE_MUTATION

    const roots = getProductCoreGuardRootsFromEnv()
    expect(roots).toContain(root)

    const decision = checkPathSafetyForAutoEdit(join(root, 'src', 'runtime.ts'))
    expect(decision.safe).toBe(false)
    if (!decision.safe) {
      expect(decision.classifierApprovable).toBe(false)
      expect(decision.message).toContain('Product Core Guard')
    }
  })
})
