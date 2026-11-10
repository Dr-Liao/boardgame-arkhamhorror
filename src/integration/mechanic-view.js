// Allowlisted public summaries. Never send scenarioFlags.mechanics or future story/road decks.
import { mechanicState } from '../engine/mechanic-state.js'
import { isPublicBeneath } from '../engine/commit-origins.js'
import { effectiveFloodLevel } from '../engine/flood.js'
import { vehicleAccessError, vehicleName } from '../engine/vehicles.js'
import { FROST_POOL_LIMIT, frostPoolCount } from '../engine/frost.js'
import { eoteCampaignState, eoteScenarioState } from '../engine/eote-state.js'
// 八循环《绯红密钥》P4 交互投影（只暴露公开信息与「本人可见」的私有信息）。
import { concealedProjection } from '../engine/tsk-concealed.js'
import { hollowCards, hollowCount } from '../engine/tsk-hollow.js'
import { scarletKeys } from '../engine/tsk-scarlet-keys.js'
import { forcedDestination } from '../engine/tsk-map.js'
import { customizationLevel } from '../engine/tsk-customizable.js'
import { crossSeatActionPending } from '../engine/tsk-investigator.js'
import { tskCampaignState, tskScenarioState } from '../engine/tsk-state.js'

// 七循环《地球边缘》交互投影：只暴露桌面公开信息与「本人可见」的私有信息。
// 口径：
//   · frost 余量总是可算（袋内 + 本次揭示区 + 封印区共用 8 枚实物池），因此没有 eote 扩展的
//     纯寒霜场景也会得到 frost 计数器；
//   · deckTop 是本人私有：只给 observer 自己的那一行，或内容层声明 public 的揭示；
//   · crossSeat 授权只给被授权的调查员本人；maskMechanicSnapshot 会在动画快照里再次掩码；
//   · partners / seals / disciplines 来自战役级扩展，属于桌面公开信息；
//   · tekeli 只暴露牌库张数，永不暴露牌序或卡号；
//   · supplies 只暴露每人携带件数与「掉落在地点」的汇总（掉落地点本身是公开的）。
function eoteView(state, data, observer) {
  const scenario = eoteScenarioState(state)
  const campaign = eoteCampaignState(state)
  const frostTotal = frostPoolCount(state)
  if (!scenario && !campaign && !(frostTotal > 0)) return null
  const eote = {
    frost: { limit: FROST_POOL_LIMIT, remaining: Math.max(0, FROST_POOL_LIMIT - frostTotal) },
  }
  const roster = campaign?.partners?.roster
  if (Array.isArray(roster) && roster.length) {
    eote.partners = roster.map(({ code, damage, horror, status, resolute }) => ({
      code, damage: damage || 0, horror: horror || 0, status,
      ...(resolute ? { resolute } : {}),
    }))
  }
  const seals = campaign?.seals?.entries
  if (Array.isArray(seals) && seals.length) {
    eote.seals = seals.map(({ kind, active, placedBySeat, locationId }) => ({
      kind, active: active === true, placedBySeat: placedBySeat ?? null, locationId: locationId ?? null,
    }))
  }
  const tekeliDeck = data?.scenarioDecks?.tekeli
  if (tekeliDeck && Array.isArray(tekeliDeck.deck)) eote.tekeli = { count: tekeliDeck.deck.length }
  const deckTopSeats = scenario?.deckTop?.seats
  if (deckTopSeats && typeof deckTopSeats === 'object') {
    const rows = Object.entries(deckTopSeats).flatMap(([key, record]) => {
      const seat = Number(key)
      if (!Number.isSafeInteger(seat) || !record || typeof record.code !== 'string') return []
      const isPublic = record.public === true
      if (seat !== observer && !isPublic) return []
      return [{ seat, code: record.code, public: isPublic }]
    })
    if (rows.length) eote.deckTop = rows
  }
  const grants = scenario?.crossSeat?.grants
  if (grants && typeof grants === 'object' && Number.isInteger(observer) && grants[observer]) {
    const grant = grants[observer]
    if (grant && Array.isArray(grant.codes) && grant.codes.length) {
      eote.crossSeat = [{
        seat: observer, fromSeat: grant.fromSeat, codes: [...grant.codes],
        ...(grant.costSplit ? { costSplit: { ...grant.costSplit } } : {}),
      }]
    }
  }
  const disciplines = campaign?.disciplines
  if (disciplines && Array.isArray(disciplines.sets) && disciplines.sets.length) {
    const faces = disciplines.faces || {}
    eote.disciplines = disciplines.sets.map(({ unbrokenCode, brokenCode, burdenCode }) => ({
      unbrokenCode, brokenCode, burdenCode,
      face: faces[unbrokenCode] === 'broken' ? 'broken' : 'unbroken',
    }))
  }
  const supplies = campaign?.supplies
  if (supplies && typeof supplies === 'object') {
    const carried = Object.entries(supplies.carriers || {}).flatMap(([key, codes]) => {
      const seat = Number(key)
      if (!Number.isSafeInteger(seat) || !Array.isArray(codes) || !codes.length) return []
      return [{ seat, count: codes.length }]
    })
    if (carried.length) eote.supplies = carried
    const droppedByLocation = new Map()
    for (const locationId of Object.values(supplies.dropped || {})) {
      if (typeof locationId !== 'string' || !locationId) continue
      droppedByLocation.set(locationId, (droppedByLocation.get(locationId) || 0) + 1)
    }
    if (droppedByLocation.size) eote.droppedSupplies = [...droppedByLocation].map(([locationId, count]) => ({ locationId, count }))
  }
  return eote
}

