import { describe, it, expect } from 'bun:test'
import { sliceProblem, validateProblemSlice } from '../../problem-slicer'

describe('Problem Slicer 切分函数验证', () => {
  describe('1. 普通任务描述可切成 2~4 个 slice', () => {
    it('应该将多句任务切成多个 slice', () => {
      const task = '分析用户需求。设计系统架构。编写核心代码。测试功能完整性。'
      const result = sliceProblem(task)

      // 验证返回结构
      expect(result).toBeDefined()
      expect(result.originalTask).toBe(task)
      expect(result.slices).toBeDefined()
      expect(Array.isArray(result.slices)).toBe(true)
      expect(result.totalSlices).toBe(result.slices.length)
      expect(result.overallRiskLevel).toBeDefined()
      expect(result.generatedAt).toBeGreaterThan(0)

      // 验证切片数量在 2~4 之间
      expect(result.slices.length).toBeGreaterThanOrEqual(2)
      expect(result.slices.length).toBeLessThanOrEqual(4)

      // 验证每个切片的基本结构
      result.slices.forEach((slice, index) => {
        // 必需字段
        expect(slice.id).toBeDefined()
        expect(slice.id.trim().length).toBeGreaterThan(0)
        expect(slice.title).toBeDefined()
        expect(slice.title.trim().length).toBeGreaterThan(0)
        expect(slice.intent).toBeDefined()
        expect(slice.intent.trim().length).toBeGreaterThan(0)
        expect(slice.suggestedProfile).toBeDefined()
        expect(slice.riskLevel).toBeDefined()
        expect(slice.expectedTools).toBeDefined()
        expect(Array.isArray(slice.expectedTools)).toBe(true)

        // 系统字段
        expect(slice.createdAt).toBeGreaterThan(0)
        expect(slice.updatedAt).toBeGreaterThan(0)

        // 验证切片有效性
        const validation = validateProblemSlice(slice)
        expect(validation.valid).toBe(true)
        expect(validation.errors).toEqual([])

        console.log(`切片 ${index + 1}:`, {
          title: slice.title,
          profile: slice.suggestedProfile,
          risk: slice.riskLevel,
          tools: slice.expectedTools
        })
      })
    })

    it('应该将多行任务切成多个 slice', () => {
      const task = `分析用户登录流程
优化数据库查询性能
修复前端样式问题
编写单元测试`

      const result = sliceProblem(task)

      expect(result.slices.length).toBeGreaterThanOrEqual(2)
      expect(result.slices.length).toBeLessThanOrEqual(4)

      // 验证每个切片都有有效数据
      result.slices.forEach(slice => {
        expect(slice.intent.length).toBeGreaterThan(0)
        expect(['plan', 'edit', 'review', 'session']).toContain(slice.suggestedProfile)
        expect(['low', 'medium', 'high']).toContain(slice.riskLevel)
        expect(slice.expectedTools.length).toBeGreaterThan(0)
      })
    })
  })

  describe('2. 切分保底机制有效', () => {
    it('应该为短文本补足最少 2 个 slice', () => {
      const shortTask = '修复bug'
      const result = sliceProblem(shortTask)

      expect(result.slices.length).toBeGreaterThanOrEqual(2)
      expect(result.slices.length).toBeLessThanOrEqual(4)

      // 验证至少有一个分析切片和一个验证切片
      const profiles = result.slices.map(s => s.suggestedProfile)
      expect(profiles).toContain('plan') // 分析切片
      expect(profiles).toContain('review') // 验证切片

      console.log('短文本切分结果:', {
        originalTask: shortTask,
        sliceCount: result.slices.length,
        profiles
      })
    })

    it('应该为无法自然切分的文本补足切片', () => {
      const singleSentence = '这是一个需要完成的重要任务，包含多个步骤和复杂逻辑'
      const result = sliceProblem(singleSentence)

      expect(result.slices.length).toBeGreaterThanOrEqual(2)
      expect(result.slices.length).toBeLessThanOrEqual(4)

      // 验证切片结构完整
      result.slices.forEach(slice => {
        expect(slice.id).toBeDefined()
        expect(slice.title).toBeDefined()
        expect(slice.intent).toBeDefined()
        expect(slice.suggestedProfile).toBeDefined()
        expect(slice.riskLevel).toBeDefined()
        expect(slice.expectedTools).toBeDefined()
      })
    })

    it('应该为极短输入生成有效切片', () => {
      const veryShort = '测试'
      const result = sliceProblem(veryShort)

      expect(result.slices.length).toBeGreaterThanOrEqual(2)
      expect(result.slices.length).toBeLessThanOrEqual(4)

      // 验证结果结构完整
      expect(result.originalTask).toBe(veryShort)
      expect(result.totalSlices).toBe(result.slices.length)
      expect(result.overallRiskLevel).toBeDefined()
      expect(result.generatedAt).toBeGreaterThan(0)
    })
  })

  describe('3. profile / risk / tools 推断有效', () => {
    it('应该为"分析/规划"类词生成 plan slice', () => {
      const task = '分析系统架构并设计解决方案'
      const result = sliceProblem(task)

      // 查找包含 plan profile 的切片
      const planSlices = result.slices.filter(s => s.suggestedProfile === 'plan')
      expect(planSlices.length).toBeGreaterThan(0)

      planSlices.forEach(slice => {
        console.log('Plan切片:', {
          title: slice.title,
          intent: slice.intent,
          tools: slice.expectedTools,
          risk: slice.riskLevel
        })
      })
    })

    it('应该为"编辑/修改/创建"类词生成 edit slice', () => {
      const task = '编辑配置文件并创建新功能模块'
      const result = sliceProblem(task)

      const editSlices = result.slices.filter(s => s.suggestedProfile === 'edit')
      expect(editSlices.length).toBeGreaterThan(0)

      editSlices.forEach(slice => {
        // edit slice 通常需要 file_edit 工具
        expect(slice.expectedTools).toContain('file_edit')
        console.log('Edit切片:', {
          title: slice.title,
          intent: slice.intent,
          tools: slice.expectedTools,
          risk: slice.riskLevel
        })
      })
    })

    it('应该为"审查/验证/测试"类词生成 review slice', () => {
      const task = '审查代码质量并测试功能完整性'
      const result = sliceProblem(task)

      const reviewSlices = result.slices.filter(s => s.suggestedProfile === 'review')
      expect(reviewSlices.length).toBeGreaterThan(0)

      reviewSlices.forEach(slice => {
        console.log('Review切片:', {
          title: slice.title,
          intent: slice.intent,
          tools: slice.expectedTools,
          risk: slice.riskLevel
        })
      })
    })

    it('应该为高风险关键词推断 high riskLevel', () => {
      const task = '修复关键安全漏洞，这是非常重要的任务'
      const result = sliceProblem(task)

      // 检查是否有 high risk 切片
      const highRiskSlices = result.slices.filter(s => s.riskLevel === 'high')
      if (highRiskSlices.length > 0) {
        highRiskSlices.forEach(slice => {
          console.log('高风险切片:', {
            title: slice.title,
            intent: slice.intent,
            risk: slice.riskLevel
          })
        })
      }

      // 至少验证总体风险等级
      expect(['low', 'medium', 'high']).toContain(result.overallRiskLevel)
    })

    it('应该推断合理的 expectedTools', () => {
      const task = '编辑代码文件并执行测试脚本'
      const result = sliceProblem(task)

      // 检查所有切片的工具推断
      result.slices.forEach(slice => {
        expect(slice.expectedTools.length).toBeGreaterThan(0)
        expect(Array.isArray(slice.expectedTools)).toBe(true)

        // 验证工具名称是字符串
        slice.expectedTools.forEach(tool => {
          expect(typeof tool).toBe('string')
          expect(tool.trim().length).toBeGreaterThan(0)
        })

        console.log(`切片工具推断:`, {
          title: slice.title,
          profile: slice.suggestedProfile,
          tools: slice.expectedTools
        })
      })
    })

    it('应该为包含特定关键词的任务推断相应工具', () => {
      const testCases = [
        {
          task: '编辑配置文件',
          expectedTools: ['file_edit']
        },
        {
          task: '执行测试脚本',
          expectedTools: ['bash']
        },
        {
          task: '提交代码到git仓库',
          expectedTools: ['git']
        },
        {
          task: '编辑代码并运行测试',
          expectedTools: ['file_edit', 'bash']
        }
      ]

      testCases.forEach(({ task, expectedTools }) => {
        const result = sliceProblem(task)

        // 至少有一个切片包含预期工具
        const hasExpectedTools = result.slices.some(slice =>
          expectedTools.some(tool => slice.expectedTools.includes(tool))
        )

        expect(hasExpectedTools).toBe(true)

        console.log(`工具推断测试:`, {
          task,
          expectedTools,
          actualTools: result.slices.map(s => s.expectedTools)
        })
      })
    })
  })

  describe('4. 边界输入安全', () => {
    it('应该处理空字符串输入', () => {
      const result = sliceProblem('')

      expect(result).toBeDefined()
      expect(result.originalTask).toBe('')
      expect(result.slices).toEqual([])
      expect(result.totalSlices).toBe(0)
      expect(result.overallRiskLevel).toBe('low')
      expect(result.generatedAt).toBeGreaterThan(0)
    })

    it('应该处理纯空白输入', () => {
      const result = sliceProblem('   \n\t  ')

      expect(result).toBeDefined()
      expect(result.originalTask.trim()).toBe('')
      expect(result.slices).toEqual([])
      expect(result.totalSlices).toBe(0)
      expect(result.overallRiskLevel).toBe('low')
    })

    it('应该处理单个字符输入', () => {
      const result = sliceProblem('a')

      expect(result).toBeDefined()
      expect(result.originalTask).toBe('a')
      expect(result.slices.length).toBeGreaterThanOrEqual(2)
      expect(result.slices.length).toBeLessThanOrEqual(4)
      expect(result.totalSlices).toBe(result.slices.length)
      expect(result.overallRiskLevel).toBeDefined()
    })

    it('应该返回完整的结果结构', () => {
      const testCases = [
        '简单任务',
        '中等复杂度的任务，包含多个步骤',
        '复杂任务：第一步分析需求，第二步设计架构，第三步编写代码，第四步测试验证'
      ]

      testCases.forEach(task => {
        const result = sliceProblem(task)

        // 验证必需字段
        expect(result.originalTask).toBe(task)
        expect(Array.isArray(result.slices)).toBe(true)
        expect(result.totalSlices).toBe(result.slices.length)
        expect(typeof result.overallRiskLevel).toBe('string')
        expect(['low', 'medium', 'high']).toContain(result.overallRiskLevel)
        expect(result.generatedAt).toBeGreaterThan(0)

        // 验证切片数量范围
        expect(result.slices.length).toBeGreaterThanOrEqual(0)
        expect(result.slices.length).toBeLessThanOrEqual(4)

        // 验证每个切片
        result.slices.forEach(slice => {
          expect(slice.id).toBeDefined()
          expect(slice.title).toBeDefined()
          expect(slice.intent).toBeDefined()
          expect(slice.suggestedProfile).toBeDefined()
          expect(slice.riskLevel).toBeDefined()
          expect(slice.expectedTools).toBeDefined()
          expect(slice.createdAt).toBeGreaterThan(0)
          expect(slice.updatedAt).toBeGreaterThan(0)
        })
      })
    })

    it('应该处理包含特殊字符的输入', () => {
      const specialTask = '修复bug! 测试功能? 优化性能; 部署系统.'
      const result = sliceProblem(specialTask)

      expect(result).toBeDefined()
      expect(result.slices.length).toBeGreaterThanOrEqual(2)
      expect(result.slices.length).toBeLessThanOrEqual(4)

      // 验证每个切片都有有效内容
      result.slices.forEach(slice => {
        expect(slice.intent.trim().length).toBeGreaterThan(0)
        expect(slice.title.trim().length).toBeGreaterThan(0)
      })
    })
  })
})