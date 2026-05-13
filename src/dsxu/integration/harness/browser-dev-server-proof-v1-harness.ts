import { randomUUID } from 'crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'

export type BrowserDevServerProofResult = {
  ok: boolean
  blocked: boolean
  completedWithinTimeout: boolean
  elapsedMs: number
  timeoutMs: number
  evidencePath: string
  tracePath: string
  workDir: string
  port: number
  url: string
  screenshotPath: string
  screenshotBytes: number
  browserExecutablePath: string
  browserStrategy: string
  chromeExitCode: number | null
  chromeTimedOut: boolean
  chromeStdout: string
  chromeStderr: string
  status: number | null
  contentType: string
  rootText: string
  exitCode: number | null
  stdout: string
  stderr: string
  cleanupError?: string
  error?: string
}

export type BrowserDevServerProofOptions = {
  evidenceDir?: string
  scenarioName?: string
  timeoutMs?: number
  readyDelayMs?: number
}

async function findFreePort(): Promise<number> {
  const net = await import('net')
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

async function statSizeIfExists(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

async function removeWorkDirBestEffort(path: string): Promise<string | undefined> {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true })
      return undefined
    } catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)))
    }
  }
  return lastError instanceof Error ? lastError.message : String(lastError)
}

async function waitForChildExit(
  child: Subprocess<'ignore', 'pipe', 'pipe'>,
  timeoutMs: number,
): Promise<'exited' | 'timeout'> {
  return await Promise.race([
    child.exited.then(() => 'exited' as const),
    new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), timeoutMs)),
  ])
}

