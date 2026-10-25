// 万象无终 · 序章《暮色庄园失踪事件》（05043）· 章节行为。
//
// 规则事实源：DisappearanceAtTheTwilightEstate.hs（setup + intro/DoStep + Skull + ScenarioResolution）
// 与 Act/Agenda/Cards/TheCircleUndone/DisappearanceAtTheTwilightEstate/*.hs。
// 共享遭遇组（看守人/幽灵捕食者/被困的灵魂/在劫难逃/冥界/寒冷刺骨）的钩子来自
// ../../encounter-rules.js（W-shared 维护）；本章只做序章自己的流程与记录写入。
//
// 序章没有胜利：幕 1a 只统计「被消除者留在幕上的线索」；议程 1a 只在调查员被击败时结算 1b，
// 写完命运记录后翻回 1a 且不移除毁灭；全员被击败/撤退 → 结局 noResolution（无经验）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, encounterResolveFor, locationRuleFor,
} from '../../../../../src/cards/card-rules.js'
import {
  encounterRules, original, activeInvestigators, here, recordsFor, doomOn,
  agendaAside, placeAgendaAside, testActionKind,
} from '../../encounter-rules.js'
import {
  applyPrologueTarotResult, ensurePrologueRecords, prologueResultText, writeMissingPersons,
} from '../../tarot.js'
import { TCU_STORY_TEXT } from '../../story-text.js'
import {
  AGENDA_CARD, ACT_CARD, STARTING_PLAY_AREA_USES, START_LOCATION, STORY_INVESTIGATOR_CODES,
  STORY_INVESTIGATOR_SETUP, THE_SPECTRAL_WATCHER, setupCardsFor,
} from './definition.js'
import { prologueChaosToken } from './chaos.js'

// 本章自己没有敌人/诡计条目（theWatcher 等 6 个共享组的逐卡条目归 W-shared）；
// 05043 的骷髅规则在 resolveChaosToken/afterTest 里实现，05044/05045 在单卡条目里实现。
export const implementedEncounterCodes = []

// ---------------------------------------------------------------------------
// 纯读点 / 小工具（测试直接调用）
// ---------------------------------------------------------------------------

export const chosenStoryInvestigators = state =>
  [...(state.storyInvestigators?.chosen || [])]
    .sort((left, right) => left.seat - right.seat)
    .filter(entry => STORY_INVESTIGATOR_SETUP[entry.code])

export const actClues = state => Number(state.acts?.[0]?.clues || 0)

// 「场上毁灭标记总数」：议程上的 state.doom + 各卡上的 doom（与共享 doomOn 同一口径）。
export const totalDoomInPlay = state => Number(state.doom || 0) + doomOn(state)

// 放在密谋牌库旁的持续诡计（05102 黑暗中的低语 / 05107 恐怖夜色）。
// 共享区由 encounter-rules.js 的 `agendaAside`/`placeAgendaAside` 维护（纯 JSON `scenarioZones.agendaAside`），
// 轮末清理走 encounterRules.roundEnded 的通用分支。
export const agendaAsideCards = state => [...agendaAside(state)]
export const nextToAgendaCards = agendaAsideCards

const monsterTraits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
const hasMonsterTrait = card => monsterTraits(card).some(trait => String(trait).toLowerCase() === 'monster')

function flagsFor(state) {
  if (!state.scenarioFlags || typeof state.scenarioFlags !== 'object') state.scenarioFlags = {}
  return state.scenarioFlags
}

function zonesFor(state) {
  if (!state.scenarioZones || typeof state.scenarioZones !== 'object') state.scenarioZones = {}
  return state.scenarioZones
}

function simpleCardInstance(state, code, suffix) {
  const card = ALL_CARDS[code]
  return {
    id: `prologue:${code}:${suffix}`,
    code,
    originalCode: code,
    name: card?.nameZh || card?.name || code,
    type: card?.type || 'treachery',
    traits: [...(card?.traits || [])],
  }
}

