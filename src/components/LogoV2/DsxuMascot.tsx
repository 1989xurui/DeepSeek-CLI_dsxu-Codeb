import * as React from 'react';
import { RawAnsi } from '../../ink.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import {
  selectDsxuMascotAnsiVariant,
} from './dsxuMascotAnsi.js';

export type DsxuMascotPose =
  | 'default'
  | 'arms-up'
  | 'look-left'
  | 'look-right';

type Props = {
  pose?: DsxuMascotPose;
  maxWidth?: number;
};

export const DSXU_MASCOT_MIN_WIDTH = 9;
export const DSXU_MASCOT_MIN_HEIGHT = 3;
export const DSXU_MASCOT_TEXT_RESERVE = 20;

export function selectDsxuMascotVariant(maxWidth: number) {
  return selectDsxuMascotAnsiVariant(Math.max(DSXU_MASCOT_MIN_WIDTH, maxWidth));
}

export function DsxuMascot({
  pose: _pose = 'default',
  maxWidth,
}: Props = {}): React.ReactNode {
  const { columns } = useTerminalSize();
  const variant = selectDsxuMascotVariant(maxWidth ?? columns - 4);
  return <RawAnsi lines={variant.lines} width={variant.width} />;
}
