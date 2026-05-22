'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');

const TERMINAL_NAME = 'DSXU Code';
const OUTPUT_NAME = 'DSXU Code';

function activate(context) {
  const output = vscode.window.createOutputChannel(OUTPUT_NAME);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 88);
  status.text = '$(terminal) DSXU Code';
  status.tooltip = 'Open DSXU Code in the current workspace';
  status.command = 'dsxuCode.open';
  status.show();

  context.subscriptions.push(
    output,
    status,
    vscode.window.registerUriHandler({
      handleUri(uri) {
        const action = uri.path.replace(/^\/+/, '').toLowerCase();
        output.appendLine(`[DSXU] URI action received: ${uri.toString()}`);
        if (action === '' || action === 'open') {
          runInteractive(context, output);
          return;
        }
        if (action === 'login' || action === 'configure-key') {
          runCli(context, output, ['auth', 'login'], 'DSXU Code - Login');
          return;
        }
        if (action === 'doctor') {
          runCli(context, output, ['auth', 'status', '--text'], 'DSXU Code - Doctor');
          return;
        }
        vscode.window.showWarningMessage(`DSXU Code: unsupported URI action "${action}".`);
      }
    }),
    vscode.commands.registerCommand('dsxuCode.open', () => runInteractive(context, output)),
    vscode.commands.registerCommand('dsxuCode.askSelection', () => askAboutSelection(context, output)),
    vscode.commands.registerCommand('dsxuCode.explainFile', () => explainCurrentFile(context, output)),
    vscode.commands.registerCommand('dsxuCode.configureKey', () => runCli(context, output, ['auth', 'login'], 'DSXU Code - Login')),
    vscode.commands.registerCommand('dsxuCode.doctor', () => runCli(context, output, ['auth', 'status', '--text'], 'DSXU Code - Doctor')),
    vscode.commands.registerCommand('dsxuCode.openInstallGuide', () => openInstallGuide(output))
  );

  output.appendLine('[DSXU] VS Code adapter activated. All AI work is delegated to the DSXU CLI mainline.');
}

function deactivate() {}

function getConfig() {
  return vscode.workspace.getConfiguration('dsxuCode');
}

function findWorkspaceFolder() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (folder) return folder.uri.fsPath;
  }
  const folders = vscode.workspace.workspaceFolders || [];
  return folders[0] ? folders[0].uri.fsPath : '';
}

function isDsxuRepo(candidate) {
  if (!candidate) return false;
  return (
    fs.existsSync(path.join(candidate, 'package.json')) &&
    fs.existsSync(path.join(candidate, 'src', 'entrypoints', 'dsxu-code.tsx'))
  );
}

function resolveRepoRoot(context) {
  const configured = getConfig().get('repoPath', '').trim();
  if (configured && isDsxuRepo(configured)) return configured;

  const workspace = findWorkspaceFolder();
  if (isDsxuRepo(workspace)) return workspace;

  const extensionRelative = path.resolve(context.extensionPath, '..', '..');
  if (isDsxuRepo(extensionRelative)) return extensionRelative;

  const cwd = process.cwd();
  if (isDsxuRepo(cwd)) return cwd;

  throw new Error('DSXU repo root was not found. Set dsxuCode.repoPath to your DSXU Code checkout.');
}

