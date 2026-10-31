// 05238《聚合幻灭》· 章节行为（引擎钩子）
//
// 规则映射见 artifacts/migration/tcu/p8/specs/unionAndDisillusion.md。
// 约定：随机只走 helper.randomValue / api.random / api.shuffle；本章状态写
// state.scenarioFlags / state.scenarioZones（纯 JSON）；火盆走 P2.11 locationFlag。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { entryFlags, enemySpawnRuleFor } from '../../../../../src/cards/card-rules.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { encounterRules, activeInvestigators, hasTrait, recordsFor } from '../../encounter-rules.js'
import { uadChaosToken, uadCultistReveal } from './chaos.js'
import {
  ACT_BEYOND_V1, ACT_BEYOND_V2, ACT_BEYOND_V3, ACT_BEYOND_V4, ACT_BINDING_RITE,
  ACT_BROKEN_RITE, ACT_DECKS, ACT_FATED_SOULS, ACT_UNVISITED_ISLE, AGENDA_CROSSROADS,
  AGENDA_LOVERS, ANETTE_MASON, COVEN_INITIATE, FATE_LIST, FORBIDDING_SHORE, GEIST_TRAP,
  ISLE_CODES, JOSEF_MEIGER, KEEPER_OF_SECRETS, LODGE_NEOPHYTE, MISKATONIC_RIVER,
  SCENARIO_CARD, SPECTRAL_RAVEN, THE_SPECTRAL_WATCHER, TREACHERY_CODES, UNVISITED_ISLES, WHIPPOORWILL,
} from './definition.js'
import { scenarioGaps, scenarioApproximations } from './notes.js'

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
const original = card => card?.originalCode || card?.code
const locById = (state, id) => (state.locations || []).find(location => location.id === id) || null
const locByCode = (state, code) => (state.locations || []).find(location => original(location) === code) || null
const isleLocations = state => (state.locations || []).filter(location => ISLE_CODES.includes(original(location)))
const here = (state, inv) => locById(state, inv?.location)
const watcherOf = state => (state.enemies || []).find(enemy => original(enemy) === THE_SPECTRAL_WATCHER) || null
const traitsOf = card => ALL_CARDS[original(card)]?.traits || card?.traits || []
const setFlags = (state, patch) => Object.assign((state.scenarioFlags ||= {}), patch)
const actCodeOf = state => String(original(state.acts?.[state.actIndex]))
// 05243–05248 的正面 [fast]：阵法行动期间花 1 线索，使本次技能检定难度 -2。
const FAST_CIRCLE_ACTS = Object.freeze([
  ACT_BEYOND_V1, ACT_BEYOND_V2, ACT_BEYOND_V3, ACT_BEYOND_V4, ACT_BINDING_RITE, ACT_BROKEN_RITE,
])
// 地点此刻是否有闹鬼能力（印刷 + 授予，与 haunted.js 的读点同口径）。
const hasHauntedAt = (state, locationId) => {
  if (!locationId) return false
  if (locById(state, locationId)?.haunted?.length) return true
  return (state.hauntedGrants || []).some(grant => grant.locationId === 'all' || grant.locationId === locationId)
}
// 05257：幽灵看守人位于灵怪陷阱时获得反击（引擎只在攻击结算读 enemy.retaliate）。
function syncWatcherRetaliate(state) {
  const watcher = watcherOf(state)
  if (!watcher) return
  watcher.retaliate = String(original(locById(state, watcher.location))) === GEIST_TRAP
}

function takeFromSetAside(state, code) {
  const zones = (state.scenarioZones ||= {})
  const list = (zones.setAside ||= [])
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
  return index >= 0
}

// ---------------------------------------------------------------------------
// 阵营 / 火盆
// ---------------------------------------------------------------------------
export function factionOf(state) {
  const records = recordsFor(state)
  if (records.theInvestigatorsSidedWithTheLodge) return 'lodge'
  if (records.theInvestigatorsSidedWithTheCoven) return 'coven'
  return 'coven'
}

// 05241/05242：「火盆已点燃」用地点实例上的 [资源标记] 承载（markers = ['brazier']）；
// 引擎 api.addMarker/removeMarker 写同一份实例数据（src/engine/scenario-runtime.js）。
const BRAZIER_MARKER = 'brazier'

export function brazierLit(state, locationId) {
  const location = locById(state, locationId)
  if (!location) return false
  if (Array.isArray(location.markers) && location.markers.includes(BRAZIER_MARKER)) return true
  // 旧存档/旧测试的 flags 回退读点（markers 为权威）。
  if (typeof location.flags?.brazier === 'boolean') return location.flags.brazier
  return location.litBrazier === true
}

export function setBrazier(state, api, locationId, lit) {
  const location = locById(state, locationId)
  if (!location) return lit
  // 先清空旧的「已点燃」标记，再按目标状态放置 1 个资源标记。
  while (Array.isArray(location.markers) && location.markers.includes(BRAZIER_MARKER)) {
    if (typeof api?.removeMarker === 'function') api.removeMarker(location, BRAZIER_MARKER)
    else location.markers.splice(location.markers.indexOf(BRAZIER_MARKER), 1)
  }
  if (lit) {
    if (typeof api?.addMarker === 'function') api.addMarker(location, BRAZIER_MARKER)
    else { location.markers ||= []; location.markers.push(BRAZIER_MARKER) }
  }
  // 旧读点镜像（净状态同一份；markers 为权威载体）。
  location.flags ||= {}
  location.flags.brazier = lit
  return lit
}

function brazierVariant(lit) {
  if (!lit) return {}
  // 入场即点燃：variant 会展开到地点实例，直接带 1 个火盆资源标记。
  return { markers: [BRAZIER_MARKER], flags: { brazier: true } }
}

// 05239：「被偷走的灵魂」= 看守人身上的 [资源标记]（markers = ['stolenSoul']），
// 与 enemy.lostSouls 数值同源；看守人不在场时先记 scenarioFlags.watcherSouls，入场时补标记。
const SOUL_MARKER = 'stolenSoul'

function soulMarkersOf(enemy) {
  return (enemy?.markers || []).filter(label => label === SOUL_MARKER).length
}

function syncWatcherSoulMarkers(state, watcher, count, api) {
  if (!watcher) return 0
  const target = Math.max(0, Number(count) || 0)
  while (Array.isArray(watcher.markers) && watcher.markers.includes(SOUL_MARKER)) {
    if (typeof api?.removeMarker === 'function') api.removeMarker(watcher, SOUL_MARKER)
    else watcher.markers.splice(watcher.markers.indexOf(SOUL_MARKER), 1)
  }
  for (let index = 0; index < target; index += 1) {
    if (typeof api?.addMarker === 'function') api.addMarker(watcher, SOUL_MARKER)
    else { watcher.markers ||= []; watcher.markers.push(SOUL_MARKER) }
  }
  watcher.lostSouls = target
  return target
}

// 放置未访之岛 / 灵怪陷阱：入场时未揭示，附加火盆初始状态（女巫集会点燃）。
function placeUnrevealedLocation(state, api, id, { lit = false } = {}) {
  state.locationVariants ||= {}
  state.locationVariants[id] = { ...(state.locationVariants[id] || {}), ...brazierVariant(lit) }
  if (!locById(state, id)) api?.place?.(id)
  return locById(state, id)
}

export function litIsles(state) {
  return isleLocations(state).filter(location => brazierLit(state, location.id))
}

// ---------------------------------------------------------------------------
// 命运剧情卡（没有「冒险参考牌底」原语 → scenarioFlags.fateCards）
// ---------------------------------------------------------------------------
function setupFateCards(state) {
  const records = recordsFor(state)
  const missing = Array.isArray(records.missingPersons) ? records.missingPersons : []
  const includeAll = missing.length === 0
  const cards = FATE_LIST
    .filter(fate => includeAll || missing.includes(fate.person))
    .map(fate => ({
      code: fate.story, ally: fate.ally, enemy: fate.enemy, person: fate.person,
      trail: fate.trail, alive: fate.alive, dead: fate.dead, name: fate.name, resolved: false, seat: null,
    }))
  return cards
}

