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
import { encounterRules, activeInvestigators, hasTrait, recordsFor } from '../../encounter-rules.js'
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
const gameDoom = state => (Number(state.doom) || 0)
  + [...(state.enemies || []), ...(state.locations || []), ...(state.storyAssets || [])]
    .reduce((sum, card) => sum + (Number(card.doom) || 0), 0)
const cluesAt = (state, id) => activeInvestigators(state).filter(inv => inv.location === id)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

function setFlags(state, patch) {
  state.scenarioFlags ||= {}
  Object.assign(state.scenarioFlags, patch)
  return state.scenarioFlags
}

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
    id, label: KEY_LABELS[id], holder: null, location: null, enemyId: null,
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
  return keysWhere(state, key => key.location === locationId)
}

export function setAsideKeys(state) {
  return keysWhere(state, key => key.holder == null && key.location == null && key.enemyId == null)
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
  key.enemyId = enemy?.id || null
}

function placeKeyOnLocation(state, key, locationId) {
  key.holder = null
  key.enemyId = null
  key.location = locationId
}

function giveKey(state, key, seat) {
  key.holder = seat
  key.enemyId = null
  key.location = null
}

function placeRandomKeyOn(state, api, target) {
  const key = randomSetAsideKey(state, api)
  if (!key) return null
  if (target.enemy) placeKeyOnEnemy(state, key, target.enemy)
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
function puzzleBoxAsset(state) {
  return byCode(state, PUZZLE_BOX)
}

function attachPuzzleBox(state, api, enemy) {
  state.storyAssets ||= []
  if (!puzzleBoxAsset(state)) {
    state.storyAssets.push({
      id: 'story:puzzleBox', code: PUZZLE_BOX, originalCode: PUZZLE_BOX,
      name: ALL_CARDS[PUZZLE_BOX]?.nameZh || '机关盒', location: enemy?.location || null,
    })
  }
  const asset = puzzleBoxAsset(state)
  if (asset) asset.location = enemy?.location || null
  setFlags(state, { puzzleBox: { holder: 'enemy', enemyId: enemy?.id || null, seat: null } })
  api?.info?.(`「机关盒」附属在「${enemy?.name || '南森·威克'}」上。`)
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

function chooseInvestigator(state, api, prompt, options) {
  const pool = options || activeInvestigators(state)
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
    if (code === LOBBY_WEVE || code === LODGE_CELLAR_WEVE || code === LODGE_CELLAR_MEMBERS) {
      if (!location.revealed) return `「${location.name}」尚未开放：先在秘社大门谈判/支付线索。`
    }
    if (code === VAULT && !location.revealed && !keysHeldBy(state, state.currentSeat ?? 0).some(key => key.id === 'elderthing')) {
      return '机密室的门锁上了：需要控制古神钥匙。'
    }
    if (code === INNER_SANCTUM && !location.revealed && !keysHeldBy(state, state.currentSeat ?? 0).some(key => key.id === 'cultist')) {
      return '圣堂内室的门锁上了：需要控制异教徒钥匙。'
    }
    if (code === LODGE_CATACOMBS && !location.revealed) return '地下墓穴的门锁上了：需要控制至少 1 把钥匙。'
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
        const key = placeRandomKeyOn(state, api, { location: lounge?.id })
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
    api?.test?.(inv.seat, 'agility', 4, result => {
      if (result?.success) {
        api.info?.(`${inv.name} 避开了核心圈骑士。`)
        return
      }
      enemyEngage(state, inv, knight)
      api.info?.(`${inv.name} 检定失败：核心圈骑士与你交战。`)
    }, 0, { label: '核心圈骑士', code: KNIGHT_INNER_CIRCLE })
  },

  locationShroudModifier(state, location, inv) {
    if (original(location) !== LIBRARY || !inv) return 0
    return keysHeldBy(state, inv.seat).some(key => key.id === 'tablet') ? -3 : 0
  },

  // 典礼室轮末：在其上的调查员与每个友方支援各受 1 点直接恐惧（有骷髅钥匙则取消）。
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    const room = locByCode(state, SANCTUM_DOORWAY_CEREMONY)
    if (!room || !room.revealed) return
    const occupants = activeInvestigators(state).filter(inv => inv.location === room.id)
    if (!occupants.length) return
    if (occupants.some(inv => keysHeldBy(state, inv.seat).some(key => key.id === 'skull'))) {
      api?.info?.('有调查员控制骷髅钥匙：典礼室的恐惧被取消。')
      return
    }
    for (const inv of occupants) api?.directHorror?.(inv.seat, 1)
    for (const inv of occupants) {
      for (const asset of [...(inv.assets || [])]) {
        if (!(ALL_CARDS[original(asset)]?.traits || []).includes('Ally')) continue
        asset.horror = (asset.horror || 0) + 1
      }
    }
    api?.info?.('典礼室轮末：在此的调查员与友方支援各受 1 点直接恐惧。')
  },

  // -------------------------------------------------------------------------
  // 玩家行动
  // -------------------------------------------------------------------------
  actions(state, inv) {
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
      moves.push({ action: 'scenarioAction', rule: 'parleyNathan', label: '谈判：说服南森·威克（意志 3）' })
    }
    if (enemiesHere.some(enemy => original(enemy) === LODGE_JAILOR)) {
      moves.push({ action: 'scenarioAction', rule: 'parleyJailor', label: '谈判：秘社狱卒（智力 3）' })
    }
    if (enemiesHere.some(enemy => original(enemy) === KNIGHT_OUTER_VOID)) {
      moves.push({ action: 'scenarioAction', rule: 'parleyKnightOuter', label: '谈判：边缘虚空骑士（意志/智力 4）' })
    }
    const august = byCode(state, AUGUST_LINDQUIST)
    if (august && august.location === location.id) {
      const needed = 2 * (state.numInvestigators || 1)
      moves.push({
        action: 'scenarioAction', rule: 'parleyAugust', label: '谈判：奥古斯特·林奎斯特（共同支付每人 2 线索）',
        reason: cluesAt(state, location.id) >= needed ? null : `需要 ${needed} 个线索（当前 ${cluesAt(state, location.id)}）`,
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move || !move.rule) return false
    const location = here(state, inv)
    switch (move.rule) {
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
        api?.test?.(inv.seat, 'willpower', 3, result => {
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
        api?.test?.(inv.seat, 'intellect', 3, result => {
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
        api?.test?.(inv.seat, ['willpower', 'intellect'], 4, result => {
          if (result?.success) {
            if ((knight.doom || 0) > 0) {
              knight.doom -= 1
              api?.giveClues?.(inv.seat, 1)
              api.info?.('控制边缘虚空骑士的 1 个毁灭并翻成线索。')
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
        api?.payClues?.(needed, location.id)
        const payers = activeInvestigators(state).filter(entry => entry.location === location.id)
        for (const payer of payers) {
          const choice = typeof api?.choose === 'function' ? api.choose({
            kind: 'harm', source: AUGUST_LINDQUIST, seat: payer.seat,
            prompt: '奥古斯特：受到 1 点伤害或 1 点恐惧。',
            options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
          }) : 'damage'
          if (choice === 'horror') api?.horror?.(payer.seat, 1)
          else api?.damage?.(payer.seat, 1)
        }
        const keys = keysOnLocation(state, august.location)
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
      const holder = box?.holder === 'seat' ? state.investigators[box.seat] : null
      const sanctums = [LOCATIONS.lodgeCatacombs, LOCATIONS.innerSanctum, LOCATIONS.sanctumDoorwayCeremony, LOCATIONS.sanctumDoorwayHolding]
      const spawnId = holder?.location || sanctums.map(id => locById(state, id)).find(Boolean)?.id
      takeFromSetAside(state, SUMMONED_BEAST)
      api?.spawn?.(SUMMONED_BEAST, spawnId)
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

  // -------------------------------------------------------------------------
  // 敌人
  // -------------------------------------------------------------------------
  spawnLocation(state, code) {
    if (code === KNIGHT_INNER_CIRCLE || code === KNIGHT_OUTER_VOID) {
      const alive = activeInvestigators(state)
      const origin = alive[0]?.location
      const originLoc = locById(state, origin)
      const connected = (originLoc?.connections || []).filter(id => locById(state, id))
      return connected[0] || origin || null
    }
    if (code === LODGE_JAILOR || code === CELL_KEEPER) {
      const sanctums = [LOCATIONS.lodgeCatacombs, LOCATIONS.innerSanctum, LOCATIONS.sanctumDoorwayCeremony, LOCATIONS.sanctumDoorwayHolding]
        .map(id => locById(state, id)).find(Boolean)
      return sanctums?.id || null
    }
    return null
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    const code = String(original(enemy))
    if (code === LODGE_JAILOR || code === CELL_KEEPER) {
      enemy.doom = (enemy.doom || 0) + 2
      const key = placeRandomKeyOn(state, api, { enemy })
      api?.info?.(`${enemy.name} 入场：放置 2 个毁灭${key ? `与${key.label}` : ''}。`)
      return
    }
    if (code === KNIGHT_OUTER_VOID) {
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
      setFlags(state, { nathanDefeated: true })
      keysLeavingEnemy(state, enemy, null, enemy.location || null, api)
    }
    if (code === SUMMONED_BEAST) {
      setFlags(state, { guardianDefeated: true })
      api?.finish?.('r3')
    }
    if (hasTrait(enemy, 'Silver Twilight')) moveDoomToAgendaAt(state, enemy.location, api)
    return encounterRules.enemyDefeated?.(state, enemy, api) || false
  },

  enemyDiscarded(state, enemy, api) {
    if (hasTrait(enemy, 'Silver Twilight')) moveDoomToAgendaAt(state, enemy.location, api)
    keysLeavingEnemy(state, enemy, null, enemy.location || null, api)
    return encounterRules.enemyDiscarded?.(state, enemy, api) || false
  },

  // 渗透秘社正面反应：躲避敌人后移除其所有毁灭（近似：自动结算）。
  afterEvade(state, inv, enemy, result, api) {
    encounterRules.afterEvade?.(state, inv, enemy, result, api)
    const act = state.acts?.[state.actIndex]
    if (String(original(act)) === ACT_INFILTRATING && enemy) {
      enemy.doom = 0
      api?.info?.(`渗透秘社：移除了「${enemy.name}」的所有毁灭。`)
    }
    if (String(original(enemy)) === NATHAN_WICK_INDOCTRINATION && result?.success) {
      const successBy = (result.value ?? 0) - (result.difficulty ?? 0)
      if (successBy >= 3) {
        giveKeysToEnemyController(state, enemy, inv.seat)
        setFlags(state, { nathanDefeated: true })
        api?.banish?.(enemy)
        api?.info?.('你偷走了机关盒，南森·威克被加入胜利区。')
      }
    }
    if (String(original(enemy)) === CELL_KEEPER && result?.success) {
      const keys = keysOnEnemy(state, enemy)
      for (const key of keys) giveKey(state, key, inv.seat)
      if (keys.length) api?.info?.(`${inv.name} 控制了牢房看门人的钥匙。`)
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
    const beast = state.enemies.find(enemy => String(original(enemy)) === SUMMONED_BEAST)
    if (!beast) return
    const humans = state.enemies.filter(enemy => enemy.id !== beast.id
      && enemy.location === beast.location && hasTrait(enemy, 'Humanoid'))
    if (!humans.length) return
    let doom = 0
    for (const human of humans) {
      doom += Number(human.doom) || 0
      state.enemies.splice(state.enemies.indexOf(human), 1)
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
      if (!cultists.length) return
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
      if (!withDoom.length) return
      if (hard) {
        const max = Math.max(...withDoom.map(enemy => enemy.doom || 0))
        const target = withDoom.find(enemy => (enemy.doom || 0) === max)
        target.doom -= max
        api?.addDoom?.(max)
        api?.info?.(`古神失败：把「${target.name}」的 ${max} 点毁灭全部移到当前议程。`)
      } else {
        const nearest = nearestCultist(state, inv, enemy => (enemy.doom || 0) > 0)
        if (!nearest) return
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
  const discarded = []
  for (let index = 0; index < 5 && state.encounterDeck.length; index++) discarded.push(state.encounterDeck.pop())
  const cultists = discarded.filter(code => {
    const card = ALL_CARDS[code]
    return card?.type === 'enemy' && hasTrait(card, 'Cultist')
  })
  const rest = discarded.filter(code => !cultists.includes(code))
  state.encounterDiscard.push(...rest)
  if (!cultists.length) {
    api?.info?.('教皇·V 背面：弃掉的 5 张里没有异教徒敌人。')
    return
  }
  const remaining = [...cultists]
  for (const inv of activeInvestigators(state)) {
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
    api?.spawnEngaged?.(code, inv.location, inv.seat)
    state.encounterDiscard.push(code)
    api?.info?.(`${inv.name} 从弃牌中抽出了「${ALL_CARDS[code]?.nameZh || code}」。`)
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

// 圣堂门廊（拘禁室）揭示：从遭遇牌库/弃牌堆找异教徒敌人生成。
function findCultistAndSpawn(state, location, api) {
  const pool = [
    ...(state.encounterDeck || []).map((code, index) => ({ code, index, zone: 'deck' })),
    ...(state.encounterDiscard || []).map((code, index) => ({ code, index, zone: 'discard' })),
  ].filter(entry => hasTrait(ALL_CARDS[entry.code] || { code: entry.code }, 'Cultist'))
  const found = pool[0]
  if (!found) {
    api?.info?.('拘禁室：牌库与弃牌堆中都没有异教徒敌人。')
    return null
  }
  if (found.zone === 'deck') state.encounterDeck.splice(found.index, 1)
  else state.encounterDiscard.splice(found.index, 1)
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
  const empty = (state.locations || []).filter(location =>
    !activeInvestigators(state).some(entry => entry.location === location.id))
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
    let from = cultist.location
    const seen = new Set([from])
    for (let guard = 0; guard < 12 && from !== destination; guard++) {
      const next = (locById(state, from)?.connections || []).find(id => !seen.has(id) && locById(state, id))
      if (!next) break
      seen.add(next)
      from = next
      cultist.location = next
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
    for (let index = 0; index < failedBy; index++) {
      if ((inv.clues || 0) > 0) {
        api.spendClues?.(inv.seat, 1)
        api.info?.('秘社地底：失去 1 个线索。')
      } else {
        api.horror?.(inv.seat, 1)
        api.info?.('秘社地底：受到 1 点恐惧。')
      }
    }
  }, 0, { label: '秘社地底', code: '05225' })
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