function browserProbeScript(): string {
  return [
    "import { chromium } from 'playwright'",
    "import { mkdtemp, rm, stat, writeFile } from 'fs/promises'",
    "import { tmpdir } from 'os'",
    "import { join } from 'path'",
    '',
    'const requestedPort = Number(process.env.DSXU_BROWSER_PROOF_PORT)',
    'const readyDelayMs = Number(process.env.DSXU_BROWSER_PROOF_READY_DELAY_MS || 500)',
    'const evidencePath = process.env.DSXU_BROWSER_PROOF_CHILD_EVIDENCE',
    'const screenshotPath = process.env.DSXU_BROWSER_PROOF_SCREENSHOT',
    'const startedAt = Date.now()',
    'let server = null',
    'let browser = null',
    '',
    'async function writeEvidence(payload) {',
    '  if (!evidencePath) return',
    '  await writeFile(evidencePath, JSON.stringify(payload, null, 2), "utf8")',
    '}',
    '',
    'async function cleanup() {',
    '  if (browser) await browser.close().catch(() => {})',
    '  if (server) server.stop(true)',
    '}',
    '',
    'process.on("SIGTERM", () => {',
    '  cleanup().finally(() => process.exit(143))',
    '})',
    'process.on("SIGINT", () => {',
    '  cleanup().finally(() => process.exit(130))',
    '})',
    '',
    'try {',
    '  const startServer = (port) => Bun.serve({',
    '    hostname: "127.0.0.1",',
    '    port,',
    '    fetch() {',
    '      const ready = Date.now() - startedAt >= readyDelayMs',
    '      if (!ready) return new Response("cold-start", { status: 503 })',
    '      return new Response("<!doctype html><html><body><main id=\\"root\\">DSXU_BROWSER_READY</main></body></html>", {',
    '        status: 200,',
    '        headers: { "content-type": "text/html; charset=utf-8" },',
    '      })',
    '    },',
    '  })',
    '  try {',
    '    server = startServer(requestedPort)',
    '  } catch (error) {',
    '    const message = error instanceof Error ? error.message : String(error)',
    '    if (!/port|EADDRINUSE|Failed to start server/i.test(message)) throw error',
    '    server = startServer(0)',
    '  }',
    '  const port = server.port',
    '  console.log(`DSXU_BROWSER_PROOF_SERVER port=${server.port}`)',
    '  await new Promise(resolve => setTimeout(resolve, readyDelayMs + 75))',
    '  const playwrightChromiumPath = chromium.executablePath()',
    '  const headlessShellPath = playwrightChromiumPath.replace("chromium-1217\\\\chrome-win64\\\\chrome.exe", "chromium_headless_shell-1217\\\\chrome-headless-shell-win64\\\\chrome-headless-shell.exe")',
    '  const headlessShellAvailable = await stat(headlessShellPath).then(() => true).catch(() => false)',
    '  const browserExecutablePath = headlessShellAvailable ? headlessShellPath : playwrightChromiumPath',
    '  const url = `http://127.0.0.1:${port}/`',
    '  const response = await fetch(url, { signal: AbortSignal.timeout(2500) })',
    '  const rootText = await response.text()',
    '  const contentType = response.headers.get("content-type") || ""',
    '  const status = response.status',
    '  const chromeUserDataDir = await mkdtemp(join(tmpdir(), "dsxu-browser-proof-"))',
    '  const chrome = Bun.spawn([',
    '    browserExecutablePath,',
    '    "--headless",',
    '    "--disable-gpu",',
    '    "--no-sandbox",',
    '    "--disable-dev-shm-usage",',
    '    "--disable-background-networking",',
    '    "--disable-component-update",',
    '    "--disable-default-apps",',
    '    "--disable-extensions",',
    '    "--disable-sync",',
    '    "--hide-scrollbars",',
    '    "--metrics-recording-only",',
    '    "--mute-audio",',
    '    "--no-default-browser-check",',
    '    "--no-first-run",',
    '    "--run-all-compositor-stages-before-draw",',
    '    "--virtual-time-budget=1000",',
    '    "--timeout=5000",',
    '    `--user-data-dir=${chromeUserDataDir}`,',
    '    "--window-size=900,700",',
    '    `--screenshot=${screenshotPath}`,',
    '    url,',
    '  ], { stdout: "pipe", stderr: "pipe" })',
    '  const chromeStdout = new Response(chrome.stdout).text()',
    '  const chromeStderr = new Response(chrome.stderr).text()',
    '  let chromeTimedOut = false',
    '  let chromeExitState = await Promise.race([',
    '    chrome.exited.then(() => "exited"),',
    '    new Promise(resolve => setTimeout(() => resolve("timeout"), 10000)),',
    '  ])',
    '  if (chromeExitState === "timeout") {',
    '    chromeTimedOut = true',
    '    chrome.kill("SIGTERM")',
    '    chromeExitState = await Promise.race([',
    '      chrome.exited.then(() => "exited"),',
    '      new Promise(resolve => setTimeout(() => resolve("timeout"), 1500)),',
    '    ])',
    '    if (chromeExitState === "timeout") chrome.kill()',
    '  }',
    '  const [chromeOut, chromeErr] = await Promise.allSettled([chromeStdout, chromeStderr]).then(results => results.map(result => result.status === "fulfilled" ? result.value : String(result.reason)))',
    '  const screenshotBytes = await stat(screenshotPath).then(value => value.size).catch(() => 0)',
    '  await rm(chromeUserDataDir, { recursive: true, force: true }).catch(() => {})',
    '  const ok = !chromeTimedOut && chrome.exitCode === 0 && status === 200 && contentType.includes("text/html") && rootText.includes("DSXU_BROWSER_READY") && screenshotBytes > 0',
    '  await writeEvidence({ ok, port, requestedPort, status, contentType, rootText: rootText.includes("DSXU_BROWSER_READY") ? "DSXU_BROWSER_READY" : "", url, screenshotPath, screenshotBytes, browserExecutablePath, browserStrategy: headlessShellAvailable ? "chromium-headless-shell-cli" : "chromium-cli", chromeExitCode: chrome.exitCode, chromeTimedOut, chromeStdout: chromeOut, chromeStderr: chromeErr, elapsedMs: Date.now() - startedAt })',
    '  console.log("DSXU_BROWSER_PROOF_DONE ok=" + ok)',
    '  process.exitCode = ok ? 0 : 1',
    '} catch (error) {',
    '  const message = error instanceof Error ? error.message : String(error)',
    '  await writeEvidence({ ok: false, error: message, elapsedMs: Date.now() - startedAt })',
    '  console.error("DSXU_BROWSER_PROOF_ERROR " + message)',
    '  process.exitCode = 1',
    '} finally {',
    '  await cleanup()',
    '}',
  ].join('\n')
}