// 「搜索收齐的卡牌，找出 1 张 X，放到…」：威胁区域。
function placeThreat(state, inv, code) {
  const instance = simpleCardInstance(state, code, `seat${inv.seat}`)
  inv.threat ||= []
  if (!inv.threat.some(card => original(card) === code)) inv.threat.push(instance)
  return instance
}

// 「放在密谋牌库旁」：共享 agendaAside 区（05102/05107 与 W-shared 的条目共用同一份表示）。

// 记录「这是被谁/什么击败的」：引擎不保留击败来源，本章用两层读点精确定位「致命的那次伤害」：
//   · beforeEnemyHarm（敌人攻击）：写 pendingAttackHarm（同时保留 lastAttacker 供旧调用方兜底）；
//   · beforeHarm（所有伤害/恐惧的落点）：把 pending 固化成 lastHarmSource[seat]（enemyAttack/agenda/other）。
// 这样同一轮有多个来源时只认最后一次实际造成伤害的来源，而不是「本轮最近一次攻击」。
function rememberAttacker(state, enemy, inv) {
  if (!inv || inv.seat == null) return
  const flags = flagsFor(state)
  const attacker = {
    code: String(original(enemy)),
    traits: [...monsterTraits(enemy)],
    round: Number(state.round || 0),
  }
  flags.lastAttacker ||= {}
  flags.lastAttacker[inv.seat] = attacker
  flags.pendingAttackHarm = { seat: Number(inv.seat), ...attacker }
}

function clearRoundMarkers(state) {
  const flags = flagsFor(state)
  flags.lastAttacker = {}
  flags.pendingAttackHarm = null
  flags.lastHarmSource = {}
  flags.agendaHarmSeat = null
}

// 议程 1b：按击败来源写该调查员的命运记录（Haskell JudgementXX.hs:150-180 的分支）。
export function recordFateForElimination(state, inv) {
  const records = ensurePrologueRecords(state)
  const flags = flagsFor(state)
  const code = String(inv.code)
  const precise = flags.lastHarmSource?.[inv.seat] || null
  const legacy = flags.lastAttacker?.[inv.seat]
  const sameRoundLegacy = Boolean(legacy && Number(legacy.round) === Number(state.round || 0))
  let key = null
  if (precise?.type === 'enemyAttack') {
    if (precise.code === THE_SPECTRAL_WATCHER) key = 'wasTakenByTheWatcher'
    else if ((precise.traits || []).map(trait => String(trait).toLowerCase()).includes('monster')) key = 'wasClaimedBySpecters'
  }
  if (!key && !precise && sameRoundLegacy) {
    if (legacy.code === THE_SPECTRAL_WATCHER) key = 'wasTakenByTheWatcher'
    else if (hasMonsterTrait(legacy)) key = 'wasClaimedBySpecters'
  }
  if (!key && (precise?.type === 'agenda' || (!precise && flags.agendaHarmSeat === inv.seat))) {
    if (totalDoomInPlay(state) >= 7) key = 'disappearedIntoTheMist'
  }
  if (!key) key = 'wasPulledIntoTheSpectralRealm'
  const list = Array.isArray(records[key]) ? records[key] : []
  if (!list.includes(code)) list.push(code)
  records[key] = list
  if (flags.lastHarmSource) delete flags.lastHarmSource[inv.seat]
  flags.agendaHarmSeat = null
  return { key, code, attacker: precise?.type === 'enemyAttack' ? precise : (sameRoundLegacy ? legacy : null) }
}

// ---------------------------------------------------------------------------
// 序章设置：塔罗 / 失踪人口 / 资源 / 固定起手牌 / 起始游戏区域标记
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// P9 序章私密正文：每位玩家只读到「自己选的故事调查员」的引言与「自己抽到」的塔罗结果。
// 引擎已经把 campaign.privateStories 按 observerSeat 过滤（campaignView / campaignStory），
// 因此这里只负责写入；不进 scenarioIntro，避免全桌都能看到别人的命运。
// ---------------------------------------------------------------------------

