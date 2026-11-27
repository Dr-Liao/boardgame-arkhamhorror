import { currentEffectSource, withEffectSource } from './effect-provenance.js'

const effectsByTest = new WeakMap()
const replacements = new WeakMap()
const baseValueFrames = new WeakMap()

export function withBaseTestValue(state, seat, value, resolve) {
  if (!Number.isFinite(value)) return resolve()
  const previous = baseValueFrames.get(state)
  baseValueFrames.set(state, { seat, value })
  try {
    return resolve()
  } finally {
    if (previous) baseValueFrames.set(state, previous)
    else baseValueFrames.delete(state)
  }
}

export function scopedBaseTestValue(state, seat) {
  const frame = baseValueFrames.get(state)
  return frame && frame.seat === seat ? frame.value : undefined
}

export function replaceNormalTestEffect(state, resolve) {
  const test = state.skillTest
  if (!test || test.stage === 'ST.8' || typeof resolve !== 'function' || replacements.has(test)) return false
  replacements.set(test, { resolve, source: currentEffectSource(state) })
  return true
}

export function resolveNormalTestEffect(state, result, normalResolve) {
  const test = state.skillTest
  const replacement = replacements.get(test)
  if (!replacement) return normalResolve?.(result)
  replacements.delete(test)
  return withEffectSource(state, replacement.source, () => replacement.resolve(result))
}

export function deferTestEffect(state, resolve) {
  const test = state.skillTest
  if (!test || test.stage === 'ST.8' || typeof resolve !== 'function') return false
  const effects = effectsByTest.get(test) || []
  effects.push({ resolve, source: currentEffectSource(state) })
  effectsByTest.set(test, effects)
  return true
}

export function resolveDeferredTestEffects(state, result) {
  const test = state.skillTest
  const effects = effectsByTest.get(test)
  if (!effects) return
  effectsByTest.delete(test)
  for (const { resolve, source } of effects) withEffectSource(state, source, () => resolve(result))
}
