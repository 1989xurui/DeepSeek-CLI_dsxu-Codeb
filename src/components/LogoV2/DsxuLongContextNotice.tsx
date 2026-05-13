import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import { useEffect, useState } from 'react';
import { UP_ARROW } from '../../constants/figures.js';
import { Box, Text } from '../../ink.js';
import { COMPAT_1M_MERGE_NOTICE_COUNT_KEY } from '../../dsxu/legacy/config/legacyProviderConfig.js';
import { isDsxuLongContextDefaultEnabled } from '../../dsxu/legacy/model/legacyProviderModel.js';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js';
import { AnimatedAsterisk } from './AnimatedAsterisk.js';
const MAX_SHOW_COUNT = 6;
export function shouldShowDsxuLongContextNotice(): boolean {
  return isDsxuLongContextDefaultEnabled() && (getGlobalConfig()[COMPAT_1M_MERGE_NOTICE_COUNT_KEY] ?? 0) < MAX_SHOW_COUNT;
}
export function DsxuLongContextNotice() {
  const $ = _c(4);
  const [show] = useState(shouldShowDsxuLongContextNotice);
  let t0;
  let t1;
  if ($[0] !== show) {
    t0 = () => {
      if (!show) {
        return;
      }
      const newCount = (getGlobalConfig()[COMPAT_1M_MERGE_NOTICE_COUNT_KEY] ?? 0) + 1;
      saveGlobalConfig(prev => {
        if ((prev[COMPAT_1M_MERGE_NOTICE_COUNT_KEY] ?? 0) >= newCount) {
          return prev;
        }
        return {
          ...prev,
          [COMPAT_1M_MERGE_NOTICE_COUNT_KEY]: newCount
        };
      });
    };
    t1 = [show];
    $[0] = show;
    $[1] = t0;
    $[2] = t1;
  } else {
    t0 = $[1];
    t1 = $[2];
  }
  useEffect(t0, t1);
  if (!show) {
    return null;
  }
  let t2;
  if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Box paddingLeft={2}><AnimatedAsterisk char={UP_ARROW} /><Text dimColor={true}>{" "}DeepSeek V4 Pro now defaults to 1M context - 5x more room, same pricing</Text></Box>;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  return t2;
}

// V18 lifecycle shim: dsxulongcontextnotice
export function processDsxulongcontextnoticeLifecycle(input) {
  void input
  const state = 'dsxulongcontextnotice-state'
  const lifecycle = 'dsxulongcontextnotice:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
