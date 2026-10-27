import { contentRegistry } from '../../content/registered.js'
import { HIDDEN_LOCATION_ART, PRIVATE_DOORWAY_NAMES } from '../../content/campaigns/thePathToCarcosa/presentation.js'
import { traitLabels } from '../cards/trait-labels.js'
import { grantedTraitsOf } from '../engine/location-traits.js'
import { agendaDoom, totalDoom, enemyHealthValue } from '../engine/rules-state.js'

// Use the same scenario gate as movement, independently of remaining actions,
// adjacency or pending choices. Only project the resulting public restriction.
export function locationEntryErrors(state) {
  const investigator = state.investigators.find(item => item.seat === state.currentSeat)
  if (!state.scenario || !investigator) return {}
  const behavior = contentRegistry.getBehavior(state.scenario.id)
  return Object.fromEntries(state.locations.flatMap(location => {
    const error = behavior.investigatorEntryError?.(state, location, investigator)
    return error ? [[location.id, error]] : []
  }))
}

// Cards attached to the current act/agenda or to locations by scenario rules
// live in scenario-private zones; project only their public card codes.
export function publicAttachments(state) {
  const behavior = state.scenario ? contentRegistry.getBehavior(state.scenario.id) : null
  const found = behavior?.publicAttachments?.(state) || {}
  const locations = Object.fromEntries(Object.entries(found.locations || {}).map(([id, cards]) => [id, [...cards]]))
  for (const attachment of state.playerLocationAttachments || []) {
    if (!attachment?.code || !attachment.location) continue
    ;(locations[attachment.location] ||= []).push(structuredClone(attachment))
  }
  return { act: [...(found.act || [])], agenda: [...(found.agenda || [])], locations }
}
export function attachLocationCards(locations, byLocation = {}) {
  return locations.map(loc => byLocation[loc.id]?.length
    ? { ...loc, attachments: [...(loc.attachments || []), ...byLocation[loc.id]] } : loc)
}

// Display checkpoints contain no deck order, RNG, transaction or future choices.
const FIELDS = ['status','currentSeat','turnSeat','moveCount','round','phase','actIndex','agendaIndex','doom','clues','actClues','victory','locations','enemies','storyAssets','encounterDiscard','turnsTaken','log']
const INV_FIELDS = ['seat','code','name','nameEn','klass','willpower','intellect','combat','agility','health','sanity','baseHealth','baseSanity','maxHealth','damage','horror','resources','clues','actionsLeft','discard','assets','threat','location','engaged','defeated','resigned','testBonus','phaseStatBonus']
const pick = (value, keys) => Object.fromEntries(keys.filter(k => Object.hasOwn(value, k)).map(k => [k, structuredClone(value[k])]))
export function publicCardInstance(card) {
  const visible = structuredClone(card)
  if (visible.code === 'xcourage') {
    delete visible.underlyingCode
    delete visible.originalCode
  }
  return visible
}
// 第 125 轮（第 8 批）：隐藏地点的背面图案分组表在内容层（`content/campaigns/thePathToCarcosa/presentation.js`）。
const hiddenLocationArtCode = loc => loc.artCode
  || HIDDEN_LOCATION_ART[loc.originalCode || loc.code]
