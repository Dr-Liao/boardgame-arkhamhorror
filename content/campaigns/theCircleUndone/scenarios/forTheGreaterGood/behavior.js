// 05197《崇高利益》· 章节行为（引擎钩子）
//
// 规则映射见 artifacts/migration/tcu/p8/specs/forTheGreaterGood.md。本文件只放钩子与
// 本章状态操作；卡面文案/数值来自 definition.js（card-data.js 读 ALL_CARDS）。
//
// 约定：
//   · 随机只走 helper.randomValue / api.random / api.shuffle，不用 Math.random；
//   · 本章状态写 state.scenarioFlags / state.scenarioZones / state.scenarioKeys（纯 JSON）；
//   · 四把钥匙没有独立原语 → scenarioKeys 纯 JSON（见 scenarioApproximations）；
//   · 覆盖共享钩子时显式调用 encounterRules.X?.(...)。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterResolveFor, entryFlags } from '../../../../../src/cards/card-rules.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { encounterRules, activeInvestigators, hasTrait, recordsFor, parleyDifficultyBonus, playerOrder, discardEncounterTop, watchEncounterDeckEmpty } from '../../encounter-rules.js'
import { fggChaosToken, cultistEnemies } from './chaos.js'
import {
  AGENDA_ENDS_AND_MEANS, AGENDA_HIEROPHANT, AUGUST_LINDQUIST, ACT_FOUR_KEYS, ACT_INFILTRATING,
  ACT_OBTAINING_DEVICE, ACT_WARM_WELCOME, CELL_KEEPER, KEY_IDS, KEY_LABELS, KNIGHT_INNER_CIRCLE,
  KNIGHT_OUTER_VOID, LIBRARY, LOCATIONS, LODGE_CATACOMBS, LODGE_CELLAR_MEMBERS, LODGE_CELLAR_WEVE,
  LODGE_GATES_MEMBERS, LODGE_GATES_WEVE, LODGE_JAILOR, LOBBY_MEMBERS, LOBBY_WEVE, LOUNGE,
  NATHAN_WICK_INDOCTRINATION, NATHAN_WICK_INITIATION, PUZZLE_BOX, SANCTUM_DOORWAY_CEREMONY,
  SANCTUM_DOORWAY_HOLDING, SUMMONED_BEAST, VAULT, INNER_SANCTUM, membersAct1,
} from './definition.js'
import { scenarioGaps, scenarioApproximations } from './notes.js'

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
const original = card => card?.originalCode || card?.code
const locById = (state, id) => (state.locations || []).find(location => location.id === id) || null
const locByCode = (state, code) => (state.locations || []).find(location => original(location) === code) || null
const byCode = (state, code) => (state.storyAssets || []).find(asset => original(asset) === code) || null
const here = (state, inv) => locById(state, inv?.location)
// 场上全部毁灭（含当前密谋实例上的毁灭）。与引擎 agendaDoom 的口径一致：
// state.doom（密谋上的毁灭）+ 当前密谋实例 doom + 敌人/地点/支援/威胁区上的 doom。
const gameDoom = state => (Number(state.doom) || 0)
  + (Number(state.agendas?.[state.agendaIndex]?.doom) || 0)
  + [...(state.enemies || []), ...(state.locations || []),
    ...(state.investigators || []).flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])])]
    .reduce((sum, card) => sum + (Number(card.doom) || 0), 0)
const cluesAt = (state, id) => activeInvestigators(state).filter(inv => inv.location === id)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

// 圣堂地点（05213 地下墓穴 / 05216 圣堂内室 / 05214-05215 圣堂门廊）。
const SANCTUM_LOCATION_IDS = [LOCATIONS.lodgeCatacombs, LOCATIONS.innerSanctum,
  LOCATIONS.sanctumDoorwayCeremony, LOCATIONS.sanctumDoorwayHolding]

// 05199 正面：「位于[[圣堂]]地点的每个[[银暮秘社]]敌人失去冷漠」。
// 引擎在生成时按印刷数据写一次 enemy.aloof（src/engine/enemies.js:287），没有关键词修正读点；
// 本章在生成/轮末/敌军阶段开始等时点同步：在圣堂地点时置 aloof=false，离开或议程翻面后还原。
function syncSanctumCultistAloof(state) {
  const agenda = state.agendas?.[state.agendaIndex]
  const active = String(agenda?.originalCode || agenda?.code || '') === AGENDA_ENDS_AND_MEANS
  for (const enemy of state.enemies || []) {
    if (!hasTrait(enemy, 'Silver Twilight')) continue
    const atSanctum = SANCTUM_LOCATION_IDS.some(id => enemy.location === id)
    if (active && atSanctum) {
      if (!enemy.lodgeAloofCleared) {
        enemy.printedAloof = enemy.printedAloof ?? enemy.aloof === true
        enemy.lodgeAloofCleared = true
      }
      enemy.aloof = false
    } else if (enemy.lodgeAloofCleared) {
      enemy.aloof = enemy.printedAloof === true
      delete enemy.lodgeAloofCleared
    }
  }
}

function setFlags(state, patch) {
  state.scenarioFlags ||= {}
  Object.assign(state.scenarioFlags, patch)
  return state.scenarioFlags
}

const flagsFor = state => (state.scenarioFlags ||= {})

function takeFromSetAside(state, code) {
  const zones = (state.scenarioZones ||= {})
  const list = (zones.setAside ||= [])
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
  return index >= 0
}

// ---------------------------------------------------------------------------
// 四把钥匙（参考实现：混乱标记钥匙 Arkham.Key；本仓库：纯 JSON 状态）
// ---------------------------------------------------------------------------
export function createKeys() {
  return Object.fromEntries(KEY_IDS.map(id => [id, {
    id, label: KEY_LABELS[id], holder: null, location: null, enemyId: null, assetId: null,
  }]))
}

const keyRecord = (state, id) => (state.scenarioKeys ||= createKeys())[id] || null
const keysWhere = (state, predicate) => KEY_IDS
  .map(id => keyRecord(state, id))
  .filter(key => key && predicate(key))

export function keysHeldBy(state, seat) {
  return keysWhere(state, key => key.holder === seat)
}

export function keyCountOf(state, seat) {
  return keysHeldBy(state, seat).length
}

export function keysOnEnemy(state, enemy) {
  return keysWhere(state, key => key.enemyId && key.enemyId === enemy?.id)
}

export function keysOnLocation(state, locationId) {
  return keysWhere(state, key => key.location === locationId && !key.assetId)
}

export function keysOnAsset(state, asset) {
  const id = asset?.id || asset
  return keysWhere(state, key => key.assetId && key.assetId === id)
}

export function setAsideKeys(state) {
  return keysWhere(state, key => key.holder == null && key.location == null
    && key.enemyId == null && key.assetId == null)
}

function randomSetAsideKey(state, api) {
  const pool = setAsideKeys(state)
  if (!pool.length) return null
  const roll = typeof api?.random === 'function' ? api.random() : 0
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index]
}

function placeKeyOnEnemy(state, key, enemy) {
  key.holder = null
  key.location = null
  key.assetId = null
  key.enemyId = enemy?.id || null
}

function placeKeyOnAsset(state, key, asset) {
  key.holder = null
  key.location = null
  key.enemyId = null
  key.assetId = asset?.id || null
}

function placeKeyOnLocation(state, key, locationId) {
  key.holder = null
  key.enemyId = null
  key.assetId = null
  key.location = locationId
}

function giveKey(state, key, seat) {
  key.holder = seat
  key.enemyId = null
  key.location = null
  key.assetId = null
}

function placeRandomKeyOn(state, api, target) {
  const key = randomSetAsideKey(state, api)
  if (!key) return null
  if (target.enemy) placeKeyOnEnemy(state, key, target.enemy)
  else if (target.asset) placeKeyOnAsset(state, key, target.asset)
  else if (target.location) placeKeyOnLocation(state, key, target.location)
  else if (target.seat != null) giveKey(state, key, target.seat)
  return key
}

// 敌人离场：控制钥匙者/击败者拿走；否则放到敌人所在地点（卡面钥匙规则）。
function keysLeavingEnemy(state, enemy, seat, locationId, api) {
  const keys = keysOnEnemy(state, enemy)
  if (!keys.length) return []
  for (const key of keys) {
    if (seat != null) giveKey(state, key, seat)
    else if (locationId) placeKeyOnLocation(state, key, locationId)
  }
  api?.info?.(`敌人离场：${keys.map(key => key.label).join('、')}${seat != null ? '被其控制者取得' : '留在原地'}。`)
  return keys
}

function giveKeysToEnemyController(state, enemy, seat) {
  const keys = keysOnEnemy(state, enemy)
  for (const key of keys) giveKey(state, key, seat)
  return keys
}

// 机关盒剧情资产：「附属到敌人」「由调查员控制」「移出游戏」三种去向。
// 附属到敌人用引擎五轮原语 api.attachStoryAssetToEnemy（真实 enemy.attachments 实例，
// cardsInPlay 可枚举），不再用 storyAssets 条目充当「附属」。
function puzzleBoxAsset(state) {
  return byCode(state, PUZZLE_BOX)
}

// 摘下当前附属在敌人身上的机关盒（幂等；无附属/敌人已离场时安全返回 null）。
function detachPuzzleBoxAttachment(state, api) {
  const box = describePuzzleBox(state)
  if (!box || box.holder !== 'enemy' || !box.enemyId) return null
  const enemy = (state.enemies || []).find(item => item.id === box.enemyId)
  const attachments = enemy?.attachments || []
  const attachment = (box.attachmentId && attachments.find(item => item.id === box.attachmentId))
    || attachments.find(item => String(original(item)) === PUZZLE_BOX)
  if (!attachment) return null
  if (typeof api?.detachEnemyAttachment === 'function') return api.detachEnemyAttachment(box.enemyId, attachment.id)
  const index = attachments.indexOf(attachment)
  if (index >= 0) attachments.splice(index, 1)
  return attachment
}

