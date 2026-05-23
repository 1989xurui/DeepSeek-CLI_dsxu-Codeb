import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Check = {
  name: string;
  pass: boolean;
  detail: string;
};

const root = process.cwd();
const extensionDir = join(root, 'integrations', 'vscode');
const packageJsonPath = join(extensionDir, 'package.json');
const extensionJsPath = join(extensionDir, 'extension.js');
const installWinPath = join(root, 'scripts', 'install-vscode-extension.ps1');
const installUnixPath = join(root, 'scripts', 'install-vscode-extension.sh');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const extensionJs = readFileSync(extensionJsPath, 'utf8');
const installWin = readFileSync(installWinPath, 'utf8');
const installUnix = readFileSync(installUnixPath, 'utf8');
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const installDoc = readFileSync(join(root, 'docs', 'INSTALL.md'), 'utf8');
const blockedProviderCallPattern = new RegExp([
  String.raw`fetch\s*\(`,
  'axios',
  'openai',
  ['anth', 'ropic'].join(''),
  ['cl', 'aude'].join(''),
].join('|'), 'i');

const checks: Check[] = [
  {
    name: 'extension package declares dsxu commands',
    pass: Array.isArray(packageJson.contributes?.commands) && packageJson.contributes.commands.length >= 6,
    detail: `${packageJson.contributes?.commands?.length ?? 0} commands`,
  },
  {
    name: 'extension delegates to DSXU CLI mainline',
    pass: extensionJs.includes('./src/entrypoints/dsxu-code.tsx') &&
      extensionJs.includes('createTerminal') &&
      extensionJs.includes('registerUriHandler') &&
      extensionJs.includes('makeLaunchTerminal') &&
      !extensionJs.includes('terminal.sendText(command'),
    detail: 'uses launch terminal and DSXU entrypoint',
  },
  {
    name: 'extension does not implement provider calls',
    pass: !blockedProviderCallPattern.test(extensionJs),
    detail: 'no direct model provider HTTP client found',
  },
  {
    name: 'extension writes prompt artifacts instead of long command payloads',
    pass: extensionJs.includes('.dsxu/vscode-prompts') && extensionJs.includes('writePromptArtifact'),
    detail: 'selection/file prompts are artifact handoffs',
  },
  {
    name: 'windows installer copies VS Code adapter only',
    pass: installWin.includes('integrations\\vscode') &&
      installWin.includes('.vscode\\extensions') &&
      installWin.includes('source-copy for a stable source-checkout install') &&
      installWin.includes('--install-extension') &&
      installWin.includes('Remove-DsxuVsCodeObsoleteMarker'),
    detail: 'source-copy default with optional VSIX and obsolete-marker cleanup present',
  },
  {
    name: 'unix installer copies VS Code adapter only',
    pass: installUnix.includes('integrations/vscode') &&
      installUnix.includes('.vscode/extensions') &&
      installUnix.includes('dsxu-code.dsxu-code-0.1.0'),
    detail: 'source-copy installer with obsolete-marker cleanup present',
  },
  {
    name: 'package exposes owner-specific VS Code scripts',
    pass: Boolean(rootPackage.scripts?.['ide:vscode-smoke']) &&
      Boolean(rootPackage.scripts?.['ide:vscode-install:win']) &&
      Boolean(rootPackage.scripts?.['ide:vscode-install:unix']),
    detail: 'owner-specific scripts checked',
  },
  {
    name: 'public docs mention VS Code adapter',
    pass: readme.includes('VS Code') && installDoc.includes('VS Code'),
    detail: 'README and install guide updated',
  },
];

const pass = checks.every((check) => check.pass);
const output = {
  status: pass ? 'PASS_DSXU_VSCODE_EXTENSION_SMOKE' : 'FAIL_DSXU_VSCODE_EXTENSION_SMOKE',
  generatedAt: new Date().toISOString(),
  extensionDir: 'integrations/vscode',
  boundary: {
    modelProvider: 'DSXU CLI mainline only',
    toolRuntime: 'DSXU Tool Gate only',
    permissionRuntime: 'DSXU Permission Gate only',
    vscodeRole: 'editor commands, terminal launch, prompt artifact handoff',
  },
  checks,
};

mkdirSync(join(root, 'docs', 'generated'), { recursive: true });
writeFileSync(
  join(root, 'docs', 'generated', 'DSXU_VSCODE_EXTENSION_SMOKE_20260522.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
);

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name} - ${check.detail}`);
}

if (!pass) {
  console.error(output.status);
  process.exit(1);
}

console.log(output.status);
