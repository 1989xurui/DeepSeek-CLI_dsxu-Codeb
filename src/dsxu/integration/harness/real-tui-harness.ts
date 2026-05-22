import { execFile } from 'child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const WSL_PROVIDER_ENV_KEYS = [
  'DSXU_API_KEY',
  'DEEPSEEK_API_KEY',
  'DSXU_DEEPSEEK_API_KEY',
  'LITELLM_BASE_URL',
  'DSXU_MODEL_PROVIDER',
  'DSXU_MODEL_GATEWAY',
]

export type RealTuiHarnessResult = {
  ok: boolean
  status: 'exited' | 'timeout' | 'spawn_failed'
  exitCode: number | null
  sentExit: boolean
  sawWelcome: boolean
  sawPrompt: boolean
  sawProgress: boolean
  progressMarkerCount: number
  sawLoginWarning: boolean
  sawMojibake: boolean
  sawTerminalMojibake: boolean
  sawInputEncodingLoss: boolean
  sentInputCount: number
  sawPromptAfterTask: boolean
  sawPermissionFallbackBar: boolean
  sawPermissionReplayMarker: boolean
  sawPermissionDialog?: boolean
  sawPermissionDialogBorder?: boolean
  sawPermissionProceedQuestion?: boolean
  sawPermissionDialogAfterResize?: boolean
  sawPermissionDialogBorderAfterResize?: boolean
  sawNoProgressReplayTrace: boolean
  sawBackgroundTaskReplayTrace: boolean
  sawBackgroundTaskPillMarker: boolean
  sawAutoContinueReplayMarker: boolean
  sawResumeReplayMarker: boolean
  sawResumeReplayQueuedTrace: boolean
  sawResumeSourceTruthGateTrace: boolean
  sawResumeProviderPreflightTrace: boolean
  sawAutoContinueEnqueuedTrace: boolean
  sawAutoContinueProcessedTrace: boolean
  sawAutoContinueSuppressedTrace: boolean
  sawTuiHealthTrace: boolean
  sawTuiStallTrace: boolean
  resizeReplayRequested?: boolean
  resizeEventsSent?: number
  sawLongContentResizeMarker?: boolean
  sawLongContentResizeTailMarker?: boolean
  sawLongContentResizeTailAfterResize?: boolean
  sawPromptAfterResize?: boolean
  sawLongContentResizeQueuedTrace?: boolean
  scrollbackResizeReplayRequested?: boolean
  scrollbackPageUpsSent?: number
  sawScrollbackResizeMiddleAfterResize?: boolean
  sawScrollbackResizeTopAfterResize?: boolean
  sawScrollbackResizeTailAfterResize?: boolean
  sawScrollbackResizePositionedTrace?: boolean
  sawDsxuTrustReplayMarker?: boolean
  sawDsxuEvidenceLine?: boolean
  sawDsxuTrustLine?: boolean
  sawDsxuTrustLedgerLine?: boolean
  sawDsxuTrustAgentLine?: boolean
  sawDsxuTrustProofLine?: boolean
  sawDsxuTrustProofLineAfterResize?: boolean
  dsxuTrustProofLineCount?: number
  sawDsxuTrustProofFlood?: boolean
  outputBytes: number
  elapsedMs: number
  tail: string
  transcriptPath?: string
  tracePath?: string
  lifecycleTraceDir?: string
  lifecycleTraceFiles?: string[]
  error?: string
}

export type RealTuiHarnessOptions = {
  distro?: string
  root?: string
  timeoutMs?: number
  evidenceDir?: string
  scenarioName?: string
  inputsAfterPrompt?: string[]
  waitForNewPromptBetweenInputs?: boolean
  permissionPromptReplay?: boolean
  noProgressReplay?: boolean
  backgroundTaskReplay?: boolean
  autoContinueReplay?: boolean
  resumeReplay?: boolean
  longContentResizeReplay?: boolean
  trustProofReplay?: boolean
  resizeSequence?: Array<{
    rows: number
    cols: number
    afterMs?: number
  }>
  scrollbackResizeReplay?: boolean
  scrollbackPageUps?: number
}

function windowsPathToWslPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (!match) return normalized
  return `/mnt/${match[1]!.toLowerCase()}/${match[2]}`
}

function wslPathToWindowsUnc(distro: string, wslPath: string): string {
  return `\\\\wsl.localhost\\${distro}\\${wslPath.replace(/^\//, '').replace(/\//g, '\\')}`
}

async function getWslHome(distro: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { stdout } = await execFileAsync(
        'wsl.exe',
        ['-d', distro, '--', 'bash', '-lc', 'printf %s "$HOME"'],
        {
          timeout: 15_000,
          maxBuffer: 1024 * 1024,
          windowsHide: true,
        },
      )
      return String(stdout).trim() || '/tmp'
    } catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'unknown WSL home probe failure'))
}

function buildWslProviderForwardEnv(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const presentProviderKeys = WSL_PROVIDER_ENV_KEYS.filter(key => {
    const value = env[key]
    return typeof value === 'string' && value.length > 0
  })
  if (presentProviderKeys.length === 0) return env

  const existing = env.WSLENV
    ? env.WSLENV.split(':').filter(Boolean)
    : []
  const forwarded = presentProviderKeys.map(key => `${key}/u`)
  return {
    ...env,
    WSLENV: [...new Set([...existing, ...forwarded])].join(':'),
  }
}