// 八循环《绯红密钥》P4 交互投影：
//   · concealed 只给位置与「是否可见」，未揭露/未合法获知的迷你卡不出现 kind/decoy（真身隐私）；
//   · keys 是公开信息（持有者与当前面）；hollows 是公开的场外区（卡号不隐藏真身，只登记归属口径）；
//   · map / statusReports / dossiers 只给公开读数：地图不传图结构，密档只给已解锁/已读 key，绝不传正文；
//   · customizations 只给 observer 本人（他人勾选属于私有构筑信息）；
//   · crossSeat 只给被授权的调查员本人；
//   · 异界牌库顺序永不投影（view.scenarioDecks 只有张数）。
function tskView(state, observer) {
  const scenario = tskScenarioState(state)
  const campaign = tskCampaignState(state)
  if (!scenario && !campaign) return null
  const tsk = {}
  const concealed = concealedProjection(state)
  if (concealed.length) tsk.concealed = concealed
  const keys = scarletKeys(state)
  if (keys.length) {
    tsk.keys = keys.map(record => ({
      id: record.id,
      face: record.stable ? record.stableFace : record.unstableFace,
      stable: record.stable,
      holder: { ...record.bearer },
      shiftedThisRound: record.shiftedRound === (Number.isSafeInteger(state.round) ? state.round : 0),
    }))
  }
  const hollows = hollowCards(state)
  if (hollows.length) {
    tsk.hollows = {
      count: hollowCount(state, { scope: 'team' }),
      cards: hollows.map(card => ({ code: card.code, scope: card.scope, seat: card.seat })),
    }
  }
  const map = campaign?.map
  if (map) {
    tsk.map = {
      current: map.current,
      time: map.time,
      unlocked: [...map.unlocked],
      forced: forcedDestination(state),
    }
  }
  const status = campaign?.statusReports
  if (status) {
    tsk.statusReports = {
      triggered: [...(status.triggered || [])],
      pending: [...(status.pending || [])],
      theta: status.theta ?? null,
      psi: status.psi ?? null,
    }
  }
  const dossiers = campaign?.dossiers
  if (dossiers) tsk.dossiers = { unlocked: [...(dossiers.unlocked || [])], read: [...(dossiers.read || [])] }
  if (Number.isSafeInteger(observer)) {
    const seatTable = campaign?.customizations?.bySeat?.[observer]
    if (seatTable && Object.keys(seatTable).length) {
      tsk.customizations = Object.entries(seatTable).map(([code, checked]) => ({
        code, checked: [...checked], level: customizationLevel(checked),
      }))
    }
    const pending = crossSeatActionPending(state, observer)
    if (pending) tsk.crossSeat = [pending]
    // 授权者本人也看到自己发出的授权（公开的桌面信息：谁授权了谁）。
    const grants = scenario?.crossSeat?.grants || {}
    const outgoing = Object.entries(grants).flatMap(([targetKey, entries]) => {
      const targetSeat = Number(targetKey)
      if (!Number.isSafeInteger(targetSeat)) return []
      return (entries || []).filter(entry => !entry.used && entry.from === observer)
        .map(entry => ({ targetSeat, from: entry.from, round: entry.round, used: false }))
    })
    if (outgoing.length) tsk.crossSeat = [...(tsk.crossSeat || []), ...outgoing]
  }
  return Object.keys(tsk).length ? tsk : null
}

