import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  buildPowerShellUtf8Prelude,
  createPowerShellProvider,
} from '../../../utils/shell/powershellProvider'
import { getCachedPowerShellPath } from '../../../utils/shell/powershellDetection'
import { withDsxuUtf8SubprocessEnv } from '../../../utils/subprocessEnv'

describe('subprocess encoding boundary V1', () => {
  test('PowerShell commands start with a UTF-8 console and child-process prelude', async () => {
    const provider = createPowerShellProvider('powershell.exe')
    const command = await provider.buildExecCommand(
      "Write-Output '检查验证是否通过'",
      {
        id: 'encoding',
        useSandbox: false,
      },
    )

    expect(command.commandString).toContain('[Console]::OutputEncoding')
    expect(command.commandString).toContain('$OutputEncoding')
    expect(command.commandString).toContain("$env:PYTHONIOENCODING = 'utf-8'")
    expect(command.commandString).toContain("$env:PYTHONUTF8 = '1'")
    expect(command.commandString).toContain("Get-Content:Encoding")
    expect(command.commandString).toContain("Select-String:Encoding")
    expect(command.commandString).toContain("Import-Csv:Encoding")
    expect(command.commandString).toContain("Export-Csv:Encoding")
    expect(command.commandString).toContain("Out-File:Encoding")
    expect(command.commandString).toContain("Write-Output '检查验证是否通过'")
  })

  test('PowerShell UTF-8 prelude is ASCII-safe before user command text', () => {
    const prelude = buildPowerShellUtf8Prelude()

    expect(prelude).toContain('[System.Text.UTF8Encoding]::new($false)')
    expect(prelude).not.toContain('鏌')
    expect(prelude).not.toContain('\uFFFD')
  })

  test('PowerShell provider makes bare Get-Content read UTF-8 no-BOM Chinese correctly', async () => {
    const powershellPath = await getCachedPowerShellPath()
    if (!powershellPath) return

    const dir = mkdtempSync(join(tmpdir(), 'dsxu-ps-utf8-'))
    const file = join(dir, 'goal.md')
    const text = 'DSXU V19 总目标：真实复杂任务能力优先。'
    writeFileSync(file, text, 'utf8')
    let cwdFilePath: string | undefined

    try {
      const escapedFile = file.replace(/'/g, "''")
      const provider = createPowerShellProvider(powershellPath)
      const command = await provider.buildExecCommand(
        `Get-Content -Raw -LiteralPath '${escapedFile}'`,
        {
          id: 'utf8-no-bom',
          useSandbox: false,
        },
      )
      cwdFilePath = command.cwdFilePath
      const output = execFileSync(
        powershellPath,
        provider.getSpawnArgs(command.commandString),
        {
          encoding: 'utf8',
          env: withDsxuUtf8SubprocessEnv({ ...process.env }),
        },
      ).trim()

      expect(output).toBe(text)
      expect(output).not.toContain('鎬')
      expect(output).not.toContain('鏍')
      expect(output).not.toContain('\uFFFD')
    } finally {
      if (cwdFilePath) rmSync(cwdFilePath, { force: true })
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('subprocess env defaults make common language runtimes emit UTF-8 without overriding user locale', () => {
    const env = withDsxuUtf8SubprocessEnv({
      PATH: 'runtime-bin',
      PYTHONIOENCODING: 'existing-encoding',
      LANG: 'zh_CN.UTF-8',
    } as NodeJS.ProcessEnv)

    expect(env.PYTHONIOENCODING).toBe('existing-encoding')
    expect(env.PYTHONUTF8).toBe('1')
    expect(env.LANG).toBe('zh_CN.UTF-8')
  })
})