function buildPythonHarness(
  root: string,
  timeoutMs: number,
  evidenceDir: string,
  scenarioName: string,
  inputsAfterPrompt: string[],
  waitForNewPromptBetweenInputs: boolean,
  permissionPromptReplay: boolean,
  noProgressReplay: boolean,
  backgroundTaskReplay: boolean,
  autoContinueReplay: boolean,
  resumeReplay: boolean,
  longContentResizeReplay: boolean,
  trustProofReplay: boolean,
  resizeSequence: Array<{ rows: number; cols: number; afterMs?: number }>,
  scrollbackResizeReplay: boolean,
  scrollbackPageUps: number,
): string {
  const timeoutSeconds = Math.max(5, Math.ceil(timeoutMs / 1000))
  const effectiveResizeSequence =
    resizeSequence.length > 0
      ? resizeSequence
      : [
          { rows: 18, cols: 80, afterMs: 250 },
          { rows: 34, cols: 140, afterMs: 250 },
          { rows: 14, cols: 62, afterMs: 250 },
          { rows: 30, cols: 118, afterMs: 350 },
        ]
  return String.raw`
import fcntl, glob, json, os, pty, re, select, shutil, signal, struct, subprocess, termios, time

root = ${JSON.stringify(root)}
timeout_s = ${timeoutSeconds}
evidence_dir = ${JSON.stringify(evidenceDir)}
scenario_name = ${JSON.stringify(scenarioName)}
inputs_after_prompt = ${JSON.stringify(inputsAfterPrompt)}
wait_for_new_prompt_between_inputs = ${waitForNewPromptBetweenInputs ? 'True' : 'False'}
permission_prompt_replay = ${permissionPromptReplay ? 'True' : 'False'}
no_progress_replay = ${noProgressReplay ? 'True' : 'False'}
background_task_replay = ${backgroundTaskReplay ? 'True' : 'False'}
auto_continue_replay = ${autoContinueReplay ? 'True' : 'False'}
resume_replay = ${resumeReplay ? 'True' : 'False'}
long_content_resize_replay = ${longContentResizeReplay ? 'True' : 'False'}
trust_proof_replay = ${trustProofReplay ? 'True' : 'False'}
scrollback_resize_replay = ${scrollbackResizeReplay ? 'True' : 'False'}
scrollback_page_ups = ${Math.max(1, scrollbackPageUps)}
resize_sequence = ${JSON.stringify(effectiveResizeSequence)}
env = os.environ.copy()
home = env.get("HOME", "/home/xurui")
env["PATH"] = f"{home}/.bun/bin:/usr/local/bin:/usr/bin:/bin:" + env.get("PATH", "")
env["LANG"] = env.get("LANG") or "C.UTF-8"
env["LC_ALL"] = env.get("LC_ALL") or "C.UTF-8"
env["PYTHONIOENCODING"] = "utf-8"
env["TERM"] = "xterm-256color"
env["DSXU_KEEP_WSL_OPEN"] = "0"
env["DSXU_TUI_HARNESS"] = "1"
if permission_prompt_replay:
    env["DSXU_CODE_TUI_HARNESS_PERMISSION_PROMPT"] = "1"
if no_progress_replay:
    env["DSXU_CODE_TUI_HARNESS_NO_PROGRESS_REPLAY"] = "1"
if background_task_replay:
    env["DSXU_CODE_TUI_HARNESS_BACKGROUND_TASK_REPLAY"] = "1"
if auto_continue_replay:
    env["DSXU_CODE_TUI_HARNESS_AUTO_CONTINUE_REPLAY"] = "1"
if resume_replay:
    env["DSXU_CODE_TUI_HARNESS_RESUME_REPLAY"] = "1"
if trust_proof_replay:
    env["DSXU_CODE_TUI_HARNESS_TRUST_PROOF_REPLAY"] = "1"
if long_content_resize_replay or scrollback_resize_replay:
    env["DSXU_CODE_TUI_HARNESS_LONG_CONTENT_RESIZE"] = "1"
    env["DSXU_CODE_NO_FLICKER"] = "1"
if scrollback_resize_replay:
    env["DSXU_CODE_TUI_HARNESS_SCROLLBACK_RESIZE"] = "1"

start = time.time()
buf = bytearray()
sent_exit = False
saw_welcome = False
saw_prompt = False
saw_progress = False
progress_markers_seen = set()
progress_marker_count = 0
saw_login_warning = False
saw_mojibake = False
status = "timeout"
exit_code = None
error = None
input_index = 0
last_input_total = 0
last_input_at = 0.0
saw_prompt_after_task = False
saw_permission_fallback_bar = False
saw_permission_replay_marker = False
saw_permission_dialog = False
saw_permission_dialog_border = False
saw_permission_proceed_question = False
saw_permission_dialog_after_resize = False
saw_permission_dialog_border_after_resize = False
saw_no_progress_replay_trace = False
saw_background_task_replay_trace = False
saw_background_task_pill_marker = False
saw_auto_continue_replay_marker = False
saw_resume_replay_marker = False
saw_resume_replay_queued_trace = False
saw_resume_source_truth_gate_trace = False
saw_resume_provider_preflight_trace = False
saw_auto_continue_enqueued_trace = False
saw_auto_continue_processed_trace = False
saw_auto_continue_suppressed_trace = False
saw_long_content_resize_marker = False
saw_long_content_resize_tail_marker = False
saw_long_content_resize_tail_after_resize = False
saw_prompt_after_resize = False
saw_long_content_resize_queued_trace = False
resize_events_sent = 0
resize_sequence_done = False
resize_start_total = 0
scrollback_position_done = False
scrollback_page_ups_sent = 0
saw_scrollback_resize_middle_after_resize = False
saw_scrollback_resize_top_after_resize = False
saw_scrollback_resize_tail_after_resize = False
saw_scrollback_resize_positioned_trace = False
saw_dsxu_trust_replay_marker = False
saw_dsxu_evidence_line = False
saw_dsxu_trust_line = False
saw_dsxu_trust_ledger_line = False
saw_dsxu_trust_agent_line = False
saw_dsxu_trust_proof_line = False
saw_dsxu_trust_proof_line_after_resize = False
dsxu_trust_proof_line_count = 0
saw_dsxu_trust_proof_flood = False
lifecycle_trace_text = ""
trace = []

os.makedirs(evidence_dir, exist_ok=True)
transcript_path = os.path.join(evidence_dir, f"{scenario_name}.transcript.txt")
trace_path = os.path.join(evidence_dir, f"{scenario_name}.trace.jsonl")
lifecycle_trace_dir = os.path.join(evidence_dir, f"{scenario_name}.lifecycle")
shutil.rmtree(lifecycle_trace_dir, ignore_errors=True)
os.makedirs(lifecycle_trace_dir, exist_ok=True)
env["DSXU_CODE_LIFECYCLE_TRACE"] = "1"
env["DSXU_CODE_LIFECYCLE_TRACE_DIR"] = lifecycle_trace_dir
try:
    open(trace_path, "w", encoding="utf-8").close()
except Exception:
    pass

def read_lifecycle_trace_text():
    files = sorted(glob.glob(os.path.join(lifecycle_trace_dir, "dsxu-lifecycle-*.jsonl")))
    text = ""
    for lifecycle_trace_file in files:
        try:
            with open(lifecycle_trace_file, "r", encoding="utf-8", errors="replace") as handle:
                text += handle.read()
        except Exception:
            pass
    return files, text

def record(event, **data):
    item = {"ts": time.time(), "event": event, **data}
    trace.append(item)
    try:
        with open(trace_path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")
    except Exception:
        pass

ansi_re = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\\\)")

def compact_terminal_text(value):
    stripped = ansi_re.sub("", value)
    return re.sub(r"\s+", "", stripped)

def plain_terminal_text(value):
    return ansi_re.sub("", value).replace("\r", "\n")

def has_prompt_marker(value):
    compact = compact_terminal_text(value)
    return (
        "\u276f" in value
        or "? for shortcuts" in value
        or "WhatshouldDSXUdo" in compact
        or ("Whatshould" in compact and "instead" in compact)
    )

def has_visible_border_line(value):
    plain = plain_terminal_text(value)
    return re.search(r"[-\u2500\u2501\u2550]{8,}", plain) is not None

def has_permission_dialog_border(value):
    compact = compact_terminal_text(value)
    if not (
        "Bashcommand" in compact
        or "PowerShellcommand" in compact
        or "Editfile" in compact
        or "Writefile" in compact
        or "Reviewrequired" in compact
    ):
        return False
    plain = plain_terminal_text(value)
    lines = [line for line in plain.split("\n") if line.strip()]
    for index, line in enumerate(lines):
        compact_line = re.sub(r"\s+", "", line)
        if (
            "Bashcommand" in compact_line
            or "PowerShellcommand" in compact_line
            or "Editfile" in compact_line
            or "Writefile" in compact_line
            or "Reviewrequired" in compact_line
        ):
            window = "\n".join(lines[max(0, index - 3):index + 4])
            if has_visible_border_line(window):
                return True
    return False

def set_winsize(fd, rows, cols, proc=None, stage="resize"):
    global resize_events_sent
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    resize_events_sent += 1
    if proc is not None:
        try:
            os.killpg(proc.pid, signal.SIGWINCH)
        except Exception:
            pass
    record(stage, rows=rows, cols=cols, resizeEventsSent=resize_events_sent)

try:
    record("spawn", root=root)
    master, slave = pty.openpty()
    if (long_content_resize_replay or scrollback_resize_replay) and len(resize_sequence) > 0:
        first = resize_sequence[0]
        set_winsize(slave, int(first.get("rows", 24)), int(first.get("cols", 80)), None, "initial_resize")
    proc = subprocess.Popen(
        ["bash", "./bin/dsxu-code"],
        cwd=root,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        env=env,
        start_new_session=True,
    )
    os.close(slave)
    os.set_blocking(master, False)

    while time.time() - start < timeout_s:
        ready, _, _ = select.select([master], [], [], 0.1)
        if ready:
            try:
                chunk = os.read(master, 8192)
                if not chunk:
                    break
                buf.extend(chunk)
                record("output", bytes=len(chunk), total_bytes=len(buf))
            except BlockingIOError:
                pass
            except OSError:
                break

        text = buf.decode("utf-8", errors="replace")
        compact_text = compact_terminal_text(text)
        saw_welcome = saw_welcome or ("DSXU Code" in text or "Welcome" in text)
        saw_prompt = saw_prompt or has_prompt_marker(text)
        saw_permission_fallback_bar = saw_permission_fallback_bar or (
            (
                "Reviewrequired" in compact_text and (
                    "pendingreviewvisible" in compact_text
                    or "Approvaldialog" in compact_text
                    or "approvalpanel" in compact_text
                )
            )
            or (
                "approvalpanel" in compact_text
                and "pendingreviewvisible" in compact_text
            )
        )
        saw_permission_dialog = saw_permission_dialog or (
            "Bashcommand" in compact_text
            or "PowerShellcommand" in compact_text
            or "Editfile" in compact_text
            or "Writefile" in compact_text
        )
        saw_permission_dialog_border = saw_permission_dialog_border or has_permission_dialog_border(text)
        saw_permission_proceed_question = saw_permission_proceed_question or (
            "Doyouwanttoproceed" in compact_text
        )
        saw_permission_replay_marker = saw_permission_replay_marker or (
            "DSXU_TUI_PERMISSION_REPLAY" in text
        )
        saw_background_task_pill_marker = saw_background_task_pill_marker or (
            "1localagent" in compact_text
            or "1backgroundtask" in compact_text
            or "DSXUTUIbackgroundtaskreplay" in compact_text
        )
        saw_auto_continue_replay_marker = saw_auto_continue_replay_marker or (
            "DSXU_TUI_AUTO_CONTINUE_REPLAY_META" in text
        )
        saw_resume_replay_marker = saw_resume_replay_marker or (
            "DSXU_TUI_RESUME_REPLAY_META" in text
        )
        saw_long_content_resize_marker = saw_long_content_resize_marker or (
            "DSXU_TUI_LONG_CONTENT_RESIZE_START" in text
        )
        saw_long_content_resize_tail_marker = saw_long_content_resize_tail_marker or (
            "DSXU_TUI_LONG_CONTENT_RESIZE_TAIL_MARKER" in text
        )
        saw_dsxu_trust_replay_marker = saw_dsxu_trust_replay_marker or (
            "DSXU_TUI_TRUST_PROOF_REPLAY_META" in text
        )
        saw_dsxu_evidence_line = saw_dsxu_evidence_line or (
            "Evidence:deepseek-v4-flash" in compact_text
            and "usage=available" in compact_text
        )
        saw_dsxu_trust_line = saw_dsxu_trust_line or (
            "DSXU:Flash" in compact_text
            and "check:pass" in compact_text
            and "cache:78%" in compact_text
        )
        saw_dsxu_trust_ledger_line = saw_dsxu_trust_ledger_line or (
            "task:verify" in compact_text
            and "events:6" in compact_text
            and "next:verify" in compact_text
        )
        saw_dsxu_trust_agent_line = saw_dsxu_trust_agent_line or (
            "agent:1" in compact_text
            and "running:1" in compact_text
            and "scope:src/dsxu/engine" in compact_text
        )
        saw_dsxu_trust_proof_line = saw_dsxu_trust_proof_line or (
            "proof:toolok3/3|eventok2/2" in compact_text
        )
        dsxu_trust_proof_line_count = len(re.findall(r"proof:tool\s*ok\s*3/3", plain_terminal_text(text)))
        saw_dsxu_trust_proof_flood = saw_dsxu_trust_proof_flood or dsxu_trust_proof_line_count > 48
        if resize_sequence_done and resize_start_total > 0:
            text_after_resize = buf[resize_start_total:].decode("utf-8", errors="replace")
            viewport_after_resize = text_after_resize.rsplit("\x1b[H", 1)[-1]
            saw_long_content_resize_tail_after_resize = saw_long_content_resize_tail_after_resize or (
                "DSXU_TUI_LONG_CONTENT_RESIZE_TAIL_MARKER" in text_after_resize
            )
            saw_prompt_after_resize = saw_prompt_after_resize or has_prompt_marker(text_after_resize)
            compact_after_resize = compact_terminal_text(text_after_resize)
            saw_dsxu_trust_proof_line_after_resize = saw_dsxu_trust_proof_line_after_resize or (
                "proof:toolok3/3|eventok2/2" in compact_after_resize
            )
            saw_permission_dialog_after_resize = saw_permission_dialog_after_resize or (
                "Bashcommand" in compact_after_resize
                or "PowerShellcommand" in compact_after_resize
                or "Editfile" in compact_after_resize
                or "Writefile" in compact_after_resize
                or "Reviewrequired" in compact_after_resize
            )
            saw_permission_dialog_border_after_resize = (
                saw_permission_dialog_border_after_resize
                or has_permission_dialog_border(text_after_resize)
            )
            saw_scrollback_resize_top_after_resize = saw_scrollback_resize_top_after_resize or (
                "DSXU_TUI_LONG_CONTENT_RESIZE_ROW_001" in viewport_after_resize
                or "Welcome back" in viewport_after_resize
            )
            saw_scrollback_resize_middle_after_resize = saw_scrollback_resize_middle_after_resize or any(
                f"DSXU_TUI_LONG_CONTENT_RESIZE_ROW_{i:03d}" in viewport_after_resize
                for i in range(55, 151)
            )
            saw_scrollback_resize_tail_after_resize = saw_scrollback_resize_tail_after_resize or (
                "DSXU_TUI_LONG_CONTENT_RESIZE_TAIL_MARKER" in viewport_after_resize
                or any(
                    f"DSXU_TUI_LONG_CONTENT_RESIZE_ROW_{i:03d}" in viewport_after_resize
                    for i in range(172, 181)
                )
            )
        if auto_continue_replay or resume_replay or no_progress_replay or background_task_replay or long_content_resize_replay or scrollback_resize_replay:
            _, lifecycle_trace_text = read_lifecycle_trace_text()
            saw_no_progress_replay_trace = saw_no_progress_replay_trace or (
                '"event":"tui_harness_no_progress_replay_started"' in lifecycle_trace_text
                and '"event":"tui_health_stalled"' in lifecycle_trace_text
                and '"visibleState":"stuck_no_event"' in lifecycle_trace_text
                and '"event":"tui_harness_no_progress_replay_recovered"' in lifecycle_trace_text
            )
            saw_auto_continue_enqueued_trace = saw_auto_continue_enqueued_trace or (
                '"event":"tool_result_auto_continue_enqueued"' in lifecycle_trace_text
            )
            saw_background_task_replay_trace = saw_background_task_replay_trace or (
                '"event":"tui_harness_background_task_replay_registered"' in lifecycle_trace_text
                and '"visibleState":"background_task_running"' in lifecycle_trace_text
                and '"id":"a-dsxu-tui-bg-replay"' in lifecycle_trace_text
                and '"toolUseId":"toolu-dsxu-tui-bg-replay"' in lifecycle_trace_text
            )
            saw_auto_continue_processed_trace = saw_auto_continue_processed_trace or (
                '"event":"tool_result_auto_continue_processed"' in lifecycle_trace_text
                and '"phase":"started"' in lifecycle_trace_text
            )
            saw_auto_continue_suppressed_trace = saw_auto_continue_suppressed_trace or (
                '"event":"tool_result_auto_continue_suppressed"' in lifecycle_trace_text
            )
            saw_resume_replay_queued_trace = saw_resume_replay_queued_trace or (
                '"event":"tui_harness_resume_replay_queued"' in lifecycle_trace_text
            )
            saw_resume_source_truth_gate_trace = saw_resume_source_truth_gate_trace or (
                '"gateId":"dsxu_recovery_post_compact_source_truth_required"' in lifecycle_trace_text
                and '"owner":"query_loop"' in lifecycle_trace_text
                and '"gateClass":"QUALITY_BLOCK"' in lifecycle_trace_text
                and '"nextAction":"read_source_truth"' in lifecycle_trace_text
            )
            saw_resume_provider_preflight_trace = saw_resume_provider_preflight_trace or (
                '"event":"provider_resume_replay_preflight"' in lifecycle_trace_text
                and '"boundary":"provider_request_preflight"' in lifecycle_trace_text
                and '"schemaVersion":"dsxu.compact-recovery.v1"' in lifecycle_trace_text
                and '"sourceTruthRefreshRequired":true' in lifecycle_trace_text
                and '"failedCommandPreserved":true' in lifecycle_trace_text
                and '"verificationStatePreserved":true' in lifecycle_trace_text
                and '"nextActionPreserved":true' in lifecycle_trace_text
                and '"experienceStorePackPreserved":true' in lifecycle_trace_text
            )
            saw_long_content_resize_queued_trace = saw_long_content_resize_queued_trace or (
                '"event":"tui_harness_long_content_resize_replay_queued"' in lifecycle_trace_text
                and '"expectedVisibleState":"sticky_bottom_after_resize"' in lifecycle_trace_text
            )
            saw_scrollback_resize_positioned_trace = saw_scrollback_resize_positioned_trace or (
                '"event":"tui_harness_scrollback_resize_positioned"' in lifecycle_trace_text
                and '"expectedVisibleState":"middle_scrollback_after_resize"' in lifecycle_trace_text
            )
        if (
            scrollback_resize_replay
            and not scrollback_position_done
            and saw_scrollback_resize_positioned_trace
        ):
            scrollback_position_done = True
            record("scrollback_position_done", pageUpsSent=scrollback_page_ups_sent, positionedTrace=True)
            time.sleep(0.4)
        if (
            (long_content_resize_replay or scrollback_resize_replay)
            and not resize_sequence_done
            and saw_long_content_resize_tail_marker
            and saw_long_content_resize_queued_trace
            and (not scrollback_resize_replay or scrollback_position_done)
        ):
            resize_start_total = len(buf)
            for index, item in enumerate(resize_sequence):
                rows = int(item.get("rows", 24))
                cols = int(item.get("cols", 80))
                set_winsize(master, rows, cols, proc, "resize")
                time.sleep(max(0.05, float(item.get("afterMs", 250)) / 1000.0))
            resize_sequence_done = True
            record("resize_sequence_done", resizeEventsSent=resize_events_sent)
        progress_markers = [
            "Thinking", "Churned for", "Cooked for", "Brewed for",
            "Worked for", "Waiting", "Successfully loaded", "Listed ",
            "Read ", "Searched ", "Julienning", "Crunched for",
            "Cogitated for", "Choreographing", "Baked for",
            "Done", "Success", "PASS", "\u2713", "\u2714"
        ]
        for marker in progress_markers:
            if marker in text and marker not in progress_markers_seen:
                progress_markers_seen.add(marker)
        progress_marker_count = len(progress_markers_seen)
        saw_progress = saw_progress or progress_marker_count > 0
        saw_login_warning = saw_login_warning or (
            ("Notloggedin" in compact_text and "Run/login" in compact_text)
            or ("Authrequired" in compact_text and "Run/login" in compact_text)
            or ("Authenticationblocked" in compact_text and "Run/login" in compact_text)
        )
        mojibake_markers = [
            "\ufffd",
            "\u951f\u65a4\u62f7",
            "\u9225",
            "\u9239",
            "\u923a",
            "\u923b",
            "\u9233",
            "\u9241",
            "\u9242",
            "\u9245",
            "\u922b",
            "\u71f6",
        ]
        saw_mojibake = saw_mojibake or any(marker in text for marker in mojibake_markers) or re.search(r"\?{3,}.*\?{3,}", text) is not None

        can_send_input = False
        permission_review_ready = (
            permission_prompt_replay
            and input_index == 0
            and (saw_permission_dialog or saw_permission_fallback_bar)
        )
        if (saw_prompt or permission_review_ready) and input_index < len(inputs_after_prompt):
            if input_index == 0 or not wait_for_new_prompt_between_inputs:
                can_send_input = True
            else:
                text_after_last_input = buf[last_input_total:].decode("utf-8", errors="replace")
                prompt_after_last_input = has_prompt_marker(text_after_last_input)
                saw_prompt_after_task = saw_prompt_after_task or prompt_after_last_input
                can_send_input = prompt_after_last_input and (time.time() - last_input_at) >= 1.0
            if (
                permission_prompt_replay
                and input_index == 0
                and not (saw_permission_replay_marker or saw_permission_dialog or saw_permission_fallback_bar)
            ):
                can_send_input = False
            if no_progress_replay and input_index == 0 and not saw_no_progress_replay_trace:
                can_send_input = False
            if background_task_replay and input_index == 0 and not saw_background_task_replay_trace:
                can_send_input = False
            if background_task_replay and input_index == 0 and not saw_background_task_pill_marker:
                can_send_input = False
            if auto_continue_replay and input_index == 0 and not saw_auto_continue_enqueued_trace:
                can_send_input = False
            if resume_replay and input_index == 0 and not saw_auto_continue_enqueued_trace:
                can_send_input = False
            if resume_replay and input_index == 0 and not saw_resume_source_truth_gate_trace:
                can_send_input = False
            if resume_replay and input_index == 0 and not saw_resume_provider_preflight_trace:
                can_send_input = False
            if (long_content_resize_replay or scrollback_resize_replay) and input_index == 0 and not resize_sequence_done:
                can_send_input = False
            if long_content_resize_replay and input_index == 0 and not saw_long_content_resize_tail_after_resize:
                can_send_input = False
            if scrollback_resize_replay and input_index == 0 and not saw_scrollback_resize_middle_after_resize:
                can_send_input = False

        if can_send_input:
            time.sleep(0.5)
            next_input = inputs_after_prompt[input_index]
            if next_input == "\x1b":
                os.write(master, next_input.encode("utf-8"))
            else:
                os.write(master, (next_input + "\r").encode("utf-8"))
            record("input", value=next_input)
            if next_input.strip() == "/exit":
                sent_exit = True
            input_index += 1
            last_input_total = len(buf)
            last_input_at = time.time()
            time.sleep(0.5)
        elif (
            (not sent_exit)
            and saw_prompt
            and not inputs_after_prompt
            and not (
                (long_content_resize_replay and not saw_long_content_resize_tail_after_resize)
                or (scrollback_resize_replay and not saw_scrollback_resize_middle_after_resize)
            )
        ):
            time.sleep(0.5)
            os.write(master, b"/exit\r")
            record("input", value="/exit")
            sent_exit = True

        if proc.poll() is not None:
            status = "exited"
            break

    if proc.poll() is None and sent_exit:
        try:
            proc.wait(timeout=3)
            status = "exited"
        except subprocess.TimeoutExpired:
            pass

    if proc.poll() is None:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except Exception:
            proc.terminate()
        time.sleep(0.5)
        if proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except Exception:
                proc.kill()
    else:
        status = "exited"

    exit_code = proc.poll()
except Exception as exc:
    status = "spawn_failed"
    error = repr(exc)
    record("error", error=error)

elapsed_ms = int((time.time() - start) * 1000)
final_text = buf.decode("utf-8", errors="replace")
compact_final_text = compact_terminal_text(final_text)
tail = final_text[-6000:]
saw_login_warning = (
    ("Notloggedin" in compact_final_text and "Run/login" in compact_final_text)
    or ("Authrequired" in compact_final_text and "Run/login" in compact_final_text)
    or ("Authenticationblocked" in compact_final_text and "Run/login" in compact_final_text)
)
saw_input_encoding_loss = re.search(r"\?{3,}.*\?{3,}", final_text) is not None
mojibake_markers = [
    "\ufffd",
    "\u951f\u65a4\u62f7",
    "\u9225",
    "\u9239",
    "\u923a",
    "\u923b",
    "\u9233",
    "\u9241",
    "\u9242",
    "\u9245",
    "\u922b",
    "\u71f6",
]
saw_terminal_mojibake = any(marker in final_text for marker in mojibake_markers)
saw_mojibake = saw_terminal_mojibake or saw_input_encoding_loss
saw_dsxu_trust_replay_marker = saw_dsxu_trust_replay_marker or (
    "DSXU_TUI_TRUST_PROOF_REPLAY_META" in final_text
)
saw_dsxu_evidence_line = saw_dsxu_evidence_line or (
    "Evidence:deepseek-v4-flash" in compact_final_text
    and "usage=available" in compact_final_text
)
saw_dsxu_trust_line = saw_dsxu_trust_line or (
    "DSXU:Flash" in compact_final_text
    and "check:pass" in compact_final_text
    and "cache:78%" in compact_final_text
)
saw_dsxu_trust_ledger_line = saw_dsxu_trust_ledger_line or (
    "task:verify" in compact_final_text
    and "events:6" in compact_final_text
    and "next:verify" in compact_final_text
)
saw_dsxu_trust_agent_line = saw_dsxu_trust_agent_line or (
    "agent:1" in compact_final_text
    and "running:1" in compact_final_text
    and "scope:src/dsxu/engine" in compact_final_text
)
saw_dsxu_trust_proof_line = saw_dsxu_trust_proof_line or (
    "proof:toolok3/3|eventok2/2" in compact_final_text
)
dsxu_trust_proof_line_count = len(re.findall(r"proof:tool\s*ok\s*3/3", plain_terminal_text(final_text)))
saw_dsxu_trust_proof_flood = saw_dsxu_trust_proof_flood or dsxu_trust_proof_line_count > 48
try:
    with open(transcript_path, "wb") as handle:
        handle.write(buf)
except Exception:
    pass
def read_lifecycle_trace_text():
    files = sorted(glob.glob(os.path.join(lifecycle_trace_dir, "dsxu-lifecycle-*.jsonl")))
    text = ""
    for lifecycle_trace_file in files:
        try:
            with open(lifecycle_trace_file, "r", encoding="utf-8", errors="replace") as handle:
                text += handle.read()
        except Exception:
            pass
    return files, text

lifecycle_trace_files = []
lifecycle_trace_text = ""
trace_deadline = time.time() + 2.0
while time.time() < trace_deadline:
    lifecycle_trace_files, lifecycle_trace_text = read_lifecycle_trace_text()
    if '"event":"tui_health_snapshot"' in lifecycle_trace_text:
        break
    time.sleep(0.1)
saw_tui_health_trace = '"event":"tui_health_snapshot"' in lifecycle_trace_text
saw_tui_stall_trace = '"event":"tui_health_stalled"' in lifecycle_trace_text
saw_no_progress_replay_trace = (
    '"event":"tui_harness_no_progress_replay_started"' in lifecycle_trace_text
    and '"event":"tui_health_stalled"' in lifecycle_trace_text
    and '"visibleState":"stuck_no_event"' in lifecycle_trace_text
    and '"event":"tui_harness_no_progress_replay_recovered"' in lifecycle_trace_text
)
saw_background_task_replay_trace = (
    '"event":"tui_harness_background_task_replay_registered"' in lifecycle_trace_text
    and '"visibleState":"background_task_running"' in lifecycle_trace_text
    and '"id":"a-dsxu-tui-bg-replay"' in lifecycle_trace_text
    and '"toolUseId":"toolu-dsxu-tui-bg-replay"' in lifecycle_trace_text
)
saw_auto_continue_enqueued_trace = '"event":"tool_result_auto_continue_enqueued"' in lifecycle_trace_text
saw_auto_continue_processed_trace = (
    '"event":"tool_result_auto_continue_processed"' in lifecycle_trace_text
    and '"phase":"started"' in lifecycle_trace_text
)
saw_auto_continue_suppressed_trace = '"event":"tool_result_auto_continue_suppressed"' in lifecycle_trace_text
saw_resume_replay_queued_trace = '"event":"tui_harness_resume_replay_queued"' in lifecycle_trace_text
saw_resume_source_truth_gate_trace = (
    '"gateId":"dsxu_recovery_post_compact_source_truth_required"' in lifecycle_trace_text
    and '"owner":"query_loop"' in lifecycle_trace_text
    and '"gateClass":"QUALITY_BLOCK"' in lifecycle_trace_text
    and '"nextAction":"read_source_truth"' in lifecycle_trace_text
)
saw_resume_provider_preflight_trace = (
    '"event":"provider_resume_replay_preflight"' in lifecycle_trace_text
    and '"boundary":"provider_request_preflight"' in lifecycle_trace_text
    and '"schemaVersion":"dsxu.compact-recovery.v1"' in lifecycle_trace_text
    and '"sourceTruthRefreshRequired":true' in lifecycle_trace_text
    and '"failedCommandPreserved":true' in lifecycle_trace_text
    and '"verificationStatePreserved":true' in lifecycle_trace_text
    and '"nextActionPreserved":true' in lifecycle_trace_text
    and '"experienceStorePackPreserved":true' in lifecycle_trace_text
)
saw_long_content_resize_queued_trace = (
    '"event":"tui_harness_long_content_resize_replay_queued"' in lifecycle_trace_text
    and '"expectedVisibleState":"sticky_bottom_after_resize"' in lifecycle_trace_text
)
if resize_sequence_done and resize_start_total > 0:
    text_after_resize = final_text[resize_start_total:]
    viewport_after_resize = text_after_resize.rsplit("\x1b[H", 1)[-1]
    compact_after_resize = compact_terminal_text(text_after_resize)
    saw_long_content_resize_tail_after_resize = (
        saw_long_content_resize_tail_after_resize
        or "DSXU_TUI_LONG_CONTENT_RESIZE_TAIL_MARKER" in text_after_resize
    )
    saw_prompt_after_resize = saw_prompt_after_resize or has_prompt_marker(text_after_resize)
    saw_permission_dialog_after_resize = (
        saw_permission_dialog_after_resize
        or "Bashcommand" in compact_after_resize
        or "PowerShellcommand" in compact_after_resize
        or "Editfile" in compact_after_resize
        or "Writefile" in compact_after_resize
        or "Reviewrequired" in compact_after_resize
    )
    saw_permission_dialog_border_after_resize = (
        saw_permission_dialog_border_after_resize
        or has_permission_dialog_border(text_after_resize)
    )
    saw_scrollback_resize_top_after_resize = (
        saw_scrollback_resize_top_after_resize
        or "DSXU_TUI_LONG_CONTENT_RESIZE_ROW_001" in viewport_after_resize
        or "Welcome back" in viewport_after_resize
    )
    saw_scrollback_resize_middle_after_resize = (
        saw_scrollback_resize_middle_after_resize
        or any(
            f"DSXU_TUI_LONG_CONTENT_RESIZE_ROW_{i:03d}" in viewport_after_resize
            for i in range(55, 151)
        )
    )
    saw_scrollback_resize_tail_after_resize = (
        saw_scrollback_resize_tail_after_resize
        or "DSXU_TUI_LONG_CONTENT_RESIZE_TAIL_MARKER" in viewport_after_resize
        or any(
            f"DSXU_TUI_LONG_CONTENT_RESIZE_ROW_{i:03d}" in viewport_after_resize
            for i in range(172, 181)
        )
    )
    saw_dsxu_trust_proof_line_after_resize = (
        saw_dsxu_trust_proof_line_after_resize
        or "proof:toolok3/3|eventok2/2" in compact_terminal_text(text_after_resize)
    )
record("done", status=status, exitCode=exit_code, sentExit=sent_exit, sawWelcome=saw_welcome, sawPrompt=saw_prompt, sawProgress=saw_progress, progressMarkerCount=progress_marker_count, sawLoginWarning=saw_login_warning, sawMojibake=saw_mojibake, sawTerminalMojibake=saw_terminal_mojibake, sawInputEncodingLoss=saw_input_encoding_loss, sentInputCount=input_index, sawPromptAfterTask=saw_prompt_after_task, sawPermissionFallbackBar=saw_permission_fallback_bar, sawPermissionReplayMarker=saw_permission_replay_marker, sawPermissionDialog=saw_permission_dialog, sawPermissionDialogBorder=saw_permission_dialog_border, sawPermissionProceedQuestion=saw_permission_proceed_question, sawPermissionDialogAfterResize=saw_permission_dialog_after_resize, sawPermissionDialogBorderAfterResize=saw_permission_dialog_border_after_resize, sawNoProgressReplayTrace=saw_no_progress_replay_trace, sawBackgroundTaskReplayTrace=saw_background_task_replay_trace, sawBackgroundTaskPillMarker=saw_background_task_pill_marker, sawAutoContinueReplayMarker=saw_auto_continue_replay_marker, sawResumeReplayMarker=saw_resume_replay_marker, sawResumeReplayQueuedTrace=saw_resume_replay_queued_trace, sawResumeSourceTruthGateTrace=saw_resume_source_truth_gate_trace, sawResumeProviderPreflightTrace=saw_resume_provider_preflight_trace, sawAutoContinueEnqueuedTrace=saw_auto_continue_enqueued_trace, sawAutoContinueProcessedTrace=saw_auto_continue_processed_trace, sawAutoContinueSuppressedTrace=saw_auto_continue_suppressed_trace, resizeReplayRequested=(long_content_resize_replay or scrollback_resize_replay), resizeEventsSent=resize_events_sent, sawLongContentResizeMarker=saw_long_content_resize_marker, sawLongContentResizeTailMarker=saw_long_content_resize_tail_marker, sawLongContentResizeTailAfterResize=saw_long_content_resize_tail_after_resize, sawPromptAfterResize=saw_prompt_after_resize, sawLongContentResizeQueuedTrace=saw_long_content_resize_queued_trace, scrollbackResizeReplayRequested=scrollback_resize_replay, scrollbackPageUpsSent=scrollback_page_ups_sent, sawScrollbackResizeMiddleAfterResize=saw_scrollback_resize_middle_after_resize, sawScrollbackResizeTopAfterResize=saw_scrollback_resize_top_after_resize, sawScrollbackResizeTailAfterResize=saw_scrollback_resize_tail_after_resize, sawScrollbackResizePositionedTrace=saw_scrollback_resize_positioned_trace, sawDsxuTrustReplayMarker=saw_dsxu_trust_replay_marker, sawDsxuEvidenceLine=saw_dsxu_evidence_line, sawDsxuTrustLine=saw_dsxu_trust_line, sawDsxuTrustLedgerLine=saw_dsxu_trust_ledger_line, sawDsxuTrustAgentLine=saw_dsxu_trust_agent_line, sawDsxuTrustProofLine=saw_dsxu_trust_proof_line, sawDsxuTrustProofLineAfterResize=saw_dsxu_trust_proof_line_after_resize, dsxuTrustProofLineCount=dsxu_trust_proof_line_count, sawDsxuTrustProofFlood=saw_dsxu_trust_proof_flood, outputBytes=len(buf), elapsedMs=elapsed_ms)
ok = status == "exited" and exit_code == 0 and sent_exit and saw_welcome and saw_prompt
print("DSXU_TUI_HARNESS_RESULT=" + json.dumps({
    "ok": ok,
    "status": status,
    "exitCode": exit_code,
    "sentExit": sent_exit,
    "sawWelcome": saw_welcome,
    "sawPrompt": saw_prompt,
    "sawProgress": saw_progress,
    "progressMarkerCount": progress_marker_count,
    "sawLoginWarning": saw_login_warning,
    "sawMojibake": saw_mojibake,
    "sawTerminalMojibake": saw_terminal_mojibake,
    "sawInputEncodingLoss": saw_input_encoding_loss,
    "sentInputCount": input_index,
    "sawPromptAfterTask": saw_prompt_after_task,
    "sawPermissionFallbackBar": saw_permission_fallback_bar,
    "sawPermissionReplayMarker": saw_permission_replay_marker,
    "sawPermissionDialog": saw_permission_dialog,
    "sawPermissionDialogBorder": saw_permission_dialog_border,
    "sawPermissionProceedQuestion": saw_permission_proceed_question,
    "sawPermissionDialogAfterResize": saw_permission_dialog_after_resize,
    "sawPermissionDialogBorderAfterResize": saw_permission_dialog_border_after_resize,
    "sawNoProgressReplayTrace": saw_no_progress_replay_trace,
    "sawBackgroundTaskReplayTrace": saw_background_task_replay_trace,
    "sawBackgroundTaskPillMarker": saw_background_task_pill_marker,
    "sawAutoContinueReplayMarker": saw_auto_continue_replay_marker,
    "sawResumeReplayMarker": saw_resume_replay_marker,
    "sawResumeReplayQueuedTrace": saw_resume_replay_queued_trace,
    "sawResumeSourceTruthGateTrace": saw_resume_source_truth_gate_trace,
    "sawResumeProviderPreflightTrace": saw_resume_provider_preflight_trace,
    "sawAutoContinueEnqueuedTrace": saw_auto_continue_enqueued_trace,
    "sawAutoContinueProcessedTrace": saw_auto_continue_processed_trace,
    "sawAutoContinueSuppressedTrace": saw_auto_continue_suppressed_trace,
    "sawTuiHealthTrace": saw_tui_health_trace,
    "sawTuiStallTrace": saw_tui_stall_trace,
    "resizeReplayRequested": long_content_resize_replay or scrollback_resize_replay,
    "resizeEventsSent": resize_events_sent,
    "sawLongContentResizeMarker": saw_long_content_resize_marker,
    "sawLongContentResizeTailMarker": saw_long_content_resize_tail_marker,
    "sawLongContentResizeTailAfterResize": saw_long_content_resize_tail_after_resize,
    "sawPromptAfterResize": saw_prompt_after_resize,
    "sawLongContentResizeQueuedTrace": saw_long_content_resize_queued_trace,
    "scrollbackResizeReplayRequested": scrollback_resize_replay,
    "scrollbackPageUpsSent": scrollback_page_ups_sent,
    "sawScrollbackResizeMiddleAfterResize": saw_scrollback_resize_middle_after_resize,
    "sawScrollbackResizeTopAfterResize": saw_scrollback_resize_top_after_resize,
    "sawScrollbackResizeTailAfterResize": saw_scrollback_resize_tail_after_resize,
    "sawScrollbackResizePositionedTrace": saw_scrollback_resize_positioned_trace,
    "sawDsxuTrustReplayMarker": saw_dsxu_trust_replay_marker,
    "sawDsxuEvidenceLine": saw_dsxu_evidence_line,
    "sawDsxuTrustLine": saw_dsxu_trust_line,
    "sawDsxuTrustLedgerLine": saw_dsxu_trust_ledger_line,
    "sawDsxuTrustAgentLine": saw_dsxu_trust_agent_line,
    "sawDsxuTrustProofLine": saw_dsxu_trust_proof_line,
    "sawDsxuTrustProofLineAfterResize": saw_dsxu_trust_proof_line_after_resize,
    "dsxuTrustProofLineCount": dsxu_trust_proof_line_count,
    "sawDsxuTrustProofFlood": saw_dsxu_trust_proof_flood,
    "outputBytes": len(buf),
    "elapsedMs": elapsed_ms,
    "tail": tail,
    "transcriptPath": transcript_path,
    "tracePath": trace_path,
    "lifecycleTraceDir": lifecycle_trace_dir,
    "lifecycleTraceFiles": lifecycle_trace_files,
    "error": error,
}, ensure_ascii=True))
`
}

