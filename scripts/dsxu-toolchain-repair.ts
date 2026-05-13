import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { homedir, platform } from 'os'
import { dirname, join, resolve } from 'path'

const EXPECTED_LINUX_RG_SHA256 =
  'c2feed7a376d3754958fa6235a6ef88a74bcabc9b0cfccacbd48939b5f87860d'

type RepairResult = {
  ok: boolean
  platform: string
  sourcePath: string
  cachePath: string
  evidencePath: string
  stdout: string
  stderr: string
  sha256?: string
  error?: string
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

async function sha256File(path: string): Promise<string> {
  const buffer = await readFile(path)
  return createHash('sha256').update(buffer).digest('hex')
}

async function writeEvidence(result: RepairResult): Promise<void> {
  await mkdir(dirname(result.evidencePath), { recursive: true })
  await writeFile(result.evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
}

async function repairWslRipgrep(
  sourcePath: string,
  evidencePath: string,
  distro: string,
): Promise<RepairResult> {
  const cachePath = '$HOME/.dsxu/tools/ripgrep/x64-linux/rg'
  const sourceSha = await sha256File(sourcePath)
  if (sourceSha !== EXPECTED_LINUX_RG_SHA256) {
    return {
      ok: false,
      platform: platform(),
      sourcePath,
      cachePath,
      evidencePath,
      stdout: '',
      stderr: '',
      sha256: sourceSha,
      error: `Linux rg source hash mismatch: ${sourceSha}`,
    }
  }

  const bashScript = [
    'set -euo pipefail',
    'mkdir -p "$HOME/.dsxu/tools/ripgrep/x64-linux"',
    'cat > "$HOME/.dsxu/tools/ripgrep/x64-linux/rg.tmp"',
    'chmod +x "$HOME/.dsxu/tools/ripgrep/x64-linux/rg.tmp"',
    `sha256sum "$HOME/.dsxu/tools/ripgrep/x64-linux/rg.tmp" | grep -F ${shellQuote(EXPECTED_LINUX_RG_SHA256)} >/dev/null`,
    'mv "$HOME/.dsxu/tools/ripgrep/x64-linux/rg.tmp" "$HOME/.dsxu/tools/ripgrep/x64-linux/rg"',
    '"$HOME/.dsxu/tools/ripgrep/x64-linux/rg" --version | head -1',
    `sha256sum "$HOME/.dsxu/tools/ripgrep/x64-linux/rg" | awk '{print $1}'`,
  ].join(' && ')

  const child = spawn(
    'wsl.exe',
    ['-d', distro, '--', 'bash', '-lc', bashScript],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )

  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    stdout += chunk
  })
  child.stderr.on('data', chunk => {
    stderr += chunk
  })

  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.on('error', rejectPromise)
    child.on('exit', code => {
      if (code === 0) resolvePromise()
      else rejectPromise(new Error(`wsl repair exited with ${code}`))
    })
    createReadStream(sourcePath).pipe(child.stdin)
  }).catch(error => {
    throw Object.assign(error, { stdout, stderr })
  })

  const lines = stdout.trim().split(/\r?\n/).filter(Boolean)
  const sha256 = lines.at(-1)?.split(/\s+/)[0]
  return {
    ok: sha256 === EXPECTED_LINUX_RG_SHA256,
    platform: platform(),
    sourcePath,
    cachePath,
    evidencePath,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    sha256,
  }
}

async function repairLocalRipgrep(
  sourcePath: string,
  evidencePath: string,
): Promise<RepairResult> {
  const cachePath = join(homedir(), '.dsxu', 'tools', 'ripgrep', 'x64-linux', 'rg')
  const sourceSha = await sha256File(sourcePath)
  return {
    ok: sourceSha === EXPECTED_LINUX_RG_SHA256,
    platform: platform(),
    sourcePath,
    cachePath,
    evidencePath,
    stdout: 'local Linux runtime can use the packaged ripgrep directly',
    stderr: '',
    sha256: sourceSha,
  }
}

async function main(): Promise<void> {
  const repoRoot = resolve(process.cwd())
  const sourcePath = join(
    repoRoot,
    'src',
    'utils',
    'vendor',
    'ripgrep',
    'x64-linux',
    'rg',
  )
  const evidencePath = join(
    repoRoot,
    '.dsxu',
    'trace',
    'v18-toolchain',
    'toolchain-repair.json',
  )
  await stat(sourcePath)

  let result: RepairResult
  try {
    result =
      platform() === 'win32'
        ? await repairWslRipgrep(
            sourcePath,
            evidencePath,
            process.env.DSXU_WSL_DISTRO ?? 'Ubuntu',
          )
        : await repairLocalRipgrep(sourcePath, evidencePath)
  } catch (error: any) {
    result = {
      ok: false,
      platform: platform(),
      sourcePath,
      cachePath: '$HOME/.dsxu/tools/ripgrep/x64-linux/rg',
      evidencePath,
      stdout: String(error?.stdout ?? ''),
      stderr: String(error?.stderr ?? ''),
      error: error?.message ?? String(error),
    }
  }

  await writeEvidence(result)
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exit(1)
}

await main()
