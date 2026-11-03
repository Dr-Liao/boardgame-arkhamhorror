import { enemyForKeyHolder } from './enemy-zones.js'
import { registeredEntry } from './ability.js'
import { randomValue } from './rules-state.js'
import { mechanicState, investigatorAt, locationAt } from './mechanic-state.js'
export const KEY_COLORS = Object.freeze(['red', 'yellow', 'green', 'blue', 'purple', 'white', 'black'])
function holder(state, target) {
  if (target === 'setAside' || target === 'removed' || target === 'reference') return target
  if (typeof target !== 'string') throw new TypeError('无效钥匙目标')
  const [kind, ...parts] = target.split(':'); const id = parts.join(':')
  if (kind === 'investigator') investigatorAt(state, Number(id))
  else if (kind === 'location') locationAt(state, id)
  else if (kind === 'enemy') { if (!enemyForKeyHolder(state,id)) throw new RangeError('无效钥匙目标') }
  else if (kind === 'act') { if (!state.acts?.some(act => act.id === id)) throw new RangeError('无效钥匙目标') }
  else if (kind !== 'asset' || ![...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])].some(asset => asset.id === id)) throw new RangeError('无效钥匙目标')
  return target
}
export function initializeKeys(state, specs) {
  if (!Array.isArray(specs) || new Set(specs.map(s => s.color)).size !== specs.length) throw new TypeError('钥匙声明重复或无效')
  const entries = specs.map(spec => {
    if (!KEY_COLORS.includes(spec.color) || typeof spec.revealed !== 'boolean') throw new TypeError('无效钥匙声明')
    return [spec.color, { holder: holder(state, spec.holder || 'setAside'), revealed: spec.revealed }]
  })
  const data = mechanicState(state, true)
  if (data.keys) throw new Error('钥匙已初始化，不能重复创建')
  data.keys = Object.fromEntries(entries)
  return entries.length
}
export function keysAt(state, target, { reveal = false } = {}) {
  holder(state, target)
  return Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => key.holder === target)
    .map(([color, key]) => reveal || key.revealed ? color : 'unrevealed')
}

export function keysHeldAtLocation(state, id) {
  locationAt(state, id)
  const holders = new Set((state.investigators || []).filter(inv => inv.location === id && !inv.defeated && !inv.resigned).map(inv => `investigator:${inv.seat}`))
  return Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => holders.has(key.holder)).map(([color]) => color)
}
export function keysHeldByGroup(state) {
  const holders = new Set((state.investigators || []).filter(inv => !inv.defeated && !inv.resigned).map(inv => `investigator:${inv.seat}`))
  return Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => holders.has(key.holder)).map(([color]) => color)
}

export function linkKeyAsset(state, color, assetId) {
  const key = mechanicState(state)?.keys?.[color]
  const asset = [...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])].find(asset => asset.id === assetId)
  if (!key || !asset) return false
  key.linkedAssetId = assetId
  return true
}
function syncLinkedAsset(state, key, to) {
  if (!key.linkedAssetId) return
  const groups = [state.storyAssets || [], ...state.investigators.map(inv => inv.assets)]
  const source = groups.find(cards => cards.some(asset => asset.id === key.linkedAssetId))
  if (!source) return // A removed or destroyed relic is never recreated.
  const asset = source.splice(source.findIndex(asset => asset.id === key.linkedAssetId), 1)[0]
  if (to.startsWith('investigator:')) {
    const inv = state.investigators[Number(to.slice(13))]
    delete asset.near; delete asset.uncontrolled; delete asset.location
    inv.assets.push(asset)
  } else if (to.startsWith('location:') || to.startsWith('enemy:') || to.startsWith('asset:')) {
    const id = to.slice(to.indexOf(':') + 1)
    const host = [...state.locations, ...state.enemies, ...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])].find(card => card.id === id)
    asset.near = to; asset.uncontrolled = true; asset.location = state.locations.includes(host) ? host.id : host?.location
    state.storyAssets ||= []; state.storyAssets.push(asset)
  } else {
    state.removedFromGame ||= []; state.removedFromGame.push(asset.originalCode || asset.code)
  }
}
export function transferKey(state, color, from, to, { reveal = false } = {}) {
  holder(state, from); holder(state, to)
  const key = mechanicState(state)?.keys?.[color]
  if (!key || key.holder !== from) return false
  key.holder = to; if (reveal) key.revealed = true
  syncLinkedAsset(state, key, to)
  return true
}
export function placeRandomUnrevealedKey(state, to) {
  holder(state, to)
  const choices = Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => key.holder === 'setAside' && !key.revealed)
  if (!choices.length) return false
  const [color] = choices[Math.floor(randomValue(state) * choices.length)]
  transferKey(state, color, 'setAside', to)
  return true // Do not reveal the randomly placed color to the caller/UI.
}
export function canClaimKey(state, seat, color = null) {
  const inv = investigatorAt(state, seat), location = locationAt(state, inv.location)
  if (inv.defeated || inv.resigned || (location.clues || 0) > 0) return false
  const traits = registeredEntry(state.acts?.[state.actIndex]?.originalCode || state.acts?.[state.actIndex]?.code)?.actRule?.keyClaimBlockedTraits || []
  if(traits.some(trait=>location.traits?.includes(trait)))return false
  const keys = mechanicState(state)?.keys || {}
  return Object.entries(keys).some(([candidate,key])=>(color==null||color===candidate)&&key.holder==='location:'+inv.location)
}
export function canGiveKeys(state, seat) {
  const inv=investigatorAt(state,seat)
  return !inv.defeated&&!inv.resigned&&keysAt(state,'investigator:'+seat).length>0&&state.investigators.some(other=>other.seat!==seat&&!other.defeated&&!other.resigned&&other.location===inv.location)
}
export function claimKey(state, seat, color) {
  const inv = investigatorAt(state, seat), location = locationAt(state, inv.location)
  if (!canClaimKey(state,seat,color)) return false
  return transferKey(state, color, `location:${inv.location}`, `investigator:${seat}`, { reveal: true })
}
export function spendKey(state, seat, color, destination = 'reference') {
  investigatorAt(state, seat)
  return transferKey(state, color, `investigator:${seat}`, destination)
}
export function keysOnExit(state, target, location, responsibleSeat = null) {
  const entries = Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => key.holder === target)
  if (!entries.length) return 0
  locationAt(state, location)
  const inv = responsibleSeat == null ? null : investigatorAt(state, responsibleSeat)
  const to = inv && !inv.defeated && !inv.resigned ? `investigator:${responsibleSeat}` : `location:${location}`
  for (const [color] of entries) transferKey(state, color, target, to, { reveal: !!inv })
  return entries.length
}
export function giveKeys(state, from, to, colors) {
  const owner = investigatorAt(state, from), recipient = investigatorAt(state, to)
  if (owner.location !== recipient.location || owner.defeated || owner.resigned || recipient.defeated || recipient.resigned) return false
  const data = mechanicState(state)?.keys || {}
  if (!Array.isArray(colors) || new Set(colors).size !== colors.length || colors.some(color => data[color]?.holder !== `investigator:${from}`)) return false
  for (const color of colors) transferKey(state, color, `investigator:${from}`, `investigator:${to}`)
  return true
}
