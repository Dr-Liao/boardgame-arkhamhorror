import { randomValue } from './rules-state.js'

const symbols = ['skull', 'cultist', 'tablet', 'elderthing']

export function validateSealEntry(entry) {
  const { sealOnEnter: fixed, sealOnEnterChoice: choice } = entry
  const face = value => typeof value === 'string' && /^(?:[+-]?\d+|skull|cultist|tablet|elderthing|eldersign|autofail|bless|curse|frost)$/.test(value)
  if (fixed != null && (!face(fixed) || choice != null)) throw new TypeError('无效的入场封印声明')
  if (choice != null && !(Array.isArray(choice)
    ? choice.length > 0 && choice.every(face) && new Set(choice).size === choice.length
    : ['symbol', 'nonAutofail', 'random'].includes(choice))) throw new TypeError('无效的入场封印选项')
}

function matchesFace(entry, face) {
  if (entry.sealOnEnter) return face === entry.sealOnEnter
  const choice = entry.sealOnEnterChoice
  if (Array.isArray(choice)) return choice.includes(face)
  if (choice === 'symbol') return symbols.includes(face)
  if (choice === 'nonAutofail') return face !== 'autofail'
  return true
}

export function sealAvailable(state, entry) {
  if (!entry?.sealOnEnter && !entry?.sealOnEnterChoice) return true
  return (state.chaosBag || []).some(face => matchesFace(entry, face))
}

// null: no required seal; false: required seal cannot be paid.
export function chooseEntrySeal(state, entry, { seat, code, choose, label }) {
  if (!entry?.sealOnEnter && !entry?.sealOnEnterChoice) return null
  const pool = (state.chaosBag || []).filter(face => matchesFace(entry, face))
  if (!pool.length) return false
  if (entry.sealOnEnterChoice === 'random') return pool[Math.floor(randomValue(state) * pool.length)]
  const faces = [...new Set(pool)]
  if (faces.length === 1) return faces[0]
  const result = choose({ kind: 'seal', source: code, seat, prompt: '选择入场时封印的标记。',
    options: faces.map(token => ({ id: token, label: label(token) })) })
  if (!faces.includes(result)) throw new RangeError('无效的入场封印目标')
  return result
}
