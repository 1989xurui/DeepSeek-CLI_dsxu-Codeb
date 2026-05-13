import { c as _c } from "react/compiler-runtime";
import React from 'react';
import { Text } from '../../ink.js';
export function CheckGitHubStep() {
  const $ = _c(1);
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = <Text>Checking GitHub CLI installation...</Text>;
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  return t0;
}

// V14 lifecycle shim: checkgithubstep
export function processCheckgithubstepLifecycle(input) {
  void input
  const state = 'checkgithubstep-state'
  const lifecycle = 'checkgithubstep:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
