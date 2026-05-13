import cliMd from './verify/examples/cli.md'
import serverMd from './verify/examples/server.md'
import skillMd from './verify/SKILL.md'

export const SKILL_MD: string = skillMd

export const SKILL_FILES: Record<string, string> = {
  'examples/cli.md': cliMd,
  'examples/server.md': serverMd,
}

export function getDsxuVerifySkillContentRuntimeProfile() {
  return {
    runtime: 'DSXU Verify Skill Content',
    skillName: 'verify',
    bodyChars: SKILL_MD.length,
    files: Object.keys(SKILL_FILES),
    hasCliExample: SKILL_FILES['examples/cli.md']?.length > 0,
    hasServerExample: SKILL_FILES['examples/server.md']?.length > 0,
    activationEvidence: [
      'verify/SKILL.md is loaded as the canonical verification prompt body',
      'CLI verification example is packaged with the skill',
      'server verification example is packaged with the skill',
    ],
  }
}