// 隐藏身份/私人门后地点被换名时，效果授予的特性仍是全桌公开信息（03141 皮博迪先生
// 可以让未揭示地点获得[[通道]]），所以跟着掩码一起保留；印刷 traits 仍然不投影。
// 授予记录的唯一来源是引擎原语（location.traitGrants，见 src/engine/location-traits.js）。
const publicGrantedTraits = loc => {
  const granted = [...grantedTraitsOf(loc)]
  const grantedZh = traitLabels(granted)
  return { grantedTraits: granted, ...(grantedZh.length ? { grantedTraitsZh: grantedZh } : {}) }
}
// 双面私人地点（谢幕的楼座 / 后台）：未揭示时显示「门口」那一面的印名，
// 否则地点名称会直接告诉玩家这扇门后面是什么。仅影响投影副本，不改引擎状态。
const doorwayMask = loc => {
  if (!loc || loc.revealed) return loc
  const names = PRIVATE_DOORWAY_NAMES[loc.originalCode || loc.code]
  if (!names) return loc
  // 只给「门口」这一面的公开信息：名称、连接、已有的毁灭。正面文本/帷幕/线索都不投影，
  // 否则点开详情就能提前看到「揭示时」的强制效果。
  return {
    id: loc.id, originalCode: loc.originalCode || loc.code,
    name: names.zh, nameEn: names.en, revealed: false,
    clues: 0, doom: loc.doom || 0, connections: [...(loc.connections || [])],
    ...publicGrantedTraits(loc),
  }
}
export function maskHiddenLocations(locations) {
  return locations.map(loc => doorwayMask(loc.hiddenIdentity && !loc.revealed
    ? { id: loc.id, name: '未知小径', artCode: hiddenLocationArtCode(loc), revealed: false, clues: 0,
        connections: [...loc.connections], doom: loc.doom || 0, ...publicGrantedTraits(loc) }
    : structuredClone(loc)))
}
export function captureTableState(state, getStat, getMaxSanity) {
  const attachments = publicAttachments(state)
  // 敌人生命值要走剧本钩子（失落时代 P2：04124/04132/04140 等常驻 +生命）。
  const behavior = state.scenario ? contentRegistry.getBehavior(state.scenario.id) : null
  // 演出快照会被客户端当作「当场状态」重绘地点地图与地点档案，所以帷幕值要和 viewState
  // 用同一口径（印刷 + shroudMod 临时修正 + 迷雾 + 剧本修正），特性也同样补中文对照；
  // 快照没有观察者，剧本修正钩子按无此次调查员调用。未揭示/隐藏身份地点的 traits 仍被
  // doorwayMask 清空（印刷特性不外泄），引擎原语记账的授予特性则来自权威地点、始终保留。
  const locationSource = loc => (state.locations || []).find(entry => entry.id === loc.id)
  const projectLocation = loc => {
    const source = locationSource(loc)
    const grantedTraits = grantedTraitsOf(source || loc)
    const projected = {
      ...loc,
      traitsZh: traitLabels(Array.isArray(loc.traits) ? loc.traits : []),
      grantedTraits: [...grantedTraits],
      grantedTraitsZh: traitLabels(grantedTraits),
    }
    if (!source) return projected
    return {
      ...projected,
      shroud: (source.shroud || 0) + (source.shroudMod || 0)
        + (state.fogMod || 0) + (behavior?.locationShroudModifier?.(state, source) || 0),
    }
  }
  return {
    ...pick(state, FIELDS), locations: attachLocationCards(structuredClone(state.locations || []), attachments.locations).map(doorwayMask).map(projectLocation),
    scriptAttachments: { act: attachments.act, agenda: attachments.agenda }, enemies: state.enemies.map(enemy => ({ ...structuredClone(enemy), health: enemyHealthValue(state, enemy, behavior) })), encounterDeckSize: state.encounterDeck.length,
    locationEntryErrors: locationEntryErrors(state),
    privateTest: state.skillTest && !state.skillTest.helpRequested ? { seat: state.skillTest.seat, publicLog: [...(state.skillTest.publicLog || [])] } : null,
    agendaDoom: agendaDoom(state),
    totalDoom: totalDoom(state),
    investigators: state.investigators.map(inv => ({ ...pick(inv, INV_FIELDS),
      assets: (inv.assets || []).map(publicCardInstance),
      threat: (inv.threat || []).map(publicCardInstance),
      hand: [...inv.hand], handSize: inv.hand.length, deck: [], deckSize: inv.deck.length,
      // 压在调查员底下的牌（黛安娜／赛菲娜）与手牌同为本人私有区：演出快照里必须带走，
      // 否则 applyStep 用中间态渲染时整排「下方」栏会消失一瞬，drain 结束才恢复。
      beneath: [...(inv.beneath || [])], beneathCount: (inv.beneath || []).length,
      maxSanity: getMaxSanity(inv), effectiveStats: Object.fromEntries(['willpower','intellect','combat','agility'].map(s => [s, getStat(state, inv, s)])),
    })),
  }
}
export function projectTableState(snapshot, observer) {
  const copy = structuredClone(snapshot)
  copy.locations = maskHiddenLocations(copy.locations || [])
  for (const inv of copy.investigators || []) if (inv.seat !== observer) { inv.hand = []; inv.beneath = [] }
  if (copy.privateTest && copy.privateTest.seat !== observer) copy.log = copy.privateTest.publicLog
  delete copy.privateTest
  return copy
}
