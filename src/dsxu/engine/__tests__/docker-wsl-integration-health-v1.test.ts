import { describe, expect, test } from 'bun:test'
import {
  classifyDsxuDockerWslIntegration,
  runDsxuDockerWslIntegrationHealth,
} from '../../integration/harness/docker-wsl-integration-health-v1-harness'

describe('Docker WSL integration health V1', () => {
  test('classifies the zero-byte proxy permission-denied failure from Docker Desktop as blocked evidence', () => {
    const evidence = classifyDsxuDockerWslIntegration({
      distro: 'Ubuntu',
      evidencePath: '.dsxu/trace/v18-toolchain/docker-wsl-integration-health-20260507.evidence.json',
      nowIso: '2026-05-07T11:00:00.000Z',
      windowsDocker: 'Server: Docker Desktop 4.70.0\n Version: 29.4.0',
      proxyFile: [
        '-rw-r--r-- 1 root root 0 May  7 18:52 /mnt/wsl/docker-desktop/docker-desktop-user-distro',
        'File: /mnt/wsl/docker-desktop/docker-desktop-user-distro',
        'Size: 0 regular empty file',
      ].join('\n'),
      ubuntuDocker: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.',
      proxyProcess:
        'execvpe(/mnt/wsl/docker-desktop/docker-desktop-user-distro) failed: Permission denied',
    })

    expect(evidence.status).toBe('BLOCKED_EVIDENCED')
    expect(evidence.ok).toBe(false)
    expect(evidence.checks.sawPermissionDenied).toBe(true)
    expect(evidence.checks.sawZeroByteProxy).toBe(true)
    expect(evidence.blockers).toContain('Docker Desktop WSL proxy reported permission denied')
    expect(evidence.blockers).toContain('Docker Desktop WSL proxy file appears to be zero bytes')
  })

  test('classifies healthy Windows + Ubuntu Docker Desktop integration as done evidence', () => {
    const evidence = classifyDsxuDockerWslIntegration({
      distro: 'Ubuntu',
      evidencePath: '.dsxu/trace/v18-toolchain/docker-wsl-integration-health-20260507.evidence.json',
      nowIso: '2026-05-07T11:00:00.000Z',
      windowsDocker: 'Client:\n Version: 29.4.0\n\nServer: Docker Desktop\n Version: 29.4.0',
      proxyFile: [
        '-rwxr-xr-x 1 root root 23434240 Apr 10 23:08 /mnt/wsl/docker-desktop/docker-desktop-user-distro',
        'srw-rw---- 1 root docker 0 May  7 18:56 /var/run/docker.sock',
        'Size: 23434240',
        'Access: (0755/-rwxr-xr-x)',
      ].join('\n'),
      ubuntuDocker: [
        '/usr/bin/docker',
        'Client:',
        ' Version: 29.4.0',
        'Server:',
        ' Version: 29.4.0',
        'CONTAINER ID   IMAGE',
      ].join('\n'),
      proxyProcess:
        'docker-desktop- /mnt/wsl/docker-desktop/docker-desktop-user-distro proxy --distro-name Ubuntu',
    })

    expect(evidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.ok).toBe(true)
    expect(evidence.blockers).toEqual([])
  })

  test(
    'records current Docker Desktop WSL integration state without hiding host-boundary failures',
    async () => {
      const evidence = await runDsxuDockerWslIntegrationHealth()

      expect(['DONE_EVIDENCED', 'BLOCKED_EVIDENCED']).toContain(evidence.status)
      expect(evidence.outputs.windowsDocker.length).toBeGreaterThan(0)
      expect(evidence.outputs.proxyFile.length).toBeGreaterThan(0)
      if (evidence.ok) {
        expect(evidence.checks.proxyFileExecutable).toBe(true)
        expect(evidence.checks.proxyFileNonEmpty).toBe(true)
        expect(evidence.checks.ubuntuDockerServer).toBe(true)
        expect(evidence.checks.proxyProcessAlive).toBe(true)
      } else {
        expect(evidence.blockers.length).toBeGreaterThan(0)
      }
    },
    60_000,
  )
})
