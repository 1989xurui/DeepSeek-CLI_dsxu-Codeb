import { appendFile, mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'

export type FrontendProjectDevServerResult = {
  ok: boolean
  evidencePath: string
  tracePath: string
  projectDir: string
  port: number
  command: string[]
  coldStartStatuses: number[]
  readyStatus: number | null
  htmlProof: {
    url: string
    status: number | null
    contentType: string
    bodyContainsMarker: boolean
    scriptPresent: boolean
  }
  screenshotProof: {
    ok: boolean
    path: string
    bytes: number
    browserExecutablePath: string
    strategy: string
    exitCode: number | null
    timedOut: boolean
    stdout: string
    stderr: string
  }
  stopStatus: 'stopped' | 'failed'
  processExitedBeforeReady: boolean
  failureType:
    | 'none'
    | 'missing_native_dependency'
    | 'process_exited_before_ready'
    | 'readiness_timeout'
    | 'browser_proof_failed'
  exitCode: number | null
  stdout: string
  stderr: string
  elapsedMs: number
  cleanupError?: string
  error?: string
}

export type FrontendProjectDevServerOptions = {
  evidenceDir?: string
  scenarioName?: string
  timeoutMs?: number
  readyDelayMs?: number
  failFast?: 'missing_native_dependency'
}

type TraceEvent = {
  ts: number
  event: string
  data?: Record<string, unknown>
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

async function appendTrace(tracePath: string, event: TraceEvent): Promise<void> {
  await appendFile(tracePath, `${JSON.stringify(event)}\n`, 'utf8')
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

async function statSizeIfExists(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

async function removeBestEffort(path: string): Promise<string | undefined> {
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

async function writeFrontendProject(
  projectDir: string,
  failFast?: FrontendProjectDevServerOptions['failFast'],
): Promise<void> {
  await mkdir(join(projectDir, 'src'), { recursive: true })
  await writeFile(
    join(projectDir, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        scripts: {
          dev: 'bun dev-server.mjs',
        },
      },
      null,
      2,
    ),
    'utf8',
  )
  await writeFile(
    join(projectDir, 'index.html'),
    [
      '<!doctype html>',
      '<html lang="en">',
      '  <head><meta charset="utf-8"><title>DSXU Frontend Proof</title></head>',
      '  <body>',
      '    <main id="root">DSXU_FRONTEND_PROJECT_READY</main>',
      '    <script type="module" src="/src/main.js"></script>',
      '  </body>',
      '</html>',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    join(projectDir, 'src', 'main.js'),
    'document.documentElement.dataset.dsxuHydrated = "true"\n',
    'utf8',
  )
  await writeFile(
    join(projectDir, 'dev-server.mjs'),
    [
      'import { readFile } from "fs/promises"',
      'import { join } from "path"',
      'if (process.env.DSXU_FRONTEND_PROOF_FAIL_FAST === "missing_native_dependency") {',
      '  console.error("Cannot find native binding: @rolldown/binding-win32-x64-msvc")',
      '  process.exit(1)',
      '}',
      'const port = Number(process.env.DSXU_FRONTEND_PROOF_PORT)',
      'const readyDelayMs = Number(process.env.DSXU_FRONTEND_PROOF_READY_DELAY_MS || 600)',
      'const startedAt = Date.now()',
      'let server',
      'const heartbeat = setInterval(() => {',
      '  console.log(`DSXU_FRONTEND_DEV_HEARTBEAT uptimeMs=${Date.now() - startedAt}`)',
      '}, 250)',
      'heartbeat.unref?.()',
      'function stop(signal) {',
      '  console.log(`DSXU_FRONTEND_DEV_STOPPING signal=${signal}`)',
      '  clearInterval(heartbeat)',
      '  server?.stop(true)',
      '  process.exit(0)',
      '}',
      'server = Bun.serve({',
      '  hostname: "127.0.0.1",',
      '  port,',
      '  async fetch(request) {',
      '    const url = new URL(request.url)',
      '    if (url.pathname === "/__dsxu_stop") {',
      '      setTimeout(() => stop("http"), 0)',
      '      return new Response("stopping", { status: 200 })',
      '    }',
      '    if (Date.now() - startedAt < readyDelayMs) return new Response("cold-start", { status: 503 })',
      '    if (url.pathname === "/src/main.js") {',
      '      return new Response(await readFile(join(process.cwd(), "src", "main.js"), "utf8"), { headers: { "content-type": "text/javascript; charset=utf-8" } })',
      '    }',
      '    return new Response(await readFile(join(process.cwd(), "index.html"), "utf8"), { headers: { "content-type": "text/html; charset=utf-8" } })',
      '  },',
      '})',
      'console.log(`DSXU_FRONTEND_DEV_LISTENING port=${server.port}`)',
      'process.on("SIGTERM", () => stop("SIGTERM"))',
      'process.on("SIGINT", () => stop("SIGINT"))',
    ].join('\n'),
    'utf8',
  )
}

function classifyDevServerFailure(input: {
  ok: boolean
  stderr: string
  processExitedBeforeReady: boolean
  readyStatus: number | null
  screenshotOk: boolean
}): FrontendProjectDevServerResult['failureType'] {
  if (input.ok) return 'none'
  if (
    input.stderr.includes('Cannot find native binding') ||
    input.stderr.includes('@rolldown/binding-win32-x64-msvc')
  ) {
    return 'missing_native_dependency'
  }
  if (input.processExitedBeforeReady) return 'process_exited_before_ready'
  if (input.readyStatus !== 200) return 'readiness_timeout'
  if (!input.screenshotOk) return 'browser_proof_failed'
  return 'process_exited_before_ready'
}

async function captureHeadlessShellScreenshot(
  url: string,
  screenshotPath: string,
): Promise<FrontendProjectDevServerResult['screenshotProof']> {
  const { chromium } = await import('playwright')
  const playwrightChromiumPath = chromium.executablePath()
  const headlessShellPath = playwrightChromiumPath.replace(
    'chromium-1217\\chrome-win64\\chrome.exe',
    'chromium_headless_shell-1217\\chrome-headless-shell-win64\\chrome-headless-shell.exe',
  )
  const hasHeadlessShell = (await statSizeIfExists(headlessShellPath)) > 0
  const executablePath = hasHeadlessShell ? headlessShellPath : playwrightChromiumPath
  const userDataDir = join(process.cwd(), '.dsxu', 'tmp', `browser-profile-${Date.now()}`)
  await mkdir(userDataDir, { recursive: true })

  const child = Bun.spawn(
    [
      executablePath,
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--no-first-run',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=1000',
      '--timeout=5000',
      `--user-data-dir=${userDataDir}`,
      '--window-size=900,700',
      `--screenshot=${screenshotPath}`,
      url,
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  const stdoutPromise = new Response(child.stdout).text()
  const stderrPromise = new Response(child.stderr).text()
  let timedOut = false
  let exitState = await waitForChildExit(child, 12_000)
  if (exitState === 'timeout') {
    timedOut = true
    child.kill('SIGTERM')
    exitState = await waitForChildExit(child, 1_500)
    if (exitState === 'timeout') child.kill()
  }
  const [stdout, stderr] = await Promise.allSettled([stdoutPromise, stderrPromise]).then(
    results =>
      results.map(result =>
        result.status === 'fulfilled' ? result.value : String(result.reason),
      ) as [string, string],
  )
  const bytes = await statSizeIfExists(screenshotPath)
  await removeBestEffort(userDataDir)

  return {
    ok: !timedOut && child.exitCode === 0 && bytes > 0,
    path: screenshotPath,
    bytes,
    browserExecutablePath: executablePath,
    strategy: hasHeadlessShell ? 'chromium-headless-shell-cli' : 'chromium-cli',
    exitCode: child.exitCode,
    timedOut,
    stdout,
    stderr,
  }
}

export async function runFrontendProjectDevServerHarness(
  options: FrontendProjectDevServerOptions = {},
): Promise<FrontendProjectDevServerResult> {
  const scenarioName = options.scenarioName ?? 'frontend-project-dev-server'
  const evidenceDir =
    options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-frontend-project')
  const projectDir = join(process.cwd(), '.dsxu', 'tmp', 'v18-frontend-project', scenarioName)
  const evidencePath = join(evidenceDir, `${scenarioName}.json`)
  const tracePath = join(evidenceDir, `${scenarioName}.trace.jsonl`)
  const screenshotPath = join(evidenceDir, `${scenarioName}.png`)
  const timeoutMs = options.timeoutMs ?? 20_000
  const readyDelayMs = options.readyDelayMs ?? 500
  const port = await findFreePort()
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const command = [npmCommand, 'run', 'dev']
  const coldStartStatuses: number[] = []
  const startedAt = Date.now()
  let readyStatus: number | null = null
  let stopStatus: FrontendProjectDevServerResult['stopStatus'] = 'failed'
  let processExitedBeforeReady = false
  let htmlProof: FrontendProjectDevServerResult['htmlProof'] = {
    url: `http://127.0.0.1:${port}/`,
    status: null,
    contentType: '',
    bodyContainsMarker: false,
    scriptPresent: false,
  }
  let screenshotProof: FrontendProjectDevServerResult['screenshotProof'] = {
    ok: false,
    path: screenshotPath,
    bytes: 0,
    browserExecutablePath: '',
    strategy: '',
    exitCode: null,
    timedOut: false,
    stdout: '',
    stderr: '',
  }
  let child: Subprocess<'ignore', 'pipe', 'pipe'> | null = null
  let stdout = ''
  let stderr = ''
  let error: string | undefined
  let stdoutPromise: Promise<string> | null = null
  let stderrPromise: Promise<string> | null = null

  await mkdir(evidenceDir, { recursive: true })
  await mkdir(projectDir, { recursive: true })
  await writeFile(tracePath, '', 'utf8')
  await writeFrontendProject(projectDir, options.failFast)
  await appendTrace(tracePath, {
    ts: Date.now(),
    event: 'project.written',
    data: { projectDir, command, port },
  })

  try {
    child = Bun.spawn(command, {
      cwd: projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        DSXU_FRONTEND_PROOF_PORT: String(port),
        DSXU_FRONTEND_PROOF_READY_DELAY_MS: String(readyDelayMs),
        DSXU_FRONTEND_PROOF_FAIL_FAST: options.failFast ?? '',
      },
    })
    stdoutPromise = new Response(child.stdout).text()
    stderrPromise = new Response(child.stderr).text()
    void child.exited.then(() => {
      if (readyStatus !== 200) processExitedBeforeReady = true
    })
    await appendTrace(tracePath, {
      ts: Date.now(),
      event: 'dev.started',
      data: { pid: child.pid },
    })

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      let status = 0
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(750),
        })
        status = response.status
      } catch {
        status = 0
      }

      if (status === 503) coldStartStatuses.push(status)
      await appendTrace(tracePath, {
        ts: Date.now(),
        event: 'http.poll',
        data: { status },
      })
      if (status === 200) {
        const response = await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(1000),
        })
        const body = await response.text()
        readyStatus = response.status
        htmlProof = {
          url: `http://127.0.0.1:${port}/`,
          status: response.status,
          contentType: response.headers.get('content-type') ?? '',
          bodyContainsMarker: body.includes('DSXU_FRONTEND_PROJECT_READY'),
          scriptPresent: body.includes('/src/main.js'),
        }
        await appendTrace(tracePath, {
          ts: Date.now(),
          event: 'http.ready',
          data: htmlProof,
        })
        break
      }
      if (processExitedBeforeReady || child.exitCode !== null) {
        processExitedBeforeReady = true
        throw new Error(`frontend dev process exited before ready; exitCode=${child.exitCode}`)
      }
      await new Promise(resolve => setTimeout(resolve, 150))
    }

    if (readyStatus !== 200) {
      throw new Error(`frontend dev server did not become ready; coldStarts=${coldStartStatuses.length}`)
    }

    screenshotProof = await captureHeadlessShellScreenshot(htmlProof.url, screenshotPath)
    await appendTrace(tracePath, {
      ts: Date.now(),
      event: screenshotProof.ok ? 'browser.screenshot.pass' : 'browser.screenshot.fail',
      data: screenshotProof,
    })

    try {
      await fetch(`http://127.0.0.1:${port}/__dsxu_stop`, {
        signal: AbortSignal.timeout(750),
      })
    } catch {
      child.kill('SIGTERM')
    }
    let exitState = await waitForChildExit(child, 2_000)
    if (exitState === 'timeout') {
      child.kill('SIGTERM')
      exitState = await waitForChildExit(child, 1_000)
      if (exitState === 'timeout') child.kill()
    }
    stopStatus = child.exitCode === 0 || child.exitCode === null ? 'stopped' : 'failed'
    const pipeResults = await Promise.allSettled([stdoutPromise, stderrPromise])
    stdout = pipeResults[0].status === 'fulfilled' ? pipeResults[0].value : String(pipeResults[0].reason)
    stderr = pipeResults[1].status === 'fulfilled' ? pipeResults[1].value : String(pipeResults[1].reason)
    await appendTrace(tracePath, {
      ts: Date.now(),
      event: 'dev.stopped',
      data: { exitCode: child.exitCode, stopStatus },
    })
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
    if (child) {
      child.kill('SIGTERM')
      await waitForChildExit(child, 1_000)
      if (child.exitCode === null) child.kill()
      const pipeResults = await Promise.allSettled([
        stdoutPromise ?? Promise.resolve(''),
        stderrPromise ?? Promise.resolve(''),
      ])
      stdout = pipeResults[0].status === 'fulfilled' ? pipeResults[0].value : String(pipeResults[0].reason)
      stderr = pipeResults[1].status === 'fulfilled' ? pipeResults[1].value : String(pipeResults[1].reason)
    }
    await appendTrace(tracePath, {
      ts: Date.now(),
      event: 'dev.failed',
      data: { error },
    })
  }

  const cleanupError = await removeBestEffort(projectDir)
  const ok =
      readyStatus === 200 &&
      coldStartStatuses.includes(503) &&
      htmlProof.bodyContainsMarker &&
      htmlProof.scriptPresent &&
      screenshotProof.ok &&
      stopStatus === 'stopped' &&
      !cleanupError &&
      !error
  const failureType = classifyDevServerFailure({
    ok,
    stderr,
    processExitedBeforeReady,
    readyStatus,
    screenshotOk: screenshotProof.ok,
  })
  const result: FrontendProjectDevServerResult = {
    ok,
    evidencePath,
    tracePath,
    projectDir,
    port,
    command,
    coldStartStatuses,
    readyStatus,
    htmlProof,
    screenshotProof,
    stopStatus,
    processExitedBeforeReady,
    failureType,
    exitCode: child?.exitCode ?? null,
    stdout,
    stderr,
    elapsedMs: Date.now() - startedAt,
    cleanupError,
    error: error ?? cleanupError,
  }

  await writeFile(evidencePath, JSON.stringify(result, null, 2), 'utf8')
  return result
}
