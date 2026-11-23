/**
 * Screens opened inside a module (an editor, a full-screen preview) register
 * here so the Android back button and Escape close them first, before the
 * module itself.
 */
const stack: Array<() => void> = []

export function onBack(fn: () => void): () => void {
  stack.push(fn)
  return () => {
    const i = stack.lastIndexOf(fn)
    if (i >= 0) stack.splice(i, 1)
  }
}

/** Runs the innermost handler; false when there is none. */
export function handleBack(): boolean {
  const fn = stack[stack.length - 1]
  if (!fn) return false
  fn()
  return true
}
