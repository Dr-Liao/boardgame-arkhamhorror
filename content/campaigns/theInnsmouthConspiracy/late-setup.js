import { suspectCode } from './role-data.js'
import { chapterData, physicalLocationId } from './chapter-definition.js'
import { concealPhysicalLocations, locationId, shuffled, initKeys } from './chapter-setup.js'
import { KEY_COLORS } from '../../../src/engine/scenario-keys.js'

const hasMemory = (state, memory) => (state.campaign.records.memoriesRecovered || []).includes(memory)
const expand = cards => (cards || []).flatMap(c => Array(c.count ?? c.quantity).fill(c.printedCode))
const codeOf = code => physicalLocationId(code)
const initialPosition = (state, id, x, y) => (state.scenarioFlags.initialPositions ||= []).push({ id, x, y })

export function lateSetupLocations(state, events, deps) {
  const id = state.scenario.id, facts = chapterData[id].setup
  state.scenarioFlags.initialPositions = []
  if (id === 'aLightInTheFog') {
    for (const loc of facts.initialLocations) initialPosition(state, codeOf(loc.physicalId), loc.position.column, loc.position.row)
    return facts.initialLocations.map(loc => codeOf(loc.physicalId))
  }
  if (id === 'theLairOfDagon') {
    const selected = facts.agendaDeck.map(a => a.code || (hasMemory(state, a.ifMemory) ? a.then : a.else))
    state.agendas.splice(0, state.agendas.length, ...selected.map(code => structuredClone(state.scenario.stageCards[code])))
    const positions = { grandEntryway: [1, 2], foulCorridors: [1, 1], thirdFloorHall: [1, 0],
      firstFloorHall1: [0, 2], firstFloorHall2: [2, 2], secondFloorHall1: [0, 1], secondFloorHall2: [2, 1] }
    const placed = facts.initialLocations.map(loc => { const id = codeOf(loc.code); initialPosition(state, id, ...positions[loc.slot]); return id })
    for (const group of facts.randomInitialSlots) {
      const pool = shuffled(state, expand(group.pool), deps)
      concealPhysicalLocations(state, pool, deps)
      for (const [index, physical] of pool.entries()) {
        const id = locationId(state, physical)
        placed.push(id); initialPosition(state, id, ...positions[group.slots[index]])
      }
    }
    return placed
  }
  if (id === 'intoTheMaelstrom') {
    const all = chapterData[id].locations.filter(loc => loc.code !== facts.start).map(loc => loc.id)
    concealPhysicalLocations(state, all, deps)
    const physicalPool = chapterData[id].locations.filter(loc => ['07319', '07102', '07103', '07104'].includes(loc.code)).map(loc => loc.id)
    const pool = shuffled(state, physicalPool, deps)
    initialPosition(state, state.scenario.startLocation, 0, 0)
    for (const [index, physical] of pool.entries()) initialPosition(state, locationId(state, physical), ...facts.initialRandomLocations.slots[index])
    return state.scenarioFlags.initialPositions.map(loc => loc.id)
  }
  throw new Error(`No late setup for ${id}`)
}

