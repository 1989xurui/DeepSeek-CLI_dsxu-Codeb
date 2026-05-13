import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Box } from '../../ink.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { getInitialSettings } from '../../utils/settings/settings.js';
import { DsxuMascot, selectDsxuMascotVariant, type DsxuMascotPose } from './DsxuMascot.js';
type Frame = {
  pose: DsxuMascotPose;
  offset: number;
};
type Props = {
  maxWidth?: number;
};

/** Hold a pose for n frames (60ms each). */
function hold(pose: DsxuMascotPose, offset: number, frames: number): Frame[] {
  return Array.from({
    length: frames
  }, () => ({
    pose,
    offset
  }));
}

// Offset semantics: marginTop in a fixed-height container. 0 = normal,
// 1 = crouched. Container height stays fixed so the layout never shifts; during
// a crouch (offset=1) DsxuMascot's feet row dips below the container and gets
// clipped and reads as "ducking below the frame" before springing back up.

// Click animation: crouch, then spring up with both arms raised. Twice.
const JUMP_WAVE: readonly Frame[] = [...hold('default', 1, 2),
// crouch
...hold('arms-up', 0, 3),
// spring!
...hold('default', 0, 1), ...hold('default', 1, 2),
// crouch again
...hold('arms-up', 0, 3),
// spring!
...hold('default', 0, 1)];

// Click animation: glance right, then left, then back.
const LOOK_AROUND: readonly Frame[] = [...hold('look-right', 0, 5), ...hold('look-left', 0, 5), ...hold('default', 0, 1)];
const CLICK_ANIMATIONS: readonly (readonly Frame[])[] = [JUMP_WAVE, LOOK_AROUND];
const IDLE: Frame = {
  pose: 'default',
  offset: 0
};
const FRAME_MS = 60;
const incrementFrame = (i: number) => i + 1;

/**
 * DsxuMascot with click-triggered animations (crouch-jump with arms up, or
 * look-around). Container height is fixed at the selected mascot height, with
 * the same footprint as a bare `<DsxuMascot />`, so the surrounding layout never shifts. During a
 * crouch only the feet row clips (see comment above). Click only fires when
 * mouse tracking is enabled (i.e. inside `<AlternateScreen>` / fullscreen);
 * elsewhere this renders and behaves identically to plain `<DsxuMascot />`.
 */
export function AnimatedDsxuMascot({ maxWidth }: Props = {}) {
  const {
    pose,
    bounceOffset,
    onClick
  } = useDsxuMascotAnimation();
  const { columns } = useTerminalSize();
  const variant = selectDsxuMascotVariant(maxWidth ?? columns - 4);
  return (
    <Box height={variant.height} flexDirection="column" onClick={onClick}>
      <Box marginTop={bounceOffset} flexShrink={0}>
        <DsxuMascot pose={pose} maxWidth={variant.width} />
      </Box>
    </Box>
  );
}
function useDsxuMascotAnimation(): {
  pose: DsxuMascotPose;
  bounceOffset: number;
  onClick: () => void;
} {
  // Read once at mount; no useSettings() subscription, since that would
  // re-render on any settings change.
  const [reducedMotion] = useState(() => getInitialSettings().prefersReducedMotion ?? false);
  const [frameIndex, setFrameIndex] = useState(-1);
  const sequenceRef = useRef<readonly Frame[]>(JUMP_WAVE);
  const onClick = () => {
    if (reducedMotion || frameIndex !== -1) return;
    sequenceRef.current = CLICK_ANIMATIONS[Math.floor(Math.random() * CLICK_ANIMATIONS.length)]!;
    setFrameIndex(0);
  };
  useEffect(() => {
    if (frameIndex === -1) return;
    if (frameIndex >= sequenceRef.current.length) {
      setFrameIndex(-1);
      return;
    }
    const timer = setTimeout(setFrameIndex, FRAME_MS, incrementFrame);
    return () => clearTimeout(timer);
  }, [frameIndex]);
  const seq = sequenceRef.current;
  const current = frameIndex >= 0 && frameIndex < seq.length ? seq[frameIndex]! : IDLE;
  return {
    pose: current.pose,
    bounceOffset: current.offset,
    onClick
  };
}

// V14 lifecycle shim: animateddsxumascot
export function processAnimatedDsxuMascotLifecycle(input) {
  void input
  const state = 'animateddsxumascot-state'
  const lifecycle = 'animateddsxumascot:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
