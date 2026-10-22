import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules } from '../../encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { assetRuleFor } from '../../../../../src/cards/card-rules.js'
import {
  CARD_CODES, HALLS_SLOTS, OBSERVER_CODE, REMEMBERED_TASKS, ROOM_CODES, ROOM_SLOTS,
  SET_ASIDE_LOCATIONS, TASK_LABELS, isItemAsset,
} from './definition.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const flagsFor = state => (state.scenarioFlags ||= {})
const rememberedFor = state => (flagsFor(state).remembered ||= {})
const isRemembered = (state, key) => !!rememberedFor(state)[key]
const traitsOf = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
const hasTrait = (card, trait) => traitsOf(card)
  .some(value => String(value).toLowerCase() === String(trait).toLowerCase())
const isYithian = card => hasTrait(card, 'Yithian') || card?.yithianTrait === true
const threatWith = (inv, code) => (inv.threat || []).find(card => original(card) === code)
const hardSide = state => ['hard', 'expert'].includes(state.difficulty)
// 第 114 轮：换身时被放到一边的剧情资产（04051 亚历山卓·维拉）由条目 assetRule 声明。
const setAsideOnBodySwap = code => assetRuleFor(code)?.setAsideOnBodySwap === true
const handLimitBase = 8

// 已经逐条实现印刷效果的本章遭遇卡原卡号（近似或未实现的不要列进来，
// 未覆盖的分支写在迁移审计的 gap 列表里）。
// 04259 的「猎物 - 手牌最多」与 04261 的「不能进行抽取行动」已补上引擎钩子
// （PREY_RANK.mostHand / drawBlocked），因此现在是逐条实现而不是近似。
export const implementedEncounterCodes = [
  '01163', '01164', '01165', '01167', '01168', '01174', '01177', '01178', // 核心遭遇卡：由共享解析器处理
  '04257', '04258', '04259', '04260', '04261', '04262', '04263',
]

function campaignRecord(state, seat) {
  const list = state.campaign?.investigators
  return Array.isArray(list) ? list[seat] : list?.[seat]
}

function mix(state, helper, list) {
  if (helper?.shuffle && helper?.randomValue) {
    return helper.shuffle([...list], () => helper.randomValue(state))
  }
  if (typeof helper?.random === 'function') {
    const copy = [...list]
    for (let index = copy.length - 1; index > 0; index--) {
      const target = Math.floor(helper.random() * (index + 1))
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
    }
    return copy
  }
  return [...list]
}

