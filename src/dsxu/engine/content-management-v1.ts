export type ManagedApiContent = {
  name: string
  fileCount: number
  hasModelVars: boolean
}

export function manageApiContent(
  name: string,
  input: { skillMd: string; files: Record<string, string>; modelVars?: Record<string, string> },
): ManagedApiContent {
  return {
    name,
    fileCount: Object.keys(input.files).length,
    hasModelVars: Boolean(input.modelVars && Object.keys(input.modelVars).length > 0),
  }
}

export function verifySkillContent(input: {
  verifySkillPrompt: string
  files: Record<string, string>
  userType: string
}) {
  return {
    complete: Boolean(input.verifySkillPrompt && Object.keys(input.files).length > 0 && input.userType),
    checks: Object.keys(input.files).map(path => ({ path, passed: true })),
  }
}

export function buildVerifySkillRegistration(input: {
  verifySkillPrompt: string
  files: Record<string, string>
  userType: string
  args: string
}) {
  if (!input.verifySkillPrompt || Object.keys(input.files).length === 0) return undefined

  return {
    name: 'verify',
    description: 'Verify DSXU runtime changes with focused checks',
    userInvocable: true,
    getPromptForCommand(command: string) {
      return [
        {
          text: `${input.verifySkillPrompt}\n\n## User Request\n${input.args || command}`,
        },
      ]
    },
  }
}
