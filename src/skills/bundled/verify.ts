import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'
import { registerBundledSkill } from '../bundledSkills.js'
import { SKILL_FILES, SKILL_MD } from './verifyContent.js'

const { frontmatter, content: SKILL_BODY } = parseFrontmatter(SKILL_MD)

const DESCRIPTION =
  typeof frontmatter.description === 'string'
    ? frontmatter.description
    : 'Verify a code change does what it should by running the app.'

export function registerVerifySkill(): void {
  const dsxuSkillsEnabled =
    isDsxuRuntimeMode() || process.env.DSXU_CODE_ENABLE_BUNDLED_SKILLS === '1'
  if (
    process.env.USER_TYPE !== 'ant' &&
    !dsxuSkillsEnabled
  ) {
    return
  }

  registerBundledSkill({
    name: 'verify',
    description: DESCRIPTION,
    userInvocable: true,
    files: SKILL_FILES,
    async getPromptForCommand(args) {
      const parts: string[] = [SKILL_BODY.trimStart()]
      if (args) {
        parts.push(`## User Request\n\n${args}`)
      }
      return [{ type: 'text', text: parts.join('\n\n') }]
    },
  })
}

export function getDsxuVerifySkillRuntimeProfile() {
  return {
    runtime: 'DSXU Verify Skill',
    skillName: 'verify',
    defaultActivation: 'DSXU_CODE_MODE or DSXU_CODE_ENABLE_BUNDLED_SKILLS',
    userInvocable: true,
    files: Object.keys(SKILL_FILES),
    activationEvidence: [
      'registerVerifySkill auto-registers in DSXU runtime mode',
      'verify skill remains user-invocable for code delivery workflows',
      'skill prompt injects user request into bundled verification discipline',
    ],
  }
}
