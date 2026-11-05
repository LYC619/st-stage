import type { ChoiceHostContext } from './choices'

/** Public ST context projection used only to identify a message; never writes native chat content. */
export function readChoiceHostContext(): ChoiceHostContext | undefined {
  try { return window.SillyTavern?.getContext() as ChoiceHostContext | undefined } catch { return undefined }
}