function attachPuzzleBox(state, api, enemy) {
  state.storyAssets ||= []
  // 卡面「将放在一边的机关盒剧情支援附属到他身上」：离开「放在一边」区。
  takeFromSetAside(state, PUZZLE_BOX)
  // 从剧情区/旧承载移除：机关盒此时是敌人身上的真实附属实例。
  const existing = puzzleBoxAsset(state)
  if (existing) state.storyAssets.splice(state.storyAssets.indexOf(existing), 1)
  detachPuzzleBoxAttachment(state, api)
  let attachment = null
  if (enemy) {
    if (typeof api?.attachStoryAssetToEnemy === 'function') {
      attachment = api.attachStoryAssetToEnemy(PUZZLE_BOX, enemy.id, {
        name: ALL_CARDS[PUZZLE_BOX]?.nameZh || '机关盒', source: '05200', attachedRound: state.round,
      })
    } else {
      // 旧 api/单测桩兜底：直接写真实附属结构（与引擎 attachCardTo 同形状）。
      enemy.attachments ||= []
      attachment = { id: `att:${PUZZLE_BOX}:${state.round}:${enemy.attachments.length + 1}`, code: PUZZLE_BOX, originalCode: PUZZLE_BOX }
      enemy.attachments.push(attachment)
    }
  }
  setFlags(state, { puzzleBox: { holder: 'enemy', enemyId: enemy?.id || null, seat: null } })
  api?.info?.(`「机关盒」附属在「${enemy?.name || '南森·威克'}」上。`)
  return attachment
}

function describePuzzleBox(state) {
  const flags = state.scenarioFlags || {}
  return flags.puzzleBox || { holder: null }
}

// 控制者座位；仍在敌人身上/被移出游戏时返回 null。
export function puzzleBoxHolder(state) {
  const box = describePuzzleBox(state)
  return box?.holder === 'enemy' ? null : (box?.seat ?? null)
}

// 同地点四钥匙 + 机关盒判定（幕 3 目标，也是测试读点）。
export function fourKeysReady(state) {
  const holder = puzzleBoxHolder(state)
  if (holder == null) return false
  const anchor = state.investigators[holder]?.location
  if (!anchor) return false
  return KEY_IDS.every(id => {
    const key = keyRecord(state, id)
    if (!key || key.holder == null) return false
    return state.investigators[key.holder]?.location === anchor
  })
}

function givePuzzleBoxTo(state, api, seat) {
  const asset = puzzleBoxAsset(state)
  if (asset) state.storyAssets.splice(state.storyAssets.indexOf(asset), 1)
  // 从敌人身上摘下真实附属（若还在），再交给调查员控制。
  detachPuzzleBoxAttachment(state, api)
  setFlags(state, { puzzleBox: { holder: 'seat', seat, enemyId: null } })
  const inv = state.investigators[seat]
  if (inv) {
    const already = (inv.assets || []).some(item => original(item) === PUZZLE_BOX)
    if (!already) {
      if (typeof api?.giveAsset === 'function') api.giveAsset(seat, PUZZLE_BOX)
      else {
        inv.assets ||= []
        inv.assets.push({ id: `asset:${PUZZLE_BOX}:${seat}`, code: PUZZLE_BOX, originalCode: PUZZLE_BOX, name: '机关盒' })
      }
    }
    api?.info?.(`${inv.name} 控制了「机关盒」。`)
  }
  return seat
}

// ---- 05228 机关盒 [action]：火盆 / 幽灵看守人 ---------------------------------
// 火盆沿用《联合与幻灭》的 location.flags.brazier / location.litBrazier 读点（同一份场景数据）。
function brazierLit(location) {
  if (!location) return false
  if (typeof location.flags?.brazier === 'boolean') return location.flags.brazier
  return location.litBrazier === true
}

function unlightBrazier(location) {
  if (!location) return
  location.flags ||= {}
  location.flags.brazier = false
  location.litBrazier = false
}

function spectralWatcher(state) {
  return (state.enemies || []).find(enemy => String(original(enemy)) === '05086') || null
}

function puzzleBoxActionOptions(state, inv) {
  const options = []
  const location = locById(state, inv?.location)
  if (brazierLit(location)) options.push({ id: 'unlight', label: `熄灭火盆（${location?.name || inv?.location}）` })
  const watcher = spectralWatcher(state)
  if (watcher && !watcher.exhausted) options.push({ id: 'exhaust', label: '横置幽灵看守人' })
  if (watcher && watcher.exhausted) options.push({ id: 'damage', label: '对已横置的幽灵看守人造成 5 点伤害' })
  return options
}