function campaignRecordId(state, seat) {
  const record = state.campaign?.investigators?.[seat]
  if (record?.id) return record.id
  return state.investigators?.[seat]?.campaignId || null
}

function pushProloguePrivateStory(state, { id, title, text, audienceInvestigatorIds }) {
  if (!text || !audienceInvestigatorIds?.length) return null
  const campaign = state.campaign
  if (!campaign) return null
  campaign.privateStories ||= []
  if (campaign.privateStories.some(entry => entry.id === id)) return null
  const story = { id, title, text, audienceInvestigatorIds: [...new Set(audienceInvestigatorIds)] }
  campaign.privateStories.push(story)
  return story
}

function pushStoryInvestigatorIntro(state, entry, inv) {
  const source = TCU_STORY_TEXT.prologue?.storyInvestigatorIntros?.[entry.code]
  if (!source?.paragraphs?.length) return
  pushProloguePrivateStory(state, {
    id: `tcuPrologueIntro:${entry.code}`,
    title: source.title || `${inv.name}的引言`,
    text: source.paragraphs.join('\n\n'),
    audienceInvestigatorIds: [campaignRecordId(state, entry.seat)].filter(Boolean),
  })
}

function pushTarotPrivateStory(state, inv, arcana, text) {
  pushProloguePrivateStory(state, {
    id: `tcuPrologueTarot:${inv.seat}`,
    title: `${inv.name}的命运`,
    text,
    audienceInvestigatorIds: [campaignRecordId(state, inv.seat)].filter(Boolean),
  })
}

function prepareStoryInvestigatorSetup(state, api) {
  const flags = flagsFor(state)
  if (flags.storyInvestigatorSetupDone) return
  flags.storyInvestigatorSetupDone = true
  const chosen = chosenStoryInvestigators(state)
  ensurePrologueRecords(state)
  if (!chosen.length) {
    // 没有选人（例如纯 hook 测试或独立模式）：不写记录，但把座位放到起始地点。
    for (const inv of state.investigators || []) inv.location = START_LOCATION
    return
  }
  // 「失踪人口」：已选者留在名单里，未选者被划掉（记录里不存在 = 已划掉，见 scenarioApproximations）。
  writeMissingPersons(state, chosen.map(entry => entry.code))
  for (const entry of chosen) {
    const inv = state.investigators?.[entry.seat]
    if (!inv) continue
    const setup = STORY_INVESTIGATOR_SETUP[entry.code]
    inv.location = setup.startLocation
    // 卡背：游戏开始时获得 N 资源（而不是 5）。
    inv.resources = setup.resources
    // 无牌组：卡背固定起手牌直接放进手牌（引擎的 P2.6 原语会跳过抓牌/换牌）。
    inv.hand = [...setup.startingHand]
    // 起始游戏区域的标记数覆盖（手枪 2 弹药 / 手电筒 2 补给）。
    for (const asset of inv.assets || []) {
      const use = STARTING_PLAY_AREA_USES[asset.code || asset.originalCode]
      if (!use) continue
      asset.uses = use.uses
      asset.usesType = use.usesType
    }
    // P9：这位玩家独享自己角色的引言（座位级私密正文）。
    pushStoryInvestigatorIntro(state, entry, inv)
    api?.info?.(`📜 ${inv.name}（故事调查员）从「${locationNameOf(state, setup.startLocation)}」开始；`
      + `${inv.hand.length} 张固定起手牌、${inv.resources} 资源。`)
  }
  if (chosen.length < STORY_INVESTIGATOR_CODES.length) {
    api?.info?.(`📜 「失踪人口」中未选的中立调查员被划掉（${STORY_INVESTIGATOR_CODES
      .filter(code => !chosen.some(entry => entry.code === code)).join('、')}）。`)
  }
}