function spawnFateEnemy(state, api, fate, inv, exhausted) {
  const card = ALL_CARDS[fate.enemy] || {}
  const printed = state.scenario?.enemies?.[fate.enemy] || {}
  const locationId = inv?.location || 'miskatonicRiver'
  let enemy = null
  if (typeof api?.spawnStoryEnemy === 'function') {
    enemy = api.spawnStoryEnemy(fate.enemy, locationId, {
      name: card.nameZh || card.name || fate.name,
      fight: printed.fight ?? card.fight ?? 0, evade: printed.evade ?? card.evade ?? 0,
      health: printed.health ?? card.health ?? 1,
      damage: printed.damage ?? card.damage ?? 0, horror: printed.horror ?? card.horror ?? 0,
      hunter: Boolean(printed.hunter), alert: Boolean(printed.alert),
      retaliate: Boolean(printed.retaliate), traits: printed.traits || traitsOf(card),
    }, { exhausted: !!exhausted })
  } else if (typeof api?.spawn === 'function') {
    enemy = api.spawn(fate.enemy, locationId)
    if (enemy && exhausted) enemy.exhausted = true
  }
  if (enemy && exhausted) {
    enemy.exhausted = true
    if (enemy.engagedSeat != null) {
      const holder = state.investigators[enemy.engagedSeat]
      if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
    }
    enemy.engagedSeat = null
  } else if (enemy && inv && typeof api?.engage === 'function') {
    // 05262-05265 背面：翻回敌人面的命运敌人「与你交战」——引擎生成时的 autoEngageAt 按猎物关键词
    // 选人，可能选到别人；这里显式与「结算这张命运卡的调查员」交战（engageEnemy 会清理旧交战者）。
    api.engage(enemy, inv.seat)
  }
  return enemy
}

function resolveFate(state, api, fate, inv) {
  if (!fate || fate.resolved) return
  const records = recordsFor(state)
  const disappeared = (records.disappearedIntoTheMist || []).includes(fate.person)
  const claimed = (records.wasClaimedBySpecters || []).includes(fate.person)
  const onTrail = Boolean(records[fate.trail])
  fate.resolved = true
  fate.seat = inv?.seat ?? null
  if (disappeared && onTrail) {
    removeFromSetAsideByCode(state, fate.ally)
    if (typeof api?.giveAsset === 'function' && inv) api.giveAsset(inv.seat, fate.ally)
    else if (inv) {
      inv.assets ||= []
      inv.assets.push({ id: `story:${fate.ally}`, code: fate.ally, originalCode: fate.ally })
    }
    // 卡面「本场冒险不占盟友槽」：引擎没有 DoNotTakeUpSlot。slotsOverride 才会让实例 slots
    // 盖过印刷槽位（平时 slotUsage 只读卡面，避免单手武器被实例槽位算成双手）。
    const asset = inv?.assets?.find(item => original(item) === fate.ally)
    if (asset) {
      asset.slots = ['none']
      asset.slotsOverride = true
    }
    records[fate.alive] = true
    api?.info?.(`“${fate.name}”从雾中跌出：你控制其剧情支援，记录其还活着。`)
    return
  }
  if (claimed) {
    spawnFateEnemy(state, api, fate, inv, onTrail)
    api?.info?.(`“${fate.name}”已被幽灵夺走性命：翻回敌人面生成${onTrail ? '（横置、不交战）' : '（与你交战）'}。`)
    return
  }
  api?.info?.(`“${fate.name}”的命运：你在原地没有找到其人。`)
}

