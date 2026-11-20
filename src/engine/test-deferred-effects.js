import { currentEffectSource, withEffectSource } from './effect-provenance.js'

const effectsByTest = new WeakMap()

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