function locationNameOf(state, id) {
  return state.locations?.find(location => location.id === id)?.name
    || state.scenario?.locations?.[id]?.name || id
}

function drawPrologueTarot(state, api) {
  const flags = flagsFor(state)
  if (flags.tarotDrawn) return []
  const chosen = chosenStoryInvestigators(state)
  if (!chosen.length || !api?.tarot) return []
  flags.tarotDrawn = true
  ensurePrologueRecords(state)
  // 参考实现的塔罗牌组是 22 张大阿卡纳，抽走的牌不再出现（同一张牌不能给两个角色）。
  if (!state.scenarioDecks?.tarot) api.tarot.build()
  const drawn = []
  for (const entry of chosen) {
    const inv = state.investigators?.[entry.seat]
    if (!inv) continue
    const [card] = api.tarot.draw(inv.seat, { orientation: 'upright', source: 'prologue' })
    if (!card) continue
    const applied = applyPrologueTarotResult(state, inv, card.arcana)
    drawn.push({ seat: inv.seat, arcana: card.arcana, orientation: card.orientation, record: applied.record,
      evidence: applied.evidence })
    const fateText = prologueResultText(card.arcana, inv.name)
      || `塔罗：${inv.name} 抽到了${card.arcana}号大阿卡纳。`
    // P9：命运只给本人看（私密故事），桌面上只公开「抽了几张、还有几张」。
    pushTarotPrivateStory(state, inv, card.arcana, fateText)
    if (typeof api?.privateInfo === 'function') api.privateInfo(inv.seat, fateText)
    else api?.info?.(fateText)
  }
  flags.tarotDrawnCount = drawn.length
  return drawn
}

// ---------------------------------------------------------------------------
// 行为对象
// ---------------------------------------------------------------------------