function resolveBunPath() {
  const configured = getConfig().get('bunPath', '').trim();
  if (configured) return configured;

  const bunInstall = process.env.BUN_INSTALL;
  if (bunInstall) {
    const candidate = path.join(bunInstall, 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun');
    if (fs.existsSync(candidate)) return candidate;
  }

  if (process.platform === 'win32') {
    const candidate = path.join(os.homedir(), '.bun', 'bin', 'bun.exe');
    if (fs.existsSync(candidate)) return candidate;
  } else {
    const candidate = path.join(os.homedir(), '.bun', 'bin', 'bun');
    if (fs.existsSync(candidate)) return candidate;
  }

  return 'bun';
}

function shellQuote(value) {
  const text = String(value);
  if (process.platform === 'win32') {
    return `'${text.replace(/'/g, "''")}'`;
  }
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

function terminalEnv() {
  return {
    DSXU_CODE_MODE: '1',
    DSXU_MODEL_PROVIDER: 'deepseek',
    DSXU_MODEL_GATEWAY: 'direct',
    DSXU_MODEL: getConfig().get('defaultModel', 'deepseek-v4-flash'),
    LANG: process.env.LANG || 'zh_CN.UTF-8',
    LC_ALL: process.env.LC_ALL || 'zh_CN.UTF-8',
    FORCE_COLOR: '1'
  };
}

function makeTerminal(context, name) {
  const repoRoot = resolveRepoRoot(context);
  const terminal = vscode.window.createTerminal({
    name,
    cwd: repoRoot,
    env: terminalEnv()
  });
  return { terminal, repoRoot };
}

function makeLaunchTerminal(context, name, args) {
  const repoRoot = resolveRepoRoot(context);
  const bun = resolveBunPath();
  const argv = [
    '--env-file=.env',
    './src/entrypoints/dsxu-code.tsx',
    ...args
  ];

  if (process.platform === 'win32') {
    const command = [
      '$ErrorActionPreference = "Stop"',
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      `Set-Location -LiteralPath ${shellQuote(repoRoot)}`,
      `& ${shellQuote(bun)} ${argv.map(shellQuote).join(' ')}`
    ].join('; ');

    return {
      terminal: vscode.window.createTerminal({
        name,
        cwd: repoRoot,
        env: terminalEnv(),
        shellPath: 'powershell.exe',
        shellArgs: ['-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]
      }),
      repoRoot,
      command: `powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -Command ${command}`
    };
  }

  const command = `cd ${shellQuote(repoRoot)} && exec ${shellQuote(bun)} ${argv.map(shellQuote).join(' ')}`;
  return {
    terminal: vscode.window.createTerminal({
      name,
      cwd: repoRoot,
      env: terminalEnv(),
      shellPath: 'bash',
      shellArgs: ['-lc', command]
    }),
    repoRoot,
    command: `bash -lc ${shellQuote(command)}`
  };
}

function cliCommand(args) {
  const bun = resolveBunPath();
  const argv = [
    bun,
    '--env-file=.env',
    './src/entrypoints/dsxu-code.tsx',
    ...args
  ];
  return argv.map(shellQuote).join(' ');
}

function runCli(context, output, args, terminalName = TERMINAL_NAME) {
  const { terminal, repoRoot, command } = makeLaunchTerminal(context, terminalName, args);
  output.appendLine(`[DSXU] cwd=${repoRoot}`);
  output.appendLine(`[DSXU] ${command}`);
  if (getConfig().get('openTerminalOnStart', true)) {
    terminal.show();
  }
}

function runInteractive(context, output) {
  runCli(context, output, [], TERMINAL_NAME);
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 96) || 'prompt';
}

function promptArtifactDir(repoRoot) {
  const configured = getConfig().get('promptArtifactDir', '.dsxu/vscode-prompts').trim() || '.dsxu/vscode-prompts';
  return path.isAbsolute(configured) ? configured : path.join(repoRoot, configured);
}

function writePromptArtifact(context, title, body) {
  const repoRoot = resolveRepoRoot(context);
  const dir = promptArtifactDir(repoRoot);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(dir, `${stamp}-${sanitizeName(title)}.md`);
  fs.writeFileSync(filePath, body, 'utf8');
  return {
    absolutePath: filePath,
    relativePath: path.relative(repoRoot, filePath).replace(/\\/g, '/')
  };
}

function activeEditorContext() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor.');
  }
  const document = editor.document;
  const selection = editor.selection;
  const selectedText = selection && !selection.isEmpty ? document.getText(selection) : '';
  return { editor, document, selection, selectedText };
}

function askAboutSelection(context, output) {
  const { document, selection, selectedText } = activeEditorContext();
  if (!selectedText.trim()) {
    vscode.window.showWarningMessage('DSXU Code: select code or text first.');
    return;
  }

  const body = [
    '# DSXU VS Code Selection Prompt',
    '',
    'Use the current DSXU CLI mainline. Read this prompt artifact as source context, then answer or propose edits with normal DSXU permission and evidence rules.',
    '',
    `- file: ${document.uri.fsPath}`,
    `- language: ${document.languageId}`,
    `- selection: ${selection.start.line + 1}:${selection.start.character + 1} -> ${selection.end.line + 1}:${selection.end.character + 1}`,
    '',
    '## Selected Text',
    '',
    '```',
    selectedText,
    '```'
  ].join('\n');

  const artifact = writePromptArtifact(context, 'selection', body);
  runCli(context, output, ['-p', `Read ${artifact.relativePath}, then help with the selected code. Keep changes behind DSXU Tool Gate and Permission Gate.`], 'DSXU Code - Selection');
}

function explainCurrentFile(context, output) {
  const { document } = activeEditorContext();
  const body = [
    '# DSXU VS Code File Prompt',
    '',
    'Use the current DSXU CLI mainline. Explain the file through source-truth reading, bounded context, and normal DSXU evidence rules.',
    '',
    `- file: ${document.uri.fsPath}`,
    `- language: ${document.languageId}`,
    '',
    'Do not edit unless the user explicitly asks for edits.'
  ].join('\n');

  const artifact = writePromptArtifact(context, 'file', body);
  runCli(context, output, ['-p', `Read ${artifact.relativePath}, then explain the referenced file. Do not edit unless I ask.`], 'DSXU Code - Explain File');
}

function openInstallGuide(output) {
  const folders = vscode.workspace.workspaceFolders || [];
  const candidates = [];
  for (const folder of folders) {
    candidates.push(path.join(folder.uri.fsPath, 'docs', 'INSTALL.md'));
  }
  candidates.push(path.resolve(__dirname, '..', '..', 'docs', 'INSTALL.md'));

  const guide = candidates.find((candidate) => fs.existsSync(candidate));
  if (!guide) {
    vscode.window.showWarningMessage('DSXU Code install guide was not found.');
    return;
  }

  output.appendLine(`[DSXU] Opening install guide: ${guide}`);
  vscode.workspace.openTextDocument(guide).then((doc) => vscode.window.showTextDocument(doc));
}

module.exports = {
  activate,
  deactivate
};
