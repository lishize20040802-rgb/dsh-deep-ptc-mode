// Reading the host's mount diagnosis of the deep-ptc preset.
//
// `agentPresets.compositionInventory()` reports one line per unusable row (see the registry's
// `diagnostic`). A row that failed to start is final. A row whose injected service has not appeared
// yet ("<id> (<module>): waiting for <services>") may still come up by itself, so it is not a reason
// to give up the full preset.

const WAITING = /^.+ \(.+\): waiting for .+$/u;

/**
 * Split a host diagnosis into failed and waiting rows.
 * @param broken - the `broken` text of an inventory row, or undefined.
 * @returns `{ failed, pending }`, one line each.
 */
export function classifyDiagnosis(broken) {
  const failed = [];
  const pending = [];
  if (typeof broken !== 'string') return { failed, pending };
  for (const line of broken.split(/\r?\n/u).map(text => text.trim()).filter(Boolean)) {
    (WAITING.test(line) ? pending : failed).push(line);
  }
  return { failed, pending };
}