export const behavior = {
  ...encounterRules,
  id: 'disappearanceAtTheTwilightEstate',
  implementedEncounterCodes,

  // 卡面子句全部接行为；近似实现（等价但改了承载方式）单独列在 scenarioApproximations。
  scenarioGaps: [],
  scenarioApproximations: [
    '「失踪人口」没有 crossedOut 字段：string[] 只记录已选故事调查员卡号，未选者缺席即等于划掉（后续章节读到的语义与参考实现 getRecordedCardCodes 一致）',
    '击败来源判定：用 beforeEnemyHarm + beforeHarm 两层读点精确定位「致命那次伤害」的来源（敌人攻击/议程 1a 强制/其它），同一轮多来源时不会误归；仅当外部直接调用 investigatorEliminated（无 harm 记录）时退回「同轮最近攻击者」兜底',
    '卡背固定起手牌直接写入 inv.hand（卡号数组），不经引擎抓牌管线，因此不触发「抽牌」窗口',
    '朦胧之雾(01168) 的附属按核心共享条目的 location.fog/shroudMod 语义近似，不建独立附属实例',
    '「放在密谋牌库旁」的 05102/05107 存共享区 state.scenarioZones.agendaAside（纯 JSON），持续效果与轮末清理由 encounterRules 的通用钩子读取',
  ],

  // ---- 设置 ---------------------------------------------------------------

  preScenarioSetup(state, events, api) {
    encounterRules.preScenarioSetup?.(state, events, api)
    const flags = flagsFor(state)
    const zones = zonesFor(state)
    zones.setAside ||= [THE_SPECTRAL_WATCHER]
    zones.removed ||= []
    if (flags.prologueInitialized) return
    flags.prologueInitialized = true
    Object.assign(flags, {
      setupComplete: false,
      tarotDrawn: false,
      tarotDrawnCount: 0,
      lastAttacker: {},
      agendaHarmSeat: null,
    })
    ensurePrologueRecords(state)
    prepareStoryInvestigatorSetup(state, api)
    drawPrologueTarot(state, api)
  },

  setupLocations(state, events, helper = {}) {
    const zones = zonesFor(state)
    zones.setAside = [THE_SPECTRAL_WATCHER]
    zones.removed = []
    flagsFor(state).locationsPlaced = Object.keys(STORY_INVESTIGATOR_SETUP).length
    helper.info?.(state, events, '🏚️ 幽灵的领域：本场景只使用 7 张带「幽灵」特性的地点。')
    // 调查员的位置已在 preScenarioSetup 写好；placeLocation 会据此把有人的地点直接揭示并放线索。
    return Object.keys(state.scenario.locations)
  },

  setupEnemies(state, events, helper = {}) {
    const spawn = (code, locationId, seat = null) => {
      const enemy = helper.spawnEnemy?.(state, code, locationId, seat, true)
      if (enemy) helper.info?.(state, events, `👹 「${enemy.name}」生成于「${helper.locName?.(state, locationId) || locationId}」${seat == null ? '' : '并与调查员交战'}。`)
      return enemy
    }
    // theSpectralWatcher：开局放在入口大厅。
    const watcher = spawn(THE_SPECTRAL_WATCHER, START_LOCATION)
    const chosen = chosenStoryInvestigators(state)
    for (const entry of chosen) {
      const inv = state.investigators?.[entry.seat]
      if (!inv) continue
      const setup = STORY_INVESTIGATOR_SETUP[entry.code]
      for (const card of setup.setupCards) {
        if (card.code === THE_SPECTRAL_WATCHER) continue
        if (card.placement === 'threat') {
          placeThreat(state, inv, card.code)
          helper.info?.(state, events, `🃏 「${ALL_CARDS[card.code]?.nameZh || card.code}」放入 ${inv.name} 的威胁区域。`)
        } else if (card.placement === 'enemy') {
          spawn(card.code, setup.startLocation)
        } else if (card.placement === 'engagedEnemy') {
          spawn(card.code, setup.startLocation, inv.seat)
        } else if (card.placement === 'locationAttachment') {
          const location = state.locations?.find(item => item.id === inv.location)
          if (location) {
            location.fog = (location.fog || 0) + 1
            location.fogCode = card.code
            location.shroudMod = (location.shroudMod || 0) + 2
            helper.info?.(state, events, `🌫️ 「${ALL_CARDS[card.code]?.nameZh || card.code}」附属到「${location.name}」（隐藏值 +2）。`)
          }
        } else if (card.placement === 'nextToAgenda') {
          placeAgendaAside(state, card.code)
          helper.info?.(state, events, `🃏 「${ALL_CARDS[card.code]?.nameZh || card.code}」放到密谋牌库旁。`)
        }
      }
      const watcherDamage = Number(setup.watcherDamageOnSpawn || 0) // 卡背：在幽灵看守人上放置 N 点伤害（数据驱动）
      if (watcherDamage > 0 && watcher) {
        watcher.damageTaken = (watcher.damageTaken || 0) + watcherDamage
        helper.info?.(state, events, `🔫 ${inv.name} 在幽灵看守人身上留下 ${watcherDamage} 点伤害。`)
      }
    }
  },

  modifyDeck(state, deck, events, helper) {
    const next = [...deck]
    const chosen = chosenStoryInvestigators(state).map(entry => entry.code)
    for (const card of setupCardsFor(chosen)) {
      const index = next.indexOf(card.code)
      if (index < 0) continue
      next.splice(index, 1)
      helper?.info?.(state, events, `🗂️ 从遭遇牌库取出「${ALL_CARDS[card.code]?.nameZh || card.code}」（按调查员卡背设置）。`)
    }
    return next
  },

  afterChaosBagSetup(state) {
    encounterRules.afterChaosBagSetup?.(state)
    flagsFor(state).setupComplete = true
  },

  // ---- 章节规则 -----------------------------------------------------------

  // 05043 骷髅：简单/普通 -3，困难/专家 -5（数值在 chaos.js）。
  resolveChaosToken(state, inv, token, api) {
    encounterRules.resolveChaosToken?.(state, inv, token, api)
    return prologueChaosToken(state, inv, token, api)
  },

  // 05043 骷髅的后半句：失败且为攻击/躲避尝试 → 结算你所在地点的每条闹鬼能力。
  // 判定按「检定动作种类」而不是技能值：战斗/敏捷检定也可能是卡牌效果或其他行动（例如 05104 的
  // [agility] 显现检定），按技能判断会误触发；01036、05029 等改技能的攻击/躲避又会漏掉。
  // 共享 encounter-rules 的 testActionKind 读检定 source 标签（攻击/躲避/调查），这里复用同一读点；
  // 调查失败由引擎自动结算闹鬼，章节不再重复触发。
  afterTest(state, inv, result, api) {
    if (!result || result.success) return
    if (result.token !== 'skull') return
    if (!['fight', 'evade'].includes(testActionKind(result))) return
    if (!inv?.location || !api?.haunted) return
    api.haunted(inv.seat, { locationId: inv.location, times: 1, kind: 'scenario' })
  },

  // 议程 1a 强制：任何卡上放置毁灭后，每位调查员受到 1 伤害或 1 恐惧（场上有 ≥5 毁灭时改为 2）。
  // `payload` 形状由引擎给出：{ target, amount, agenda }。
  doomPlaced(state, payload, api) {
    encounterRules.doomPlaced?.(state, payload, api)
    const flags = flagsFor(state)
    if (!flags.setupComplete) return
    if (state.agendaIndex !== 0) return
    const damage = totalDoomInPlay(state) >= 5 ? 2 : 1
    for (const inv of activeInvestigators(state)) {
      let choice = 'damage'
      if (api?.choose) {
        choice = api.choose({
          kind: 'harm', source: AGENDA_CARD, seat: inv.seat,
          prompt: `审判·XX：${inv.name} 受到 ${damage} 点伤害，或受到 ${damage} 点恐惧。`,
          options: [
            { id: 'damage', label: `受到 ${damage} 点伤害` },
            { id: 'horror', label: `受到 ${damage} 点恐惧` },
          ],
        })
      }
      // 记录「这次伤害来自议程强制」：若因此被击败，1b 的「消失在迷雾之中」分支要靠它。
      flags.agendaHarmSeat = inv.seat
      try {
        if (choice === 'horror') api?.horror?.(inv.seat, damage)
        else api?.damage?.(inv.seat, damage)
      } finally {
        flags.agendaHarmSeat = null
      }
    }
  },

  // 敌人攻击：先记「本次攻击」来源；真正的来源固化在 beforeHarm（伤害落点）里。
  beforeEnemyHarm(state, enemy, inv, harm, api) {
    encounterRules.beforeEnemyHarm?.(state, enemy, inv, harm, api)
    rememberAttacker(state, enemy, inv)
  },

  // 每次伤害/恐惧落点：把「致命那次伤害」的真实来源固化为 lastHarmSource[seat]：
  // enemyAttack（含来源敌人与 traits）/ agenda（本密谋 1a 强制）/ other。1b 的四分支记录据此判定。
  beforeHarm(state, inv, harm, api) {
    encounterRules.beforeHarm?.(state, inv, harm, api)
    if (!inv || inv.seat == null) return
    const flags = flagsFor(state)
    const pending = flags.pendingAttackHarm
    let source = { type: 'other' }
    if (pending && Number(pending.seat) === Number(inv.seat) && Number(pending.round) === Number(state.round || 0)) {
      source = { type: 'enemyAttack', code: pending.code, traits: [...(pending.traits || [])] }
      flags.pendingAttackHarm = null
    } else if (flags.agendaHarmSeat === inv.seat) {
      source = { type: 'agenda' }
    }
    flags.lastHarmSource ||= {}
    flags.lastHarmSource[inv.seat] = source
  },

  // 幕 1a 强制 + 议程 1a 强制②：调查员被消除时（含撤退）。
  investigatorEliminated(state, inv, clues, api) {
    const flags = flagsFor(state)
    const act = state.acts?.[0]
    const actIsPrologue = String(original(act)) === ACT_CARD
    const amount = Number(clues ?? inv.clues ?? 0)
    if (actIsPrologue && amount > 0) {
      // 「改为将该调查员的每个线索放在本场景上，而不是放在所在地点」。
      act.clues = Number(act.clues || 0) + amount
      inv.clues = 0
      api?.info?.(`📜 ${inv.name} 被消除：${amount} 个线索放到「${act.name}」上（场景共 ${act.clues} 个）。`)
    }
    // 「当任何调查员被击败时，该调查员必须推进此议程」——撤退 ≠ 被击败，不触发。
    // 用 agenda-in-place-flip 原语真实翻到 1b（播报背面正文），记录该调查员命运后再翻回 1a；
    // 不推进 agendaIndex、不移除任何毁灭标记（卡面「在本密谋推进时，不要移除其上任何毁灭标记」）。
    if (!inv.resigned && state.agendaIndex === 0 && String(original(state.agendas?.[0])) === AGENDA_CARD) {
      const hasFlip = typeof api?.flipAgendaInPlace === 'function'
      if (hasFlip) api.flipAgendaInPlace('back')
      else api?.info?.(`📖 密谋 1b「审判·XX」：翻开背面并按指示记录 ${inv.name} 的命运。`)
      const fate = recordFateForElimination(state, inv)
      const backText = ALL_CARDS[AGENDA_CARD]?.backTextZh || ALL_CARDS[AGENDA_CARD]?.backText || ''
      if (!hasFlip && backText) api?.info?.(backText)
      api?.info?.(`📖 ${inv.name} 的命运已记录（${fate.key}）。`)
      if (hasFlip) api.flipAgendaInPlace('front')
      else api?.info?.('🌑 密谋翻回 1a；本次推进不移除其上任何毁灭标记。')
      if (fate.attacker) api?.info?.(`🩸 击败来源：${ALL_CARDS[fate.attacker.code]?.nameZh || fate.attacker.code}。`)
    }
    // 本 hook 接管了「线索放在地点」的默认行为。
    return true
  },

  // 回合结束清理「上一轮攻击者」。
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    clearRoundMarkers(state)
  },

  // ---- 幕 / 议程 / 地点 / 遭遇的分派 ---------------------------------------

  actReveal(state, act, api, revealType) {
    const handled = encounterRules.actReveal?.(state, act, api, revealType)
    if (handled) return handled
    return actRuleFor(String(original(act)))?.onReveal?.(state, act, api)
  },

  // 幕 1b「记录你被追捕。翻回场景 1a。」：用 actIndexAfterAdvance 实现「翻回」。
  actIndexAfterAdvance(state, cur, api) {
    const next = encounterRules.actIndexAfterAdvance?.(state, cur, api)
    if (Number.isInteger(next)) return next
    if (String(original(cur)) !== ACT_CARD) return undefined
    return 0
  },

  agendaReveal(state, agenda, api, revealType) {
    const handled = encounterRules.agendaReveal?.(state, agenda, api, revealType)
    if (handled) return handled
    return agendaRuleFor(String(original(agenda)), state.scenario?.id)?.onReveal?.(state, agenda, api)
  },

  // 地点行动统一由地点条目提供（入口大厅的「撤退」在 05078 条目里；条目未注册前给兜底按钮）。
  actions(state, inv) {
    const moves = []
    encounterRules.actions?.({ state, inv, moves })
    const location = here(state, inv)
    const rule = locationRuleFor(String(original(location)))
    if (rule?.actions) rule.actions({ state, inv, location, moves })
    else if (location?.id === START_LOCATION) {
      moves.push({ action: 'scenarioAction', rule: 'resignEntryHall', label: '🚪 撤退：破门而出，逃出幽灵国度' })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    const location = here(state, inv)
    if (locationRuleFor(String(original(location)))?.performAction?.(state, inv, move, api)) return
    if (encounterRules.performAction?.(state, inv, move, api)) return
    if (move.rule === 'resignEntryHall') {
      api.resign(inv.seat)
      return
    }
    throw new Error(`未知暮色庄园失踪事件行动：${move.rule}`)
  },

  resolveEncounter(state, inv, treachery, api) {
    const code = String(original(treachery))
    const resolver = encounterResolveFor(code)
    if (typeof resolver === 'function') {
      return resolver(state, inv, treachery, api, { location: here(state, inv) })
    }
    // 共享组条目由 W-shared 提供；索引重建（Lead 合并）前可能读不到，不能静默当作已结算。
    return encounterRules.resolveEncounter?.(state, inv, treachery, api) || false
  },

  // ---- 结局 ---------------------------------------------------------------

  resolution(state, key, events, api) {
    if (key !== 'noResolution') throw new Error(`未知暮色庄园失踪事件结局：${key}`)
    const records = recordsFor(state)
    const clues = actClues(state)
    // 参考实现用 recordCount（覆盖）把证据设为幕上线索数；本实现固定走塔罗路径，
    // 塔罗已经累加过证据，因此改为累加（与中文引言「统计遗留证据总数」一致）。
    records.piecesOfEvidenceWereLeftBehind = Number(records.piecesOfEvidenceWereLeftBehind || 0) + clues
    api?.info?.(`📖 结局：未达成任何结局。幕上留下的线索 ${clues} 个已计入「证据被留下了」`
      + `（累计 ${records.piecesOfEvidenceWereLeftBehind}）。序章不获得经验值。`)
    return { award: false, bonus: 0 }
  },

  // 最后一位撤退的调查员：引擎会把 noResolution 走正常结局流程（不额外处理）。
  allResigned(state, api) {
    encounterRules.allResigned?.(state, api)
  },

  // 界面/日志摘要：序章状态块（塔罗、证据、命运记录、看守人来源）。
  describe(state) {
    const lines = encounterRules.describe?.(state) || []
    const records = state.campaign?.records || {}
    const chosen = chosenStoryInvestigators(state).map(entry => entry.code)
    if (!chosen.length) return lines
    lines.push(`序章故事调查员：${chosen.map(code => STORY_INVESTIGATOR_SETUP[code].name).join('、')}`
      + `（未选：${STORY_INVESTIGATOR_CODES.filter(code => !chosen.includes(code)).join('、') || '无'}）`)
    lines.push(`幕上线索：${actClues(state)}；遗留证据：${Number(records.piecesOfEvidenceWereLeftBehind || 0)}`)
    for (const [key, label] of [
      ['disappearedIntoTheMist', '消失在迷雾之中'],
      ['wasClaimedBySpecters', '被幽灵夺走性命'],
      ['wasPulledIntoTheSpectralRealm', '被拉入幽灵国度'],
      ['wasTakenByTheWatcher', '被看守人抓走'],
    ]) {
      const codes = records[key]
      if (!Array.isArray(codes) || !codes.length) continue
      lines.push(`${label}：${codes.map(code => STORY_INVESTIGATOR_SETUP[code]?.name || ALL_CARDS[code]?.nameZh || code).join('、')}`)
    }
    const nextToAgenda = agendaAsideCards(state)
    if (nextToAgenda.length) {
      lines.push(`密谋旁：${nextToAgenda.map(card => ALL_CARDS[card.code]?.nameZh || card.code).join('、')}`)
    }
    return lines
  },
}