export function lateAfterDeckSetup(state, events, { api, ...deps }) {
  const id = state.scenario.id, spec = chapterData[id], facts = spec.setup
  const map = api.mechanics.map
  map.configure({ adjacency: id === 'aLightInTheFog' ? 'row' : id === 'theLairOfDagon' ? 'none' : 'orthogonal' })
  for (const loc of state.scenarioFlags.initialPositions) map.place(loc.id, loc.x, loc.y)
  state.scenarioZones.setAside = [...spec.reservedEncounter]
  if (id === 'aLightInTheFog') {
    initKeys(api, facts.keys.faceupAside)
    api.storyAsset('07252', null)
    for (const item of facts.conditionalSetAsideAssets) if (state.campaign.records[item.record]) state.scenarioZones.setAside.push(item.code)
    const doom = facts.initialDoom.sum.reduce((sum, rule) => sum + (state.campaign.records[rule.ifRecord] ? rule.amount : 0), 0)
    if (doom) api.addDoom(doom)
  } else if (id === 'theLairOfDagon') {
    initKeys(api, facts.keys.faceupAside)
    state.scenarioZones.setAside.push('07292a', '07300')
    if (hasMemory(state, 'AJailbreak') && suspectCode(state.campaign.records.harperSuspect)) state.scenarioZones.setAside.push(suspectCode(state.campaign.records.harperSuspect))
    if (!hasMemory(state, 'ADecisionToStickTogether')) state.scenarioZones.setAside.push('07082')
  } else if (id === 'intoTheMaelstrom') {
    const held = facts.keyRecordRecipients.filter(item => state.campaign.records[item.record]).map(item => item.key)
    const hidden = [...facts.keyRecordRecipients.map(item => item.key).filter(color => !held.includes(color)), ...shuffled(state, ['purple', 'white', 'black'], deps)].slice(0, 4)
    const recipients = {}
    for (const color of held) recipients[color] = state.investigators.length === 1 ? 0 : Number(api.choose({ kind: 'investigator', source: 'maelstromKeys',
      seat: state.campaign.leadSeat, prompt: `选择由谁持有${color}钥匙。`, options: state.investigators.map(inv => ({ id: String(inv.seat), label: inv.name })) }))
    api.mechanics.keys.initialize(KEY_COLORS.map(color => ({ color, revealed: held.includes(color),
      holder: held.includes(color) ? `investigator:${recipients[color]}` : hidden.includes(color) ? 'setAside' : 'removed' })))
    // 沉睡/苏醒面的初始面由战役记录决定（data 的 faceIfRecord）；此前只读了 else 分支，
    // 导致 DagonHasAwakened 时也把沉睡面放进 setAside。
    const setAsideFaces = facts.setAsidePhysical.map(physical => {
      if (physical.face) return physical.face
      if (physical.faceIfRecord) {
        const record = physical.faceIfRecord
        return state.campaign.records?.[record.record] ? record.then : record.else
      }
      return null
    }).filter(Boolean)
    state.scenarioZones.setAside.push(...setAsideFaces)
    for (const inv of state.investigators) if (state.campaign.investigators[inv.seat]?.records?.PossessesADivingSuit
      || state.campaign.investigators[inv.seat]?.PossessesADivingSuit) api.giveAsset(inv.seat, facts.divingSuits.code)
    api.mechanics.water.set(state.scenario.startLocation, 1)
  }
  api.reveal(state.scenario.startLocation)
  state.scenario.setAsideLocations = Object.keys(state.scenario.locations).filter(id => !state.locations.some(loc => loc.id === id))
}

export function lateAfterChaosBagSetup(state, events, api) {
  if (state.scenario.id !== 'theLairOfDagon') return
  const count = (state.campaign.records.memoriesRecovered || []).length
  api.mechanics.chaosTokens.add(count <= 4 ? 'bless' : 'curse', count <= 4 || count >= 8 ? 5 : 2)
  if (hasMemory(state, 'ADecisionToStickTogether')) {
    const inv = state.investigators.length === 1 ? state.investigators[0] : state.investigators[Number(api.choose({ kind: 'investigator',
      source: '07082', seat: state.campaign.leadSeat, prompt: '选择控制托马斯·道森的调查员。',
      options: state.investigators.map(inv => ({ id: String(inv.seat), label: inv.name })) }))]
    api.giveAsset(inv.seat, '07082')
  }
}