export async function runBrowserDevServerProofHarness(
  options: BrowserDevServerProofOptions = {},
): Promise<BrowserDevServerProofResult> {
  const scenarioName = options.scenarioName ?? 'browser-dev-server-proof'
  const timeoutMs = options.timeoutMs ?? 18_000
  const readyDelayMs = options.readyDelayMs ?? 500
  const evidenceDir =
    options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-browser-proof')
  const workDir = join(
    process.cwd(),
    '.dsxu',
    'tmp',
    'v18-browser-proof',
    scenarioName,
    `${Date.now()}-${randomUUID()}`,
  )
  const tracePath = join(evidenceDir, `${scenarioName}.trace.json`)
  const evidencePath = join(evidenceDir, `${scenarioName}.json`)
  const childEvidencePath = join(workDir, 'child-result.json')
  const screenshotPath = join(evidenceDir, `${scenarioName}.png`)
  const scriptPath = join(workDir, 'browser-proof.mjs')
  const port = await findFreePort()
  const startedAt = Date.now()

  await mkdir(evidenceDir, { recursive: true })
  await mkdir(workDir, { recursive: true })
  await writeFile(scriptPath, browserProbeScript(), 'utf8')

  const child = Bun.spawn([process.execPath, scriptPath], {
    cwd: workDir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      DSXU_BROWSER_PROOF_PORT: String(port),
      DSXU_BROWSER_PROOF_READY_DELAY_MS: String(readyDelayMs),
      DSXU_BROWSER_PROOF_CHILD_EVIDENCE: childEvidencePath,
      DSXU_BROWSER_PROOF_SCREENSHOT: screenshotPath,
    },
  })

  const stdoutPromise = new Response(child.stdout).text()
  const stderrPromise = new Response(child.stderr).text()
  let timedOut = false
  let exitState = await waitForChildExit(child, timeoutMs)
  if (exitState === 'timeout') {
    timedOut = true
    child.kill('SIGTERM')
    exitState = await waitForChildExit(child, 2_000)
    if (exitState === 'timeout') child.kill()
  }

  const [stdout, stderr] = await Promise.allSettled([stdoutPromise, stderrPromise]).then(
    results =>
      results.map(result =>
        result.status === 'fulfilled' ? result.value : String(result.reason),
      ) as [string, string],
  )
  const childEvidenceText = await readTextIfExists(childEvidencePath)
  const childEvidence = childEvidenceText ? JSON.parse(childEvidenceText) : {}
  const screenshotBytes = await statSizeIfExists(screenshotPath)
  const elapsedMs = Date.now() - startedAt
  const completedWithinTimeout = !timedOut
  const error =
    childEvidence.error ??
    (timedOut
      ? `browser proof timed out after ${timeoutMs}ms`
      : child.exitCode === 0
        ? undefined
        : `browser proof exited with ${child.exitCode}`)
  const ok =
    completedWithinTimeout &&
    child.exitCode === 0 &&
    childEvidence.ok === true &&
    screenshotBytes > 0

  const result: BrowserDevServerProofResult = {
    ok,
    blocked: !ok,
    completedWithinTimeout,
    elapsedMs,
    timeoutMs,
    evidencePath,
    tracePath,
    workDir,
    port: childEvidence.port ?? port,
    url: childEvidence.url ?? `http://127.0.0.1:${childEvidence.port ?? port}/`,
    screenshotPath,
    screenshotBytes,
    browserExecutablePath: childEvidence.browserExecutablePath ?? '',
    browserStrategy: childEvidence.browserStrategy ?? '',
    chromeExitCode: childEvidence.chromeExitCode ?? null,
    chromeTimedOut: childEvidence.chromeTimedOut ?? false,
    chromeStdout: childEvidence.chromeStdout ?? '',
    chromeStderr: childEvidence.chromeStderr ?? '',
    status: childEvidence.status ?? null,
    contentType: childEvidence.contentType ?? '',
    rootText: childEvidence.rootText ?? '',
    exitCode: child.exitCode,
    stdout,
    stderr,
    error,
  }

  const cleanupError = await removeWorkDirBestEffort(workDir)
  if (cleanupError) {
    result.cleanupError = cleanupError
    result.blocked = true
    result.error = result.error
      ? `${result.error}; cleanup=${cleanupError}`
      : `cleanup=${cleanupError}`
  }
  await writeFile(evidencePath, JSON.stringify(result, null, 2), 'utf8')
  await writeFile(
    tracePath,
    JSON.stringify(
      {
        event: ok ? 'browser_proof.passed' : 'browser_proof.blocked',
        elapsedMs,
        timeoutMs,
        exitCode: child.exitCode,
        screenshotBytes,
        cleanupError,
        error: result.error,
      },
      null,
      2,
    ),
    'utf8',
  )

  return result
}