function chooseInvestigator(state, api, prompt, options) {  const pool = options || activeInvestigators(state)
  if (!pool.length) return null
  if (pool.length === 1) return pool[0].seat
  if (typeof api?.choose !== 'function') return pool[0].seat
  const answer = api.choose({
    kind: 'investigator', source: PUZZLE_BOX, seat: state.campaign?.leadSeat ?? 0,
    prompt, options: pool.map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  const seat = Number(answer)
  return pool.some(inv => inv.seat === seat) ? seat : pool[0].seat
}

// ---------------------------------------------------------------------------
// 布置 / 牌库
// ---------------------------------------------------------------------------
export function isMembersOfTheLodge(state) {
  return Boolean(recordsFor(state).theInvestigatorsAreMembersOfTheLodge)
}

export function setupPlan(state) {
  const members = isMembersOfTheLodge(state)
  return {
    members,
    placed: [
      members ? LOCATIONS.lodgeGatesWeve : LOCATIONS.lodgeGatesMembers,
      members ? LOCATIONS.lobbyWeve : LOCATIONS.lobbyMembers,
      members ? LOCATIONS.lodgeCellarWeve : LOCATIONS.lodgeCellarMembers,
      LOCATIONS.lounge,
      LOCATIONS.lodgeCatacombs,
    ],
  }
}

// 圣堂门廊以未揭示面（圣堂门廊 / 星形）入场，揭示时翻成典礼室（三角）或拘禁室（方形）。
function doorwayVariant(actualName) {
  return {
    name: '圣堂门廊', subname: '', hiddenIdentity: true,
    unrevealedActualName: actualName,
    symbols: { front: { symbol: 'star', links: ['squiggle'], label: '星形' } },
  }
}

function placeDoorway(state, api, id) {
  if (locById(state, id)) return locById(state, id)
  state.locationVariants ||= {}
  state.locationVariants[id] = doorwayVariant(id === LOCATIONS.sanctumDoorwayCeremony ? '典礼室' : '拘禁室')
  if (typeof api?.place === 'function') {
    api.place(id)
    return locById(state, id)
  }
  return null
}

export const implementedEncounterCodes = [
  LODGE_JAILOR, CELL_KEEPER, SUMMONED_BEAST, KNIGHT_INNER_CIRCLE, KNIGHT_OUTER_VOID,
  '05217', '05217b', '05223', '05224', '05225', '05226',
]

// 卡面子句完全未实现的内容（审计读点；development 不阻塞，但必须诚实）。
export const behavior = {
  ...encounterRules,
  id: 'forTheGreaterGood',

  setupPlan,
  implementedEncounterCodes,
  scenarioGaps,
  scenarioApproximations,
  // 钥匙/机关盒读点也挂到 behavior 上，供测试与其它 worker 使用（index.js 只导出 behavior）。
  createKeys,
  keysHeldBy,
  keyCountOf,
  keysOnEnemy,
  keysOnLocation,
  keysOnAsset,
  setAsideKeys,
  fourKeysReady,
  puzzleBoxHolder,
  isMembersOfTheLodge,

  // 记录决定场景 1a（热烈欢迎 / 渗透秘社）。
  preScenarioSetup(state) {
    const members = isMembersOfTheLodge(state)
    if (members && state.acts?.[0]) state.acts[0] = JSON.parse(JSON.stringify(membersAct1))
    setFlags(state, { members })
  },

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      plan.members ? NATHAN_WICK_INITIATION : NATHAN_WICK_INDOCTRINATION,
      SUMMONED_BEAST, PUZZLE_BOX, AUGUST_LINDQUIST,
      LIBRARY, VAULT, INNER_SANCTUM, SANCTUM_DOORWAY_CEREMONY, SANCTUM_DOORWAY_HOLDING,
    ]
    state.scenarioZones.removed = plan.members
      ? [LODGE_GATES_MEMBERS, LOBBY_MEMBERS, LODGE_CELLAR_MEMBERS]
      : [LODGE_GATES_WEVE, LOBBY_WEVE, LODGE_CELLAR_WEVE]
    state.scenarioKeys = createKeys()
    setFlags(state, {
      members: plan.members,
      puzzleBox: { holder: null, seat: null, enemyId: null, removed: false },
      nathanDefeated: false,
      nathanVariant: plan.members ? NATHAN_WICK_INITIATION : NATHAN_WICK_INDOCTRINATION,
      augustRemoved: false,
    })
    return plan.placed
  },

  startLocation(state) {
    return isMembersOfTheLodge(state) ? LOCATIONS.lodgeGatesWeve : LOCATIONS.lodgeGatesMembers
  },

  // 参考实现：另一分支的敌人各 1 张从游戏中移除（3 祭司/1 密会巫师等核组卡见 gaps）。
  modifyDeck(state, deck) {
    const members = isMembersOfTheLodge(state)
    const remove = members
      ? [KNIGHT_INNER_CIRCLE, KNIGHT_INNER_CIRCLE, CELL_KEEPER]
      : [KNIGHT_OUTER_VOID, KNIGHT_OUTER_VOID, LODGE_JAILOR]
    const remaining = new Map()
    for (const code of remove) remaining.set(code, (remaining.get(code) || 0) + 1)
    return deck.filter(code => {
      const count = remaining.get(code) || 0
      if (count <= 0) return true
      remaining.set(code, count - 1)
      return false
    })
  },

  // -------------------------------------------------------------------------
  // 地点
  // -------------------------------------------------------------------------
  investigatorEntryError(state, location) {
    const code = original(location)
    // 卡面背面：05206 前厅（成员版）与 05209 秘社地窖（成员版）有「不能进入」的限制；
    // 05208 秘社地窖（「我们一直在等你」版）背面为空，没有进入限制——进入后正常揭示，
    // 并由 locationRevealed 的随机钥匙分支结算「揭示后放 1 把钥匙」。
    if ((code === LOBBY_WEVE || code === LODGE_CELLAR_MEMBERS) && !location.revealed) {
      return `「${location.name}」尚未开放：先在秘社大门谈判/支付线索。`
    }
    if (code === VAULT && !location.revealed && !keysHeldBy(state, state.currentSeat ?? 0).some(key => key.id === 'elderthing')) {
      return '机密室的门锁上了：需要控制古神钥匙。'
    }
    if (code === INNER_SANCTUM && !location.revealed && !keysHeldBy(state, state.currentSeat ?? 0).some(key => key.id === 'cultist')) {
      return '圣堂内室的门锁上了：需要控制异教徒钥匙。'
    }
    // 05213 背面：控制至少 1 把任意钥匙即可进入（进入后由 locationRevealed 放圣堂内室与门廊）。
    if (code === LODGE_CATACOMBS && !location.revealed
      && keysHeldBy(state, state.currentSeat ?? 0).length === 0) {
      return '地下墓穴的门锁上了：需要控制至少 1 把钥匙。'
    }
    return null
  },

  locationRevealed(state, location, api) {
    const code = original(location)
    if (code === LOBBY_MEMBERS || code === LODGE_CELLAR_WEVE || code === VAULT || code === INNER_SANCTUM) {
      const key = placeRandomKeyOn(state, api, { location: location.id })
      if (key) api?.info?.(`「${location.name}」被揭示：${key.label}放在此处。`)
      return
    }
    if (code === LOUNGE) {
      if (!locById(state, LOCATIONS.vault)) api?.place?.(LOCATIONS.vault)
      if (!locById(state, LOCATIONS.library)) api?.place?.(LOCATIONS.library)
      const lounge = locById(state, LOCATIONS.lounge)
      if (!byCode(state, AUGUST_LINDQUIST)) {
        state.storyAssets ||= []
        state.storyAssets.push({
          id: 'story:august', code: AUGUST_LINDQUIST, originalCode: AUGUST_LINDQUIST,
          name: ALL_CARDS[AUGUST_LINDQUIST]?.nameZh || '奥古斯特·林奎斯特', location: lounge?.id || null,
        })
        // 卡面/参考 Lounge.hs:30-34：钥匙放在奥古斯特支援上（不是地点上）。
        const august = byCode(state, AUGUST_LINDQUIST)
        const key = placeRandomKeyOn(state, api, { asset: august })
        if (key) api?.info?.(`奥古斯特·林奎斯特入场，${key.label}在他身上。`)
      }
      api?.info?.('休息室揭示：机密室与藏书室入场。')
      return
    }
    if (code === LODGE_CATACOMBS) {
      placeDoorway(state, api, LOCATIONS.sanctumDoorwayCeremony)
      placeDoorway(state, api, LOCATIONS.sanctumDoorwayHolding)
      if (!locById(state, LOCATIONS.innerSanctum)) api?.place?.(LOCATIONS.innerSanctum)
      api?.info?.('地下墓穴揭示：圣堂内室与每个圣堂门廊入场（门廊以未揭示面放置）。')
      return
    }
    if (code === SANCTUM_DOORWAY_CEREMONY) {
      location.symbols = { front: { symbol: 'triangle', links: ['squiggle'], label: '三角' } }
      return
    }
    if (code === SANCTUM_DOORWAY_HOLDING) {
      location.symbols = { front: { symbol: 'square', links: ['squiggle'], label: '方形' } }
      findCultistAndSpawn(state, location, api)
    }
  },

  locationEntered(state, inv, location, api) {
    // 核心圈骑士：进入骑士所在地点后检定 agility(4)，失败交战。
    const knight = state.enemies.find(enemy => original(enemy) === KNIGHT_INNER_CIRCLE && enemy.location === location.id)
    if (!knight) return
    forceKnightTest(state, inv, knight, api)
  },

  // 05221 的另一半：「核心圈骑士进入你所在地点后」同样检定 agility(4)，失败交战。
  // 引擎在移动管线里派发 enemyMoved（src/engine/locations.js:265 / movement.js:219,326）。
  enemyMoved(state, enemy, previousLocationId, api) {
    // 引擎第三参是「移动前地点」（src/engine/movement.js:325-329 的 previous；locations.js:263-265 同义）。
    // 卡面判定要用敌人现在的位置：enemy.location 已在派发钩子前更新为移动后地点。
    const newLocationId = enemy?.location ?? previousLocationId
    if (enemy && String(original(enemy)) === KNIGHT_INNER_CIRCLE) {
      for (const inv of activeInvestigators(state).filter(entry => entry.location === newLocationId)) {
        forceKnightTest(state, inv, enemy, api)
      }
    }
    // 05199：「位于圣堂地点的银暮秘社敌人失去冷漠」——移动进入/离开时立即同步。
    syncSanctumCultistAloof(state)
    return encounterRules.enemyMoved?.(state, enemy, previousLocationId, api)
  },

  locationShroudModifier(state, location, inv) {
    if (original(location) !== LIBRARY || !inv) return 0
    return keysHeldBy(state, inv.seat).some(key => key.id === 'tablet') ? -3 : 0
  },

  // 典礼室轮末：在其上的调查员与每个友方支援各受 1 点直接恐惧（有骷髅钥匙则取消）。
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    syncSanctumCultistAloof(state)
    const room = locByCode(state, SANCTUM_DOORWAY_CEREMONY)
    if (!room || !room.revealed) return
    const occupants = activeInvestigators(state).filter(inv => inv.location === room.id)
    if (!occupants.length) return
    if (occupants.some(inv => keysHeldBy(state, inv.seat).some(key => key.id === 'skull'))) {
      api?.info?.('有调查员控制骷髅钥匙：典礼室的恐惧被取消。')
      return
    }
    for (const inv of occupants) api?.directHorror?.(inv.seat, 1)
    // 每个友方支援各受 1 点直接恐惧：走引擎 api.horrorAsset（含「达到理智→弃置」检查）。
    for (const inv of occupants) {
      for (const asset of [...(inv.assets || [])]) {
        if (!(ALL_CARDS[original(asset)]?.traits || []).includes('Ally')) continue
        api?.horrorAsset?.(inv.seat, asset.id, 1)
      }
    }
    api?.info?.('典礼室轮末：在此的调查员与友方支援各受 1 点直接恐惧。')
  },

  // -------------------------------------------------------------------------
  // 玩家行动
  // -------------------------------------------------------------------------
  actions(state, inv) {
    // 05199 兜底：引擎在多数移动路径都派发 enemyMoved，但极少数路径会直接写 enemy.location
    //（如基础弱点「当场抓获」src/engine/weakness.js:200-203）；玩家每次生成合法行动前再同步一次，
    // 保证「位于圣堂的银暮秘社敌人失去冷漠」在玩家可行动时永远是最新状态。
    syncSanctumCultistAloof(state)
    const moves = []
    const location = here(state, inv)
    if (!location) return moves
    const gatesIds = [LOCATIONS.lodgeGatesMembers, LOCATIONS.lodgeGatesWeve]
    if (gatesIds.includes(location.id)) {
      moves.push({ action: 'scenarioAction', rule: 'resignGates', label: '撤退：仔细想想，来这里或许是个糟糕的主意。' })
      const lobby = locById(state, LOCATIONS.lobbyWeve)
      if (lobby && !lobby.revealed) {
        moves.push({ action: 'scenarioAction', rule: 'parleyLobby', label: '谈判：看门人让你进门（揭示前厅）' })
      }
      const cellar = locById(state, LOCATIONS.lodgeCellarMembers)
      if (cellar && !cellar.revealed) {
        const needed = state.numInvestigators || 1
        moves.push({
          action: 'scenarioAction', rule: 'revealCellar', label: '共同支付每人 1 线索：揭示秘社地窖',
          reason: cluesAt(state, location.id) >= needed ? null : `秘社大门处需要 ${needed} 个线索（当前 ${cluesAt(state, location.id)}）`,
        })
      }
    }
    const keysHere = keysOnLocation(state, location.id)
    if (keysHere.length && (location.clues || 0) === 0) {
      moves.push({ action: 'scenarioAction', rule: 'takeKeyAtLocation', actions: 0, label: `控制「${location.name}」上的一把钥匙` })
    }
    const enemiesHere = state.enemies.filter(enemy => enemy.location === location.id)
    if (enemiesHere.some(enemy => original(enemy) === NATHAN_WICK_INITIATION)) {
      moves.push({ action: 'scenarioAction', rule: 'parleyNathan', actionKind: 'parley', label: '谈判：说服南森·威克（意志 3）' })
    }
    if (enemiesHere.some(enemy => original(enemy) === LODGE_JAILOR)) {
      moves.push({ action: 'scenarioAction', rule: 'parleyJailor', actionKind: 'parley', label: '谈判：秘社狱卒（智力 3）' })
    }
    if (enemiesHere.some(enemy => original(enemy) === KNIGHT_OUTER_VOID)) {
      moves.push({ action: 'scenarioAction', rule: 'parleyKnightOuter', actionKind: 'parley', label: '谈判：边缘虚空骑士（意志/智力 4）' })
    }
    const august = byCode(state, AUGUST_LINDQUIST)
    if (august && august.location === location.id) {
      const needed = 2 * (state.numInvestigators || 1)
      moves.push({
        action: 'scenarioAction', rule: 'parleyAugust', actionKind: 'parley', label: '谈判：奥古斯特·林奎斯特（共同支付每人 2 线索）',
        reason: cluesAt(state, location.id) >= needed ? null : `需要 ${needed} 个线索（当前 ${cluesAt(state, location.id)}）`,
      })
    }
    // 05228 机关盒 [action]：只有控制者能用；团队每场游戏限一次。
    if (puzzleBoxHolder(state) === inv.seat && !state.scenarioFlags?.puzzleBox?.actionUsed) {
      const options = puzzleBoxActionOptions(state, inv)
      if (options.length) {
        moves.push({
          action: 'scenarioAction', rule: 'puzzleBoxAction',
          // 卡面「本行动不会引发幽灵看守人的借机攻击」（引擎 dispatch 读该字段，src/engine/dispatch.js:239-252）。
          noOpportunityAttackFrom: ['05086'],
          label: `机关盒：${options.map(option => option.label).join(' / ')}`,
        })
      }
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move || !move.rule) return false
    const location = here(state, inv)
    switch (move.rule) {
      case 'puzzleBoxAction': {
        if (puzzleBoxHolder(state) !== inv.seat) return true
        const box = state.scenarioFlags?.puzzleBox || {}
        if (box.actionUsed) {
          api?.info?.('「机关盒」的本场游戏行动已经用过了。')
          return true
        }
        const options = puzzleBoxActionOptions(state, inv)
        if (!options.length) return true
        let answer = options[0].id
        if (options.length > 1 && typeof api?.choose === 'function') {
          answer = api.choose({
            kind: 'effect', source: PUZZLE_BOX, seat: inv.seat,
            prompt: '「机关盒」：选择一项结算。',
            options: options.map(option => ({ id: option.id, label: option.label })),
          })
        }
        const picked = options.find(option => option.id === answer) || options[0]
        setFlags(state, { puzzleBox: { ...box, actionUsed: true } })
        if (picked.id === 'unlight') {
          unlightBrazier(location)
          api?.info?.(`「机关盒」熄灭了「${location?.name || inv.location}」的火盆。`)
          return true
        }
        const watcher = spectralWatcher(state)
        if (!watcher) return true
        if (picked.id === 'exhaust') {
          watcher.exhausted = true
          api?.info?.('「机关盒」横置了幽灵看守人。')
          return true
        }
        if (picked.id === 'damage') {
          // 非攻击伤害（卡面：对已横置的幽灵看守人造成 5 点伤害）。
          if (typeof api?.damageEnemy === 'function') api.damageEnemy(watcher.id, 5, inv.seat)
          else watcher.damageTaken = (watcher.damageTaken || 0) + 5
          api?.info?.('「机关盒」对已横置的幽灵看守人造成 5 点伤害。')
          return true
        }
        return true
      }
      case 'resignGates':
        api?.resign?.(inv.seat)
        return true
      case 'parleyLobby': {
        const lobby = locById(state, LOCATIONS.lobbyWeve)
        if (lobby && !lobby.revealed) api?.reveal?.(lobby.id)
        api?.info?.('看门人认出了你：前厅被揭示。')
        return true
      }
      case 'revealCellar': {
        const cellar = locById(state, LOCATIONS.lodgeCellarMembers)
        const needed = state.numInvestigators || 1
        if (!cellar || cluesAt(state, location?.id) < needed) {
          api?.info?.('线索不足，无法打开秘社地窖。')
          return true
        }
        api?.payClues?.(needed, location.id)
        api?.reveal?.(cellar.id)
        api?.info?.('你们共同支付线索，揭示了秘社地窖。')
        return true
      }
      case 'takeKeyAtLocation': {
        const key = keysOnLocation(state, location?.id)[0]
        if (!key) return true
        giveKey(state, key, inv.seat)
        api?.info?.(`${inv.name} 控制了${key.label}。`)
        return true
      }
      case 'parleyNathan': {
        const nathan = state.enemies.find(enemy => original(enemy) === NATHAN_WICK_INITIATION && enemy.location === inv.location)
        if (!nathan) return true
        // 05097 秘社玄仪：直到一轮结束，对该敌人谈判难度 +2（实例标记，共享读点）。
        api?.test?.(inv.seat, 'willpower', 3 + parleyDifficultyBonus(state, nathan), result => {
          if (result?.success) {
            nathan.resources = (nathan.resources || 0) + 1
            api.info?.(`南森·威克上现在有 ${nathan.resources} 点资源。`)
            if (nathan.resources >= (state.numInvestigators || 1)) {
              giveKeysToEnemyController(state, nathan, inv.seat)
              setFlags(state, { nathanDefeated: true })
              api.banish?.(nathan)
              api.info?.('南森交出了钥匙与机关盒，被加入胜利区。')
            }
          } else {
            api.attack?.(nathan, inv)
            api.info?.('谈判失败：南森·威克攻击了你。')
          }
        }, 0, { label: '谈判', code: NATHAN_WICK_INITIATION })
        return true
      }
      case 'parleyJailor': {
        const jailor = state.enemies.find(enemy => original(enemy) === LODGE_JAILOR && enemy.location === inv.location)
        if (!jailor) return true
        // 05097 秘社玄仪：谈判难度 +2。
        api?.test?.(inv.seat, 'intellect', 3 + parleyDifficultyBonus(state, jailor), result => {
          if (!result?.success) {
            api.info?.('与秘社狱卒谈判失败。')
            return
          }
          const keys = keysOnEnemy(state, jailor)
          const options = [
            ...((jailor.doom || 0) > 0 ? [{ id: 'doom', label: '移除秘社狱卒上的 1 个毁灭' }] : []),
            ...keys.map(key => ({ id: `key:${key.id}`, label: `控制${key.label}` })),
          ]
          let answer = options[0]?.id
          if (typeof api.choose === 'function' && options.length) {
            answer = api.choose({
              kind: 'parley', source: LODGE_JAILOR, seat: inv.seat,
              prompt: '秘社狱卒谈判成功：选择一项。', options,
            })
          }
          if (String(answer).startsWith('key:')) {
            const key = keys.find(item => `key:${item.id}` === answer) || keys[0]
            giveKey(state, key, inv.seat)
            api.info?.(`${inv.name} 控制了${key.label}。`)
          } else {
            jailor.doom = Math.max(0, (jailor.doom || 0) - 1)
            api.info?.('移除了秘社狱卒上的 1 个毁灭。')
          }
        }, 0, { label: '谈判', code: LODGE_JAILOR })
        return true
      }
      case 'parleyKnightOuter': {
        const knight = state.enemies.find(enemy => original(enemy) === KNIGHT_OUTER_VOID && enemy.location === inv.location)
        if (!knight) return true
        // 卡面「使用[[意志]]或[[智力]]进行谈判」：玩家选 1 个技能（不是多技能合计）。
        const skillAnswer = typeof api?.choose === 'function' ? api.choose({
          kind: 'skill', source: KNIGHT_OUTER_VOID, seat: inv.seat,
          prompt: '边缘虚空骑士：选择谈判技能（意志或智力）。',
          options: [{ id: 'willpower', label: '意志' }, { id: 'intellect', label: '智力' }],
        }) : 'willpower'
        const parleySkill = skillAnswer === 'intellect' ? 'intellect' : 'willpower'
        // 05097 秘社玄仪：谈判难度 +2。
        api?.test?.(inv.seat, parleySkill, 4 + parleyDifficultyBonus(state, knight), result => {
          if (result?.success) {
            if ((knight.doom || 0) > 0) {
              // 「控制其 1 个毁灭并翻至线索面」：走引擎第七轮标记翻面原语；参考实现为
              // removeDoom + placeClues(iid)（KnightOfTheOuterVoid.hs:38-41），翻出的线索由谈判者控制。
              let flipped = 0
              if (typeof api?.flipMarker === 'function') {
                flipped = api.flipMarker(knight, { from: 'doom', to: 'clue', amount: 1 }) || 0
              } else {
                knight.doom -= 1
                flipped = 1
              }
              if (flipped) {
                if ((knight.clues || 0) > 0) knight.clues -= 1
                if (typeof api?.gainClues === 'function') api.gainClues(inv.seat, 1)
                else if (state.investigators[inv.seat]) state.investigators[inv.seat].clues += 1
                api.info?.('控制边缘虚空骑士的 1 个毁灭并翻成线索。')
              }
            }
          } else {
            api.attack?.(knight, inv)
            api.info?.('谈判失败：边缘虚空骑士攻击了你。')
          }
        }, 0, { label: '谈判', code: KNIGHT_OUTER_VOID })
        return true
      }
      case 'parleyAugust': {
        const august = byCode(state, AUGUST_LINDQUIST)
        if (!august || august.location !== location?.id) return true
        const needed = 2 * (state.numInvestigators || 1)
        if (cluesAt(state, location.id) < needed) {
          api?.info?.('线索不足，无法与奥古斯特谈判。')
          return true
        }
        // 卡面「每位实际花费线索的调查员」：付费前后比对，只询问线索减少者（参考 AugustLindquist.hs:25-29 totalCluePaymentPerInvestigator）。
        const before = new Map(activeInvestigators(state)
          .filter(entry => entry.location === location.id)
          .map(entry => [entry.seat, entry.clues || 0]))
        api?.payClues?.(needed, location.id)
        const payers = activeInvestigators(state).filter(entry => entry.location === location.id
          && (entry.clues || 0) < (before.get(entry.seat) ?? 0))
        for (const payer of payers) {
          const choice = typeof api?.choose === 'function' ? api.choose({
            kind: 'harm', source: AUGUST_LINDQUIST, seat: payer.seat,
            prompt: '奥古斯特：受到 1 点伤害或 1 点恐惧。',
            options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
          }) : 'damage'
          if (choice === 'horror') api?.horror?.(payer.seat, 1)
          else api?.damage?.(payer.seat, 1)
        }
        // 卡面「控制奥古斯特身上的钥匙」：只交还奥古斯特支援上的钥匙，不动地点上的钥匙。
        const keys = keysOnAsset(state, august)
        for (const key of keys) giveKey(state, key, inv.seat)
        state.storyAssets = (state.storyAssets || []).filter(asset => original(asset) !== AUGUST_LINDQUIST)
        setFlags(state, { augustRemoved: true })
        api?.info?.('奥古斯特被移出游戏，其钥匙由你们控制。')
        return true
      }
      default:
        break
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return true
    throw new Error(`未知崇高利益行动：${move.rule}`)
  },

  // -------------------------------------------------------------------------
  // 幕 / 议程
  // -------------------------------------------------------------------------
  actReveal(state, act, api) {
    const code = String(original(act))
    if (code === ACT_INFILTRATING) {
      if (!locByCode(state, INNER_SANCTUM)) api?.place?.(LOCATIONS.innerSanctum)
      spawnNathan(state, api, NATHAN_WICK_INDOCTRINATION, locById(state, LOCATIONS.innerSanctum)?.id)
      // 卡面「直到游戏结束，当前幕获得转化反应」：用跨幕 flag 承载（离开本幕后仍持续）。
      setFlags(state, { infiltrationReactionActive: true })
      // 卡面「将本卡放到幕牌库旁作为提醒」：引擎第七轮提醒实体（state.actReminders，纯提醒载体）。
      if (typeof api?.addActReminder === 'function') api.addActReminder('05201', state.actIndex)
      api?.info?.('圣堂内室入场：南森·威克（教化大师）带着机关盒出现。')
      return
    }
    if (code === ACT_WARM_WELCOME) {
      if (!locByCode(state, LIBRARY)) api?.place?.(LOCATIONS.library)
      spawnNathan(state, api, NATHAN_WICK_INITIATION, locById(state, LOCATIONS.library)?.id)
      api?.info?.('藏书室入场：南森·威克（引导大师）带着机关盒出现。')
      return
    }
    if (code === ACT_OBTAINING_DEVICE) {
      api?.info?.('你从南森手里取得了仪器。')
      return
    }
    if (code === ACT_FOUR_KEYS) {
      api?.finish?.(isMembersOfTheLodge(state) ? 'r1' : 'r2')
      api?.info?.('四把钥匙齐备：机关盒的秘密被打开。')
    }
  },

  // 05199 正面「位于圣堂地点的银暮秘社敌人失去冷漠」：引擎在「新密谋正面入场」时必调 agendaChain
  // （src/engine/act-agenda.js:206-216），借此在议程翻到 05199 的当刻即时同步；返回 false = 不连锁推进。
  agendaChain(state, agenda) {
    if (String(original(agenda)) === AGENDA_ENDS_AND_MEANS) syncSanctumCultistAloof(state)
    return false
  },

  agendaReveal(state, agenda, api) {
    const code = String(original(agenda))
    if (code === AGENDA_HIEROPHANT) {
      discardAndDrawCultists(state, api)
      return
    }
    if (code === AGENDA_ENDS_AND_MEANS) {
      state.acts = []
      setFlags(state, { actsDiscarded: true })
      const box = describePuzzleBox(state)
      const sanctums = SANCTUM_LOCATION_IDS.map(id => locById(state, id)).filter(Boolean)
      // 卡面：生成在「机关盒所在地点」。机关盒可能由调查员控制（含在敌人身上/已移出游戏）。
      const boxLocationId = box?.holder === 'seat'
        ? state.investigators[box.seat]?.location || null
        : box?.holder === 'enemy'
          ? ((state.enemies || []).find(enemy => enemy.id === box.enemyId)?.location
            || puzzleBoxAsset(state)?.location || null)
          : null
      // 机关盒不在场时生成在任意一个圣堂地点（有多个时由玩家选；没有圣堂地点时 API 会如实失败）。
      let spawnId = boxLocationId || (sanctums.length === 1 ? sanctums[0].id : null)
      if (!spawnId && sanctums.length > 1 && typeof api?.choose === 'function') {
        const answer = api.choose({
          kind: 'location', source: AGENDA_ENDS_AND_MEANS, seat: state.campaign?.leadSeat ?? 0,
          prompt: '选择「响应召唤的怪兽」的生成地点（任意一个[[圣堂]]地点）。',
          options: sanctums.map(location => ({ id: location.id, label: location.name || location.id })),
        })
        spawnId = sanctums.some(location => location.id === answer) ? answer : sanctums[0].id
      }
      takeFromSetAside(state, SUMMONED_BEAST)
      api?.spawn?.(SUMMONED_BEAST, spawnId)
      detachPuzzleBoxAttachment(state, api)
      state.storyAssets = (state.storyAssets || []).filter(asset => original(asset) !== PUZZLE_BOX)
      setFlags(state, { puzzleBox: { holder: 'removed', removed: true, seat: null, enemyId: null } })
      api?.info?.('目的与手段背面：全部幕牌被弃，陷阱守卫者现身，机关盒被移出游戏。')
    }
  },

  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const code = String(original(act))
    if (code === ACT_OBTAINING_DEVICE) {
      const defeated = (state.victoryDisplay || []).some(card =>
        String(card.code) === '05217' || String(card.code) === '05217b')
        || state.scenarioFlags?.nathanDefeated === true
      if (!defeated) return
      if (puzzleBoxHolder(state) == null) {
        const seat = chooseInvestigator(state, api, '选择一位调查员：取得机关盒。')
        if (seat != null) givePuzzleBoxTo(state, api, seat)
      }
      api?.advanceAct?.()
      return
    }
    if (code === ACT_FOUR_KEYS && fourKeysReady(state)) api?.advanceAct?.()
  },

  // 05228 机关盒的强制：控制者被击败时把控制权交给另一位调查员。
  // 引擎的击杀钩子只派发给当前章节（src/engine/harm-threat.js:236），所以本实现只覆盖《崇高利益》；
  // 机关盒随牌组进入其它章节时需要各章自己的 investigatorEliminated 钩子（见 primitive request）。
  investigatorEliminated(state, inv, clues, api) {
    const box = describePuzzleBox(state)
    if (!box || box.holder !== 'seat' || box.seat !== inv?.seat) return false
    const owned = (inv.assets || []).find(item => original(item) === PUZZLE_BOX)
    if (owned) inv.assets.splice(inv.assets.indexOf(owned), 1)
    const others = activeInvestigators(state).filter(other => other.seat !== inv.seat)
    if (!others.length) {
      setFlags(state, { puzzleBox: { holder: 'removed', removed: true, seat: null, enemyId: null } })
      api?.info?.('机关盒没有可接手的调查员，被移出游戏。')
      return false
    }
    const seat = others.length === 1 ? others[0].seat
      : chooseInvestigator(state, api, '选择一位调查员：接手「机关盒」。', others)
    if (seat != null) givePuzzleBoxTo(state, api, seat)
    return false
  },

  // -------------------------------------------------------------------------
  // 敌人
  // -------------------------------------------------------------------------
  // 05204/05205 正面：「敌人不能生成在秘社大门」。引擎在 spawnEnemy 提交前统一咨询
  // （src/engine/enemies.js:280-287，含 api.spawn 的 ignoreSpawn 路径）；被禁止即生成失败。
  // 05221「猎物 - 控制最多钥匙」：card-ops.preyTarget（座位号）与 turn.js hunterStep（调查员对象）都读该钩子。
  preyRank(state, enemy, candidates) {
    if (String(original(enemy)) !== KNIGHT_INNER_CIRCLE) return null
    const scores = candidates.map(c => keyCountOf(state, c && typeof c === 'object' ? c.seat : c))
    const max = Math.max(...scores)
    return candidates.filter((_, index) => scores[index] === max)
  },

  spawnForbiddenAt(state, code, locationId) {
    if (!locationId) return false
    return [LOCATIONS.lodgeGatesMembers, LOCATIONS.lodgeGatesWeve].includes(locationId)
  },

  // 05204/05205 正面：「敌人不能生成在秘社大门」——引擎在 spawnEnemy 提交前统一咨询
  // behavior.spawnForbiddenAt（src/engine/enemies.js:280-287）：显式生成点落在大门时按参考
  // 实现 noSpawn 语义「生成失败」（牌进遭遇弃牌堆）。本函数因此不再把大门替换成别的地点。
  // 「生成 - 任意一个……」类改点只从「可生成」的候选里选（参考 CannotSpawnIn 从 matcher 排除）。
  spawnLocation(state, code, fallbackLocation, engagedSeat, api) {
    const gatesIds = [LOCATIONS.lodgeGatesMembers, LOCATIONS.lodgeGatesWeve]
    const fallback = fallbackLocation || activeInvestigators(state)[0]?.location || null
    // 「生成 - 任意一个……」类生成点：有多个合法地点时由玩家选择（参考多地点 spawnAt 的选择窗口）。
    const chooseLocation = (candidates, prompt) => {
      const unique = [...new Set(candidates.filter(Boolean))]
      if (!unique.length) return null
      if (unique.length === 1 || typeof api?.choose !== 'function') return unique[0]
      const answer = api.choose({
        kind: 'location', source: code, seat: state.campaign?.leadSeat ?? 0, prompt,
        options: unique.map(id => ({ id, label: locById(state, id)?.name || id })),
      })
      return unique.includes(answer) ? answer : unique[0]
    }
    if (code === KNIGHT_INNER_CIRCLE || code === KNIGHT_OUTER_VOID) {
      // 「生成 - 任意一个与你所在地点连接的地点」：候选里排除大门（参考 applyMatcherExclusions）。
      const originLoc = locById(state, fallback)
      const connected = (originLoc?.connections || [])
        .filter(id => locById(state, id) && !gatesIds.includes(id))
      return chooseLocation(connected, '选择生成地点（与抽牌者地点连接）') || fallback
    }
    if (code === LODGE_JAILOR || code === CELL_KEEPER) {
      const sanctums = SANCTUM_LOCATION_IDS.map(id => locById(state, id)).filter(Boolean)
      return chooseLocation(sanctums.map(location => location.id), '选择一个生成地点（圣堂）') || fallback
    }
    // 未特判的卡：返回引擎传入的生成点；若落在大门由 spawnForbiddenAt 按生成失败处理。
    return fallback
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    syncSanctumCultistAloof(state)
    const code = String(original(enemy))
    if (code === LODGE_JAILOR || code === CELL_KEEPER) {
      enemy.doom = (enemy.doom || 0) + 2
      const key = placeRandomKeyOn(state, api, { enemy })
      api?.info?.(`${enemy.name} 入场：放置 2 个毁灭${key ? `与${key.label}` : ''}。`)
      return
    }
    if (code === KNIGHT_OUTER_VOID) {
      // 卡面是「显现：队长选择放 1 或 2 个毁灭」：只在由遭遇牌显现时结算，
      // 被其它效果生成时不放毁灭（encounter-rules.encounterDrawn 记录最近抽到的卡）。
      const drawn = flagsFor(state).lastEncounterDrawn
      if (!drawn || drawn.code !== KNIGHT_OUTER_VOID || drawn.round !== state.round) return
      const answer = typeof api?.choose === 'function' ? api.choose({
        kind: 'revelation', source: KNIGHT_OUTER_VOID, seat: state.campaign?.leadSeat ?? 0,
        prompt: '边缘虚空骑士显现：在它身上放 1 个还是 2 个毁灭？',
        options: [{ id: '1', label: '1 个毁灭' }, { id: '2', label: '2 个毁灭' }],
      }) : '1'
      enemy.doom = (enemy.doom || 0) + (Number(answer) === 2 ? 2 : 1)
      return
    }
    if (code === NATHAN_WICK_INITIATION || code === NATHAN_WICK_INDOCTRINATION) {
      enemy.resources = enemy.resources || 0
      attachPuzzleBox(state, api, enemy)
      setFlags(state, { nathanVariant: code })
    }
  },

  enemyDefeated(state, enemy, api) {
    const code = String(original(enemy))
    if (code === NATHAN_WICK_INITIATION || code === NATHAN_WICK_INDOCTRINATION) {
      // 南森离场：摘下机关盒的真实附属（它随宿主一起消失），等幕目标分配给调查员。
      detachPuzzleBoxAttachment(state, api)
      setFlags(state, {
        nathanDefeated: true,
        puzzleBox: { holder: 'ground', enemyId: null, seat: null },
      })
      keysLeavingEnemy(state, enemy, null, enemy.location || null, api)
    }
    if (code === SUMMONED_BEAST) {
      setFlags(state, { guardianDefeated: true })
      // 引擎先派 enemyDefeated 钩子、后 addVictory；而 api.finish 会抛 ScenarioEnded，
      // 导致陷阱守卫者的胜利点永不入账。卡面要求「被击败→结局 3」，参考 SummonedBeast.hs:44-47
      // 先 addToVictory 再 push R3；这里在结束前手动补胜利区（幂等）。
      state.victoryDisplay ||= []
      const victory = Number(ALL_CARDS[SUMMONED_BEAST]?.victory) || 2
      if (!state.victoryDisplay.some(card => card.id === enemy.id)) {
        state.victoryDisplay.push({
          id: enemy.id, code: SUMMONED_BEAST, originalCode: SUMMONED_BEAST, victory,
        })
      }
      api?.finish?.('r3')
    }
    // 卡面「当你击败一个银暮秘社敌人时」：只有由调查员造成的击败才触发；
    // 引擎在击败前把击败者写在 enemy.defeatedBy（src/engine/combat.js:359/505/547、api-clue.js:128），
    // 剧本/其它来源造成的离场不记击败者，不应触发本强制。
    if (hasTrait(enemy, 'Silver Twilight') && enemy.defeatedBy != null) moveDoomToAgendaAt(state, enemy.location, api)
    return encounterRules.enemyDefeated?.(state, enemy, api) || false
  },

  enemyDiscarded(state, enemy, api) {
    // 卡面只写「击败」：被弃置/移出游戏不触发「将 1 点毁灭移到当前密谋」。
    keysLeavingEnemy(state, enemy, null, enemy.location || null, api)
    return encounterRules.enemyDiscarded?.(state, enemy, api) || false
  },

  // 渗透秘社正面反应：躲避敌人后移除其所有毁灭（近似：自动结算）。
  afterEvade(state, inv, enemy, result, api) {
    encounterRules.afterEvade?.(state, inv, enemy, result, api)
    // 渗透秘社（05201）：直到游戏结束的转化反应——躲避成功后可选移除该敌人所有毁灭。
    if (flagsFor(state).infiltrationReactionActive && enemy && result?.success) {
      const answer = typeof api?.choose === 'function' ? api.choose({
        kind: 'reaction', source: ACT_INFILTRATING, seat: inv?.seat ?? 0, canSkip: true,
        prompt: `渗透秘社：是否移除「${enemy.name}」的所有毁灭？`,
        options: [{ id: 'yes', label: '移除所有毁灭' }, { id: 'no', label: '不发动' }],
      }) : 'yes'
      if (answer !== 'no') {
        enemy.doom = 0
        api?.info?.(`渗透秘社：移除了「${enemy.name}」的所有毁灭。`)
      }
    }
    if (String(original(enemy)) === NATHAN_WICK_INDOCTRINATION && result?.success) {
      const successBy = (result.value ?? 0) - (result.difficulty ?? 0)
      if (successBy >= 3) {
        // 卡面「你偷了机关盒」：躲避成功超过难度≥3 当刻就把机关盒从南森身上转交给躲避者
        // （旧实现只转交钥匙，把机关盒留给幕 05202 的目标再分配；参考 Haskell 该分支只给钥匙，
        // 本轮按卡面文本修正，差异见 artifacts/tcu-fix2/plans/reaudit-h.json 的 05217b）。
        giveKeysToEnemyController(state, enemy, inv.seat)
        givePuzzleBoxTo(state, api, inv.seat)
        setFlags(state, { nathanDefeated: true })
        api?.banish?.(enemy)
        api?.info?.('你偷走了机关盒，南森·威克被加入胜利区。')
      }
    }
    if (String(original(enemy)) === CELL_KEEPER && result?.success) {
      // 卡面「成功超过难度 2 点或更多」（参考 CellKeeper.hs:27-30 atLeast 2）。
      const successBy = (result.value ?? 0) - (result.difficulty ?? 0)
      if (successBy >= 2) {
        const keys = keysOnEnemy(state, enemy)
        for (const key of keys) giveKey(state, key, inv.seat)
        if (keys.length) api?.info?.(`${inv.name} 控制了牢房看门人的钥匙。`)
      }
    }
  },

  enemyStatModifier(state, enemy, stat) {
    let delta = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    if (String(original(enemy)) === SUMMONED_BEAST && (stat === 'fight' || stat === 'evade')) {
      delta += Math.floor(gameDoom(state) / 2)
    }
    return delta
  },

  enemyAttackModifier(state, enemy) {
    if (String(original(enemy)) !== SUMMONED_BEAST) return null
    const bonus = Math.floor(gameDoom(state) / 2)
    return bonus ? { damage: bonus, horror: bonus } : null
  },

  // 敌军阶段开始：陷阱守卫者击败同地点每个类人敌人并吸收其毁灭。
  enemyPhaseStart(state, api) {
    encounterRules.enemyPhaseStart?.(state, api)
    // 02021 敌军阶段前后敌人才会移动：这里再同步一次「圣堂地点银暮秘社敌人失去冷漠」。
    syncSanctumCultistAloof(state)
    const beast = state.enemies.find(enemy => String(original(enemy)) === SUMMONED_BEAST)
    if (!beast) return
    const humans = state.enemies.filter(enemy => enemy.id !== beast.id
      && enemy.location === beast.location && hasTrait(enemy, 'Humanoid'))
    if (!humans.length) return
    let doom = 0
    for (const human of humans) {
      doom += Number(human.doom) || 0
      human.doom = 0
      // 05220：「击败」而不是直接移出战场——走引擎击败结算（胜利区/离场触发/钥匙归属等）。
      human.damageTaken = Math.max(Number(human.damageTaken) || 0, Number(human.health) || 0)
      if (typeof api?.checkEnemyDefeat === 'function') api.checkEnemyDefeat(human, null, null)
      else state.enemies.splice(state.enemies.indexOf(human), 1)
    }
    beast.doom = (beast.doom || 0) + doom
    api?.info?.(`陷阱守卫者吞噬了「${beast.location}」的 ${humans.length} 个类人敌人，吸收 ${doom} 点毁灭。`)
  },

  // -------------------------------------------------------------------------
  // 混乱标记 / 检定
  // -------------------------------------------------------------------------
  resolveChaosToken(state, inv, token, api) {
    return fggChaosToken(state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    if (!result) return
    const hard = ['hard', 'expert'].includes(state.difficulty)
    const drawn = (result.drawn || []).filter(token => !(result.cancelledTokens || []).includes(token))
    const failed = !result.success
    if (drawn.includes('tablet') && failed) {
      const cultists = cultistEnemies(state)
      if (!cultists.length) {
        // 困难/专家：场上没有异教徒敌人时改为「再揭示一个标记」（05197 卡面）。
        if (hard) api?.revealToken?.(inv.seat)
        return
      }
      if (hard) {
        for (const target of cultists) target.doom = (target.doom || 0) + 1
        api?.info?.('石板失败：每个异教徒敌人各 +1 毁灭。')
      } else {
        const nearest = nearestCultist(state, inv)
        if (nearest) {
          nearest.doom = (nearest.doom || 0) + 1
          api?.info?.(`石板失败：最近的异教徒敌人「${nearest.name}」+1 毁灭。`)
        }
      }
    }
    if (drawn.includes('elderthing') && failed) {
      const withDoom = cultistEnemies(state).filter(enemy => (enemy.doom || 0) > 0)
      if (!withDoom.length) {
        // 困难/专家：场上没有带毁灭的异教徒敌人时改为「再揭示一个标记」（05197 卡面）。
        if (hard) api?.revealToken?.(inv.seat)
        return
      }
      if (hard) {
        const max = Math.max(...withDoom.map(enemy => enemy.doom || 0))
        const target = withDoom.find(enemy => (enemy.doom || 0) === max)
        target.doom -= max
        api?.addDoom?.(max)
        api?.info?.(`古神失败：把「${target.name}」的 ${max} 点毁灭全部移到当前议程。`)
      } else {
        // 卡面是「最近的异教徒敌人」：即使它没有毁灭也不改选更远的目标（无可移动则不动）。
        const nearest = nearestCultist(state, inv)
        if (!nearest || (nearest.doom || 0) <= 0) return
        nearest.doom -= 1
        api?.addDoom?.(1)
        api?.info?.(`古神失败：从「${nearest.name}」移 1 点毁灭到当前议程。`)
      }
    }
  },

  // -------------------------------------------------------------------------
  // 诡计（本章 4 张；共享组诡计回落到 W-shared 的单卡条目）
  // -------------------------------------------------------------------------
  resolveEncounter(state, inv, treachery, api) {
    const code = String(original(treachery))
    // 逐卡分派：单卡条目用 flags.fggTreachery 声明身份（不写卡号字面量分支）。
    const handler = entryFlags(code)?.fggTreachery
    if (handler === 'callToOrder') return callToOrder(state, inv, api)
    if (handler === 'expulsion') return expulsion(state, inv, api)
    if (handler === 'beneathTheLodge') return beneathTheLodge(state, inv, api)
    if (handler === 'markOfTheOrder') return markOfTheOrder(state, inv, api)
    const entryResolve = encounterResolveFor(code)
    if (entryResolve) return entryResolve(state, inv, treachery, api, { location: here(state, inv) })
    api?.info?.(`（共享遭遇「${ALL_CARDS[code]?.nameZh || code}」由战役共享条目结算。）`)
    return false
  },

  // -------------------------------------------------------------------------
  // 结局
  // -------------------------------------------------------------------------
  resolution(state, key, events, api) {
    const known = ['noResolution', 'r1', 'r2', 'r3']
    if (!known.includes(key)) throw new Error(`未知崇高利益结局：${key}`)
    const records = recordsFor(state)
    const box = describePuzzleBox(state)
    // 结局清场：机关盒若仍附属在敌人身上，先摘下真实附属，再移除剧情区条目。
    detachPuzzleBoxAttachment(state, api)
    state.storyAssets = (state.storyAssets || []).filter(asset => original(asset) !== PUZZLE_BOX)
    if (key === 'noResolution') {
      records.theGuardianOfTheTrapEmerged = true
      return { award: true, bonus: 0 }
    }
    if (key === 'r3') {
      records.theGuardianOfTheTrapEmergedAndWasDefeated = true
      return { award: true, bonus: 0 }
    }
    records.theInvestigatorsDiscoveredHowToOpenThePuzzleBox = true
    const preferred = box?.holder === 'seat' ? box.seat : null
    const candidates = activeInvestigators(state).filter(inv => state.campaign?.investigators?.[inv.seat])
    const pool = candidates.length ? candidates : activeInvestigators(state)
    let seat = preferred != null && state.campaign?.investigators?.[preferred] ? preferred : null
    if (seat == null && pool.length) seat = chooseInvestigator(state, api, '选择一位调查员：把「机关盒」加入其牌库。', pool)
    if (seat != null && state.campaign?.investigators?.[seat]) {
      const already = (state.campaign.investigators[seat].deck || []).includes(PUZZLE_BOX)
      if (!already) campaignCardChange(state.campaign, seat, PUZZLE_BOX, 'add', state.scenario.id)
      api?.info?.(`机关盒加入调查员 ${seat + 1} 的牌库（不计入 30 张）。`)
    }
    return { award: true, bonus: 0 }
  },
}