function removeFromSetAsideByCode(state, code) {
  state.scenarioZones ||= {}
  const list = (state.scenarioZones.setAside ||= [])
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

// ---------------------------------------------------------------------------
// 幕 3/4 版本选择（战役记录）
// ---------------------------------------------------------------------------
export function actVersionFor(records) {
  if (records.theInvestigatorsSidedWithTheLodge) return 'v1'
  if (records.theInvestigatorsSidedWithTheCoven) {
    const deceiving = records.theInvestigatorsAreDeceivingTheLodge
    const inducted = records.theInvestigatorsWereInductedIntoTheInnerCircle
    const hidKnowledge = records.theInvestigatorsHidTheirKnowledgeOfTheCoven
    const keptMementos = records.theInvestigatorsKeptsTheirMementosHidden
    if (deceiving && inducted) return 'v2'
    if ([deceiving, hidKnowledge, keptMementos].filter(Boolean).length >= 2) return 'v3'
    return 'v4'
  }
  return 'v4'
}

// ---------------------------------------------------------------------------
// 阵法行动表（P2.5：2–4 个技能求和 + actionKind:'circle'）
// ---------------------------------------------------------------------------
export const CIRCLE_ACTIONS = Object.freeze({
  [FORBIDDING_SHORE]: { skills: ['willpower', 'intellect'], chooseSkill: true, difficulty: 3 },
  [UNVISITED_ISLES.standingStones]: { skills: ['willpower', 'intellect'], difficulty: 10 },
  [UNVISITED_ISLES.mistyClearing]: { skills: ['willpower', 'agility'], difficulty: 11 },
  [UNVISITED_ISLES.forsakenWoods]: { skills: ['willpower', 'combat'], difficulty: 11 },
  [UNVISITED_ISLES.mossCoveredSteps]: { skills: ['combat', 'agility'], difficulty: 10 },
  [UNVISITED_ISLES.hauntedSpring]: { skills: ['intellect', 'agility'], difficulty: 9 },
  [UNVISITED_ISLES.decayedWillow]: { skills: ['intellect', 'combat'], difficulty: 9 },
  [GEIST_TRAP]: { skills: ['willpower', 'intellect', 'combat', 'agility'], difficulty: 20 },
})

// 05243–05248 正面 [fast]：阵法行动期间花 1 线索，使本次技能检定难度 -2。
// R4：改为真正的 [fast] 玩家窗口能力——由 behavior.fastActions 在任何玩家窗口提供
// （playerWindow 读点 src/engine/encounter.js:469-476）。这里保留函数签名（两处 api.test 仍调用），
// 只返回基础难度，实际降难度在 performAction('circleFast') 里结算。
function circleTestDifficulty(state, inv, base, api) {
  return base
}

// [fast] 的可用性：存在进行中的阵法行动检定、当前幕是本轮修复的六个 [fast] 幕、该调查员有线索，
// 且本次检定尚未由该调查员触发过（同一检定每人一次，避免同一窗口反复询问）。
function circleFastAvailable(state, inv) {
  const test = state.skillTest
  if (!test || String(test.actionKind || '') !== 'circle') return false
  if (!FAST_CIRCLE_ACTS.includes(actCodeOf(state))) return false
  if (!inv || (inv.clues || 0) < 1) return false
  return !test.circleFastUsed?.[inv.seat]
}

function markCircleFastUsed(state, inv) {
  state.skillTest ||= {}
  state.skillTest.circleFastUsed ||= {}
  state.skillTest.circleFastUsed[inv.seat] = true
}

// 「本次技能检定难度 -N」：优先走引擎 api；没有时写引擎同名读点
// （tests.js:837-838 在判定前统一扣减 state.skillTest.difficultyReduction）。
function reduceCurrentTestDifficulty(state, api, amount) {
  if (typeof api?.reduceTestDifficulty === 'function') return api.reduceTestDifficulty(amount)
  const test = state.skillTest
  if (!test) return 0
  test.difficultyReduction = (test.difficultyReduction || 0) + amount
  test.difficulty = Math.max(0, (test.difficulty || 0) - amount)
  return test.difficulty
}

export const implementedEncounterCodes = [
  WHIPPOORWILL, SPECTRAL_RAVEN,
  '05262b', '05263b', '05264b', '05265b',
  '05268', '05269', '05270', '05271', '05272',
]

// 卡面子句完全未实现的内容（审计读点）。
export const behavior = {
  ...encounterRules,
  id: 'unionAndDisillusion',

  implementedEncounterCodes,
  scenarioGaps,
  scenarioApproximations,
  // 读点（测试 / UI / 其它 worker）
  factionOf,
  brazierLit,
  setBrazier,
  litIsles,
  actVersionFor,
  CIRCLE_ACTIONS,
  fateCards: state => (state.scenarioFlags || {}).fateCards || [],

  // 序章二选一（记录已存在时不询问）与幕 3/4 版本。
  preScenarioSetup(state, events, api) {
    const records = recordsFor(state)
    if (!records.theInvestigatorsSidedWithTheLodge && !records.theInvestigatorsSidedWithTheCoven) {
      let answer = 'coven'
      if (typeof api?.choose === 'function') {
        answer = api.choose({
          kind: 'story', source: 'unionAndDisillusion', seat: state.campaign?.leadSeat ?? 0,
          prompt: '你们要帮助秘社完成仪式，还是阻止秘社的仪式？',
          options: [
            { id: 'lodge', label: '我们得帮助秘社完成仪式。' },
            { id: 'coven', label: '我们得阻止秘社的仪式。' },
          ],
        })
      }
      if (answer === 'lodge') records.theInvestigatorsSidedWithTheLodge = true
      else records.theInvestigatorsSidedWithTheCoven = true
    }
    setFlags(state, { faction: factionOf(state) })
    const version = actVersionFor(records)
    const deck = ACT_DECKS[version]
    if (Array.isArray(state.acts) && deck) {
      state.acts[2] = JSON.parse(JSON.stringify(deck[2]))
      state.acts[3] = JSON.parse(JSON.stringify(deck[3]))
    }
    setFlags(state, { actVersion: version })
  },

  setupLocations(state, events, helper = {}) {
    const records = recordsFor(state)
    const faction = factionOf(state)
    // setup 的 helper：randomValue(state) 带 state 参数；shuffle(items, rng) 是两参。
    // 不能把 randomValue 直接当 rng（引擎会按 rng(items) 调用而报 `rng is not a function`）。
    const shuffle = list => (typeof helper?.shuffle === 'function'
      ? helper.shuffle([...list], () => helper.randomValue(state))
      : [...list])
    const shuffled = shuffle([...ISLE_CODES])
    const placedIsles = shuffled.slice(0, 2)
    const asideIsles = shuffled.slice(2)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      GEIST_TRAP, TREACHERY_CODES.watchersGaze,
      ...asideIsles,
      // 三个整组放在一边（act 3 背面洗回；看守人本身也放在一边）
      THE_SPECTRAL_WATCHER, '05087', '05087',
      COVEN_INITIATE, COVEN_INITIATE, COVEN_INITIATE, '05091',
      LODGE_NEOPHYTE, LODGE_NEOPHYTE, LODGE_NEOPHYTE, KEEPER_OF_SECRETS, '05097', '05097',
      // 参考 setup 还把安妮特与约瑟夫放在一边：05243 背面按记录生成安妮特/把剩余女巫敌人洗回，
      // 05245 背面按「约瑟夫依然健在」生成他。spawnPrinted 会同步从 setAside 消耗对应卡。
      ANETTE_MASON, JOSEF_MEIGER,
      ...FATE_LIST.map(fate => fate.ally).filter(code => {
        const fate = FATE_LIST.find(entry => entry.ally === code)
        return !Array.isArray(records.missingPersons) || records.missingPersons.length === 0
          || records.missingPersons.includes(fate.person)
      }),
    ]
    state.scenarioZones.removed = []
    setFlags(state, {
      faction,
      asideIsles,
      placedIsles,
      fateCards: setupFateCards(state),
      watcherSpawned: false,
      watcherSouls: 0,
      watcherDefeatedAt: null,
      geistTrapPlaced: false,
      circleDifficultyRound: 0,
      mossStepsRound: 0,
      mossStepsPaid: {},
      noParleyJosef: false,
    })
    // 火盆：女巫集会支持者开局点燃危险河岸 + 2 张未访之岛。
    state.locationVariants ||= {}
    const lit = faction === 'coven'
    state.locationVariants.forbiddingShore = { ...(state.locationVariants.forbiddingShore || {}), ...brazierVariant(lit) }
    for (const code of placedIsles) {
      const id = idOfIsle(code)
      state.locationVariants[id] = { ...(state.locationVariants[id] || {}), ...brazierVariant(lit) }
    }
    return ['miskatonicRiver', 'forbiddingShore', ...placedIsles.map(idOfIsle)]
  },

  startLocation() {
    return 'miskatonicRiver'
  },

  // 鬼灵迷雾 / 灵怪陷阱：未揭示时不能进入。
  investigatorEntryError(state, location) {
    const code = original(location)
    if (ISLE_CODES.includes(code) && !location.revealed) {
      const lit = brazierLit(state, 'forbiddingShore')
      const faction = factionOf(state)
      if (faction === 'lodge' && !lit) return '鬼灵迷雾堵住道路：危险河岸的火盆尚未点燃，不能进入。'
      if (faction === 'coven' && lit) return '鬼灵迷雾堵住道路：危险河岸的火盆仍然点燃，不能进入。'
      return null
    }
    if (code === GEIST_TRAP && !location.revealed) return '通往仪式地点的道路被鬼灵迷雾所遮蔽：尚未揭示。'
    return null
  },

  // 05242「每位调查员不能离开自己面前的地点」：以 05241 背面记录的 flags.frontOf 为准。
  // 引擎在移动行动（moves.js）与合法动作列表读 moveError；任何位移（含效果位移）读 movementError
  // （src/engine/hidden-rules.js:85-91 → src/engine/movement.js:181），第四轮起全阶段生效。
  moveError(state, inv, destLoc) {
    if (actCodeOf(state) !== ACT_FATED_SOULS) return undefined
    const fronts = state.scenarioFlags?.frontOf || {}
    if (Number(fronts[inv?.location]) !== Number(inv?.seat)) return undefined
    if (destLoc && destLoc.id === inv.location) return undefined
    return '你被钉在自己面前的地点：本幕你不能离开它。'
  },

  movementError(state, inv) {
    if (actCodeOf(state) !== ACT_FATED_SOULS) return undefined
    const fronts = state.scenarioFlags?.frontOf || {}
    if (Number(fronts[inv?.location]) !== Number(inv?.seat)) return undefined
    return '你被钉在自己面前的地点：本幕你不能离开它。'
  },

  // 05246/05248 的 [fast]：任意调查员在「阵法行动」的检定期可花自己的 1 个线索，使本次难度 -2。
  // R4：引擎 playerWindow 支持 behavior.fastActions(state, inv, timing)（src/engine/encounter.js:469-476），
  // 检定者本人与其他玩家的通用窗口统一走 fastActions；非检定者在检定进行中没有通用玩家窗口，
  // 仍由引擎 testOtherInvestigatorTrigger 固定时点询问（src/engine/tests.js:181-193）。
  // 两条路径共用 circleFastUsed 标记，同一检定每人只触发一次。
  fastActions(state, inv, timing) {
    if (!circleFastAvailable(state, inv)) return []
    return [{
      action: 'scenarioAction', rule: 'circleFast', actions: 0, fast: true,
      label: '⚡ 阵法行动：花你自己的 1 个线索，本次技能检定难度 -2',
    }]
  },

  // 阵法行动：任何有火盆且已揭示的地点。
  actions(state, inv) {
    const moves = []
    // 05246 背面：「本局剩余时间，调查员不能与约瑟夫·梅吉尔谈判」——谈判行动只在未封锁时列出，
    // 封锁标记以 flags.noParleyJosef 为唯一读点（生成约瑟夫时写入）。
    const josef = (state.enemies || []).find(enemy =>
      String(original(enemy)) === JOSEF_MEIGER && enemy.location === inv?.location)
    if (josef && !state.scenarioFlags?.noParleyJosef) {
      moves.push({
        action: 'scenarioAction', rule: 'parleyJosef', actions: 1,
        label: '🕊️ 谈判约瑟夫·梅吉尔（智识 4）：成功翻面结算「约瑟夫的计划」',
      })
    }
    const location = here(state, inv)
    if (!location || !location.revealed) return moves
    const code = original(location)
    if (!CIRCLE_ACTIONS[code]) return moves
    const lit = brazierLit(state, location.id)
    moves.push({
      action: 'scenarioAction', rule: 'circle', label: '阵法：检定以寻找火盆',
      hint: lit ? '当前火盆已点燃' : '当前火盆未点燃',
    })
    return moves
  },

  performAction(state, inv, move, api) {
    if (move?.rule === 'circleFast') {
      // [fast]：只在「进行中的阵法行动检定」期间可结算；由玩家窗口/固定时点两条路径进来。
      const test = state.skillTest
      if (!test || String(test.actionKind || '') !== 'circle') {
        api?.info?.('只有在阵法行动的技能检定期间才能使用这个 [fast] 能力。')
        return true
      }
      if (test.circleFastUsed?.[inv.seat]) {
        api?.info?.('本次阵法检定你已经花过线索了。')
        return true
      }
      if ((inv.clues || 0) < 1) {
        api?.info?.('没有线索可以花费。')
        return true
      }
      markCircleFastUsed(state, inv)
      if (typeof api?.spendClues === 'function') api.spendClues(inv.seat, 1)
      else inv.clues = Math.max(0, (inv.clues || 0) - 1)
      reduceCurrentTestDifficulty(state, api, 2)
      api?.info?.(`${inv.name} 花 1 个线索：本次阵法检定难度 -2。`)
      return true
    }
    if (move?.rule === 'parleyJosef') {
      const josef = (state.enemies || []).find(enemy => String(original(enemy)) === JOSEF_MEIGER)
      if (!josef || state.scenarioFlags?.noParleyJosef) {
        api?.info?.('📜 本局剩余时间里，调查员不能与约瑟夫·梅吉尔谈判。')
        return true
      }
      api?.test?.(inv.seat, 'intellect', 4, result => {
        if (!result?.success) {
          api?.attack?.(josef, inv)
          return
        }
        flipJosef(state, josef, api)
      }, 0, { label: '与约瑟夫·梅吉尔谈判', code: JOSEF_MEIGER })
      return true
    }
    if (!move || move.rule !== 'circle') {
      if (encounterRules.performAction?.(state, inv, move, api)) return true
      throw new Error(`未知聚合幻灭行动：${move?.rule}`)
    }
    const location = here(state, inv)
    const spec = CIRCLE_ACTIONS[original(location)]
    if (!spec) {
      api?.info?.('这里没有火盆。')
      return true
    }
    const finish = result => {
      if (!result?.success) {
        api?.info?.('阵法检定失败：火盆没有变化。')
        return
      }
      const lit = brazierLit(state, location.id)
      const options = []
      if (lit) options.push({ id: 'unlight', label: '熄灭此处的火盆' })
      else options.push({ id: 'light', label: '点燃此处的火盆' })
      options.push({ id: 'leave', label: '不做改变' })
      let answer = options[0].id
      if (typeof api?.choose === 'function') {
        answer = api.choose({
          kind: 'circle', source: original(location), seat: inv.seat,
          prompt: `阵法成功：${lit ? '熄灭' : '点燃'}火盆？`, options,
        })
      }
      if (answer === 'light') setBrazier(state, api, location.id, true)
      if (answer === 'unlight') setBrazier(state, api, location.id, false)
      api?.info?.(`阵法成功：${answer === 'leave' ? '火盆保持原样' : (answer === 'light' ? '火盆被点燃' : '火盆被熄灭')}。`)
    }
    if (spec.chooseSkill) {
      let skill = spec.skills[0]
      if (typeof api?.choose === 'function') {
        skill = api.choose({
          kind: 'circle', source: original(location), seat: inv.seat,
          prompt: '选择检定技能。',
          options: spec.skills.map(id => ({ id, label: { willpower: '意志', intellect: '智力', combat: '战斗', agility: '敏捷' }[id] })),
        })
      }
      if (!spec.skills.includes(skill)) skill = spec.skills[0]
      api?.test?.(inv.seat, skill, circleTestDifficulty(state, inv, spec.difficulty, api),
        finish, 0, { label: '阵法', code: original(location), actionKind: 'circle' }, { actionKind: 'circle' })
      return true
    }
    // P2.5：2–4 个技能求和检定。
    api?.test?.(inv.seat, [...spec.skills], circleTestDifficulty(state, inv, spec.difficulty, api),
      finish, 0, { label: '阵法', code: original(location), actionKind: 'circle' }, { actionKind: 'circle' })
    return true
  },

  // 立石闹鬼：本轮所有阵法检定难度 +2。
  testDifficultyModifier(state, inv, skill, difficulty, source) {
    const isCircle = source?.label === '阵法' || state.skillTest?.actionKind === 'circle'
    if (isCircle && (state.scenarioFlags?.circleDifficultyRound || 0) === state.round) return 2
    return 0
  },

  // 05246/05248 的 [fast]：任意调查员在「阵法行动」的检定期可花自己的 1 个线索，使本次难度 -2。
  // R4：通用玩家窗口统一由 behavior.fastActions 提供（src/engine/encounter.js:469-476）；
  // 非检定者在检定进行中没有通用窗口，故保留本引擎固定时点钩子（src/engine/tests.js:181-193）。
  // 两条路径共用 circleFastUsed 标记，同一检定每人一次。
  testOtherInvestigatorTrigger(state, other, tester, context, api) {
    if (!context || !other || other.seat === tester?.seat) return
    const isCircle = String(context.actionKind || '') === 'circle' || context.source?.label === '阵法'
    if (!isCircle) return
    if (!FAST_CIRCLE_ACTS.includes(actCodeOf(state))) return
    if ((other.clues || 0) < 1) return
    if (state.skillTest?.circleFastUsed?.[other.seat]) return
    let answer = 'skip'
    if (typeof api?.choose === 'function') {
      answer = api.choose({
        kind: 'effect', source: actCodeOf(state), seat: other.seat,
        prompt: `${other.name}：阵法行动期间，花你自己的 1 个线索使本次技能检定难度 -2？`,
        options: [
          { id: 'spend', label: '花 1 个线索（难度 -2）' },
          { id: 'skip', label: '不花线索' },
        ],
      })
    }
    if (answer !== 'spend') return
    markCircleFastUsed(state, other)
    if (typeof api?.spendClues === 'function') api.spendClues(other.seat, 1)
    else other.clues = Math.max(0, (other.clues || 0) - 1)
    reduceCurrentTestDifficulty(state, api, 2)
    api?.info?.(`${other.name} 在阵法行动期间花 1 个线索：本次技能检定难度 -2。`)
  },

  // 闹鬼脚本（P2.1 的 escape 子句：需要跨牌堆/跨检定状态的能力）。
  hauntedScript(state, payload, api) {
    const scriptId = payload?.scriptId
    const locationId = payload?.locationId || state.investigators?.[payload?.seat]?.location
    if (scriptId === 'standingStones') {
      setFlags(state, { circleDifficultyRound: state.round })
      api?.info?.('立石闹鬼：直到本轮结束，阵法行动期间的检定难度 +2。')
      return true
    }
    if (scriptId === 'mossSteps') {
      setFlags(state, { mossStepsRound: state.round, mossStepsPaid: {} })
      api?.info?.('苔藓阶梯闹鬼：本轮你的下一次移动行动额外花费 1 个行动。')
      return true
    }
    if (scriptId === 'hauntedSpring') {
      // 卡面：弃掉你控制的一张支援，或受到 1 点伤害。没有支援时只提供「受到 1 点伤害」。
      const inv = state.investigators?.[payload?.seat]
      if (!inv) return false
      const assets = inv.assets || []
      const options = []
      if (assets.length) options.push({ id: 'asset', label: '弃掉你控制的一张支援' })
      options.push({ id: 'damage', label: '受到 1 点伤害' })
      let answer = options[options.length - 1].id
      if (typeof api?.choose === 'function' && options.length > 1) {
        answer = api.choose({
          kind: 'haunted', source: 'hauntedSpring', seat: payload?.seat,
          prompt: '闹鬼：弃掉一张支援，或受到 1 点伤害。', options,
        })
      }
      if (answer === 'asset' && assets.length) {
        const picked = assets.length === 1 ? assets[0].id : api.choose?.({
          kind: 'target', source: 'hauntedSpring', seat: payload?.seat,
          prompt: '选择并弃掉你控制的一张支援。',
          options: assets.map(asset => ({ id: asset.id, cardCode: asset.code, label: api?.cardName?.(asset.code) || asset.name || asset.code })),
        })
        api?.discardAsset?.(payload.seat, picked && assets.some(asset => asset.id === picked) ? picked : assets[0].id)
      } else {
        api?.damage?.(payload.seat, 1)
      }
      api?.info?.('闹鬼：闹鬼的泉水结算完毕。')
      return true
    }
    if (scriptId === 'forsakenWoods') {
      const ravens = state.enemies.filter(enemy => original(enemy) === WHIPPOORWILL)
      // 卡面「最近的夜鹰」：按地点连接距离取最近的一只（同地点距离 0 自然最近）；并列时由玩家选择。
      const distances = ravens.map(enemy => ({ enemy, distance: hopDistance(state, locationId, enemy.location) }))
        .filter(entry => Number.isFinite(entry.distance))
      const nearestDistance = distances.length ? Math.min(...distances.map(entry => entry.distance)) : Infinity
      const pool = distances.filter(entry => entry.distance === nearestDistance).map(entry => entry.enemy)
      let nearby = pool[0] || null
      if (pool.length > 1 && typeof api?.choose === 'function') {
        const picked = api.choose({
          kind: 'enemy', source: 'forsakenWoods', seat: payload?.seat,
          prompt: '选择要攻击你的夜鹰（最近距离并列）。',
          options: pool.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        nearby = pool.find(enemy => String(enemy.id) === String(picked)) || pool[0]
      }
      const options = []
      const found = findWhippoorwill(state)
      // 卡面「找出一张夜鹰并生成」在牌库与弃牌堆都没有夜鹰时没有可结算的来源：不提供该选项（参考实现同口径）。
      if (found) options.push({ id: 'search', label: '查找夜鹰并生成在此地点' })
      if (nearby) options.push({ id: 'attack', label: '最近的夜鹰攻击你' })
      if (!options.length) return true
      let answer = options[0].id
      if (typeof api?.choose === 'function' && options.length > 1) {
        answer = api.choose({
          kind: 'haunted', source: 'forsakenWoods', seat: payload?.seat,
          prompt: '被遗忘的树林闹鬼：选择一项。', options,
        })
      }
      if (answer === 'attack' && nearby) {
        api?.attack?.(nearby, state.investigators[payload.seat])
        return true
      }
      removeEncounterCard(state, found)
      api?.spawn?.(WHIPPOORWILL, locationId)
      api?.info?.('被遗忘的树林闹鬼：一张夜鹰生成在此地点。')
      return true
    }
    return false
  },

  // 苔藓阶梯：下一次「移动行动」额外 1 行动（效果位移不加价，见引擎 beforeMove 第 5 参 reason）。
  beforeMove(state, inv, destination, api, context) {
    if ((state.scenarioFlags?.mossStepsRound || 0) !== state.round) return
    if (context && context.reason !== 'move') return
    const paid = (state.scenarioFlags.mossStepsPaid ||= {})
    if (paid[inv.seat]) return
    paid[inv.seat] = true
    if (state.phase === 'investigation') inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - 1)
    else {
      inv.pendingActionLoss ||= {}
      inv.pendingActionLoss[state.round] = (inv.pendingActionLoss[state.round] || 0) + 1
    }
    api?.info?.('苔藓阶梯：下一次移动额外花费 1 个行动。')
  },

  // -------------------------------------------------------------------------
  // 幕 / 议程
  // -------------------------------------------------------------------------
  actReveal(state, act, api) {
    const code = String(original(act))
    if (code === ACT_UNVISITED_ISLE) {
      const aside = [...(state.scenarioFlags?.asideIsles || [])]
      const placedIsles = state.scenarioFlags?.placedIsles || []
      const faction = factionOf(state)
      const fronts = {}
      for (const inv of activeInvestigators(state)) {
        if (!aside.length) break
        const isleCode = aside.shift()
        const id = idOfIsle(isleCode)
        placeUnrevealedLocation(state, api, id, { lit: faction === 'coven' })
        placedIsles.push(isleCode)
        // 05241/05242：「放到自己面前」→ flags.frontOf[地点 id] = 座位（引擎没有面前地点原语）。
        fronts[id] = inv.seat
        api?.moveInvestigator?.(inv.seat, id)
        if (typeof api?.moveInvestigator !== 'function') inv.location = id
        api?.info?.(`${inv.name} 面前放置了「未访之岛」，并立即移动到该地点。`)
      }
      setFlags(state, { asideIsles: aside, placedIsles, frontOf: fronts })
      dealFateCards(state, api)
      return
    }
    if (code === ACT_FATED_SOULS) {
      const watcherCode = THE_SPECTRAL_WATCHER
      takeFromSetAside(state, watcherCode)
      const watcher = typeof api?.spawn === 'function' ? api.spawn(watcherCode, 'miskatonicRiver') : null
      if (watcher) {
        watcher.lostSouls = state.scenarioFlags?.watcherSouls || 0
        watcher.health = (Number(state.scenario?.enemies?.[watcherCode]?.health) || Number(ALL_CARDS[watcherCode]?.health) || 5) + watcher.lostSouls * (state.numInvestigators || 1)
      }
      setFlags(state, { watcherSpawned: true })
      // 看守人的攫噬 ×2 与看守人的注视一起洗入遭遇牌库 + 洗回弃牌堆（卡面 05242 背面原文）。
      const shuffledFromAside = []
      const gaze = TREACHERY_CODES.watchersGaze
      if (takeFromSetAside(state, gaze)) shuffledFromAside.push(gaze)
      for (let index = 0; index < 2; index++) {
        if (takeFromSetAside(state, '05087')) shuffledFromAside.push('05087')
      }
      if (shuffledFromAside.length) {
        state.encounterDeck ||= []
        state.encounterDeck.push(...shuffledFromAside)
        if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
      }
      state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
      state.encounterDiscard = []
      if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
      api?.info?.('命数已定背面：看守人的攫噬 ×2 与看守人的注视连同弃牌堆洗入遭遇牌库。')
      // 灵怪陷阱入场（未揭示）；女巫集会则点燃火盆。
      const lit = factionOf(state) === 'coven'
      placeUnrevealedLocation(state, api, 'geistTrap', { lit })
      setFlags(state, { geistTrapPlaced: true })
      api?.info?.('命数已定背面：幽灵看守人出现在米斯卡塔尼克河，灵怪陷阱入场。')
      return
    }
    if ([ACT_BEYOND_V1, ACT_BEYOND_V2, ACT_BEYOND_V3, ACT_BEYOND_V4].includes(code)) {
      revealGeistTrapAndGather(state, api)
      if (code === ACT_BEYOND_V1) {
        if (recordsFor(state).theWitchesSpellWasCast) {
          spawnPrinted(state, api, ANETTE_MASON, 'geistTrap')
        } else {
          const count = (state.numInvestigators || 1) > 2 ? 2 : 1
          for (let index = 0; index < count; index++) spawnPrinted(state, api, COVEN_INITIATE, 'geistTrap')
        }
        // 卡面：「将放在一边的每张剩余[[女巫]]敌人与遭遇弃牌堆一起洗入遭遇牌库」——
        // 生成之后从 setAside 取剩余女巫敌人（安妮特若未被生成则也在其中），不能写死张数。
        shuffleAsideIntoDeck(state, api, remainingSetAsideWitchEnemies(state))
      } else if (code === ACT_BEYOND_V2) {
        // 卡面：所有 [cultist] 标记从混乱袋移除（含封印在场上卡牌上的），直到剧本结束。
        state.chaosBag = (state.chaosBag || []).filter(token => token !== 'cultist')
        const chaos = (state.chaos ||= { revealed: [], sealed: [], removed: [], frames: [] })
        chaos.sealed = (chaos.sealed || []).filter(item => item?.token !== 'cultist')
        state.sealedTokens = chaos.sealed.map(item => item.token)
        // 「直到剧本结束」：同步从战役袋移除，下一关 setupChaosBag 用它重建时不会回来。
        if (Array.isArray(state.campaign?.chaosBag)) {
          state.campaign.chaosBag = state.campaign.chaosBag.filter(token => token !== 'cultist')
        }
        api?.info?.('迷雾彼端（版本二）：所有异教徒标记从混乱袋（含封印）与战役袋中移除，直到剧本结束。')
      } else {
        const count = (state.numInvestigators || 1) > 2 ? 2 : 1
        for (let index = 0; index < count; index++) {
          // 生成的秘社新信徒来自「放在一边」的银暮秘社组：spawnPrinted 会同步从 setAside 移除。
          spawnPrinted(state, api, LODGE_NEOPHYTE, 'geistTrap')
        }
        if (recordsFor(state).josefIsAliveAndWell) {
          setFlags(state, { noParleyJosef: true })
          spawnPrinted(state, api, JOSEF_MEIGER, 'geistTrap')
        }
        // 卡面：将放在一边的「银暮秘社」遭遇组剩余卡牌与遭遇弃牌堆一起洗入遭遇牌库。
        const aside = state.scenarioZones?.setAside || []
        const remainingLodge = aside.filter(code =>
          [LODGE_NEOPHYTE, KEEPER_OF_SECRETS, '05097'].includes(code))
        shuffleAsideIntoDeck(state, api, remainingLodge)
      }
      return
    }
    if (code === ACT_BINDING_RITE) {
      api?.finish?.('r1')
      return
    }
    if (code === ACT_BROKEN_RITE) api?.finish?.('r4')
  },

  agendaReveal(state, agenda, api) {
    const code = String(original(agenda))
    if (code === AGENDA_LOVERS) {
      state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
      state.encounterDiscard = []
      if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
      const taken = (recordsFor(state).wasTakenByTheWatcher || []).length
      setFlags(state, { watcherSouls: taken })
      const watcher = watcherOf(state)
      if (watcher) {
        syncWatcherSoulMarkers(state, watcher, taken, api)
        watcher.health = (Number(state.scenario?.enemies?.[THE_SPECTRAL_WATCHER]?.health) || Number(ALL_CARDS[THE_SPECTRAL_WATCHER]?.health) || 5) + taken * (state.numInvestigators || 1)
      }
      api?.info?.(`恋人·VI 背面：洗回弃牌堆；${taken} 个灵魂被偷走（看守人 +${taken} 攻击 / +${taken * (state.numInvestigators || 1)} 生命）。`)
      return
    }
    if (code === AGENDA_CROSSROADS) {
      for (const inv of activeInvestigators(state)) {
        api?.trauma?.(inv.seat, 'physical', 1)
        inv.defeated = true
        api?.info?.(`命运的十字路口背面：${inv.name} 被击败并承受 1 点肉体创伤。`)
      }
      api?.finish?.('r5')
    }
  },

  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const code = String(original(act))
    const isles = isleLocations(state)
    if ([ACT_BEYOND_V1, ACT_BEYOND_V2, ACT_BEYOND_V3, ACT_BEYOND_V4].includes(code)) {
      if (!isles.length) return
      const wantLit = code === ACT_BEYOND_V1
      const ready = isles.every(location => location.revealed && brazierLit(state, location.id) === wantLit)
      if (ready) api?.advanceAct?.()
      return
    }
    if (code === ACT_BINDING_RITE || code === ACT_BROKEN_RITE) {
      const flags = state.scenarioFlags || {}
      const defeatedAtTrap = Boolean(flags.watcherDefeatedAt)
      if (!defeatedAtTrap) return
      const wantLit = code === ACT_BINDING_RITE
      // 用击败瞬间记下的火盆状态判定；旧存档没有该登记时退回当前值。
      const recordedLit = flags.watcherDefeatedBrazierLit
      const matched = recordedLit == null
        ? brazierLit(state, 'geistTrap') === wantLit
        : Boolean(recordedLit) === wantLit
      if (matched) api?.advanceAct?.()
    }
  },

  // -------------------------------------------------------------------------
  // 敌人
  // -------------------------------------------------------------------------
  // 单卡生成地点由条目 enemySpawnRule 声明（05266/05267：生成在首位调查员所在地点）。
  spawnLocation(state, code, fallbackLoc) {
    if (enemySpawnRuleFor(String(code))?.spawnAtFirstInvestigator) {
      return activeInvestigators(state)[0]?.location || fallbackLoc || null
    }
    // 引擎语义：spawnLocation 返回 null = 生成失败。未特判的 code 必须回退到引擎给定的地点，
    // 否则整关所有未列出的敌人都无法生成（含共享组敌人与放一边的 05100 等）。
    return fallbackLoc || null
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    syncWatcherRetaliate(state)
    const code = String(original(enemy))
    if (code === THE_SPECTRAL_WATCHER) {
      // 05239：被偷走的灵魂现为看守人身上的真实资源标记；不在场期间先记 watcherSouls，
      // 入场时按记账数补标记（数值读点同步 enemy.lostSouls）。
      const souls = Number(enemy.lostSouls) || Number(state.scenarioFlags?.watcherSouls) || 0
      syncWatcherSoulMarkers(state, enemy, souls, api)
      enemy.health = (Number(enemy.health) || 5) + souls * (state.numInvestigators || 1)
      setFlags(state, { watcherSpawned: true })
      return
    }
    if (code === SPECTRAL_RAVEN) {
      enemy.prey = 'lowestIntellect'
      return
    }
    // 秘社新信徒的「入场放 1 毁灭」已由共享 encounterRules.enemySpawned 按
    // enemySpawnRule.doomOnSpawn 结算（本函数开头已转发）；这里不再手动 +1，
    // 否则 QA 实测入场毁灭会变成 2 个（05095 verdict=mismatch 的根因）。
    if (code === LODGE_NEOPHYTE) {
      api?.info?.('秘社新信徒入场：共享规则已在其上放置 1 个毁灭。')
    }
  },

  // 05257：看守人移动到灵怪陷阱/离开时要同步反击关键词。
  enemyMoved(state, enemy, previousLocation, api) {
    encounterRules.enemyMoved?.(state, enemy, previousLocation, api)
    if (String(original(enemy)) === THE_SPECTRAL_WATCHER) syncWatcherRetaliate(state)
  },

  enemyDefeated(state, enemy, api) {
    const code = String(original(enemy))
    if (code === THE_SPECTRAL_WATCHER) {
      // 卡面：被击败时不弃掉，改为治愈所有伤害、解除交战并横置；本轮补给阶段不重整。
      // 与共享条目 05086 同口径：preventReady 由引擎补给阶段读；还要从交战调查员的 engaged 数组清理。
      enemy.damageTaken = 0
      enemy.exhausted = true
      enemy.preventReady = { from: state.round, rounds: 1 }
      const holder = enemy.engagedSeat == null ? null : state.investigators[enemy.engagedSeat]
      if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
      for (const inv of state.investigators || []) {
        if (Array.isArray(inv.engaged)) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
      }
      enemy.engagedSeat = null
      if (!state.enemies.includes(enemy)) state.enemies.push(enemy)
      const atTrap = String(original(locById(state, enemy.location))) === GEIST_TRAP
      if (atTrap) {
        // 05247/05248 目标要求「被击败时该处火盆点燃/未点燃」同时成立：击败瞬间把火盆状态
        // 一并记下，之后火盆再变也不能改变已经达成的条件（旧实现 checkObjectives 读当前值，
        // 存在点亮再熄灭后仍推进的漏洞）。
        const brazierAtDefeat = brazierLit(state, 'geistTrap')
        setFlags(state, {
          watcherDefeatedAt: enemy.location,
          watcherDefeatedBrazierLit: brazierAtDefeat,
        })
        api?.info?.('幽灵看守人在灵怪陷阱被击败：它没有被弃掉，治愈伤害并横置。')
        const actCode = String(original(state.acts?.[state.actIndex]))
        if ((actCode === ACT_BINDING_RITE || actCode === ACT_BROKEN_RITE)
          && brazierAtDefeat === (actCode === ACT_BINDING_RITE)) api?.advanceAct?.()
      } else {
        api?.info?.('幽灵看守人被击败：它没有被弃掉，治愈伤害并横置。')
      }
      return true
    }
    if (FATE_LIST.some(fate => fate.enemy === code)) {
      const fate = FATE_LIST.find(entry => entry.enemy === code)
      if (fate) recordsFor(state)[fate.dead] = true
      return encounterRules.enemyDefeated?.(state, enemy, api) || false
    }
    return encounterRules.enemyDefeated?.(state, enemy, api) || false
  },

  enemyEngaged(state, enemy, inv, api) {
    encounterRules.enemyEngaged?.(state, enemy, inv, api)
    const code = String(original(enemy))
    const flags = entryFlags(code) || {}
    if (flags.onEngageDiscardTwo) {
      api?.discardChosen?.(inv.seat, flags.onEngageDiscardTwo, enemy.name)
      api?.info?.(`${enemy.name}与你交战：选择并弃掉 ${flags.onEngageDiscardTwo} 张手牌。`)
      return
    }
    if (flags.onEngageLoseTwoResources) {
      inv.resources = Math.max(0, (inv.resources || 0) - 2)
      api?.info?.(`${enemy.name}与你交战：失去 2 个资源。`)
      return
    }
    // 05267 幽灵乌鸦的交战二选一在条目的 enemyScript.onEngaged（共享 enemyEngaged 已派发）。
  },

  afterEvade(state, inv, enemy, result, api) {
    encounterRules.afterEvade?.(state, inv, enemy, result, api)
    const evadeFlags = entryFlags(String(original(enemy))) || {}
    if (evadeFlags.onEvadeDamage && result?.success) {
      api?.damage?.(inv.seat, evadeFlags.onEvadeDamage)
      api?.info?.(`你成功躲避${enemy.name}：受到 ${evadeFlags.onEvadeDamage} 点伤害。`)
    }
  },

  // 05262b「强制 - 在你成功攻击加弗瑞拉后，如果她处于重整状态：受到 1 点恐惧」。
  // 引擎第 5 参给出本次攻击是否已击败她（combat.js:374-380 在判定击败之后、真正移除之前调用）；
  // 被击败/已横置/已离场时都不再是「重整状态」，不触发。
  enemyAttackedSuccessfully(state, inv, enemy, api, info) {
    encounterRules.enemyAttackedSuccessfully?.(state, inv, enemy, api)
    const stillReady = !info?.defeated && !enemy.exhausted && (state.enemies || []).includes(enemy)
    if (entryFlags(String(original(enemy)))?.onAttackedHorrorIfReady && stillReady) {
      api?.horror?.(inv.seat, 1)
      api?.info?.(`你成功攻击${enemy.name}：她仍处于重整状态，受到 1 点恐惧。`)
    }
  },

  // 夜鹰的「所在地点调查员 -1 全技能」在条目 enemyStatRule.skillAura（共享读点 encounterRules.statModifier）。
  statModifier(state, inv, skill) {
    return encounterRules.statModifier?.(state, inv, skill) || 0
  },

  // 单卡战斗修正都在条目 enemyStatRule（05086 每个 stolenSoul +1、05267 boostUntilRound），共享读点统一汇总。
  enemyStatModifier(state, enemy, stat) {
    return encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
  },

  // 共享 encounter-rules 的幽灵敌人地点限制不适用于本章（UAD 幽灵敌人卡面无此限制）。
  canFightEnemy(state, inv, enemy) {
    syncWatcherRetaliate(state)
    return true
  },

  canEvadeEnemy(state, inv, enemy) {
    syncWatcherRetaliate(state)
    return true
  },

  // 05269/05270 威胁区的强制：在将受到伤害/恐惧时额外 2 点并弃掉本卡。
  // -------------------------------------------------------------------------
  // 混乱标记 / 检定
  // -------------------------------------------------------------------------
  resolveChaosToken(state, inv, token, api) {
    if (token === 'cultist') uadCultistReveal(state, inv, api)
    return uadChaosToken(state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    if (!result) return
    const drawn = (result.drawn || []).filter(token => !(result.cancelledTokens || []).includes(token))
    const failed = !result.success
    if (!failed) return
    if (drawn.includes('tablet')) {
      const locals = state.enemies.filter(enemy =>
        enemy.location === inv.location && traitsOf(enemy).some(trait => String(trait).toLowerCase() === 'spectral'))
      if (locals.length) {
        // 05238 [tablet]：由结算玩家选择所在地点的哪个幽灵敌人攻击（旧实现固定取第一个）。
        let target = locals[0]
        if (locals.length > 1 && typeof api?.choose === 'function') {
          const picked = api.choose({
            kind: 'enemy', source: SCENARIO_CARD, seat: inv.seat,
            prompt: '石板失败：选择所在地点的一个幽灵敌人攻击你。',
            options: locals.map(enemy => ({ id: enemy.id, label: enemy.name })),
          })
          target = locals.find(enemy => String(enemy.id) === String(picked)) || locals[0]
        }
        api?.attack?.(target, inv)
        api?.info?.(`石板失败：所在地点的幽灵敌人「${target.name}」攻击你（不论是否横置）。`)
      }
    }
    // 引擎在调 afterTest 前已 closeTest 恢复 state.skillTest（tests.js:354-371,412,954），
    // 所以「本次检定是否是阵法行动」必须从 result.source 读（内容层在 api.test 的 source 里
    // 显式写了 actionKind:'circle'）；state.skillTest 仅在旧测试直接调用本钩子时兜底。
    const isCircleTest = result.source?.actionKind === 'circle'
      || state.skillTest?.actionKind === 'circle'
    if (drawn.includes('elderthing') && isCircleTest) {
      if (typeof api?.haunted === 'function') api.haunted(inv.seat, { locationId: inv.location })
      api?.info?.('古神标记失败：结算你所在地点的所有闹鬼能力。')
    }
  },

  afterChaosBagSetup(state) {
    const records = recordsFor(state)
    const heretics = records.hereticsWereUnleashedUntoArkham === true ? 1
      : Number(records.hereticsWereUnleashedUntoArkham) || 0
    if (heretics > 0) {
      state.doom = (state.doom || 0) + heretics
      setFlags(state, { startingDoom: heretics })
    }
  },

  // -------------------------------------------------------------------------
  // 诡计（本章 5 张）的规则都在单卡条目：05268/05271 走 treacheryRule.test，
  // 05269/05270/05272 走 encounterResolve；章节只委托共享 encounterRules 统一分派。
  // -------------------------------------------------------------------------
  resolveEncounter(state, inv, treachery, api) {
    return encounterRules.resolveEncounter?.(state, inv, treachery, api) ?? false
  },

  // -------------------------------------------------------------------------
  // 结局
  // -------------------------------------------------------------------------
  resolution(state, key, events, api) {
    const records = recordsFor(state)
    const known = ['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10']
    if (!known.includes(key)) throw new Error(`未知聚合幻灭结局：${key}`)
    if (key === 'noResolution') return this.resolution(state, 'r5', events, api)
    if (key === 'r1') {
      const canSideWithLodge = Boolean(records.theInvestigatorsWereInductedIntoTheInnerCircle)
        && !records.theInvestigatorsAreDeceivingTheLodge
      let answer = canSideWithLodge ? 'yes' : 'no'
      if (typeof api?.choose === 'function' && canSideWithLodge) {
        answer = api.choose({
          kind: 'resolution', source: '05247', seat: state.campaign?.leadSeat ?? 0,
          prompt: '桑福德宣称他欺骗了魔鬼：你们相信他吗？',
          options: [
            { id: 'yes', label: '是的，我们忠于秘社。' },
            { id: 'no', label: '不，我们站在女巫一边。' },
          ],
        })
      }
      return this.resolution(state, answer === 'yes' ? 'r2' : 'r3', events, api)
    }
    if (key === 'r2') {
      records.theTrueWorkOfTheSilverTwilightLodgeHasBegun = true
      api?.info?.('银暮秘社的真正计划开始实行：秘社胜利（战役结束流程由 P9 接线）。')
      return { award: true, bonus: 0 }
    }
    if (key === 'r3') return recordSanfordAndConclusion(state, events, api, this)
    if (key === 'r4') return recordAnetteAndConclusion(state, events, api, this)
    if (key === 'r5') {
      const spellCast = Boolean(records.theWitchesSpellWasCast)
      const josefDisappeared = Boolean(records.josefDisappearedIntoTheMist)
      const heretics = records.hereticsWereUnleashedUntoArkham === true ? 1
        : Number(records.hereticsWereUnleashedUntoArkham) || 0
      const firstGroup = [not(spellCast), not(josefDisappeared), heretics <= 1].filter(Boolean).length
      api?.info?.(`结局 5：第一组属实 ${firstGroup} 项（法术被破坏=${!spellCast}、约瑟夫得救=${!josefDisappeared}、异端者≤1=${heretics <= 1}）。`)
      return this.resolution(state, firstGroup >= 2 ? 'r6' : 'r7', events, api)
    }
    if (key === 'r6') return recordSanfordAndConclusion(state, events, api, this)
    if (key === 'r7') return recordAnetteAndConclusion(state, events, api, this)
    if (key === 'r8') return resolution8(state, events, api, records)
    if (key === 'r9') {
      records.theCovenOfKeziahHoldsTheWorldInItsGrasp = true
      api?.info?.('女巫集会掌控世界：女巫集会胜利（战役结束流程由 P9 接线）。')
      return { award: true, bonus: 0 }
    }
    if (key === 'r10') return recordAnetteAndConclusion(state, events, api, this)
    throw new Error(`未知聚合幻灭结局：${key}`)
  },
}

// ---------------------------------------------------------------------------
// 内部函数
// ---------------------------------------------------------------------------
const not = value => !value

function idOfIsle(code) {
  const entry = Object.entries(UNVISITED_ISLES).find(([, value]) => value === code)
  return entry ? entry[0] : code
}

function spawnPrinted(state, api, code, locationId) {
  // 从「放在一边」生成：同步消耗账本（对不在 setAside 的卡是无操作）。
  takeFromSetAside(state, code)
  const card = ALL_CARDS[code] || {}
  const printed = state.scenario?.enemies?.[code] || {}
  if (typeof api?.spawnStoryEnemy === 'function') {
    return api.spawnStoryEnemy(code, locationId, {
      name: card.nameZh || card.name || code,
      fight: printed.fight ?? card.fight ?? 0, evade: printed.evade ?? card.evade ?? 0,
      health: printed.health ?? card.health ?? 1,
      damage: printed.damage ?? card.damage ?? 0, horror: printed.horror ?? card.horror ?? 0,
      hunter: Boolean(printed.hunter), alert: Boolean(printed.alert),
      retaliate: Boolean(printed.retaliate), aloof: Boolean(printed.aloof),
      traits: printed.traits || traitsOf(card),
    }, {})
  }
  return api?.spawn?.(code, locationId) || null
}

function revealGeistTrapAndGather(state, api) {
  const trap = locByCode(state, GEIST_TRAP)
  if (!trap) placeUnrevealedLocation(state, api, 'geistTrap', { lit: factionOf(state) === 'coven' })
  const target = locByCode(state, GEIST_TRAP)
  if (target && !target.revealed) api?.reveal?.(target.id)
  for (const inv of activeInvestigators(state)) {
    if (ISLE_CODES.includes(String(original(locById(state, inv.location))))) {
      if (target) {
        api?.moveInvestigator?.(inv.seat, target.id)
        if (typeof api?.moveInvestigator !== 'function') inv.location = target.id
      }
      api?.info?.(`${inv.name} 被拉进灵怪陷阱。`)
    }
  }
}

function shuffleAsideIntoDeck(state, api, codes) {
  state.scenarioZones ||= {}
  const aside = (state.scenarioZones.setAside ||= [])
  const moved = []
  for (const code of codes) {
    const index = aside.indexOf(code)
    if (index >= 0) {
      aside.splice(index, 1)
      moved.push(code)
    }
  }
  state.encounterDeck = [...(state.encounterDeck || []), ...moved, ...(state.encounterDiscard || [])]
  state.encounterDiscard = []
  if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
  api?.info?.(`银暮秘社/女巫集会的卡牌与弃牌堆一起洗入遭遇牌库。`)
}

// setAside 里剩余的[[女巫]]敌人（05057/05090/05091 等）：05243 背面按「每张剩余」洗回。
function remainingSetAsideWitchEnemies(state) {
  return (state.scenarioZones?.setAside || []).filter(code => {
    const card = ALL_CARDS[code]
    return card?.type === 'enemy'
      && (card.traits || []).some(trait => String(trait).toLowerCase() === 'witch')
  })
}

// 05246 的本地谈判：成功结算 05085b（翻转敌人面 → 移除毁灭 → 翻回并解除交战）。
// 05085 的完整长期效果属该卡自身条目（另包审计），本章只需要「谈判成功后翻面」这一可观察结果。
function flipJosef(state, josef, api) {
  if (state.scenarioFlags?.josefPlanResolved) return false
  setFlags(state, { josefPlanResolved: true })
  api?.flipEnemy?.(josef, '05085b')
  josef.doom = 0
  api?.info?.('📜 「约瑟夫的计划」：他身上的毁灭被移除。')
  api?.flipEnemy?.(josef, JOSEF_MEIGER)
  for (const inv of state.investigators || []) {
    if (Array.isArray(inv.engaged)) inv.engaged = inv.engaged.filter(id => id !== josef.id)
    if (Array.isArray(inv.threat)) inv.threat = inv.threat.filter(card => original(card) !== '05085b')
  }
  josef.engagedSeat = null
  return true
}

function dealFateCards(state, api) {
  const cards = state.scenarioFlags?.fateCards || []
  const investigators = [...activeInvestigators(state)].sort((left, right) => left.seat - right.seat)
  if (!cards.length || !investigators.length) return
  // 参考实现：洗混冒险参考牌底的命运卡，按玩家顺序随机发放，直到发完；随后按玩家顺序结算每张。
  const shuffled = typeof api?.shuffle === 'function' ? api.shuffle(cards) : [...cards]
  const dealt = investigators.map(() => [])
  for (const [index, fate] of shuffled.entries()) {
    dealt[index % investigators.length].push(fate)
  }
  for (const [index, inv] of investigators.entries()) {
    for (const fate of dealt[index]) resolveFate(state, api, fate, inv)
  }
}

function findWhippoorwill(state) {
  const zones = ['encounterDeck', 'encounterDiscard']
  for (const zone of zones) {
    const list = state[zone] || []
    for (const [index, code] of list.entries()) {
      if (code === WHIPPOORWILL) return { zone, index, code }
    }
  }
  return null
}

// 地点间最短步数（BFS；不可达返回 Infinity）。卡面「最近的夜鹰」按连接距离计算。
function hopDistance(state, fromId, toId) {
  if (!fromId || !toId) return Infinity
  if (fromId === toId) return 0
  const seen = new Set([toId])
  const queue = [[toId, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    const location = (state.locations || []).find(entry => entry.id === id)
    for (const next of location?.connections || []) {
      if (next === fromId) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Infinity
}

function removeEncounterCard(state, found) {
  if (!found) return
  const list = state[found.zone] || []
  const index = list.indexOf(found.code)
  if (index >= 0) list.splice(index, 1)
}

function apiSafeInfo(state, text) {
  state.scenarioFlags ||= {}
  state.scenarioFlags._log ||= []
  state.scenarioFlags._log.push(text)
}

function apiSafeLoseAction(state, inv) {
  if (state.phase === 'investigation') inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - 1)
  else {
    inv.pendingActionLoss ||= {}
    inv.pendingActionLoss[state.round] = (inv.pendingActionLoss[state.round] || 0) + 1
  }
  state.scenarioFlags ||= {}
  state.scenarioFlags._log ||= []
  state.scenarioFlags._log.push('苔藓阶梯：下一次移动额外花费 1 个行动。')
}

function recordSanfordAndConclusion(state, events, api, behaviorObject) {
  recordsFor(state).carlSanfordPossessesTheSecretsOfTheUniverse = true
  api?.info?.('记录：卡尔·桑福德知晓了宇宙之秘。转至结局 8。')
  return behaviorObject.resolution(state, 'r8', events, api)
}

function recordAnetteAndConclusion(state, events, api, behaviorObject) {
  recordsFor(state).anetteMasonIsPossessedByEvil = true
  api?.info?.('记录：安妮特·梅森被魔鬼附身。转至结局 8。')
  return behaviorObject.resolution(state, 'r8', events, api)
}

function resolution8(state, events, api, records) {
  // 移除机关盒：R8 结算属于本关结局，引擎 api 只有 campaignCardChange。
  const removeCard = (seat, code) => {
    const record = state.campaign?.investigators?.[seat]
    if (!record) return
    if (Array.isArray(record.deck) && record.deck.includes(code)) {
      record.deck = record.deck.filter(item => item !== code)
    }
  }
  for (const inv of state.investigators) removeCard(inv.seat, '05228')
  // 失踪者：还活着 → 任选一位调查员把剧情支援加入牌库；否则记录死亡。
  for (const fate of FATE_LIST) {
    const alive = Boolean(records[fate.alive])
    if (!alive) {
      records[fate.dead] = true
      api?.info?.(`记录：${fate.name}已死亡。`)
      continue
    }
    const candidates = activeInvestigators(state).filter(inv => state.campaign?.investigators?.[inv.seat])
    if (!candidates.length) continue
    let seat = candidates[0].seat
    if (candidates.length > 1 && typeof api?.choose === 'function') {
      const answer = api.choose({
        kind: 'investigator', source: '05265', seat: state.campaign?.leadSeat ?? 0,
        prompt: `选择将「${ALL_CARDS[fate.ally]?.nameZh || fate.name}」剧情支援加入牌库的调查员。`,
        options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
      })
      seat = candidates.some(inv => inv.seat === Number(answer)) ? Number(answer) : seat
    }
    campaignCardChange(state.campaign, seat, fate.ally, 'add', state.scenario.id)
    api?.info?.(`${fate.name}还活着：其剧情支援加入调查员 ${seat + 1} 的牌库（不计入 30 张）。`)
  }
  api?.info?.('结局 8：结算失踪者与经验值（XP 未实现，见 gaps）。')
  return { award: true, bonus: 0 }
}