// 所有洗牌都走 api.random()，保证同种子结果一致。
function shuffled(api, list) {
  const copy = [...list]
  if (typeof api?.random !== 'function') return copy
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(api.random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

function pickRandom(api, list) {
  if (!list.length) return null
  if (list.length === 1) return list[0]
  const value = typeof api?.random === 'function' ? api.random() : 0
  return list[Math.min(list.length - 1, Math.floor(value * list.length))]
}

function locationForCode(state, code) {
  const definition = Object.values(state.scenario.locations)
    .find(entry => original(entry) === code)
  if (!definition) throw new Error(`天机之城：未知会谈间卡面 ${code}`)
  return definition
}

// 会谈间三张卡面在布置时换位：运行期用 locationVariants 覆盖槽位的印刷身份。
function roomVariant(state, slot, code) {
  const base = structuredClone(locationForCode(state, code))
  return { ...base, id: slot }
}

export function remember(state, key, api) {
  const remembered = rememberedFor(state)
  if (remembered[key]) return false
  remembered[key] = true
  api?.info?.(`📝 记住：${TASK_LABELS[key] || key}。`)
  return true
}

// 场景 2b 的六项条件：5 项「记住」任务 + 控制看管人。
export function controlledCustodian(state) {
  for (const inv of state.investigators) {
    const asset = (inv.assets || []).find(item => original(item) === CARD_CODES.custodian)
    if (asset) return { inv, asset }
  }
  return null
}

function uncontrolledCustodian(state) {
  return (state.storyAssets || []).find(asset => original(asset) === CARD_CODES.custodian
    && asset.controllerSeat == null)
}

export function completedTasks(state) {
  const remembered = REMEMBERED_TASKS.filter(key => isRemembered(state, key)).length
  return remembered + (controlledCustodian(state) ? 1 : 0)
}

// 手牌上限：密谋 2a/3a 减少，太阳系仪 +2，带挂坠的调查员忽略减少。
// 引擎的 getHandSize 没有剧本钩子，因此这里的结果只用于本章自己的
// 抽牌加成与界面提示（见 gap 列表）。
export function handLimit(state, inv) {
  let reduction = state.agendaIndex === 1 ? 2 : state.agendaIndex >= 2 ? 4 : 0
  if (inv.ignoreHandSizeReduction) reduction = 0
  let limit = handLimitBase - reduction
  if (original(here(state, inv)) === CARD_CODES.yithianOrrery) limit += 2
  return Math.max(1, limit)
}

function yithianEnemyAt(state, locationId) {
  return state.enemies.some(enemy => enemy.location === locationId && isYithian(enemy))
}

// 伊斯观测者、监守人、科学家三张卡的关键词随场景/任务进度变化。
function refreshYithianEnemy(state, enemy) {
  const code = original(enemy)
  if (code === OBSERVER_CODE) {
    const act = original(state.acts?.[state.actIndex])
    if (act === CARD_CODES.act1) {
      enemy.aloof = true
    } else if (act === CARD_CODES.act3) {
      enemy.aloof = false
      enemy.hunter = true
    }
    return
  }
  if (code === CARD_CODES.keeper) {
    if (isRemembered(state, 'foundTheProcess') || isRemembered(state, 'realizedWhatYearItIs')) {
      enemy.aloof = false
      enemy.hunter = true
    }
    return
  }
  if (code === CARD_CODES.scientist) {
    if (isRemembered(state, 'activatedTheDevice') || isRemembered(state, 'dissectedAnOrgan')) {
      enemy.aloof = false
      enemy.hunter = true
    }
  }
}

function refreshYithianEnemies(state) {
  for (const enemy of state.enemies) refreshYithianEnemy(state, enemy)
}

function groupCluesAt(state, locationId) {
  return state.locations.find(location => location.id === locationId)?.clues || 0
}

function discardThreat(state, inv, threat) {
  const index = (inv.threat || []).indexOf(threat)
  if (index >= 0) inv.threat.splice(index, 1)
  state.encounterDiscard ||= []
  state.encounterDiscard.push(original(threat))
}

function removeTopOfDeckFromGame(state, inv) {
  if (!(inv.deck || []).length) return null
  const code = inv.deck.pop()
  state.removedFromGame ||= []
  state.removedFromGame.push(code)
  return code
}

export function setupPlan(state, helper = {}) {
  const cooperated = !!recordsFor(state).theInvestigatorsCooperatedWithTheYithians
  const first = cooperated ? ROOM_CODES.arrival : ROOM_CODES.restraining
  const others = cooperated
    ? [ROOM_CODES.restraining, ROOM_CODES.ichor]
    : [ROOM_CODES.arrival, ROOM_CODES.ichor]
  const order = mix(state, helper, others)
  return {
    cooperated,
    rooms: {
      interviewRoom1: first,
      interviewRoom2: order[0],
      interviewRoom3: order[1],
    },
  }
}

export const behavior = {
  ...encounterRules,
  id: 'theCityOfArchives',
  // 本章所有地点入场时都按「已揭示」面入场（规则书默认），布置即带线索。
  locationsStartRevealed: true,

  setupPlan,

  // P2 引擎钩子：整理阶段的手牌上限（getHandSize）与本章的 handLimit 合并。
  // 卡面：04239「失去的记忆」-2、04240「遗忘人类身份」-4、04252 太阳系仪 +2、
  // 带挂坠者忽略减少。返回增减值，基础值仍由引擎的 8 张决定。
  handSizeModifier(state, inv) {
    return handLimit(state, inv) - handLimitBase
  },

  // 04238 伟大种族之城：冒险 1 期间不能将[[道具]]支援放置入场（含直接放置与弱点）。
  canPlaceAsset(state, inv, code) {
    if (state.agendaIndex !== 0) return true
    const def = ALL_CARDS[code]
    if (!def || def.type !== 'asset') return true
    const item = (def.traits || []).some(trait => ['Item', '道具'].includes(String(trait)))
    return !item
  },

  // 04244 伊斯人身体：你的每个[[盟友]]支援获得[[伊斯]]特性。
  assetEntered(state, inv, asset) {
    if (!inv?.yithianBody) return
    const traits = ALL_CARDS[asset?.code]?.traits || asset?.traits || []
    if (traits.some(trait => ['Ally', '盟友'].includes(String(trait)))) asset.yithianTrait = true
  },

  // 04244 的旧印：+2，抽 1 张牌（引擎在揭示旧印时读这个钩子）。
  elderSign(state, inv) {
    if (!flagsFor(state).yithianBody) return null
    if (!inv?.yithianBody) return null
    return { delta: 2, draw: 1 }
  },

  // 剧情前步骤：写入合作/反抗记录、把调查员换成伊斯人身体、
  // 并把独特[[道具]]与亚历山卓·维拉移出牌组（Haskell: beforeDrawingOpeningHands*）。
  preScenarioSetup(state, events, api = {}) {
    const records = recordsFor(state)
    flagsFor(state)
    if (!records.theInvestigatorsCooperatedWithTheYithians
      && !records.theInvestigatorsResistedCaptivity) {
      const answer = api.choose?.({
        kind: 'story',
        source: CARD_CODES.scenario,
        seat: state.campaign?.leadSeat ?? state.currentSeat ?? 0,
        prompt: '伊斯人抓住了你们。你们选择与它们合作，还是反抗到底？',
        options: [
          { id: 'cooperate', label: '合作：配合伊斯人研究人类，换取回到自己身体的承诺' },
          { id: 'resist', label: '反抗：拒绝配合，试着从天机之城逃出去' },
        ],
      })
      if (answer === 'cooperate') records.theInvestigatorsCooperatedWithTheYithians = true
      else records.theInvestigatorsResistedCaptivity = true
    }
    flagsFor(state).yithianBody = true
    flagsFor(state).removedCards = []
    flagsFor(state).setAsideCards = []
    for (const inv of state.investigators) {
      inv.yithianBody = true
      // 04244 伊斯人身体：印刷属性 意志2/智识2/战斗2/敏捷2，生命 7。
      // prepareInvestigator 每场冒险都会按调查员卡重建，所以这里直接覆盖即可，
      // 不需要在结算时恢复；旧值只用于日志。
      flagsFor(state).yithianBodyOriginals ||= {}
      // 04244 伊斯人身体：印刷属性 意志2/智识2/战斗2/敏捷2，生命 7、神智 7。
      flagsFor(state).yithianBodyOriginals[inv.seat] = {
        willpower: inv.willpower, intellect: inv.intellect, combat: inv.combat, agility: inv.agility,
        maxHealth: inv.maxHealth, baseHealth: inv.baseHealth,
        maxSanity: inv.maxSanity, baseSanity: inv.baseSanity,
      }
      inv.willpower = 2
      inv.intellect = 2
      inv.combat = 2
      inv.agility = 2
      inv.maxHealth = 7
      inv.baseHealth = 7
      inv.maxSanity = 7
      inv.baseSanity = 7
      // 已在场的盟友也要获得伊斯特性（不只是之后入场的）。
      for (const asset of inv.assets || []) {
        const traits = ALL_CARDS[asset?.code]?.traits || asset?.traits || []
        if (traits.some(trait => ['Ally', '盟友'].includes(String(trait)))) asset.yithianTrait = true
      }
      api.info?.(`🧠 ${inv.name} 换上了伊斯人身体：四属性 2，生命 7，神智 7。`)
      for (const zone of ['deck', 'hand', 'discard']) {
        const kept = []
        for (const code of inv[zone] || []) {
          if (isItemAsset(code) && ALL_CARDS[code]?.unique) {
            flagsFor(state).removedCards.push(code)
            continue
          }
          if (setAsideOnBodySwap(code)) {
            flagsFor(state).setAsideCards.push(code)
            continue
          }
          kept.push(code)
        }
        inv[zone] = kept
      }
      const record = campaignRecord(state, inv.seat)
      if (record?.deck) {
        record.deck = record.deck.filter(code => {
          if (isItemAsset(code) && ALL_CARDS[code]?.unique) {
            flagsFor(state).removedCards.push(code)
            return false
          }
          if (setAsideOnBodySwap(code)) {
            flagsFor(state).setAsideCards.push(code)
            return false
          }
          return true
        })
      }
    }
    flagsFor(state).preScenarioComplete = true
    return { cooperated: !!records.theInvestigatorsCooperatedWithTheYithians }
  },

  setupLocations(state, events, helper = {}) {
    if (!flagsFor(state).preScenarioComplete) behavior.preScenarioSetup(state, events, helper)
    const plan = setupPlan(state, helper)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      CARD_CODES.custodian,
      CARD_CODES.outOfBodyExperience, CARD_CODES.outOfBodyExperience,
      CARD_CODES.outOfBodyExperience, CARD_CODES.outOfBodyExperience,
    ]
    state.scenarioZones.removed = []
    flagsFor(state).rooms = { ...plan.rooms }
    flagsFor(state).remembered = {}
    state.locationVariants ||= {}
    for (const slot of ROOM_SLOTS) {
      state.locationVariants[slot] = roomVariant(state, slot, plan.rooms[slot])
    }
    return [...ROOM_SLOTS, ...HALLS_SLOTS]
  },

  setupEnemies(state, events, helper = {}) {
    // 合作：观测者在 1 号会谈间看管你们；反抗：它被直接放进胜利区。
    const cooperated = !!recordsFor(state).theInvestigatorsCooperatedWithTheYithians
    const room = state.locations.find(location => location.id === 'interviewRoom1')
    if (cooperated && room) {
      helper.spawnEnemy?.(state, OBSERVER_CODE, 'interviewRoom1', null)
      flagsFor(state).observerInPlay = true
      helper.info?.(state, events, '👁️ 伊斯观测者在 1 号会谈间看着你们。')
      return
    }
    state.victoryDisplay ||= []
    if (!state.victoryDisplay.some(card => original(card) === OBSERVER_CODE)) {
      state.victoryDisplay.push({
        id: 'yithianObserver-victory', code: OBSERVER_CODE, originalCode: OBSERVER_CODE, victory: 1,
      })
    }
    flagsFor(state).observerInPlay = false
    helper.info?.(state, events, '👁️ 你们打晕了看守，伊斯观测者被放进胜利区。')
  },

  // 无论哪条分支，都有一张伊斯观测者不在遭遇牌库中。
  modifyDeck(state, deck) {
    const index = deck.indexOf(OBSERVER_CODE)
    if (index >= 0) deck.splice(index, 1)
    return deck
  },

  afterDeckSetup(state, events, helper = {}) {
    const rooms = flagsFor(state).rooms || {}
    const names = ROOM_SLOTS.map(slot => `${slot}=${ALL_CARDS[rooms[slot]]?.nameZh || rooms[slot]}`)
    helper.info?.(state, events, `🏛️ 会谈间布置：${names.join('、')}。`)
  },

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken('theCityOfArchives', state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    // 困难/专家面的符号修正统一放在 tfa-chaos.js 的共享表里（cultist/elderthing
    // 成功也放线索、tablet 按失败差额弃牌），这里不再重复结算一次。
    tfaChaosAfterTest('theCityOfArchives', state, inv, result, api)
    encounterRules.afterTest?.(state, inv, result, api)
  },

  // 密谋 1a：调查员不能将[[道具]]支援放置入场。
  canPlayCard(state, inv, card) {
    if (encounterRules.canPlayCard?.(state, inv, card) === false) return false
    if (state.agendaIndex === 0 && isItemAsset(original(card))) return false
    return true
  },

  // 「伊斯人登场」：所在地点有[[伊斯]]敌人时不能调查该地点。
  investigationError(state, inv, location) {
    if (!threatWith(inv, CARD_CODES.yithianPresence)) return null
    if (!yithianEnemyAt(state, location?.id || inv.location)) return null
    return '「伊斯人登场」：所在地点有伊斯敌人，你不能调查该地点'
  },

  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    const code = original(location)
    // 拘束室：讯问被囚禁的意识。
    if (code === ROOM_CODES.restraining) {
      moves.push({
        action: 'scenarioAction', rule: 'interrogateSubject',
        label: '🗣️ 谈判：检定智识(4)或战斗(4)讯问被囚禁的意识',
      })
    }
    // 纳克特廊道：免费弃 1 张手牌换位置（每回合一次）。
    if (location && HALLS_SLOTS.includes(location.id)) {
      const others = HALLS_SLOTS.filter(id => id !== location.id
        && state.locations.some(entry => entry.id === id))
      if (others.length && inv.tfaHallsShortcutRound !== state.round) {
        moves.push({
          action: 'scenarioAction', rule: 'hallsShortcut', actions: 0,
          label: '🚪 免费：弃 1 张手牌，移动到另一处纳克特廊道（每回合一次）',
          reason: (inv.hand || []).length ? null : '需要先有 1 张手牌可弃（手牌已空）',
        })
      }
    }
    // 大图书馆：共同花费 1 线索/人，破译归位程式。
    if (code === CARD_CODES.greatLibrary) {
      const pooled = groupCluesAt(state, location.id)
      moves.push({
        action: 'scenarioAction', rule: 'decipherProcess',
        label: `📖 花费${state.numInvestigators}个线索：检定智识(3)破译归位程式`,
        reason: pooled >= state.numInvestigators ? null
          : `需要共同支付 ${state.numInvestigators} 个线索（当前 ${pooled}）`,
      })
    }
    // 伊斯的太阳系仪：两个行动 + 无线索。
    if (code === CARD_CODES.yithianOrrery) {
      const clues = location.clues || 0
      moves.push({
        action: 'scenarioAction', rule: 'realizeTheYear', actions: 2,
        label: '🪐 两个行动：记住现在的地球年份',
        reason: clues === 0 ? null : `需要先取走此地点上的线索（还有 ${clues} 个）`,
      })
    }
    // 伟大种族的实验室：无线索时操纵设备。
    if (code === CARD_CODES.laboratory) {
      const clues = location.clues || 0
      moves.push({
        action: 'scenarioAction', rule: 'activateDevice',
        label: '⚙️ 检定敏捷(3)操纵先进设备',
        reason: clues === 0 ? null : `需要先取走此地点上的线索（还有 ${clues} 个）`,
      })
    }
    // 解构室：难度随线索数上升。
    if (code === CARD_CODES.deconstructionRoom) {
      moves.push({
        action: 'scenarioAction', rule: 'dissectOrgan',
        label: `🔪 检定战斗(${4 + (location.clues || 0)})解剖怪物尸体`,
      })
    }
    // 纳克特之塔：弃任意张手牌后洗弃牌堆并抽回（每回合一次）。
    if (code === CARD_CODES.towersOfPnakotus && inv.tfaTowersRound !== state.round) {
      moves.push({
        action: 'scenarioAction', rule: 'towersOfPnakotus',
        label: '🗼 弃任意张手牌，把弃牌堆洗回牌库并抽「弃牌数+1」张（每回合一次）',
      })
    }
    // 回归自我：花 1 个线索执行抽取行动（手牌超上限再 +1）。
    if (original(state.acts?.[state.actIndex]) === CARD_CODES.act3) {
      const clues = inv.clues || 0
      moves.push({
        action: 'scenarioAction', rule: 'repossessionDraw',
        label: '🃏 花费1个线索：抽取 2 张卡牌（手牌超出上限改为 3 张）',
        reason: clues > 0 ? null : '需要花费 1 个线索（当前 0 个）',
      })
    }
    // 看管人：无人控制时的谈判。
    const custodian = uncontrolledCustodian(state)
    if (custodian && custodian.location === inv.location) {
      moves.push({
        action: 'scenarioAction', rule: 'parleyCustodian',
        label: '🗣️ 谈判：检定智识(3)与图书馆看管人交涉',
      })
    }
    // 伊斯学者：与其交战时可以谈判（假扮伟大种族）。
    const scholar = state.enemies.find(enemy => original(enemy) === CARD_CODES.scholar
      && enemy.engagedSeat === inv.seat)
    if (scholar) {
      moves.push({
        action: 'scenarioAction', rule: 'parleyScholar', enemyId: scholar.id,
        label: '🗣️ 谈判：检定智识(3)假扮伟大种族（成功抽 1 张并躲避）',
        reason: scholar.exhausted ? '伊斯学者已横置，需要先让它重整' : null,
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    const location = here(state, inv)
    if (move.rule === 'interrogateSubject') {
      // 卡面允许智识(4)或战斗(4)：让玩家选一项。
      const skill = api.choose?.({
        kind: 'skill', source: ROOM_CODES.restraining, seat: inv.seat,
        prompt: '选择用于讯问的技能。',
        options: [{ id: 'intellect', label: '智识(4)' }, { id: 'combat', label: '战斗(4)' }],
      }) === 'combat' ? 'combat' : 'intellect'
      api.test(inv.seat, skill, 4, result => {
        if (result.success) remember(state, 'interviewedASubject', api)
        else api.horror(inv.seat, 2)
      }, 0, { type: 'scenario', name: '讯问被囚禁的意识', ability: true })
      return
    }
    if (move.rule === 'hallsShortcut') {
      const others = HALLS_SLOTS.filter(id => id !== location?.id
        && state.locations.some(entry => entry.id === id))
      if (!others.length || !(inv.hand || []).length) return
      const destination = others.length === 1 ? others[0] : api.choose({
        kind: 'location', source: '04248', seat: inv.seat,
        prompt: '选择另一处纳克特廊道。',
        options: others.map(id => ({ id, label: state.locations.find(entry => entry.id === id)?.name || id })),
      })
      if (!others.includes(destination)) return
      api.discardChosen?.(inv.seat, 1, '04248')
      inv.tfaHallsShortcutRound = state.round
      api.moveInvestigator(inv.seat, destination)
      return
    }
    if (move.rule === 'decipherProcess') {
      if (!location || groupCluesAt(state, location.id) < state.numInvestigators) {
        api.info?.('大图书馆的线索不足。')
        return
      }
      api.payClues(state.numInvestigators, location.id)
      api.test(inv.seat, 'intellect', 3, result => {
        if (result.success) remember(state, 'foundTheProcess', api)
      }, 0, { type: 'scenario', name: '破译归位程式', ability: true })
      return
    }
    if (move.rule === 'realizeTheYear') {
      remember(state, 'realizedWhatYearItIs', api)
      return
    }
    if (move.rule === 'activateDevice') {
      api.test(inv.seat, 'agility', 3, result => {
        if (result.success) {
          remember(state, 'activatedTheDevice', api)
          return
        }
        if (location) location.clues = (location.clues || 0) + 1
        api.info?.('设备失控：伟大种族的实验室增加了 1 个线索。')
      }, 0, { type: 'scenario', name: '操纵先进设备', ability: true })
      return
    }
    if (move.rule === 'dissectOrgan') {
      const difficulty = 4 + (location?.clues || 0)
      api.test(inv.seat, 'combat', difficulty, result => {
        if (result.success) remember(state, 'dissectedAnOrgan', api)
      }, 0, { type: 'scenario', name: '解剖怪物尸体', ability: true })
      return
    }
    if (move.rule === 'towersOfPnakotus') {
      const discardable = (inv.hand || []).filter(code => !isWeaknessCardCode(code)).length
      const amount = discardable === 0 ? 0 : Number(api.choose?.({
        kind: 'amount', source: CARD_CODES.towersOfPnakotus, seat: inv.seat,
        prompt: '选择弃掉的手牌数量（抽「弃牌数+1」张）。',
        options: Array.from({ length: discardable + 1 }, (_, count) => ({
          id: String(count), label: `${count} 张`,
        })),
      }) || 0)
      const paid = Math.max(0, Math.min(discardable, amount))
      if (paid) api.discardChosen?.(inv.seat, paid, CARD_CODES.towersOfPnakotus)
      inv.deck = shuffled(api, [...(inv.deck || []), ...(inv.discard || [])])
      inv.discard = []
      inv.tfaTowersRound = state.round
      api.drawCards(inv.seat, paid + 1)
      return
    }
    if (move.rule === 'repossessionDraw') {
      if ((inv.clues || 0) < 1) {
        api.info?.('回归自我：没有线索可花。')
        return
      }
      api.spendClues(inv.seat, 1)
      // 先抽 2 张，再按抽完后的手牌判断是否超上限，超了再抽 1 张。
      api.drawCards(inv.seat, 2)
      if ((inv.hand || []).length > handLimit(state, inv)) api.drawCards(inv.seat, 1)
      return
    }
    if (move.rule === 'parleyCustodian') {
      const asset = uncontrolledCustodian(state)
      if (!asset) return
      api.test(inv.seat, 'intellect', 3, result => {
        if (!result.success) {
          api.info?.('看管人没有理会你。')
          return
        }
        // 卡面：先把你自己的 1 个线索放到看管人上，放满 1[per_investigator] 才取得控制。
        if ((inv.clues || 0) < 1) {
          api.info?.('你没有线索可以放在看管人身上。')
          return
        }
        api.spendClues(inv.seat, 1)
        asset.clues = (asset.clues || 0) + 1
        if ((asset.clues || 0) >= state.numInvestigators) {
          const index = state.storyAssets.indexOf(asset)
          if (index >= 0) state.storyAssets.splice(index, 1)
          delete asset.location
          asset.controllerSeat = inv.seat
          inv.assets.push(asset)
          api.info?.(`🤝 ${inv.name} 取得「看管人」的控制权。`)
        }
      }, 0, { type: 'scenario', name: '与看管人交涉', ability: true })
      return
    }
    if (move.rule === 'parleyScholar') {
      const enemy = state.enemies.find(entry => entry.id === move.enemyId)
      if (!enemy) return
      api.test(inv.seat, 'intellect', 3, result => {
        if (result.success) {
          api.drawCards(inv.seat, 1)
          api.evadeEnemy?.(enemy)
          return
        }
        api.attack(enemy, inv)
      }, 0, { type: 'parley', name: '假扮伟大种族', ability: true })
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知天机之城行动：${move.rule}`)
  },

  encounterActions(state, inv) {
    const moves = [...(encounterRules.encounterActions?.(state, inv) || [])]
    // 「伊斯人登场」：有伊斯敌人时不能触发遭遇卡上的行动能力。
    if (threatWith(inv, CARD_CODES.yithianPresence) && yithianEnemyAt(state, inv.location)) return moves
    for (const threat of inv.threat || []) {
      const code = original(threat)
      if (code === CARD_CODES.yithianPresence) {
        const hand = (inv.hand || []).length
        moves.push({
          action: 'encounterAction', rule: 'endYithianPresence', threatId: threat.id, actions: 1,
          label: '♻️ 弃 2 张手牌以弃掉「伊斯人登场」',
          reason: hand >= 2 ? null : `需要弃 2 张手牌（当前 ${hand} 张）`,
        })
      }
      if (code === CARD_CODES.cruelInterrogations) {
        moves.push({
          action: 'encounterAction', rule: 'endCruelInterrogations', threatId: threat.id, actions: 1,
          label: '♻️ 检定意志(2)弃掉「残酷拷问」',
        })
      }
    }
    return moves
  },

  performEncounterAction(state, inv, move, api) {
    if (move.rule === 'endYithianPresence') {
      const threat = (inv.threat || []).find(card => card.id === move.threatId)
      if (!threat || (inv.hand || []).length < 2) return false
      api.discardChosen(inv.seat, 2, CARD_CODES.yithianPresence)
      discardThreat(state, inv, threat)
      return true
    }
    if (move.rule === 'endCruelInterrogations') {
      const threat = (inv.threat || []).find(card => card.id === move.threatId)
      if (!threat) return false
      api.test(inv.seat, 'willpower', 2, result => {
        if (result.success) discardThreat(state, inv, threat)
      }, 0, { type: 'encounter', name: '残酷拷问', ability: true })
      return true
    }
    return encounterRules.performEncounterAction?.(state, inv, move, api) || false
  },

  resolveEncounter(state, inv, t, api) {
    const code = original(t)
    if (code === CARD_CODES.yithianPresence) {
      // 卡面没有「不能重复附属」：同名威胁再抽到就再放一张，不再白送一张遭遇。
      api.threat(inv.seat, code)
      api.info?.('「伊斯人登场」进入你的威胁区域。')
      return true
    }
    if (code === CARD_CODES.cruelInterrogations) {
      const interviewed = isRemembered(state, 'interviewedASubject')
      api.threat(inv.seat, code)
      api.info?.('「残酷拷问」进入你的威胁区域。')
      if (interviewed) {
        api.horror(inv.seat, 1)
        api.drawEncounter?.(inv.seat)
        return { placed: true, surgeHandled: true }
      }
      return true
    }
    if (code === CARD_CODES.lostHumanity) {
      api.test(inv.seat, 'willpower', 5, result => {
        const failedBy = result.success ? 0 : Math.max(0, 5 - (result.value || 0))
        for (let index = 0; index < failedBy; index++) removeTopOfDeckFromGame(state, inv)
        const total = (inv.hand || []).length + (inv.deck || []).length + (inv.discard || []).length
        if (total < 10) {
          api.info?.(`💀 ${inv.name} 的手牌、牌库与弃牌堆合计不足 10 张，发疯了。`)
          api.defeat(inv, 'madness')
        }
      })
      return false
    }
    if (code === CARD_CODES.captiveMind) {
      api.test(inv.seat, 'willpower', 0, result => {
        const keep = Math.max(0, Number(result.value) || 0)
        const excess = Math.max(0, (inv.hand || []).length - keep)
        if (excess) api.discardChosen(inv.seat, excess, CARD_CODES.captiveMind)
      })
      return false
    }
    return encounterRules.resolveEncounter(state, inv, t, api)
  },

  actReveal(state, act, api) {
    const code = original(act)
    if (code === CARD_CODES.act1) {
      const placed = []
      for (const id of SET_ASIDE_LOCATIONS) {
        if (state.locations.some(location => location.id === id)) continue
        api.place(id)
        placed.push(id)
      }
      const pool = placed.length ? placed : [...SET_ASIDE_LOCATIONS]
      const spawnAt = pickRandom(api, pool)
      if (spawnAt) api.storyAsset(CARD_CODES.custodian, spawnAt)
      // 1b 的注意：伊斯观测者不再具有冷漠。
      for (const enemy of state.enemies.filter(entry => original(entry) === OBSERVER_CODE)) {
        enemy.aloof = false
      }
      return
    }
    if (code === CARD_CODES.act2) {
      // 2b：本卡放进胜利区作为提醒（任务清单）。
      state.victoryDisplay ||= []
      if (!state.victoryDisplay.some(card => original(card) === CARD_CODES.act2)) {
        state.victoryDisplay.push({
          id: 'act2', code: CARD_CODES.act2, originalCode: CARD_CODES.act2, victory: 0,
        })
      }
      return
    }
    if (code === CARD_CODES.act3) {
      for (const enemy of state.enemies.filter(entry => original(entry) === OBSERVER_CODE)) {
        enemy.aloof = false
        enemy.hunter = true
      }
      // 3b：（→ 结局 1）
      api.finish('r1')
      return
    }
    throw new Error(`未知天机之城场景：${code}`)
  },

  agendaReveal(state, agenda, api) {
    const code = original(agenda)
    if (code === CARD_CODES.agenda1) {
      for (const inv of active(state)) searchDeckForItems(state, inv, api)
      api.shuffleDiscard()
      moveCustodian(state, api)
      return
    }
    if (code === CARD_CODES.agenda2) {
      api.shuffleDiscard()
      moveCustodian(state, api)
      for (const inv of active(state)) {
        if (api.hasSupply?.(inv.seat, 'pendant') ?? api.checkSupplies?.(inv.seat, 'pendant')) {
          inv.ignoreHandSizeReduction = true
          api.drawCards(inv.seat, 2)
          api.info?.(`📿 ${inv.name} 带着挂坠，记起了自己是谁：抽取 2 张牌，本场冒险忽略手牌上限减少。`)
        }
      }
      return
    }
    if (code === CARD_CODES.agenda3) {
      // 3b：幸存的每位调查员被击败（全灭后由引擎结算 noResolution）。
      for (const inv of active(state)) api.defeat(inv, null)
      return
    }
    throw new Error(`未知天机之城密谋：${code}`)
  },

  checkObjectives(state, api) {
    refreshYithianEnemies(state)
    const act = original(state.acts?.[state.actIndex])
    if (act === CARD_CODES.act2) {
      // 禁止通行：六项条件中满足三项即可推进。
      if (completedTasks(state) >= 3) api.advanceAct()
      return
    }
    if (act === CARD_CODES.act3) {
      // 回归自我：幸存调查员人手 10 张手牌时立即推进。
      const survivors = active(state)
      if (survivors.length && survivors.every(inv => (inv.hand || []).length >= 10)) {
        api.advanceAct()
      }
    }
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    refreshYithianEnemies(state)
    // 大图书馆：轮末线索不足 4 个时补足。
    const library = state.locations.find(location => original(location) === CARD_CODES.greatLibrary)
    if (library && (library.clues || 0) < 4) {
      library.clues = 4
      api.info?.('📚 大图书馆补足到 4 个线索。')
    }
  },

  // 04256 的「调查阶段开始时」：由引擎 phaseBegan 钩子精确触发（不再借用回合开始）。
  phaseBegan(state, phase, api) {
    if (phase !== 'investigation') return
    const controlled = controlledCustodian(state)
    if (!controlled) return
    const flags = flagsFor(state)
    if (flags.custodianRound === state.round) return
    flags.custodianRound = state.round
    const at = controlled.asset.location || controlled.inv.location
    for (const target of active(state).filter(entry => entry.location === at)) {
      api.drawCards(target.seat, 1)
    }
  },

  turnBegins(state, inv, api) {
    encounterRules.turnBegins?.(state, inv, api)
    const location = here(state, inv)
    // 会谈间（到达厅）：[reaction] 本地点有[[伊斯]]敌人时抽 1 张——可选，必须询问。
    if (original(location) === ROOM_CODES.arrival && yithianEnemyAt(state, inv.location)) {
      const answer = api.choose?.({
        kind: 'reaction', source: '04245', seat: inv.seat, canSkip: true,
        prompt: '会谈间：本地点有伊斯敌人，是否抽取 1 张卡牌？',
        options: [{ id: 'draw', label: '抽取 1 张卡牌' }, { id: 'skip', label: '不抽' }],
      })
      if (!api.choose || answer === 'draw') api.drawCards(inv.seat, 1)
    }
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },

  locationEntered(state, inv, location, api) {
    encounterRules.locationEntered?.(state, inv, location, api)
    // 会谈间（充满脓液的房间）：进入后检定意志(3)，按失败差额受到恐惧。
    if (original(location) === ROOM_CODES.ichor) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const failedBy = Math.max(0, 3 - (result.value || 0))
        if (failedBy) api.horror(inv.seat, failedBy)
      }, 0, { type: 'scenario', name: '充满脓液的房间', ability: true })
    }
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    refreshYithianEnemy(state, enemy)
  },

  // 印在敌人卡上的强制：观测者弃 1 张手牌，学者弃 2 张。
  enemyAttackStarted(state, enemy, inv, api) {
    encounterRules.enemyAttackStarted?.(state, enemy, inv, api)
    const code = original(enemy)
    if (code === OBSERVER_CODE) {
      if ((inv.hand || []).length) api.discardRandom?.(inv.seat, 1)
      else enemy.tfaAttackBoost = true
    }
    if (code === CARD_CODES.scholar) api.discardRandom?.(inv.seat, 2)
  },

  enemyAttackModifier(state, enemy) {
    if (original(enemy) === OBSERVER_CODE && enemy.tfaAttackBoost) return { damage: 1, horror: 1 }
    return {}
  },

  enemyAttackResolved(state, enemy, inv, api) {
    delete enemy.tfaAttackBoost
    encounterRules.enemyAttackResolved?.(state, enemy, inv, api)
  },

  enemyStatModifier(state, enemy, stat) {
    return encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
  },

  // 监守人生成于大图书馆、科学家生成于实验室；地点不在场时按抽牌者所在地点。
  spawnLocation(state, code, fallback) {
    const target = code === CARD_CODES.keeper ? 'greatLibrary'
      : code === CARD_CODES.scientist ? 'laboratory' : null
    if (!target) return fallback
    return state.locations.some(location => location.id === target) ? target : fallback
  },

  // 伊斯人身体（04244）：投入一张卡牌时把它的技能图标翻倍（每次检定一次）。
  // 只对「伊斯人身体持有者自己正在执行、自己投入」的检定生效；别人替他投入的牌不翻倍。
  commitIconMultiplier(state, inv) {
    if (!inv?.yithianBody) return 1
    const test = state.skillTest
    if (!test || test.seat !== inv.seat || test.tfaYithianIconDoubled) return 1
    return {
      multiplier: 2, once: 'tfaYithianIconDoubled', source: 'yithianBody',
      prompt: '伊斯人身体：是否翻倍刚投入这张牌的技能图标？（每次检定一次）',
    }
  },

  describe(state) {
    const remembered = REMEMBERED_TASKS.filter(key => isRemembered(state, key))
      .map(key => TASK_LABELS[key])
    const custodian = controlledCustodian(state) ? '、控制着看管人' : ''
    const lines = [`📝 任务 ${completedTasks(state)}/6：${remembered.join('、') || '尚未完成任何任务'}${custodian}。`]
    lines.push(`🖐️ 手牌：${active(state).map(inv =>
      `${inv.name} ${(inv.hand || []).length}/${handLimit(state, inv)}`).join('、') || '无'}`)
    if (hardSide(state)) lines.push('🎲 困难/专家面：符号效果在揭示时生效。')
    return lines
  },

  resolution(state, key, events, api = {}) {
    if (!['noResolution', 'r1'].includes(key)) throw new Error('未知天机之城结局')
    const records = recordsFor(state)
    if (key === 'noResolution') {
      records.theInvestigatorsHadTheirMemoriesExpunged = true
      for (const inv of active(state)) api.defeat?.(inv, 'madness')
      return { award: true, bonus: 0 }
    }
    const total = completedTasks(state)
    flagsFor(state).processTasks = total
    // 幕间四会检查「在上一场冒险结束时，看管人受调查员控制」；这是场景级事实，
    // 用战役规则标记带出这一关（不新增战役记录字段）。
    state.campaign.ruleFlags ||= {}
    state.campaign.ruleFlags.custodianWasUnderControl = controlledCustodian(state)
    const [bonus] = [total >= 6 ? 4 : total === 5 ? 2 : total === 4 ? 1 : 0]
    // 显式写记录键：审计脚本按字面键统计写入者，计算键会让证据看起来缺失。
    if (total >= 6) records.theProcessWasPerfected = true
    else if (total === 5) records.theProcessWasSuccessful = true
    else if (total === 4) records.theProcessBackfired = true
    else records.theProcessBackfiredSpectacularly = true
    return { award: true, bonus }
  },
}

// 大图书馆/解构室的卡号在 actions() 里按地点卡号判断，这里只保留弱点的判断。
function isWeaknessCardCode(code) {
  const card = ALL_CARDS[code]
  return !!card && (card.subtype === 'weakness' || card.subtype === 'basicweakness')
}

// 密谋 1b：每位调查员从牌库顶 9 张找出最多 2 张[[道具]]支援抽取，然后洗牌。
function searchDeckForItems(state, inv, api) {
  const deck = inv.deck || []
  if (!deck.length) return
  const topCount = Math.min(9, deck.length)
  const top = deck.slice(deck.length - topCount)
  const rest = deck.slice(0, deck.length - topCount)
  const candidates = top.filter(code => isItemAsset(code))
  const picks = []
  if (candidates.length <= 2) {
    picks.push(...candidates)
  } else {
    const pool = [...candidates]
    while (picks.length < 2 && pool.length) {
      const answer = api.choose?.({
        kind: 'card', source: CARD_CODES.agenda1, seat: inv.seat,
        prompt: '从牌库顶 9 张中选择 1 张[[道具]]支援抽取。',
        options: pool.map((code, index) => ({
          id: String(index), cardCode: code, label: ALL_CARDS[code]?.nameZh || code,
        })),
      })
      const index = Math.min(pool.length - 1, Math.max(0, Number(answer) || 0))
      picks.push(pool.splice(index, 1)[0])
    }
  }
  const remaining = [...top]
  inv.hand ||= []
  for (const code of picks) {
    const index = remaining.indexOf(code)
    if (index >= 0) {
      remaining.splice(index, 1)
      inv.hand.push(code)
    }
  }
  inv.deck = shuffled(api, [...rest, ...remaining])
  api.info?.(`🔎 ${inv.name} 找出 ${picks.length} 张道具支援并洗牌。`)
}

// 密谋 1b/2b：看管人无人控制时移动到线索最多的地点。
function moveCustodian(state, api) {
  const asset = uncontrolledCustodian(state)
  if (!asset) return
  const candidates = state.locations
  if (!candidates.length) return
  const most = Math.max(...candidates.map(location => location.clues || 0))
  const pool = candidates.filter(location => (location.clues || 0) === most)
  const chosen = pickRandom(api, pool)
  if (!chosen) return
  asset.location = chosen.id
  api.info?.(`📚 看管人移动到线索最多的「${chosen.name}」。`)
}