export function mechanicView(state, observer = null) {
  const data = mechanicState(state)
  const eote = eoteView(state, data, observer)
  const tsk = tskView(state, observer)
  if (!data && !state.skillTest?.tokenResults?.length && !eote && !tsk) return null
  const revealed = state.skillTest && (state.skillTest.helpRequested || state.skillTest.seat === observer)
    ? (state.chaos?.revealed || []).flatMap((face, index) => {
      if (index < (state.chaos?.frames?.at(-1) || 0)) return []
      const result = state.skillTest.tokenResults?.find(item => item.index === index)
      return [{ index, face, as: state.skillTest.tokenTreatments?.[index]?.as, modifier: result?.modifier ?? (/^[+-]?\d+$/.test(face) ? Number(face) : undefined),
        cancelled: !!state.skillTest.tokenTreatments?.[index]?.cancel }]
    }) : []
  const view = {}
  if (data?.barriers?.length) view.barriers = data.barriers.map(({ a, b, count }) => ({ a, b, count }))
  if (data?.scenarioDecks) view.scenarioDecks = Object.fromEntries(Object.entries(data.scenarioDecks).map(([id, pile]) => [id, { count: pile.deck.length }]))
  if (data?.flood || data?.air) {
    view.water = {
      locations: (state.locations || []).filter(loc => loc.revealed).map(loc => ({ id: loc.id, level: data.flood?.[loc.id] || 0 })),
      investigators: (state.investigators || []).map(inv => ({ seat: inv.seat, level: state.locations.some(loc => loc.id === inv.location) ? effectiveFloodLevel(state, inv.seat) : 0,
        airRequired: !!data.air?.[inv.seat], damage: data.air?.[inv.seat]?.damage || 0 })),
    }
  }
  if (data?.keys) {
    const publicHolders = new Set([
      'reference', ...(state.locations || []).filter(loc => loc.revealed).map(loc => `location:${loc.id}`),
      ...(state.investigators || []).map(inv => `investigator:${inv.seat}`),
      ...(state.enemies || []).map(enemy => `enemy:${enemy.id}`),
      ...(state.storyAssets || []).map(asset => `asset:${asset.id}`),
      ...(state.investigators || []).flatMap(inv => (inv.assets || []).map(asset => `asset:${asset.id}`)),
    ])
    view.keys = Object.entries(data.keys).filter(([, key]) => publicHolders.has(key.holder))
      .map(([color, key]) => ({ holder: key.holder, color: key.revealed ? color : 'unrevealed' }))
  }
  if (data?.vehicles) view.vehicles = Object.entries(data.vehicles).map(([id, vehicle]) => ({
    id, name: vehicleName(state, id), location: vehicle.location, capacity: vehicle.capacity, running: vehicle.running,
    driver: vehicle.driver, passengers: [...vehicle.passengers], protectsFromFlood: vehicle.protectsFromFlood,
    ...(Number.isInteger(observer) && state.investigators[observer] ? {
      enterReason: vehicleAccessError(state, observer, id), leaveReason: vehicleAccessError(state, observer, id, false),
    } : {}),
  }))
  if (data?.beneath) view.beneath = Object.entries(data.beneath).flatMap(([seat, hosts]) => Object.entries(hosts)
    .map(([host, cards]) => ({ seat: Number(seat), host, count: cards.length,
      ...(isPublicBeneath(state, Number(seat), host) ? { public: true } : {}),
      ...(Number(seat) === observer || isPublicBeneath(state, Number(seat), host) ? { codes: [...cards] } : {}) })))
  if (revealed?.length) view.tokens = revealed.map(({ index, face, as, modifier, cancelled }) => ({ index, face, as, modifier, cancelled: !!cancelled }))
  if (eote) view.eote = eote
  if (tsk) view.tsk = tsk
  return Object.keys(view).length ? view : null
}

// Animation snapshots may contain all owners' beneath cards, just like hands. Mask them again per recipient.
// EotE: deckTop 只有本人或公开揭示可见；crossSeat 授权只发给被授权者；其余 eote 字段是公开桌面信息。
export function maskMechanicSnapshot(model, observer) {
  if (!model) return model
  const copy = structuredClone(model)
  for (const item of copy.beneath || []) if (item.seat !== observer && !item.public) delete item.codes
  if (copy.tokenSeat != null && copy.tokenSeat !== observer) delete copy.tokens
  delete copy.tokenSeat
  if (copy.eote) {
    if (Array.isArray(copy.eote.deckTop)) {
      copy.eote.deckTop = copy.eote.deckTop.filter(item => item.seat === observer || item.public === true)
      if (!copy.eote.deckTop.length) delete copy.eote.deckTop
    }
    if (Array.isArray(copy.eote.crossSeat)) {
      copy.eote.crossSeat = copy.eote.crossSeat.filter(item => item.seat === observer)
      if (!copy.eote.crossSeat.length) delete copy.eote.crossSeat
    }
  }
  // TSK：本人勾选与本人授权不进其他座位的快照；密钥/空洞/地图/密档 key 是公开信息保持原样，
  // 未揭露迷你卡在投影阶段就已删除身份字段（快照再复制也不会泄露）。
  if (copy.tsk) {
    delete copy.tsk.customizations
    if (Array.isArray(copy.tsk.crossSeat)) {
      copy.tsk.crossSeat = copy.tsk.crossSeat.filter(item => item.targetSeat === observer)
      if (!copy.tsk.crossSeat.length) delete copy.tsk.crossSeat
    }
    if (!Object.keys(copy.tsk).length) delete copy.tsk
  }
  return copy
}

export function mechanicSnapshot(state) {
  const model = mechanicView(state, state.skillTest?.seat)
  if (!model) return null
  for (const item of model.beneath || []) item.codes = [...(mechanicState(state)?.beneath?.[item.seat]?.[item.host] || [])]
  if (model.tokens && !state.skillTest?.helpRequested) model.tokenSeat = state.skillTest.seat
  return model
}