export async function runRealTuiExitSmoke(
  options: RealTuiHarnessOptions = {},
): Promise<RealTuiHarnessResult> {
  const distro = options.distro ?? 'Ubuntu'
  const root = options.root ?? '/mnt/d/DSXU-code'
  const timeoutMs = options.timeoutMs ?? 35_000
  const scenarioName = options.scenarioName ?? 'exit-smoke'
  const dir = await mkdtemp(join(tmpdir(), 'dsxu-real-tui-'))
  let wslEvidenceDir = '/tmp/dsxu-real-tui'
  let evidenceDir = join(dir, 'evidence')
  try {
    const wslHome = await getWslHome(distro)
    wslEvidenceDir = `${wslHome}/.dsxu/trace/v18-tui`
    evidenceDir = wslPathToWindowsUnc(distro, wslEvidenceDir)
    await mkdir(evidenceDir, { recursive: true })
  } catch (error) {
    await mkdir(evidenceDir, { recursive: true })
    const message = error instanceof Error ? error.message : String(error)
    await rm(dir, { recursive: true, force: true })
    return {
      ok: false,
      status: 'spawn_failed',
      exitCode: null,
      sentExit: false,
      sawWelcome: false,
      sawPrompt: false,
      sawProgress: false,
      progressMarkerCount: 0,
      sawLoginWarning: false,
      sawMojibake: false,
      sawTerminalMojibake: false,
      sawInputEncodingLoss: false,
      sentInputCount: 0,
      sawPromptAfterTask: false,
      sawPermissionFallbackBar: false,
      sawPermissionReplayMarker: false,
      sawNoProgressReplayTrace: false,
      sawBackgroundTaskReplayTrace: false,
      sawBackgroundTaskPillMarker: false,
      sawAutoContinueReplayMarker: false,
      sawResumeReplayMarker: false,
      sawResumeReplayQueuedTrace: false,
      sawResumeSourceTruthGateTrace: false,
      sawResumeProviderPreflightTrace: false,
      sawAutoContinueEnqueuedTrace: false,
      sawAutoContinueProcessedTrace: false,
      sawAutoContinueSuppressedTrace: false,
      sawTuiHealthTrace: false,
      sawTuiStallTrace: false,
      outputBytes: 0,
      elapsedMs: 0,
      tail: '',
      transcriptPath: join(evidenceDir, `${scenarioName}.transcript.txt`),
      tracePath: join(evidenceDir, `${scenarioName}.trace.jsonl`),
      lifecycleTraceDir: join(evidenceDir, `${scenarioName}.lifecycle`),
      error: `wsl home probe failed: ${message}`,
    }
  }
  const scriptPath = join(dir, 'harness.py')
  await writeFile(
    scriptPath,
    buildPythonHarness(
      root,
      timeoutMs,
      wslEvidenceDir,
      scenarioName,
      options.inputsAfterPrompt ?? [],
      options.waitForNewPromptBetweenInputs ?? false,
      options.permissionPromptReplay ?? false,
      options.noProgressReplay ?? false,
      options.backgroundTaskReplay ?? false,
      options.autoContinueReplay ?? false,
      options.resumeReplay ?? false,
      options.longContentResizeReplay ?? false,
      options.trustProofReplay ?? false,
      options.resizeSequence ?? [],
      options.scrollbackResizeReplay ?? false,
      options.scrollbackPageUps ?? 5,
    ),
    'utf8',
  )

  try {
    const { stdout, stderr } = await execFileAsync(
      'wsl.exe',
      ['-d', distro, '--', 'python3', windowsPathToWslPath(scriptPath)],
      {
        timeout: timeoutMs + 10_000,
        maxBuffer: 12 * 1024 * 1024,
        env: buildWslProviderForwardEnv(),
        windowsHide: true,
      },
    )
    const combined = `${stdout}\n${stderr}`
    const line = combined
      .split(/\r?\n/)
      .find(part => part.startsWith('DSXU_TUI_HARNESS_RESULT='))
    if (!line) {
      return {
        ok: false,
        status: 'spawn_failed',
        exitCode: null,
        sentExit: false,
        sawWelcome: false,
        sawPrompt: false,
        sawProgress: false,
        progressMarkerCount: 0,
        sawLoginWarning: false,
        sawMojibake: false,
        sawTerminalMojibake: false,
        sawInputEncodingLoss: false,
        sentInputCount: 0,
        sawPromptAfterTask: false,
        sawPermissionFallbackBar: false,
        sawPermissionReplayMarker: false,
        sawNoProgressReplayTrace: false,
        sawBackgroundTaskReplayTrace: false,
        sawBackgroundTaskPillMarker: false,
        sawAutoContinueReplayMarker: false,
        sawResumeReplayMarker: false,
        sawResumeReplayQueuedTrace: false,
        sawResumeSourceTruthGateTrace: false,
        sawResumeProviderPreflightTrace: false,
        sawAutoContinueEnqueuedTrace: false,
        sawAutoContinueProcessedTrace: false,
        sawAutoContinueSuppressedTrace: false,
        sawTuiHealthTrace: false,
        sawTuiStallTrace: false,
        outputBytes: Buffer.byteLength(combined),
        elapsedMs: timeoutMs,
        tail: combined.slice(-6000),
        transcriptPath: join(evidenceDir, `${scenarioName}.transcript.txt`),
        tracePath: join(evidenceDir, `${scenarioName}.trace.jsonl`),
        lifecycleTraceDir: join(evidenceDir, `${scenarioName}.lifecycle`),
        error: 'missing DSXU_TUI_HARNESS_RESULT line',
      }
    }
    const result = JSON.parse(
      line.slice('DSXU_TUI_HARNESS_RESULT='.length),
    ) as RealTuiHarnessResult
    return {
      ...result,
      transcriptPath: join(evidenceDir, `${scenarioName}.transcript.txt`),
      tracePath: join(evidenceDir, `${scenarioName}.trace.jsonl`),
      lifecycleTraceDir: join(evidenceDir, `${scenarioName}.lifecycle`),
    }
  } catch (error) {
    return {
      ok: false,
      status: 'spawn_failed',
      exitCode: null,
      sentExit: false,
      sawWelcome: false,
      sawPrompt: false,
      sawProgress: false,
      progressMarkerCount: 0,
      sawLoginWarning: false,
      sawMojibake: false,
      sawTerminalMojibake: false,
      sawInputEncodingLoss: false,
      sentInputCount: 0,
      sawPromptAfterTask: false,
      sawPermissionFallbackBar: false,
      sawPermissionReplayMarker: false,
      sawNoProgressReplayTrace: false,
      sawBackgroundTaskReplayTrace: false,
      sawBackgroundTaskPillMarker: false,
      sawAutoContinueReplayMarker: false,
      sawResumeReplayMarker: false,
      sawResumeReplayQueuedTrace: false,
      sawResumeSourceTruthGateTrace: false,
      sawResumeProviderPreflightTrace: false,
      sawAutoContinueEnqueuedTrace: false,
      sawAutoContinueProcessedTrace: false,
      sawAutoContinueSuppressedTrace: false,
      sawTuiHealthTrace: false,
      sawTuiStallTrace: false,
      outputBytes: 0,
      elapsedMs: timeoutMs,
      tail: '',
      transcriptPath: join(evidenceDir, `${scenarioName}.transcript.txt`),
      tracePath: join(evidenceDir, `${scenarioName}.trace.jsonl`),
      lifecycleTraceDir: join(evidenceDir, `${scenarioName}.lifecycle`),
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
