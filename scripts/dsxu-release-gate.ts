import { spawn } from 'child_process'
import { getDsxuReleaseGateCommand } from '../src/dsxu/engine/release-test-gate'

async function run(command: string, args: readonly string[]): Promise<number> {
  return await new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      windowsHide: true,
    })
    child.on('error', error => {
      console.error(`release gate failed to start: ${error.message}`)
      resolve(1)
    })
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`release gate terminated by signal ${signal}`)
        resolve(1)
        return
      }
      resolve(code ?? 1)
    })
  })
}

const [command, ...args] = getDsxuReleaseGateCommand()
const code = await run(command, args)
process.exitCode = code