// ---------------------------------------------------------------------------
// 内部函数
// ---------------------------------------------------------------------------
// 最短路径的下一跳（BFS；不可达返回 null）。
function nextStepToward(state, from, to) {
  if (!from || !to || from === to) return null
  const seen = new Set([from])
  const queue = [[from, null]]
  while (queue.length) {
    const [id, first] = queue.shift()
    for (const next of locById(state, id)?.connections || []) {
      if (!locById(state, next) || seen.has(next)) continue
      const step = first || next
      if (next === to) return step
      seen.add(next)
      queue.push([next, step])
    }
  }
  return null
}

function nearestCultist(state, inv, predicate = () => true) {
  const cultists = cultistEnemies(state).filter(predicate)
  if (!cultists.length) return null
  const from = inv?.location || state.investigators?.[0]?.location
  const distance = enemy => {
    if (!from || !enemy.location) return Number.POSITIVE_INFINITY
    if (from === enemy.location) return 0
    const seen = new Set([from])
    const queue = [[from, 0]]
    while (queue.length) {
      const [id, steps] = queue.shift()
      for (const next of locById(state, id)?.connections || []) {
        if (next === enemy.location) return steps + 1
        if (seen.has(next)) continue
        seen.add(next)
        queue.push([next, steps + 1])
      }
    }
    return Number.POSITIVE_INFINITY
  }
  return [...cultists].sort((left, right) => distance(left) - distance(right))[0] || null
}

