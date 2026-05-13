import { describe, it, expect } from 'bun:test'
import { getProfileConfig, isToolAllowedInProfile } from '../../profiles'

describe('Profile Filtering', () => {
  describe('getProfileConfig', () => {
    it('应该返回正确的profile配置', () => {
      const planProfile = getProfileConfig('plan')
      expect(planProfile.type).toBe('plan')
      expect(planProfile.displayName).toBe('规划者')
      expect(planProfile.readOnly).toBe(true)
      expect(planProfile.allowedToolCategories).toContain('read')
      expect(planProfile.allowedToolCategories).toContain('analysis')

      const editProfile = getProfileConfig('edit')
      expect(editProfile.type).toBe('edit')
      expect(editProfile.readOnly).toBe(false)
      expect(editProfile.allowedToolCategories).toContain('write')
    })
  })

  describe('isToolAllowedInProfile', () => {
    it('应该正确过滤只读profile的工具', () => {
      // Plan profile是只读的
      expect(isToolAllowedInProfile('Read', 'plan')).toBe(true)
      expect(isToolAllowedInProfile('Grep', 'plan')).toBe(true)
      expect(isToolAllowedInProfile('Write', 'plan')).toBe(false) // 写工具不允许
      expect(isToolAllowedInProfile('Edit', 'plan')).toBe(false) // 编辑工具不允许
      expect(isToolAllowedInProfile('Bash', 'plan')).toBe(false) // Bash可能包含写操作
    })

    it('应该正确过滤编辑profile的工具', () => {
      // Edit profile允许写操作
      expect(isToolAllowedInProfile('Read', 'edit')).toBe(true)
      expect(isToolAllowedInProfile('Write', 'edit')).toBe(true)
      expect(isToolAllowedInProfile('Edit', 'edit')).toBe(true)
      expect(isToolAllowedInProfile('LSP', 'edit')).toBe(true)
    })

    it('应该正确过滤审查profile的工具', () => {
      // Review profile是只读的
      expect(isToolAllowedInProfile('Read', 'review')).toBe(true)
      expect(isToolAllowedInProfile('Analysis', 'review')).toBe(true)
      expect(isToolAllowedInProfile('Write', 'review')).toBe(false)
      expect(isToolAllowedInProfile('Git', 'review')).toBe(false)
    })

    it('应该正确过滤会话profile的工具', () => {
      // Session profile允许所有工具
      expect(isToolAllowedInProfile('Read', 'session')).toBe(true)
      expect(isToolAllowedInProfile('Write', 'session')).toBe(true)
      expect(isToolAllowedInProfile('Git', 'session')).toBe(true)
      expect(isToolAllowedInProfile('Skill__test', 'session')).toBe(true)
      expect(isToolAllowedInProfile('Test', 'session')).toBe(true)
    })
  })
})
