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
import { forcedDestination, embarkOptions } from '../engine/tsk-map.js'
import {
  customizationLevel, customizationOptions, customizationsOfSeat,
} from '../engine/tsk-customizable.js'
// P8：关间/构筑期的定制升级卡面板需要卡名与 exceptional 判定（只读卡表，不复制规则）。
import { cardDef, cardName } from '../engine/card-lookup.js'
import { upgradeRecord } from '../campaign/campaign.js'
import { crossSeatActionPending } from '../engine/tsk-investigator.js'
import { tskCampaignState, tskScenarioState } from '../engine/tsk-state.js'
// P8：地图目的地投影的展示名/图结构由战役清单提供（内容层 flow extras；投影不 import 剧情正文）。
import { contentRegistry } from '../../content/registered.js'

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
//
// P8（大厅定制升级卡）：新增 `customizationHub`——构筑期/关间的**本人**定制勾选面板投影。
//   · 只在关间窗口（scenarioSetup / interlude / campaignHub）出现；场景内仍用 P4 的 `customizations`；
//   · 条目 = observer 战役牌组里「已登记定制选项」的卡（数据来自 tsk-customizable 原语注册表，
//     引擎不认战役 id：没有登记过定制卡的战役不会产生条目，因此实际只在《绯红密钥》出现）；
//   · availableXp 与大厅 hubPurchase 同口径（upgradeRecord 的未花费 XP）；canUpgrade 只在 interlude
//     且 XP ≥ 1 时真——初始构筑期只展示 0 勾选，不伪造经验；
//   · xpPerCheck 按卡面 exceptional 判定（本循环 16 张定制卡均为 1 XP/格；原语已支持 2）。
const CUSTOMIZATION_HUB_STATES = Object.freeze(['scenarioSetup', 'interlude', 'campaignHub'])

function customizationHubView(state, observer) {
  const record = state.campaign?.investigators?.[observer]
  if (!record) return null
  const availableXp = Math.max(0, Number(upgradeRecord(record)?.xp) || 0)
  const checkedTable = customizationsOfSeat(state, observer)
  const deck = Array.isArray(record.deck) ? record.deck : []
  const entries = [...new Set(deck)].flatMap(code => {
    const optionList = customizationOptions(code)
    if (!optionList) return []
    const checked = checkedTable[code] || []
    const counts = new Map()
    for (const index of checked) counts.set(index, (counts.get(index) || 0) + 1)
    return [{
      code,
      name: cardName(code),
      checked,
      level: customizationLevel(checked),
      options: optionList.map((option, index) => ({
        index, name: option.name, checks: option.checks, checkedCount: counts.get(index) || 0,
      })),
      xpPerCheck: cardDef(code)?.exceptional === true ? 2 : 1,
      canUpgrade: state.uiState === 'interlude' && availableXp >= 1,
    }]
  })
  return entries.length ? { availableXp, entries } : null
}

function tskView(state, observer) {
  const scenario = tskScenarioState(state)
  const campaign = tskCampaignState(state)
  // P8：首章前的 scenarioSetup 还没有 `campaign.tsk` 容器（世界地图由序幕初始化），
  // 但定制升级卡面板必须照样可见——面板数据来自战役牌组 + 原语注册表，不依赖 TSK 容器。
  const hubPanel = Number.isSafeInteger(observer) && CUSTOMIZATION_HUB_STATES.includes(state.uiState)
    ? customizationHubView(state, observer) : null
  if (!scenario && !campaign && !hubPanel) return null
  const tsk = {}
  if (hubPanel) tsk.customizationHub = hubPanel
  // 2026-11-13 P1-15：按观察者座位投影（knownBy 只对合法看过的座位可见）。
  const concealed = concealedProjection(state, { observerSeat: Number.isSafeInteger(observer) ? observer : null })
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
    // P8：目的地投影（embarkOptions 的公开字段）。名字来自 manifest.mapNodeNames（story-text
    // locations.<id>.name，缺省回退 id）；不投影图结构、不投影节点正文/密档正文。
    // canEmbark 只在「流程停在 map 节点 + uiState interlude」时为真，供大厅判断是否显示启程面板。
    // 注意 `campaign` 这里是 campaign.tsk 容器；战役清单要按 state.campaign.id 查。
    const manifest = state.campaign?.id ? contentRegistry.getCampaign(state.campaign.id) : null
    const graph = manifest?.worldMapGraph
    if (graph?.nodes?.length && map.current) {
      try {
        const options = embarkOptions(state, { graph })
        const names = manifest.mapNodeNames || {}
        tsk.map.destinations = options.options.map(option => ({
          destination: option.destination,
          name: names[option.destination] || option.destination,
          cost: option.cost,
          unlocked: option.unlocked,
          sideStory: option.sideStory,
          forcedBlocked: option.forcedBlocked,
        }))
        const flowNode = state.campaign.flow?.nodeId ? manifest.flow?.nodes?.[state.campaign.flow.nodeId] : null
        if (flowNode?.type === 'map' && state.uiState === 'interlude') {
          tsk.map.canEmbark = true
          tsk.map.phase = 'embark'
        }
      } catch {
        // 地图状态不完整（旧存档/未初始化）时保留基础投影；观察投影不得因扩展失败中断。
      }
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
  // 2026-11-13 P1-12：章节公开状态摘要——与 `observation.js#projectPublicScenarioFlags`
  // 读同一份「战役清单声明」（manifest.publicScenarioFlags），只投影计数/位置/布尔，不含正文。
  const campaignManifest = state.campaign?.id ? contentRegistry.getCampaign(state.campaign.id) : null
  const declaredFlags = Array.isArray(campaignManifest?.publicScenarioFlags) ? campaignManifest.publicScenarioFlags : []
  if (declaredFlags.length) {
    const flags = state.scenarioFlags || {}
    const readPath = path => String(path || '').split('.').reduce((value, key) => (value == null ? undefined : value[key]), flags)
    const locationNameOf = id => state.locations?.find(location => location.id === id)?.name || id
    const formatValue = (entry, value) => {
      if (value == null) return null
      if (entry.kind === 'map' && value && typeof value === 'object') {
        return Object.entries(value).filter(([, item]) => Number(item) > 0 || item === true)
          .map(([key, item]) => `${locationNameOf(key)}:${item}`).join('、')
      }
      if (entry.kind === 'list' && Array.isArray(value)) return value.length
      if (typeof value === 'boolean') return value ? '是' : '否'
      if (value && typeof value === 'object') return JSON.stringify(value)
      return value
    }
    const rows = declaredFlags.flatMap(entry => {
      const path = typeof entry === 'string' ? entry : entry?.path
      const value = formatValue(entry, readPath(path))
      if (value == null || value === '') return []
      return [{ key: path, label: entry.label || path, labelEn: entry.labelEn || entry.label || path,
        kind: entry.kind || 'text', value }]
    })
    if (rows.length) tsk.scenarioFlags = rows
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
    // 关间定制面板同样只属于本人（快照的观察者是本次技能检定的座位，正常不会在关间产生，
    // 这里保持与 customizations 同一个隐私口径）。
    delete copy.tsk.customizationHub
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