function moveDoomToAgendaAt(state, locationId, api) {
  const targets = (state.enemies || []).filter(enemy => enemy.location === locationId && (Number(enemy.doom) || 0) > 0)
  if (!targets.length) return 0
  let moved = 0
  for (const enemy of targets) {
    enemy.doom = (enemy.doom || 0) - 1
    moved += 1
  }
  if (moved) {
    api?.addDoom?.(moved)
    api?.info?.(`击败银暮秘社敌人：${moved} 点毁灭从该地点的敌人移到当前议程。`)
  }
  return moved
}

function spawnNathan(state, api, code, locationId) {
  takeFromSetAside(state, code)
  const spawned = typeof api?.spawn === 'function' ? api.spawn(code, locationId) : null
  if (spawned) attachPuzzleBox(state, api, spawned)
  return spawned
}

function discardAndDrawCultists(state, api) {
  state.encounterDeck ||= []
  state.encounterDiscard ||= []
  // 弃顶 5 张：走共享 discardEncounterTop，牌库由有到无时在同一结算里通知 05091/05098。
  // 不洗回弃牌堆（「弃顶 5 张」不应把刚弃掉的牌洗回来）。
  const discarded = discardEncounterTop(state, api, 5, { reshuffle: false, notifyEmpty: true })
  const cultists = discarded.filter(code => {
    const card = ALL_CARDS[code]
    return card?.type === 'enemy' && hasTrait(card, 'Cultist')
  })
  // 被抽出来生成的异教徒敌人不应同时留在遭遇弃牌堆里。
  for (const code of cultists) {
    const index = state.encounterDiscard.indexOf(code)
    if (index >= 0) state.encounterDiscard.splice(index, 1)
  }
  if (!cultists.length) {
    api?.info?.('教皇·V 背面：弃掉的 5 张里没有异教徒敌人。')
    return
  }
  const remaining = [...cultists]
  // 卡背「每名调查员按玩家顺序」：从队长起环绕（参考 TheHierophantV.hs:43-52 getInvestigators）。
  for (const inv of playerOrder(state).map(seat => state.investigators[seat])
    .filter(entry => entry && !entry.defeated && !entry.resigned)) {
    if (!remaining.length) break
    let choice = 0
    if (typeof api?.choose === 'function' && remaining.length > 1) {
      const answer = api.choose({
        kind: 'encounter', source: AGENDA_HIEROPHANT, seat: inv.seat,
        prompt: '选择 1 张被弃的异教徒敌人抽取。',
        options: remaining.map((code, index) => ({ id: String(index), label: ALL_CARDS[code]?.nameZh || code })),
      })
      choice = Math.max(0, Math.min(remaining.length - 1, Number(answer) || 0))
    }
    const code = remaining.splice(choice, 1)[0]
    // 卡面「抽取 1 张以此方式弃掉的异教徒敌人」：走常规生成路径（ignoreSpawn=false），让印刷生成规则/本章
    // spawnLocation 生效（05218/05219 的「生成 - 任意圣堂地点」）；spawnEngaged 只在同地点时自动交战。
    const spawned = typeof api?.spawnEngaged === 'function' ? api.spawnEngaged(code, inv.location, inv.seat)
      : (typeof api?.spawn === 'function' ? api.spawn(code, inv.location) : null)
    if (spawned) {
      api?.info?.(`${inv.name} 从弃牌中抽出了「${ALL_CARDS[code]?.nameZh || code}」并生成。`)
    } else {
      // 生成失败时引擎 spawnEnemy 已经把牌放进 encounterDiscard（src/engine/enemies.js:285-295），
      // 这里不能再 push，否则同一张牌会出现两个副本。
      api?.info?.(`${inv.name} 未能抽出「${ALL_CARDS[code]?.nameZh || code}」。`)
    }
  }
  state.encounterDiscard.push(...remaining)
}

