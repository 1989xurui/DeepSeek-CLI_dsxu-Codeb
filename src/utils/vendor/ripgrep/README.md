# DSXU vendored ripgrep

DSXU ships ripgrep per runtime platform so `Glob` and `Grep` do not depend on
the host PATH, WindowsApps shims, or another application's resource directory.

Current binaries:

- `x64-win32/rg.exe`: ripgrep 14.1.0, `x86_64-pc-windows-msvc`
- `x64-linux/rg`: ripgrep 14.1.0, `x86_64-unknown-linux-musl`

Windows SHA-256:

```text
1dce02aae98c0a48c2644abd1849fb90406296d4e0c95e239f95242ee8480ff8  x64-win32/rg.exe
```

Linux SHA-256:

```text
c2feed7a376d3754958fa6235a6ef88a74bcabc9b0cfccacbd48939b5f87860d  x64-linux/rg
```

Runtime policy:

- Default: use DSXU's platform-native vendored binary.
- Bundled native builds may use the embedded `rg` implementation.
- `USE_BUILTIN_RIPGREP=false` can opt into system `rg` for diagnostics.
- `DSXU_ALLOW_CROSS_OS_TOOL_FALLBACK=1` enables Windows `rg.exe` from WSL only
  as a development escape hatch, not as a product default.
