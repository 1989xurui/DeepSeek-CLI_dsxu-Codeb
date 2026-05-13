import * as React from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import { SkillsMenu } from '../../components/skills/SkillsMenu.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext): Promise<React.ReactNode> {
  return <SkillsMenu onExit={onDone} commands={context.options.commands} />;
}

// V14 lifecycle shim: skills
export function processSkillsLifecycle(input) {
  void input
  const state = 'skills-state'
  const lifecycle = 'skills:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