function enemyEngage(state, inv, enemy) {
  enemy.engagedSeat = inv.seat
  enemy.exhausted = false
  inv.engaged ||= []
  if (!inv.engaged.includes(enemy.id)) inv.engaged.push(enemy.id)
  return true
}

// 05221：「在你进入核心圈骑士所在地点（或骑士进入你所在地点）后：检定 agility(4)；
// 失败则核心圈骑士与你交战。」两处入口共用本函数。
function forceKnightTest(state, inv, knight, api) {
  api?.test?.(inv.seat, 'agility', 4, result => {
    if (result?.success) {
      api.info?.(`${inv.name} 避开了核心圈骑士。`)
      return
    }
    enemyEngage(state, inv, knight)
    api.info?.(`${inv.name} 检定失败：核心圈骑士与你交战。`)
  }, 0, { label: '核心圈骑士', code: KNIGHT_INNER_CIRCLE })
}

// 圣堂门廊（拘禁室）揭示：从遭遇牌库/弃牌堆找异教徒敌人生成。
function findCultistAndSpawn(state, location, api) {
  const pool = [
    ...(state.encounterDeck || []).map((code, index) => ({ code, index, zone: 'deck' })),
    ...(state.encounterDiscard || []).map((code, index) => ({ code, index, zone: 'discard' })),
  ].filter(entry => hasTrait(ALL_CARDS[entry.code] || { code: entry.code }, 'Cultist'))
  if (!pool.length) {
    api?.info?.('拘禁室：牌库与弃牌堆中都没有异教徒敌人。')
    return null
  }
  // 卡面是「搜索」：在候选里选 1 张（参考 SanctumDoorwayHoldingCells.hs:23-28 findEncounterCard）。
  let found = pool[0]
  if (typeof api?.choose === 'function' && pool.length > 1) {
    const owner = activeInvestigators(state)[0]
    const answer = api.choose({
      kind: 'search', source: '05215', seat: owner?.seat ?? 0,
      prompt: '拘禁室：从遭遇牌库/弃牌堆中选择 1 张异教徒敌人。',
      options: pool.map((entry, index) => ({
        id: String(index),
        label: `${ALL_CARDS[entry.code]?.nameZh || entry.code}（${entry.zone === 'deck' ? '牌库' : '弃牌堆'}）`,
      })),
    })
    found = pool[Math.max(0, Math.min(pool.length - 1, Number(answer) || 0))]
  }
  // 从遭遇牌库移除 1 张：若这是最后一张，补共享的「遭遇牌库耗尽」强制（05091/05098）。
  const watchDeckEmpty = watchEncounterDeckEmpty(state)
  if (found.zone === 'deck') state.encounterDeck.splice(found.index, 1)
  else state.encounterDiscard.splice(found.index, 1)
  watchDeckEmpty(api)
  const spawned = api?.spawn?.(found.code, location.id) || null
  api?.info?.(`拘禁室：生成了「${ALL_CARDS[found.code]?.nameZh || found.code}」并洗混遭遇牌库。`)
  if (typeof api?.shuffleEncounterDeck === 'function') api.shuffleEncounterDeck()
  else if (state.encounterDeck && typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
  return spawned
}

// ---- 05223 发号施令 ---------------------------------------------------------
function callToOrder(state, inv, api) {
  const discard = state.encounterDiscard || []
  const picked = []
  for (let index = discard.length - 1; index >= 0 && picked.length < 2; index--) {
    const code = discard[index]
    const card = ALL_CARDS[code]
    if (card?.type === 'enemy' && hasTrait(card, 'Cultist')) {
      picked.push(code)
      discard.splice(index, 1)
    }
  }
  if (!picked.length) {
    api?.info?.('发号施令：没有被弃的异教徒敌人，获得涌动。')
    if (typeof api?.drawEncounter === 'function') api.drawEncounter(inv.seat)
    return false
  }
  // 卡面「没有调查员或敌人的地点」（EmptyLocation 口径）。
  const empty = (state.locations || []).filter(location =>
    !activeInvestigators(state).some(entry => entry.location === location.id)
    && !(state.enemies || []).some(enemy => enemy.location === location.id))
  const pool = empty.length ? empty : state.locations
  const target = [...pool].sort((left, right) => (right.clues || 0) - (left.clues || 0))[0]
  if (!target) return false
  for (const code of picked) api?.spawn?.(code, target.id)
  api?.info?.(`发号施令：${picked.length} 个异教徒敌人生成在「${target.name}」。`)
  return false
}

// ---- 05224 除籍 -------------------------------------------------------------
function expulsion(state, inv, api) {
  const cultist = nearestCultist(state, inv)
  if (!cultist) {
    api?.info?.('除籍：场上没有异教徒敌人，获得涌动。')
    if (typeof api?.drawEncounter === 'function') api.drawEncounter(inv.seat)
    return false
  }
  cultist.exhausted = false
  const destination = state.investigators[inv.seat]?.location
  if (destination && cultist.location !== destination) {
    // 卡面「朝你移动，直到与你同地点」：每步移动 1 个地点、沿最短路径（参考 Expulsion.hs:30-32 moveUntil）。
    // 移动走引擎 relocateEnemy（api.moveEnemy），确保派发 enemyMoved（05221 骑士进入/05199 圣堂 aloof 同步）。
    for (let guard = 0; guard < 30 && cultist.location !== destination; guard++) {
      const next = nextStepToward(state, cultist.location, destination)
      if (!next || next === cultist.location) break
      const previous = cultist.location
      if (typeof api?.moveEnemy === 'function') {
        api.moveEnemy(cultist, next)
        if (cultist.location === previous) break // 引擎拒绝移动（如「不能移动」）时停止，避免死循环。
      } else {
        cultist.location = next
        syncSanctumCultistAloof(state)
        encounterRules.enemyMoved?.(state, cultist, previous, api)
      }
    }
  }
  if (cultist.location === destination) {
    enemyEngage(state, inv, cultist)
    api?.attack?.(cultist, inv)
    const keys = keysHeldBy(state, inv.seat)
    for (const key of keys) placeKeyOnEnemy(state, key, cultist)
    if (keys.length) api?.info?.(`除籍：你控制的 ${keys.length} 把钥匙被放到该敌人身上。`)
  }
  api?.info?.(`除籍：「${cultist.name}」移动到你的地点、与你交战并攻击。`)
  return false
}

// ---- 05225 秘社地底 ---------------------------------------------------------
function beneathTheLodge(state, inv, api) {
  const keys = keysHeldBy(state, inv.seat).length
  const difficulty = 3 + (keys ? 1 : 0)
  api?.test?.(inv.seat, 'intellect', difficulty, result => {
    if (result?.success) {
      api.info?.('你通过了秘社地底的检定。')
      return
    }
    const failedBy = Math.max(0, difficulty - (result?.value ?? 0))
    // 卡面「每低于难度 1 点：失去 1 个线索或受到 1 点恐惧」——逐点让玩家二选一
    // （无线索时只能受恐惧；参考 BeneathTheLodge.hs:38-50 HandlePointOfFailure）。
    for (let index = 0; index < failedBy; index++) {
      if ((inv.clues || 0) > 0) {
        const choice = typeof api.choose === 'function' ? api.choose({
          kind: 'harm', source: '05225', seat: inv.seat,
          prompt: '秘社地底：失去 1 个线索或受到 1 点恐惧。',
          options: [{ id: 'clue', label: '失去 1 个线索' }, { id: 'horror', label: '受到 1 点恐惧' }],
        }) : 'clue'
        if (choice === 'horror') {
          api.horror?.(inv.seat, 1)
          api.info?.('秘社地底：受到 1 点恐惧。')
        } else {
          api.spendClues?.(inv.seat, 1)
          api.info?.('秘社地底：失去 1 个线索。')
        }
      } else {
        api.horror?.(inv.seat, 1)
        api.info?.('秘社地底：受到 1 点恐惧。')
      }
    }
  }, 0, { label: '秘社地底', code: '05225' }, { peril: keys > 0 })
  return false
}

// ---- 05226 修道会符号 -------------------------------------------------------
function markOfTheOrder(state, inv, api) {
  const holders = KEY_IDS
    .map(id => ({ key: keyRecord(state, id) }))
    .filter(entry => entry.key && entry.key.holder != null)
  if (!holders.length) {
    api?.info?.('修道会符号：没有调查员控制钥匙。')
    return false
  }
  for (const { key } of holders) {
    const seat = key.holder
    const holder = state.investigators[seat]
    if (!holder) continue
    if (key.id === 'skull') {
      api?.damage?.(seat, 1)
      api?.info?.(`${holder.name} 因骷髅钥匙受到 1 点伤害。`)
    } else if (key.id === 'cultist') {
      api?.horror?.(seat, 1)
      api?.info?.(`${holder.name} 因异教徒钥匙受到 1 点恐惧。`)
    } else if (key.id === 'tablet') {
      api?.discardRandom?.(seat, 2)
      api?.info?.(`${holder.name} 因石板钥匙随机弃掉 2 张手牌。`)
    } else if (key.id === 'elderthing') {
      holder.resources = Math.max(0, (holder.resources || 0) - 3)
      api?.info?.(`${holder.name} 因古神钥匙失去 3 点资源。`)
    }
  }
  return false
}
