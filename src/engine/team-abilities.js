import { registeredEntry } from './ability.js'
import { assetTextBlanked, assetTextBlankedExceptForced } from './card-text.js'

export function teamCanActivate(state, inv, owner, source) {
  if (!source || !owner || owner.defeated || owner.resigned || owner.location !== inv.location) return false
  if (assetTextBlankedExceptForced(source) || assetTextBlanked(source, owner)) return false
  const rule = registeredEntry(source.code)?.teamActivatable
  return typeof rule === 'function' ? rule({ state, inv, owner, source }) === true : rule === true
}