// ---------------------------------------------------------------------------
// 幕背面「章节级布置」：条目只声明 `actRule.chapterSetup`（数据键），具体数据来自
// chapter-data.json 的 setup[键]（当前只有《暗潮之下》07315b 的 act1Back）。
//
// 数据形状（act1Back）：
//   gateway               保留的起始地点坐标（起始地点 = scenario.startLocation）
//   shuffleSanctumPool    圣堂地点卡号池（要洗混后按 maps[人数].sanctums 依次放置）
//   shuffleOrdinaryPool   普通地点 {printedCode, count} 池（洗混后按 maps[人数].ordinary 放置，余数留场外）
//   maps[人数]            sanctums/ordinary/dagon/hydra 坐标 + unusedOrdinary
//   spawnHydra/spawnDagon {face|faceIfRecord, location}
//
// 条目可以在 `actRule.setupSpawns` 里给出结构化生成声明（覆盖数据文件里的人工描述串，
// 例如达贡按战役记录选择面）。内容层只做数据驱动布置，不写卡号分支。
// ---------------------------------------------------------------------------
export function chapterActBackSetup(state, act, api, setupKey, rule = {}) {
  const spec = chapterData[state.scenario.id]?.setup?.[setupKey]
  if (!spec) throw new Error(`未知的章节幕背面布置：${state.scenario.id}.${setupKey}`)
  const printedCode = entity => entity?.originalCode || entity?.code
  // 同名地点有多份物理定义（07321#1/#2、07322#1/#2、07323#1/#2/#3、07102…#2 等）：
  // 放置时要逐份取用，不能按卡号只 find 第一份（否则第二份同卡号地点永远放不下）。
  const definitionsByCode = new Map()
  for (const definition of Object.values(state.scenario.locations || {})) {
    const code = printedCode(definition)
    if (!code) continue
    definitionsByCode.set(code, [...(definitionsByCode.get(code) || []), definition])
  }
  const takeDefinition = code => definitionsByCode.get(code)?.shift() || null
  const gateway = state.locations.find(location => location.id === state.scenario.startLocation)
    || state.locations.find(location => (location.connections || []).length === 0)

  // 1) 移除除起始地点外的所有地点：Victory X 且无线索的进胜利区，其余移出游戏；
  //    地点上的敌人/玩家附件由 removeLocationFromGame 按印刷「弃掉这些地点的所有其他卡牌」清理。
  for (const location of [...state.locations]) {
    if (location.id === gateway?.id) continue
    if (Number(location.victory || 0) > 0 && (location.clues || 0) === 0) api.awardLocationVictory(location.id)
    api.removeLocationFromGame(location.id, { discardPlayerAttachments: true })
  }

  // 2) 按调查员人数图示放置地点。
  const map = spec.maps?.[String(state.numInvestigators)]
  if (!map) throw new Error(`幕背面布置缺少 ${state.numInvestigators} 人图示：${setupKey}`)
  const placeDefinition = (definition, position) => {
    if (!definition || !position) return null
    api.mechanics.map.place(definition.id, position[0], position[1])
    return state.locations.find(location => location.id === definition.id) || null
  }
  const placeOne = (code, position) => placeDefinition(takeDefinition(code), position)
  const sanctums = api.shuffle([...(spec.shuffleSanctumPool || [])])
  ;(map.sanctums || []).forEach((position, index) => placeOne(sanctums[index], position))
  const ordinaryPool = []
  for (const group of spec.shuffleOrdinaryPool || []) {
    for (let index = 0; index < (group.count || 1); index++) ordinaryPool.push(group.printedCode)
  }
  const ordinary = api.shuffle(ordinaryPool)
  ;(map.ordinary || []).forEach((position, index) => placeOne(ordinary[index], position))
  const dagonLair = placeOne(spec.spawnDagon?.location, map.dagon)
  const hydraLair = placeOne(spec.spawnHydra?.location, map.hydra)

  // 3) 生成沉睡/苏醒的古神：条目 `setupSpawns` 优先，否则用数据里的 face/faceIfRecord。
  //    setupSpawns 支持两种结构化写法：{ face } 或 { record/then/else }（也接受嵌套 faceIfRecord）。
  const resolveFace = spawn => {
    if (spawn.face) return spawn.face
    const record = spawn.faceIfRecord || (spawn.record ? spawn : null)
    if (!record) return null
    return state.campaign.records?.[record.record] ? record.then : record.else
  }
  const defaultSpawns = [
    spec.spawnHydra ? { ...spec.spawnHydra, face: spec.spawnHydra.face } : null,
    spec.spawnDagon || null,
  ].filter(Boolean)
  for (const spawn of (Array.isArray(rule.setupSpawns) ? rule.setupSpawns : defaultSpawns)) {
    const face = resolveFace(spawn)
    const lair = spawn.location === spec.spawnDagon?.location ? dagonLair : hydraLair
    if (!face || !lair) continue
    if (api.takeFromSetAside(face)) api.spawn(face, lair.id)
  }
}

