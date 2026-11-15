import { assertFields, integer, investigatorAt } from './mechanic-state.js'

export function transferControlledClues(state, seat, fromId, toId, count, options = {}) {
  assertFields(options, ['emptyTarget', 'traits'])
  integer(count, 1)
  if (options.emptyTarget != null && typeof options.emptyTarget !== 'boolean') throw new TypeError('无效线索目标限制')
  if (options.traits != null && (!Array.isArray(options.traits) || !options.traits.length
    || options.traits.some(trait => typeof trait !== 'string' || !trait))) throw new TypeError('无效线索目标特质')
  const inv = investigatorAt(state, seat)
  const resolve = id => id === 'investigator' ? inv : inv.assets.find(asset => asset.id === id)
  const from = resolve(fromId), to = resolve(toId)
  if (!from || !to || from === to || (from.clues || 0) < count || (options.emptyTarget && to.clues)) return false
  const asset = to === inv ? from : to
  if (options.traits && !asset.traits?.some(trait => options.traits.some(target => target.toLowerCase() === trait.toLowerCase()))) return false
  from.clues -= count
  to.clues = (to.clues || 0) + count
  if (to !== inv) to.returnCluesOnLeave = true
  return count
}

export function returnAssetClues(state, inv, asset) {
  if (!asset.returnCluesOnLeave || !asset.clues) return 0
  const location = state.locations.find(location => location.id === (asset.location || inv.location))
  if (!location) return 0
  const count = asset.clues
  location.clues = (location.clues || 0) + count
  asset.clues = 0
  delete asset.returnCluesOnLeave
  return count
}

export function validateAssetClueSave(state) {
  for (const inv of state.investigators || []) for (const asset of inv.assets || []) {
    if (asset.returnCluesOnLeave == null) continue
    if (asset.returnCluesOnLeave !== true) throw new TypeError('无效线索承载声明')
    integer(asset.clues)
  }
}
