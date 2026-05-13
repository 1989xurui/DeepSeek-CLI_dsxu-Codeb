import React from 'react';
import { Doctor } from '../../screens/Doctor.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
export const call: LocalJSXCommandCall = (onDone, _context, _args) => {
  return Promise.resolve(<Doctor onDone={onDone} />);
};

// V14 strict lifecycle shim: commands-doctor-doctor
export function processCommandsDoctorDoctorStrictLifecycle(input) {
  void input
  const state = 'commands-doctor-doctor-state'
  const lifecycle = 'commands-doctor-doctor:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsDoctorDoctorStrict(input) {
  return processCommandsDoctorDoctorStrictLifecycle(input)
}
