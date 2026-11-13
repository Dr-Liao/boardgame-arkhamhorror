// 苦痛之影（Shades of Suffering · 09660）· 引擎钩子（章节流程 + 影穑充能 / 灵怪剧情面 / 朱三娘 / 伞密钥）。
//
// 约定（与 sanguineShadows / deadHeat / onThinIce 相同）：
//   · 逐卡规则写在单卡条目的 enemyRule / enemyScript / assetRule / treacheryRule / flags，
//     behavior 只做分派与本章专属机械（隐匿分配、灵怪翻面、朱三娘的影子往返、影穑充能、结局记录）；
//   · 内容层（behavior）允许直接读写 state；卡条目禁止，只拿 ctx.api；
//   · 隐匿迷你卡走 P2 原语 `src/engine/tsk-concealed.js`；绯红密钥走 `src/engine/tsk-scarlet-keys.js`。
//
// 本章机械（参考 Scenarios/TheScarletKeys/ShadesOfSuffering.hs 与各卡 CardDef/实现）：
//   1. 布置：West Wing / Selangor Club / East Wing / Padang 入场（其余三张放一边）；
//      福林特工三档状态决定起始地点与幕间充能；三对灵怪各随机留一张（另一张移出游戏）；
//      朱三娘以「隐匿 2」在阴影中（真身迷你卡 + 2 诱饵，分配到起始地点以外的地点）；
//      影穑以[[动荡]]面附属在她身上，充能数按战役记录 time 结算（≤11 无 / 12–18 三个 / 19–26 六个 / ≥27 九个 + 1 毁灭）。
//   2. 影穑充能：`scenarioFlags.shadeReaperCharges`（见 scenarioApproximations 与本文件 addCharges）；
//      [skull] 的 X、折磨（09677）、魂灵收割（09678）、痛苦的历史（09661b）、血债血偿（09679b）
//      与密谋 2b 的收割都读写同一计数。
//   3. 灵怪：三张双面敌人（敌人面 ↔ 剧情面）。谈判成功或「将要被击败」时翻面结算剧情：
//      队伍记住对应事实 → 剧情卡进胜利区（胜利 1）；否则翻回敌人面、治愈全部伤害、解除交战并横置。
//   4. 朱三娘：隐匿 2；被击败时改为「治愈全部伤害、移除场上所有毁灭、返回阴影、把迷你卡重新分配到
//      有非弱点灵怪的地点」；幕 2 背面的收割 / 幕 2 目标达成后翻到「血债血偿」面。
//   5. 结局：未达成 / 1（用伞制住她）/ 2（放她走）/ 3（被她控制），记录、时间与影穑归属都在 resolution 里结算。
import { exposeWithReaction } from '../../concealed.js'
import { concealedMiniCards, distributeConcealed, exposeMiniCard } from '../../../../../src/engine/tsk-concealed.js'
import { isPendingChoice } from '../../../../../src/engine/resolution.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { assetRuleFor, enemyRuleFor, treacheryRuleFor } from '../../../../../src/cards/card-rules.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  AGENDA2, CHAPTER_ID, CHARGE_FLAG, CONCEALED_AMOUNT, DECOY_KIND, GATHER_GROUPS, GEIST_ENEMY_CODES, GEIST_PAIRS,
  LOCATIONS, MELATIS_SHOP, RAW_CODES, RECORD_READS, RECORD_WRITES, REMEMBERED, SELANGOR_CLUB,
  SELANGOR_CLUB_PADANG, SETUP_LOCATION_IDS, SHADE_REAPER_KEY,
  STATION_EAST_WING, STATION_WEST_WING, TIN_MINE, TZU_FACE_CODES, TZU_SAN_NIANG, TZU_SAN_NIANG_OUT_FOR_BLOOD,
  WAYANG_KULIT_THEATER, clueValueOf, geistPairOf, resolutions, scenario,
} from './definition.js'
import {
  GEIST_TRAIT, SHADES_OF_SUFFERING_TOKEN_MEANINGS, shadeReaperCharges, shadesOfSufferingAfterTest,
  shadesOfSufferingChaosToken, skullModifier,
} from './chaos.js'

const STATE_VERSION = 1
const TZU_KIND = 'TzuSanNiang'
const TZU_DECOY_KIND = `${DECOY_KIND}${TZU_KIND}`
const INSPECTOR_FLINT = '09762'
const HAUNTED_TRAIT = 'Haunted'
const ELITE_TRAIT = 'Elite'
// 记住的事实：六张剧情面各自的解锁条件（剧情条目 `assetRule.geistStory.fact` 是唯一事实源）。
const STORY_FACT_FALLBACK = Object.freeze(Object.fromEntries(GEIST_PAIRS.map(pair => [pair.story, pair.fact])))

export const scenarioApproximations = Object.freeze([
  '影穑的充能记在场景旗标 `scenarioFlags.shadeReaperCharges`（密钥原语 tsk-scarlet-keys 只登记持有者/面，'
    + '不提供计数器）；[skull]、两张诡计、痛苦的历史、血债血偿与密谋 2b 的收割都读写同一键。'
    + '已登记原语请求 extend-scarlet-key-charges。',
  '影穑的持有者：Setup 时附属在阴影中的朱三娘身上，因此引擎侧绑定为 `{type:"none"}`，真实持有者写'
    + '战役记录 `shadeReaperBearer`；调查员持有（结局 1/2）时才走 `keys.bind` 的 investigator 绑定。',
  '灵怪的「翻到剧情面」由内容层结算（敌人离场 + 剧情卡进胜利区，或灵怪原地治愈/解除交战/横置），'
    + '没有把剧情卡放进威胁区的中间态；引擎的物理翻面原语（physical-faces）只接受同类型面，'
    + 'enemy ↔ story 的跨类型面已登记原语请求 extend-enemy-story-face-flip。',
  '「调查员们作为一个团队共同花费线索」在剧本行动里由本地 spendGroupClues 依次扣减（先行动者、再同地点/任意地点），'
    + '引擎只有按座位花费的 api.spendClues/loseClues；已登记原语请求 new-scenario-group-clue-cost。',
  '幕 2「[[灵怪]]敌人不能离开[[闹鬼]]地点」用 enemyMoved 补偿钩子实现（走回原地点并记日志）；'
    + '引擎没有「敌人不能离开某类地点」的读点，已登记原语请求 new.enemyMovementRestriction。',
  '密谋 2 的「单人游戏毁灭阈值 +1」在 Setup 时改写该阶段数据（引擎没有毁灭阈值的运行期修正读点）。',
  '影穑动荡面的「若不在你的回合，则在你的下个回合失去 1 行动」记为待结算标记，在 turnBegins 时扣除'
    + '（引擎没有延迟失去行动的原语）。',
  '「查看隐匿迷你卡的已揭示面 / 灵怪的另面」用私密日志（api.privateInfo）展示卡名与卡文，'
    + '没有「只给某座位看卡面」的投影读点。',
  '痛苦的历史（09661b）「弃掉场上印刷费用最高的[[盟友]]支援」按「场上所有[[盟友]]支援里印刷费用最高者」选择，'
    + '平手时取控制者顺序靠前者；「在朱三娘上放 1 毁灭」在她仍在阴影中时记在章节状态（`tzuDoom`）。',
])

export const scenarioGaps = Object.freeze([
  '共享遭遇组（黑暗笼罩 / 处处神秘 / 猩红巫术 / 蔓延腐化 / 惊骇袭击）的卡牌行为属于共享组 worker，'
    + '本章只声明 requiredEncounterGroupIds 并在遭遇牌库里按印刷份数展开。',
  '世界地图的时间阈值（状况报告 α–ω）与启程循环由战役流程层结算；本章只累加 time 记录并按 time 放影穑充能。',
  '福林特工加入牌组后的「不占盟友槽」用 api.exemptAssetSlot(asset, "ally") 近似（规则书口径的'
    + '「本场景期间不算牌组张数」由战役构筑层承担）。',
])

const codeOf = card => card?.originalCode || card?.code || card
export const enemyOf = (state, code) =>
  (state.enemies || []).find(enemy => !enemy.defeated && codeOf(enemy) === code) || null
const aliveInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const difficultyKey = state => {
  const value = String(state?.difficulty || 'standard')
  return ['easy', 'standard', 'hard', 'expert'].includes(value) ? value : 'standard'
}
const numInvestigators = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)
const cardTextOf = code => ALL_CARDS[code]?.textZh || ALL_CARDS[code]?.text || ''
const locationName = (state, id) => LOCATIONS[id]?.name || locationOf(state, id)?.name || String(id || '')
const hasTrait = (entity, trait) =>
  (entity?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())
const locationHasTrait = (state, id, trait) => hasTrait(locationOf(state, id), trait)
const isGeistCode = code => GEIST_ENEMY_CODES.includes(String(code || ''))
const isGeistEnemy = enemy => isGeistCode(codeOf(enemy))
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const shuffleWith = (state, list, helper) => {
  if (typeof helper?.shuffle === 'function') return helper.shuffle([...list], () => helper.randomValue(state))
  const copy = [...list]
  const random = typeof helper?.random === 'function' ? helper.random : () => randomValue(state)
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
function choiceFor(api, request) {
  const choose = api?.choose || api?.choice
  if (typeof choose !== 'function') return null
  try {
    return choose(request)
  } catch (error) {
    // 引擎用异常表达「等待玩家选择 / 事务检查点」；吞掉会让选择静默默认或事务游标失配。
    if (isPendingChoice(error)) throw error
    return null
  }
}

// ---------------------------------------------------------------------------
// 章节状态（福林分支 / 三张灵怪 / 朱三娘 / 待结算标记）；纯 JSON，随存档往返。
// ---------------------------------------------------------------------------
export function chapterState(state) {
  const flags = (state.scenarioFlags ||= {})
  const data = flags[CHAPTER_ID] ||= {}
  data.version ||= STATE_VERSION
  if (data.tzuInShadows == null) data.tzuInShadows = true
  data.removedGeists ||= []
  data.geists ||= {}
  data.tzuDoom = Number(data.tzuDoom) || 0
  data.storyVictories ||= []
  data.pendingActionLoss ||= {}
  if (data.interludeDone == null) data.interludeDone = false
  if (data.agenda3 == null) data.agenda3 = false
  return data
}

/** 影穑充能（唯一读写点；卡条目通过 api.scenarioFlag/setScenarioFlag 访问同一个旗标）。 */
export const chargesOf = state => shadeReaperCharges(state)
export function setCharges(state, value, api = null) {
  const next = Math.max(0, Math.floor(Number(value) || 0))
  if (typeof api?.setScenarioFlag === 'function') api.setScenarioFlag(CHARGE_FLAG, next)
  else (state.scenarioFlags ||= {})[CHARGE_FLAG] = next
  return next
}
export function addCharges(state, amount, api = null) {
  const delta = Math.floor(Number(amount) || 0)
  if (!delta) return chargesOf(state)
  const next = setCharges(state, chargesOf(state) + delta, api)
  if (delta > 0) api?.info?.(`🔑 影穑上放置 ${delta} 充能（共 ${next}）。`)
  else api?.info?.(`🔑 影穑上移除 ${-delta} 充能（共 ${next}）。`)
  return next
}
export const removeCharges = (state, amount, api = null) => addCharges(state, -Math.abs(Number(amount) || 0), api)

// 「记住」的事实（换到小猫 / 找到纪念品 / 让领事蒙羞 / 眺望彼端 / 分担痛苦 / 找到遗骨）。
export const rememberedFacts = state =>
  (Array.isArray(state?.scenarioFlags?.remembered) ? state.scenarioFlags.remembered : [])
export const hasRemembered = (state, fact) => Boolean(fact) && rememberedFacts(state).includes(fact)
export function rememberFact(state, fact, api = null) {
  if (!fact || hasRemembered(state, fact)) return false
  if (typeof api?.remember === 'function') {
    try {
      return Boolean(api.remember(fact))
    } catch {
      return false
    }
  }
  ;(state.scenarioFlags ||= {}).remembered ||= []
  state.scenarioFlags.remembered.push(fact)
  return true
}

// 福林特工：三档状态（重归特别小组 / 失踪 / 死亡；都缺省时按「独自行动」处理）。
export function flintStatus(state) {
  const records = state?.campaign?.records || {}
  if (records.flintRejoinedTheCell) return 'rejoined'
  if (records.agentFlintIsDead) return 'dead'
  if (records.agentFlintIsMissing) return 'missing'
  if (records.flintIsWorkingSolo || records.flintAbandonedHisSearch) return 'solo'
  return 'missing'
}
export const flintRejoined = state => flintStatus(state) === 'rejoined'

// ---------------------------------------------------------------------------
// 隐匿迷你卡（朱三娘的「隐匿 2」）
// ---------------------------------------------------------------------------
export const concealedAmountOf = code => {
  const declared = enemyRuleFor(code)?.concealed
  if (declared != null) return Number(declared) || 0
  return String(code) === TZU_SAN_NIANG ? CONCEALED_AMOUNT : 0
}
export const tzuMiniCards = state => concealedMiniCards(state)
  .filter(card => card.kind === TZU_KIND || card.kind === TZU_DECOY_KIND)
export const tzuMiniCardLocation = state =>
  tzuMiniCards(state).find(card => !card.decoy)?.locationId || null
export function clearTzuConcealed(state) {
  const group = tzuMiniCards(state)
  for (const card of group) {
    try {
      exposeMiniCard(state, card.id)
    } catch { /* 已取出 */ }
  }
  return group.length
}
/** 该把迷你卡分到哪里：有非弱点灵怪的地点；没有时退到「起始地点以外的地点」。 */
export function concealedSpotsForTzu(state) {
  const all = (state.locations || []).map(location => location.id)
  const withGeist = all.filter(id => geistEnemiesAt(state, id).length > 0)
  if (withGeist.length) return withGeist
  const start = chapterState(state).startLocation
  const others = all.filter(id => id !== start)
  return others.length ? others : all
}
/** 尽可能平均地分配（除不尽时按地点顺序补足；参考实现让领队选择多出的那张）。 */
export function evenPlacements(cards, locationIds) {
  const ids = [...new Set(locationIds)]
  if (!ids.length) return []
  const placements = ids.map(locationId => ({ locationId, count: 0 }))
  cards.forEach((_, index) => { placements[index % ids.length].count += 1 })
  return placements.filter(entry => entry.count > 0)
}
/** 结算朱三娘的「隐匿 2」：真身 + 2 诱饵，混洗后平均分配到地点。 */
export function resolveTzuConcealed(state, { locations = null, shuffle = null } = {}) {
  const spots = locations && locations.length ? locations : concealedSpotsForTzu(state)
  if (!spots.length) return []
  clearTzuConcealed(state)
  const cards = [{ kind: TZU_KIND, code: TZU_SAN_NIANG, decoy: false }]
  for (let index = 0; index < CONCEALED_AMOUNT; index += 1) cards.push({ kind: TZU_DECOY_KIND, decoy: true })
  const placements = evenPlacements(cards, spots)
  return distributeConcealed(state, { cards, placements, position: null, ...(shuffle ? { shuffle } : {}) })
}

/** 揭露（Expose）一张朱三娘的迷你卡：诱饵翻面移除；真身让她在该地点入场。 */
export function exposeAt(state, inv, miniCardId, api = null) {
  const card = concealedMiniCards(state).find(item => item.id === miniCardId)
  if (!card) return null
  if (card.kind !== TZU_KIND && card.kind !== TZU_DECOY_KIND) return null
  const locationId = card.locationId
  const result = exposeWithReaction(state, api, miniCardId, { seat: inv?.seat ?? null })
  if (result.decoy) {
    const data = chapterState(state)
    data.decoyExposed = (Number(data.decoyExposed) || 0) + 1
    api?.info?.(`🔓 揭露了一张诱饵（${locationName(state, locationId)}）：翻面并移除。`)
    return { ...result, locationId }
  }
  const enemy = spawnTzuAt(state, api, locationId)
  api?.info?.(`🔓 揭露了朱三娘的真身：她在「${locationName(state, locationId)}」入场。`)
  return { ...result, code: TZU_SAN_NIANG, locationId, enemyId: enemy?.id || null }
}

function bindShadeReaper(state, api, bearer) {
  const records = recordsFor(state)
  records.shadeReaperBearer = bearer
  const keys = api?.mechanics?.tsk?.keys
  if (typeof keys?.bind !== 'function') return false
  try {
    keys.bind(SHADE_REAPER_KEY.id, typeof bearer === 'number'
      ? { type: 'investigator', seat: bearer }
      : { type: 'none' })
    return true
  } catch {
    return false
  }
}
function shadeReaperKey(state) {
  return state?.campaign?.tsk?.keys?.keys?.[SHADE_REAPER_KEY.id] || null
}
/** Setup：初始化密钥并把它翻到[[动荡]]面（参考实现 createScarletKeyAt ... 、Unstable side faceup）。 */
export function ensureShadeReaper(state, api = null) {
  const keys = api?.mechanics?.tsk?.keys
  try {
    if (typeof keys?.initialize === 'function') {
      keys.initialize([{
        id: SHADE_REAPER_KEY.id,
        stableFace: SHADE_REAPER_KEY.stableFace,
        unstableFace: SHADE_REAPER_KEY.unstableFace,
      }])
    } else if (state.campaign?.tsk?.keys?.keys?.[SHADE_REAPER_KEY.id] == null) {
      state.campaign ||= {}
      state.campaign.tsk ||= {}
      state.campaign.tsk.keys ||= { version: 1, keys: {}, shifts: {} }
      state.campaign.tsk.keys.keys[SHADE_REAPER_KEY.id] = {
        id: SHADE_REAPER_KEY.id,
        stableFace: SHADE_REAPER_KEY.stableFace,
        unstableFace: SHADE_REAPER_KEY.unstableFace,
        stable: true,
        bearer: { type: 'none' },
        shiftedRound: null,
      }
    }
  } catch (error) {
    if (!/已经初始化/.test(String(error?.message || ''))) throw error
  }
  const record = shadeReaperKey(state)
  if (record && record.stable !== false) {
    let flipped = false
    if (typeof keys?.shift === 'function') {
      try {
        keys.shift(SHADE_REAPER_KEY.id, { force: true })
        flipped = true
      } catch { flipped = false }
    }
    if (!flipped) record.stable = false
  }
  // Setup 的「以动荡面附属」不是玩法中的变换：清掉「本轮已变换」记账，
  // 否则第一轮里调查员/朱三娘的第一次 Shift 会被密钥原语的每轮一次限制挡掉。
  if (record) record.shiftedRound = null
  bindShadeReaper(state, api, 'tzuSanNiang')
  return shadeReaperKey(state)
}
export const shadeReaperFace = state => {
  const record = shadeReaperKey(state)
  if (!record) return SHADE_REAPER_KEY.stableFace
  return record.stable ? SHADE_REAPER_KEY.stableFace : SHADE_REAPER_KEY.unstableFace
}

// ---------------------------------------------------------------------------
// 灵怪（Geist）：配对 / 生成 / 剧情翻面
// ---------------------------------------------------------------------------
export function geistEnemiesAt(state, locationId) {
  return (state.enemies || []).filter(enemy => !enemy.defeated && isGeistEnemy(enemy)
    && (locationId == null || enemy.location === locationId))
}
export function nonWeaknessGeists(state) {
  return geistEnemiesAt(state, null).filter(enemy => !enemy.subtype)
}
/** 灵怪条目声明的剧情面/事实（声明即接线；条目缺省时回落到 definition 的配对表）。 */
export function geistStoryOf(state, code) {
  void state
  const declared = enemyRuleFor(code)?.geist || {}
  const pair = geistPairOf(code) || {}
  return {
    story: declared.story || pair.story || null,
    fact: declared.fact || STORY_FACT_FALLBACK[declared.story || pair.story] || pair.fact || null,
    parley: declared.parley || pair.parley || null,
  }
}
/** 剧情卡条目声明的「解锁事实」（behavior 与测试共用的读点）。 */
export function storyFactOf(storyCode) {
  return assetRuleFor(storyCode)?.geistStory?.fact || STORY_FACT_FALLBACK[storyCode] || null
}
export function geistPairSpecOf(code) {
  const pair = geistPairOf(code)
  if (!pair) return null
  return { ...pair, fact: storyFactOf(pair.story) || pair.fact }
}

export function spawnGeist(state, api, code, locationId) {
  const enemy = safeCall(api, 'spawn', code, locationId)
  if (!enemy) return null
  const plot = geistStoryOf(state, code)
  enemy.geistStoryCode = plot.story
  if (chapterState(state).agenda3) {
    enemy.hunter = true
    enemy.retaliate = true
  }
  api?.info?.(`👻 「${cardNameOf(code)}」在「${locationName(state, locationId)}」现身。`)
  return enemy
}
function removeEnemyFromPlay(state, enemy, api = null) {
  if (!enemy) return false
  safeCall(api, 'disengage', enemy)
  if (typeof api?.setEnemyAside === 'function') {
    const id = api.setEnemyAside(enemy)
    if (id) return true
  }
  const index = (state.enemies || []).indexOf(enemy)
  if (index >= 0) state.enemies.splice(index, 1)
  if (enemy.engagedSeat != null) {
    const holder = state.investigators?.[enemy.engagedSeat]
    if (holder?.engaged) holder.engaged = holder.engaged.filter(id => id !== enemy.id)
    enemy.engagedSeat = null
  }
  return index >= 0
}
/**
 * 灵怪翻到剧情面并结算：
 *   · 队伍已记住对应事实 → 剧情卡加入胜利区（胜利 1），灵怪留在场外；
 *   · 否则 → 灵怪翻回敌人面（回到场上、治愈全部伤害、解除交战、横置）。
 * `outOfPlay` 表示引擎已经把它移出战场（「将要被击败」的强制路径）。
 */
export function resolveGeistStory(state, enemy, api = null, { outOfPlay = false } = {}) {
  const code = codeOf(enemy)
  const pair = geistPairSpecOf(code)
  if (!pair) return null
  const remembered = hasRemembered(state, pair.fact)
  const locationId = enemy.location
  if (remembered) {
    if (!outOfPlay) removeEnemyFromPlay(state, enemy, api)
    const data = chapterState(state)
    if (!data.storyVictories.includes(pair.story)) data.storyVictories.push(pair.story)
    if (typeof api?.scenario?.addStoryToVictory === 'function') api.scenario.addStoryToVictory(pair.story)
    else if (typeof api?.addStoryToVictory === 'function') api.addStoryToVictory(pair.story)
    api?.info?.(`🕯️ 「${cardNameOf(code)}」安息了：「${cardNameOf(pair.story)}」加入胜利区（胜利 1）。`)
    return { storyCode: pair.story, victory: true, fact: pair.fact }
  }
  if (outOfPlay) safeCall(api, 'putEnemyInPlay', enemy)
  enemy.damageTaken = 0
  enemy.exhausted = true
  safeCall(api, 'disengage', enemy)
  if (enemy.engagedSeat != null) {
    const holder = state.investigators?.[enemy.engagedSeat]
    if (holder?.engaged) holder.engaged = holder.engaged.filter(id => id !== enemy.id)
    enemy.engagedSeat = null
  }
  api?.info?.(`👻 「${cardNameOf(code)}」的剧情面没有解开（没有记住「${factLabel(pair.fact)}」）：`
    + `它翻回敌人面、治愈全部伤害、解除交战并横置（${locationName(state, locationId)}）。`)
  return { storyCode: pair.story, victory: false, fact: pair.fact }
}
function factLabel(fact) {
  const labels = {
    [REMEMBERED.tradedForAKitten]: '换到了一只小猫',
    [REMEMBERED.foundACheapMemento]: '找到了一件便宜的纪念品',
    [REMEMBERED.embarrassedTheConsulate]: '让领事蒙羞',
    [REMEMBERED.peeredBeyond]: '眺望彼端',
    [REMEMBERED.sharedADeepPain]: '分担了深沉的痛苦',
    [REMEMBERED.foundHiddenBones]: '找到了掩埋的遗骨',
  }
  return labels[fact] || String(fact || '')
}
/** 灵怪谈判：费用（随机弃手牌 / 承受恐惧 / 弃支援）→ 难度 6 - 支付量。 */
export function resolveGeistParley(state, inv, enemy, api) {
  const code = codeOf(enemy)
  const spec = geistStoryOf(state, code).parley
  if (!spec) return false
  let paid = 0
  if (spec.cost === 'discardRandomCards') {
    const max = Math.min(Number(spec.max) || 3, (inv.hand || []).length)
    if (max < 1) {
      api?.info?.('手牌不足：至少要随机弃掉 1 张手牌才能谈判。')
      return false
    }
    const amount = max === 1 ? 1 : Math.max(1, Math.min(max, Number(choiceFor(api, {
      kind: 'choice', source: code, seat: inv.seat,
      prompt: '从手中随机弃掉几张卡牌作为谈判费用？',
      options: Array.from({ length: max }, (_, index) => ({
        id: String(index + 1), label: `随机弃掉 ${index + 1} 张`,
      })),
    })) || 1))
    safeCall(api, 'discardRandomFromHand', inv.seat, amount)
    paid = amount
  } else if (spec.cost === 'takeHorror') {
    const max = Number(spec.max) || 3
    const amount = max === 1 ? 1 : Math.max(1, Math.min(max, Number(choiceFor(api, {
      kind: 'choice', source: code, seat: inv.seat,
      prompt: '受到几点恐惧作为谈判费用？',
      options: Array.from({ length: max }, (_, index) => ({
        id: String(index + 1), label: `受到 ${index + 1} 点恐惧`,
      })),
    })) || 1))
    safeCall(api, 'directHorror', inv.seat, amount)
    paid = amount
  } else if (spec.cost === 'discardAsset') {
    const assets = [...(inv.assets || [])]
    if (!assets.length) {
      api?.info?.('没有可弃掉的支援：无法支付谈判费用。')
      return false
    }
    const chosen = choiceFor(api, {
      kind: 'asset', source: code, seat: inv.seat,
      prompt: '弃掉你控制的一个支援作为谈判费用。',
      options: assets.map(asset => ({ id: asset.id, label: cardNameOf(codeOf(asset)) })),
    })
    const asset = assets.find(item => item.id === chosen) || assets[0]
    paid = Number(ALL_CARDS[codeOf(asset)]?.cost) || 0
    safeCall(api, 'discardAsset', inv.seat, asset.id)
  }
  const difficulty = Math.max(0, (Number(spec.difficulty) || 6) - paid)
  api?.test?.(inv.seat, spec.skill || 'willpower', difficulty, result => {
    if (!result?.success) {
      api?.info?.(`👻 谈判失败：难度 ${difficulty}。`)
      return
    }
    const current = (state.enemies || []).find(item => item.id === enemy.id)
    if (!current) return
    resolveGeistStory(state, current, api)
  }, 0, { type: 'scenario', label: `谈判：${cardNameOf(code)}`, code })
  return true
}

// ---------------------------------------------------------------------------
// 朱三娘 / 影穑
// ---------------------------------------------------------------------------
export function tzuEnemy(state) {
  return enemyOf(state, TZU_SAN_NIANG) || enemyOf(state, TZU_SAN_NIANG_OUT_FOR_BLOOD)
}
export const tzuInShadows = state => chapterState(state).tzuInShadows !== false
export const tzuOnOutForBlood = state => Boolean(enemyOf(state, TZU_SAN_NIANG_OUT_FOR_BLOOD))
export const currentAgendaCode = state => codeOf((state.agendas || [])[state.agendaIndex])
export const currentActCode = state => codeOf((state.acts || [])[state.actIndex])

export function spawnTzuAt(state, api, locationId) {
  const enemy = safeCall(api, 'spawn', TZU_SAN_NIANG, locationId)
  const data = chapterState(state)
  data.tzuInShadows = false
  if (enemy) {
    bindShadeReaper(state, api, 'tzuSanNiang')
    api?.info?.(`🌂 朱三娘在「${locationName(state, locationId)}」现身。`)
  }
  return enemy
}
/** 朱三娘返回阴影：治愈全部伤害、移出战场、真身迷你卡重新分配到她该去的地点。 */
export function returnTzuToShadows(state, api = null, { redistribute = true } = {}) {
  const enemy = tzuEnemy(state)
  const locationId = enemy?.location || null
  if (enemy) {
    enemy.damageTaken = 0
    removeEnemyFromPlay(state, enemy, api)
  }
  const data = chapterState(state)
  data.tzuInShadows = true
  data.tzuDoom = 0
  bindShadeReaper(state, api, 'tzuSanNiang')
  let cards = []
  if (redistribute) {
    try {
      cards = resolveTzuConcealed(state)
    } catch {
      cards = []
    }
  }
  api?.info?.(`🌫️ 朱三娘返回阴影：${cards.length} 张隐匿迷你卡重新分配`
    + `（${[...new Set(cards.map(card => locationName(state, card.locationId)))].join('、') || '无地点'}）。`)
  return { locationId, cards }
}
/** 翻到「血债血偿」面：+2×人数生命值、获得猎手/反击、胜利 1，并可由指定调查员交战。 */
export function flipTzuOutForBlood(state, api = null, { locationId = null, healAll = false, engageSeat = null } = {}) {
  let enemy = tzuEnemy(state)
  const target = locationId || enemy?.location || tzuMiniCardLocation(state) || chapterState(state).startLocation
  if (enemy) {
    const flipped = safeCall(api, 'flipEnemy', enemy, TZU_SAN_NIANG_OUT_FOR_BLOOD)
    if (!flipped) {
      enemy.code = TZU_SAN_NIANG_OUT_FOR_BLOOD
      enemy.originalCode = TZU_SAN_NIANG_OUT_FOR_BLOOD
      enemy.name = cardNameOf(TZU_SAN_NIANG_OUT_FOR_BLOOD)
    }
  } else {
    enemy = safeCall(api, 'spawn', TZU_SAN_NIANG_OUT_FOR_BLOOD, target)
  }
  if (!enemy) return null
  enemy.code = TZU_SAN_NIANG_OUT_FOR_BLOOD
  enemy.originalCode = TZU_SAN_NIANG_OUT_FOR_BLOOD
  const bonus = Number(enemyRuleFor(TZU_SAN_NIANG_OUT_FOR_BLOOD)?.healthPerPlayerBonus) || 2
  enemy.health = (Number(ALL_CARDS[TZU_SAN_NIANG_OUT_FOR_BLOOD]?.health) || 4) + bonus * numInvestigators(state)
  enemy.fight = Number(ALL_CARDS[TZU_SAN_NIANG_OUT_FOR_BLOOD]?.fight) || 2
  enemy.evade = Number(ALL_CARDS[TZU_SAN_NIANG_OUT_FOR_BLOOD]?.evade) || 2
  enemy.damage = Number(ALL_CARDS[TZU_SAN_NIANG_OUT_FOR_BLOOD]?.damage) || 1
  enemy.horror = Number(ALL_CARDS[TZU_SAN_NIANG_OUT_FOR_BLOOD]?.horror) || 1
  enemy.victory = 1
  if (enemyRuleFor(TZU_SAN_NIANG_OUT_FOR_BLOOD)?.hunter !== false) enemy.hunter = true
  if (enemyRuleFor(TZU_SAN_NIANG_OUT_FOR_BLOOD)?.retaliate !== false) enemy.retaliate = true
  if (healAll) enemy.damageTaken = 0
  if (engageSeat != null) safeCall(api, 'engage', enemy, engageSeat)
  chapterState(state).tzuInShadows = false
  bindShadeReaper(state, api, 'tzuSanNiang')
  api?.info?.(`🌂 朱三娘翻到「血债血偿」面（生命 ${enemy.health}、猎手、反击、胜利 1）。`)
  return enemy
}
/** 「血债血偿」的强制：攻击/躲避她成功时，每超过 1 点移除 1 充能并承受等量伤害/恐惧。 */
export function drainShadeReaperOnSuccess(state, inv, successBy, api = null) {
  const declared = enemyRuleFor(TZU_SAN_NIANG_OUT_FOR_BLOOD) || {}
  if (declared.drainsShadeReaperOnSuccess === false) return 0
  const charges = chargesOf(state)
  const amount = Math.min(Math.max(0, Math.floor(Number(successBy) || 0)), charges)
  if (amount <= 0) return 0
  removeCharges(state, amount, api)
  const half = Math.floor(amount / 2)
  let plan = null
  if (amount === 1) {
    const answer = choiceFor(api, {
      kind: 'choice', source: TZU_SAN_NIANG_OUT_FOR_BLOOD, seat: inv?.seat ?? 0,
      prompt: '朱三娘（血债血偿）：承受 1 点伤害或 1 点恐惧。',
      options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
    })
    plan = answer === 'horror' ? { damage: 0, horror: 1 } : { damage: 1, horror: 0 }
  } else if (amount % 2 === 0) {
    plan = { damage: half, horror: half }
  } else {
    const answer = choiceFor(api, {
      kind: 'choice', source: TZU_SAN_NIANG_OUT_FOR_BLOOD, seat: inv?.seat ?? 0,
      prompt: `朱三娘（血债血偿）：${half + 1} 伤害 + ${half} 恐惧，或 ${half} 伤害 + ${half + 1} 恐惧。`,
      options: [
        { id: 'damage', label: `${half + 1} 点伤害 + ${half} 点恐惧` },
        { id: 'horror', label: `${half} 点伤害 + ${half + 1} 点恐惧` },
      ],
    })
    plan = answer === 'horror' ? { damage: half, horror: half + 1 } : { damage: half + 1, horror: half }
  }
  // 幕 3「收割苦难」的反应：同地点调查员可以花线索取消等量伤害/恐惧。
  if (currentActCode(state) === RAW_CODES.act3) plan = harvesterCancelHarm(state, inv, plan, api)
  if (plan.damage > 0 || plan.horror > 0) safeCall(api, 'harm', inv?.seat, plan)
  api?.info?.(`🔑 血债血偿：移除影穑 ${amount} 充能，${inv?.name || '调查员'} 承受 `
    + `${plan.damage} 点伤害 / ${plan.horror} 点恐惧。`)
  return amount
}
/** 攻击/躲避成功的「超过难度点数」：优先读引擎的标准检定结果，其次用 value - difficulty。 */
function successByOf(state, result = null) {
  const last = state?.lastTestResult || {}
  if (Number.isFinite(last.successBy)) return Math.max(0, Number(last.successBy))
  if (Number.isFinite(result?.successBy)) return Math.max(0, Number(result.successBy))
  const value = Number(result?.value ?? last.value)
  const difficulty = Number(result?.difficulty ?? last.difficulty)
  if (Number.isFinite(value) && Number.isFinite(difficulty)) return Math.max(0, value - difficulty)
  return 0
}
/** 幕 3 的反应：朱三娘的强制效果造成伤害/恐惧时，同地点调查员可以花线索取消。 */
export function harvesterCancelHarm(state, inv, amounts, api = null) {
  const damage = Number(amounts?.damage) || 0
  const horror = Number(amounts?.horror) || 0
  if (!inv || damage + horror <= 0) return { damage, horror }
  const total = groupCluesAt(state, inv.location)
  if (total < 1) return { damage, horror }
  const answer = choiceFor(api, {
    kind: 'choice', source: RAW_CODES.act3, seat: inv.seat,
    prompt: `「收割苦难」：本地点调查员可以花任意数量线索取消同等伤害/恐惧（现有 ${total} 个线索）。`,
    options: [
      { id: '0', label: '不取消' },
      ...Array.from({ length: Math.min(total, damage + horror) }, (_, index) => ({
        id: String(index + 1), label: `花 ${index + 1} 个线索取消 ${index + 1} 点`,
      })),
    ],
  })
  const spend = Math.max(0, Math.min(Number(answer) || 0, total))
  if (!spend) return { damage, horror }
  spendGroupClues(state, api, spend, { locationId: inv.location })
  let cancelled = 0
  let leftDamage = damage
  let leftHorror = horror
  while (cancelled < spend && leftDamage + leftHorror > 0) {
    if (leftDamage > 0) { leftDamage -= 1; cancelled += 1 } else if (leftHorror > 0) { leftHorror -= 1; cancelled += 1 }
  }
  api?.info?.(`🕯️ 收割苦难：花 ${spend} 个线索取消了 ${cancelled} 点伤害/恐惧。`)
  return { damage: leftDamage, horror: leftHorror }
}

// ---------------------------------------------------------------------------
// 团队线索 / 时间 / 记录
// ---------------------------------------------------------------------------
export function investigatorsAt(state, locationId) {
  return aliveInvestigators(state).filter(inv => inv.location === locationId)
}
export function groupCluesAt(state, locationId) {
  return investigatorsAt(state, locationId).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
}
export function groupCluesAnywhere(state) {
  return aliveInvestigators(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
}
/** 团队共同花费线索：先行动者，再同地点（或任意地点）其余调查员；返回实际支付量。 */
export function spendGroupClues(state, api, amount, { locationId = null, anywhere = false } = {}) {
  let remaining = Math.max(0, Math.floor(Number(amount) || 0))
  if (!remaining) return 0
  const pool = anywhere ? aliveInvestigators(state) : investigatorsAt(state, locationId)
  let spent = 0
  for (const inv of pool) {
    if (!remaining) break
    const take = Math.min(remaining, Number(inv.clues) || 0)
    if (take <= 0) continue
    if (typeof api?.loseClues === 'function') api.loseClues(inv.seat, take)
    else inv.clues = (Number(inv.clues) || 0) - take
    remaining -= take
    spent += take
  }
  return spent
}
export function markTime(state, amount) {
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  if (!value) return 0
  const records = recordsFor(state)
  records.time = (Number(records.time) || 0) + value
  const map = state.campaign?.tsk?.map
  if (map) map.time = Number(records.time)
  return records.time
}
function recordFact(state, key, value = true) {
  const records = recordsFor(state)
  if (value === false) delete records[key]
  else records[key] = value
  return records[key]
}
function clearDoomInPlay(state, api, { except = null } = {}) {
  const cleared = []
  for (const card of [...(state.enemies || []), ...(state.storyAssets || []),
    ...(state.investigators || []).flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])])]) {
    if (!card || card === except) continue
    if (!(Number(card.doom) > 0)) continue
    if (typeof api?.clearDoomOnCard === 'function') api.clearDoomOnCard(card)
    else delete card.doom
    cleared.push(card)
  }
  const agendaDoom = Number(state.doom) || 0
  if (agendaDoom > 0 && typeof api?.removeDoom === 'function') api.removeDoom(agendaDoom)
  else state.doom = 0
  chapterState(state).tzuDoom = except ? (Number(chapterState(state).tzuDoom) || 0) : 0
  return cleared.length + (agendaDoom ? 1 : 0)
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
function placeLocationInstance(state, id, { revealed = true } = {}) {
  const definition = LOCATIONS[id]
  if (!definition) return null
  state.locations ||= []
  const existing = state.locations.find(location => location.id === id)
  if (existing) return existing
  const maxClues = clueValueOf(state, id)
  const location = {
    ...definition,
    id,
    code: definition.originalCode || definition.code,
    connections: [...(definition.connections || [])],
    revealed,
    clues: revealed ? maxClues : 0,
    maxClues,
    ...(id === STATION_WEST_WING ? { resign: true } : {}),
    ...(id === WAYANG_KULIT_THEATER ? { shroud: 0 } : {}),
  }
  state.locations.push(location)
  return location
}
function connectLocations(state) {
  for (const location of state.locations || []) {
    const definition = LOCATIONS[location.id]
    if (!definition) continue
    const placed = new Set((state.locations || []).map(item => item.id))
    location.connections = (definition.connections || []).filter(id => placed.has(id))
  }
}
function chooseGeists(state, helper) {
  const data = chapterState(state)
  if (data.geists.uncannyShadow) return data.geists
  const picks = {}
  const removed = []
  for (const pair of [
    ['uncannyShadow', [RAW_CODES.uncannyShadowPlayful, RAW_CODES.uncannyShadowTimorous]],
    ['buriedMiner', [RAW_CODES.buriedMinerMemento, RAW_CODES.buriedMinerBones]],
    ['slainForeman', [RAW_CODES.slainForemanSympathy, RAW_CODES.slainForemanFamilial]],
  ]) {
    const [role, codes] = pair
    const chosen = shuffleWith(state, codes, helper)[0] || codes[0]
    picks[role] = chosen
    for (const code of codes) if (code !== chosen) removed.push(code)
  }
  data.geists = picks
  data.removedGeists = removed
  return picks
}
function setupChargesByTime(state, api) {
  const time = Number(recordsFor(state).time) || 0
  if (time >= 27) {
    addCharges(state, 9, api)
    safeCall(api, 'addDoom', 1)
    api?.info?.('🔑 时间已过 27：影穑上放置 9 充能，并在密谋上放 1 毁灭。')
  } else if (time >= 19) {
    addCharges(state, 6, api)
  } else if (time >= 12) {
    addCharges(state, 3, api)
  }
  return chargesOf(state)
}

// ---------------------------------------------------------------------------
// 幕间：降头师（幕 1 背面）
// ---------------------------------------------------------------------------
export function playInspectorFlint(state, api, seat) {
  const inv = state.investigators?.[seat]
  if (!inv) return null
  if ((inv.deck || []).includes(INSPECTOR_FLINT)) safeCall(api?.scenario, 'putInHand', seat, INSPECTOR_FLINT)
  if (!(inv.hand || []).includes(INSPECTOR_FLINT)) return null
  if (!safeCall(api, 'putAssetIntoPlay', seat, INSPECTOR_FLINT)) return null
  const asset = (inv.assets || []).find(item => codeOf(item) === INSPECTOR_FLINT)
  if (asset) safeCall(api, 'exemptAssetSlot', asset, 'ally')
  api?.info?.(`🕵️ ${inv.name} 让福林探员入场（本场景不占盟友槽）。`)
  return asset
}
export function resolveBomohInterlude(state, api = null) {
  const data = chapterState(state)
  if (data.interludeDone) return false
  data.interludeDone = true
  // 1) 美拉提的商店入场并揭示；解除所有交战，全队移过去。
  placeLocationInstance(state, MELATIS_SHOP, { revealed: true })
  placeLocationInstance(state, TIN_MINE, { revealed: true })
  placeLocationInstance(state, WAYANG_KULIT_THEATER, { revealed: true })
  connectLocations(state)
  for (const inv of aliveInvestigators(state)) {
    for (const enemy of (state.enemies || []).slice()) {
      if (enemy.engagedSeat === inv.seat) safeCall(api, 'disengage', enemy)
    }
    if (inv.location !== MELATIS_SHOP) safeCall(api, 'moveInvestigator', inv.seat, MELATIS_SHOP)
  }
  api?.info?.('🕯️ 幕间「降头师」：美拉提的商店、锡矿与哇扬皮影偶戏剧场入场；'
    + '调查员解除交战并移入美拉提的商店。')
  // 2) 福林特工状态分支：重归特别小组 → 降头师 2；否则划掉「失踪」、记「死亡」并在影穑上放 2 充能。
  if (flintRejoined(state)) {
    api?.info?.(scenario.theBomoh?.rejoined || '福林重新归队。')
  } else {
    recordFact(state, 'agentFlintIsMissing', false)
    recordFact(state, 'agentFlintIsDead', true)
    addCharges(state, 2, api)
    api?.info?.(scenario.theBomoh?.missing || '福林特工已死。')
  }
  // 3) 三张放一边的灵怪按卡面地点生成（被杀害的工头 → 西翼、诡怪的阴影 → 剧场、被掩埋的矿工 → 锡矿）。
  const geists = chooseGeists(state, null)
  const spawns = [
    ['slainForeman', STATION_WEST_WING],
    ['uncannyShadow', WAYANG_KULIT_THEATER],
    ['buriedMiner', TIN_MINE],
  ]
  for (const [role, locationId] of spawns) {
    const code = geists[role]
    if (!code || !locationOf(state, locationId)) continue
    const pair = geistPairOf(code)
    if ((pair && (enemyOf(state, pair.enemy) || enemyOf(state, pair.story))) || enemyOf(state, code)) continue
    spawnGeist(state, api, code, locationId)
  }
  // 4) 朱三娘返回阴影并把迷你卡分到有灵怪的地点；移除场上其它毁灭（她自己的保留）。
  const tzu = tzuEnemy(state)
  clearTzuConcealed(state)
  data.tzuInShadows = true
  if (tzu) removeEnemyFromPlay(state, tzu, api)
  resolveTzuConcealed(state)
  clearDoomInPlay(state, api, { except: null })
  api?.info?.('🌂 朱三娘返回阴影：迷你卡按有灵怪的地点重新分配；场上其它毁灭被移除'
    + '（若当前是密谋 1a，将直接推进到密谋 2a 而不结算 1b）。')
  // 5) 密谋 1a → 直接推进到 2a（不结算 1b）；动作由 agendaReveal 触发时不会重复（见 agendaReveal）。
  const pendingAgenda = codeOf((state.agendas || [])[state.agendaIndex])
  if (pendingAgenda === RAW_CODES.agenda1 && data.agenda1BackResolving !== true
    && typeof api?.advanceAgendaTo === 'function') {
    api.advanceAgendaTo(1)
  }
  return true
}

// ---------------------------------------------------------------------------
// 地点行动（地点不建条目；本章七张地点的卡面能力在这里统一实现）
// ---------------------------------------------------------------------------
const FAST_FLAG = 'shadesEastWingFast'
function eastWingFastUsed(state, inv) {
  const used = chapterState(state)[FAST_FLAG]
  return Boolean(used && used.turn === state.turnSerial && used.seat === inv.seat)
}
function useEastWingFast(state, inv) {
  chapterState(state)[FAST_FLAG] = { turn: state.turnSerial, seat: inv.seat }
}
function performEastWingFast(state, inv, api) {
  if (eastWingFastUsed(state, inv)) return false
  if ((Number(inv.resources) || 0) < 2) return false
  const targets = (locationOf(state, inv.location)?.connections || []).filter(id => locationOf(state, id))
  if (!targets.length) return false
  const picked = targets.length === 1 ? targets[0] : choiceFor(api, {
    kind: 'location', source: RAW_CODES.stationEastWing, seat: inv.seat,
    prompt: '支付 2 资源：移动到一个连接地点。',
    options: targets.map(id => ({ id, label: locationName(state, id) })),
  })
  const destination = targets.includes(picked) ? picked : targets[0]
  safeCall(api, 'loseResources', inv.seat, 2)
  safeCall(api, 'moveInvestigator', inv.seat, destination)
  useEastWingFast(state, inv)
  api?.info?.(`🚉 吉隆坡火车站（东翼）：支付 2 资源移动到「${locationName(state, destination)}」。`)
  return true
}
function performEastWingKitten(state, inv, api) {
  const data = chapterState(state)
  if (data.kittenUsed) return false
  const assets = [...(inv.assets || [])]
  if (!assets.length) return false
  const picked = assets.length === 1 ? assets[0].id : choiceFor(api, {
    kind: 'asset', source: RAW_CODES.stationEastWing, seat: inv.seat,
    prompt: '弃掉一个你控制的支援（换取半价资源，并记住「换到了一只小猫」）。',
    options: assets.map(asset => ({ id: asset.id, label: cardNameOf(codeOf(asset)) })),
  })
  const asset = assets.find(item => item.id === picked) || assets[0]
  const gain = Math.floor((Number(ALL_CARDS[codeOf(asset)]?.cost) || 0) / 2)
  safeCall(api, 'discardAsset', inv.seat, asset.id)
  if (gain > 0) safeCall(api, 'gainResources', inv.seat, gain)
  rememberFact(state, REMEMBERED.tradedForAKitten, api)
  data.kittenUsed = true
  api?.info?.(`🐱 换到了一只小猫：弃掉「${cardNameOf(codeOf(asset))}」，获得 ${gain} 资源（团队每场游戏一次）。`)
  return true
}
function performWestWingMemento(state, inv, api) {
  const cost = numInvestigators(state)
  if (groupCluesAt(state, inv.location) < cost) return false
  spendGroupClues(state, api, cost, { locationId: inv.location })
  for (const member of investigatorsAt(state, inv.location)) safeCall(api, 'healHorror', member.seat, 2)
  rememberFact(state, REMEMBERED.foundACheapMemento, api)
  api?.info?.(`🪙 找到了一件便宜的纪念品：本地点的调查员各治愈 2 点恐惧。`)
  return true
}
function performSelangorParley(state, inv, api) {
  const data = chapterState(state)
  if (data.selangorRound === state.round) return false
  if ((Number(inv.resources) || 0) < 2) return false
  const investigators = investigatorsAt(state, inv.location)
  const allies = investigators.flatMap(owner => (owner.assets || [])
    .filter(asset => hasTrait(ALL_CARDS[codeOf(asset)], 'Ally'))
    .map(asset => ({ owner, asset })))
  const options = [
    ...investigators.map(member => ({ id: `inv:${member.seat}`, label: `${member.name}（治愈 1 伤害与 1 恐惧）` })),
    ...allies.map(({ owner, asset }) => ({ id: `asset:${asset.id}`, label: `${cardNameOf(codeOf(asset))}（${owner.name} 的盟友）` })),
  ]
  if (!options.length) return false
  const picked = options.length === 1 ? options[0].id : choiceFor(api, {
    kind: 'choice', source: RAW_CODES.selangorClub, seat: inv.seat,
    prompt: '花费 2 资源：治愈你所在地点的一位调查员或一个[[盟友]]支援 1 点伤害与 1 点恐惧。',
    options,
  })
  const choice = options.find(option => option.id === picked) || options[0]
  safeCall(api, 'loseResources', inv.seat, 2)
  if (String(choice.id).startsWith('inv:')) {
    const seat = Number(String(choice.id).slice(4))
    safeCall(api, 'healDamage', seat, 1)
    safeCall(api, 'healHorror', seat, 1)
  } else {
    const assetId = String(choice.id).slice(6)
    const found = allies.find(entry => entry.asset.id === assetId) || allies[0]
    safeCall(api, 'healAsset', found.asset, { damage: 1, horror: 1 })
  }
  data.selangorRound = state.round
  api?.info?.('🍽️ 雪兰莪俱乐部：花费 2 资源享用珍馐佳酿，治愈 1 点伤害与 1 点恐惧。')
  return true
}
function performPadangParley(state, inv, api) {
  const data = chapterState(state)
  if (data.padangRound === state.round) return false
  api?.test?.(inv.seat, 'combat', 4, result => {
    if (!result?.success) {
      rememberFact(state, REMEMBERED.embarrassedTheConsulate, api)
      api?.info?.('🏏 加入球赛失败：记住「让领事蒙羞」。')
      return
    }
    chapterState(state).padangRound = state.round
    safeCall(api, 'gainResources', inv.seat, 3)
    api?.info?.('🏏 加入球赛成功：获得 3 资源（本轮最多成功一次）。')
  }, 0, { type: 'scenario', label: '谈判：加入球赛', code: RAW_CODES.selangorClubPadang })
  return true
}
function performMelatiPeek(state, inv, api) {
  const cost = numInvestigators(state)
  if (groupCluesAt(state, inv.location) < cost) return false
  spendGroupClues(state, api, cost, { locationId: inv.location })
  rememberFact(state, REMEMBERED.peeredBeyond, api)
  const geists = nonWeaknessGeists(state)
  const minis = concealedMiniCards(state)
  const options = [
    ...geists.map(enemy => ({ id: `enemy:${enemy.id}`, label: `${cardNameOf(codeOf(enemy))}（另一面）` })),
    ...minis.map(card => ({ id: `mini:${card.id}`, label: `隐匿迷你卡（${locationName(state, card.locationId)}）` })),
  ]
  if (!options.length) return true
  const picked = options.length === 1 ? options[0].id : choiceFor(api, {
    kind: 'choice', source: RAW_CODES.melatisShop, seat: inv.seat,
    prompt: '「眺望彼端」：查看一张隐匿迷你卡的已揭示面，或一个灵怪敌人的另一面。',
    options,
  })
  const choice = options.find(option => option.id === picked) || options[0]
  if (String(choice.id).startsWith('enemy:')) {
    const enemy = (state.enemies || []).find(item => `enemy:${item.id}` === choice.id)
    const plot = enemy ? geistStoryOf(state, codeOf(enemy)) : null
    const text = plot ? `${cardNameOf(plot.story)}\n\n${cardTextOf(plot.story)}` : '（看不到另一面）'
    safeCall(api, 'privateInfo', inv.seat, `🔍 灵怪的另一面：${text}`)
  } else {
    const mini = concealedMiniCards(state).find(card => `mini:${card.id}` === choice.id)
    const label = mini
      ? (mini.decoy ? '一张诱饵（翻面后移除）' : `真身：${cardNameOf(TZU_SAN_NIANG)}`)
      : '（已经不在场）'
    safeCall(api, 'privateInfo', inv.seat, `🔍 隐匿迷你卡的已揭示面：${label}`)
  }
  api?.info?.('🔍 记住「眺望彼端」。')
  return true
}
function performWayangHeal(state, inv, api) {
  const cost = numInvestigators(state)
  if (groupCluesAt(state, inv.location) < cost) return false
  spendGroupClues(state, api, cost, { locationId: inv.location })
  for (const member of investigatorsAt(state, inv.location)) safeCall(api, 'healDamage', member.seat, 2)
  rememberFact(state, REMEMBERED.sharedADeepPain, api)
  api?.info?.('🎭 哇扬皮影偶戏剧场：分担了深沉的痛苦，本地点的调查员各治愈 2 点伤害。')
  return true
}
function performTinMineTest(state, inv, api) {
  const data = chapterState(state)
  if (data.tinMineUsed) return false
  const cost = numInvestigators(state)
  const canPay = groupCluesAt(state, inv.location) >= cost
  const answer = canPay ? choiceFor(api, {
    kind: 'choice', source: RAW_CODES.tinMine, seat: inv.seat,
    prompt: `共同花费 ${cost} 个线索让本次检定自动成功？`,
    options: [{ id: 'pay', label: `花费 ${cost} 个线索（自动成功）` }, { id: 'skip', label: '不花费' }],
  }) : null
  if (answer === 'pay') spendGroupClues(state, api, cost, { locationId: inv.location })
  api?.test?.(inv.seat, 'agility', 6, result => {
    if (answer === 'pay' || result?.success) {
      chapterState(state).tinMineUsed = true
      safeCall(api, 'drawCards', inv.seat, 2)
      rememberFact(state, REMEMBERED.foundHiddenBones, api)
      api?.info?.('⛏️ 锡矿：找到了掩埋的遗骨，抽取 2 张卡牌（团队每场游戏一次）。')
      return
    }
    api?.info?.('⛏️ 锡矿检定失败。')
  }, 0, { type: 'scenario', label: '检定：寻找遗骨', code: RAW_CODES.tinMine })
  return true
}

// ---------------------------------------------------------------------------
// 遭遇卡（09677 折磨 / 09678 魂灵收割）
// ---------------------------------------------------------------------------
function excruciate(state, inv, card, api) {
  const rule = treacheryRuleFor(codeOf(card)) || {}
  const charge = Number(rule.chargeOnReveal) || 1
  addCharges(state, charge, api)
  const charges = chargesOf(state)
  const test = {
    skill: rule.testSkill || 'willpower',
    difficulty: Number(rule.testDifficulty) || 3,
  }
  const atThreshold = rule.testDifficultyAtCharges
  const difficulty = atThreshold && charges >= (Number(atThreshold.atLeast) || 8)
    ? (Number(atThreshold.difficulty) || 6)
    : test.difficulty
  const failDamage = Number(rule.failChoice?.damage) || 2
  api?.test?.(inv.seat, test.skill, difficulty, result => {
    if (result?.success) return
    const failedBy = Math.max(0, difficulty - (Number(result?.value) || 0))
    const canDiscard = (inv.hand || []).length > 0 && rule.failChoice?.discardCardsPerFailedBy !== false
    const answer = canDiscard ? choiceFor(api, {
      kind: 'choice', source: RAW_CODES.excruciate, seat: inv.seat,
      prompt: `「酷刑折磨」失败 ${failedBy} 点：随机弃掉 ${failedBy} 张手牌，或受到 ${failDamage} 点伤害。`,
      options: [
        { id: 'discard', label: `随机弃掉 ${failedBy} 张手牌` },
        { id: 'damage', label: `受到 ${failDamage} 点伤害` },
      ],
    }) : 'damage'
    if (answer === 'discard') {
      const amount = Math.min(failedBy, (inv.hand || []).length)
      safeCall(api, 'discardRandomFromHand', inv.seat, amount)
      api?.info?.(`🎭 酷刑折磨：随机弃掉 ${amount} 张手牌。`)
      return
    }
    safeCall(api, 'damage', inv.seat, failDamage)
    api?.info?.(`🎭 酷刑折磨：受到 ${failDamage} 点伤害。`)
  }, 0, { type: 'encounter', label: card?.name || '酷刑折磨', code: RAW_CODES.excruciate })
}
function spiritHarvest(state, inv, card, api) {
  const rule = treacheryRuleFor(codeOf(card)) || {}
  const answer = choiceFor(api, {
    kind: 'choice', source: RAW_CODES.spiritHarvest, seat: inv.seat,
    prompt: '「魂灵收割」：选择一项。',
    options: [
      { id: 'damage', label: '每位调查员受到 1 点伤害和 1 点恐惧' },
      { id: 'tzu', label: '朱三娘变换影穑，然后在上面放 2 充能' },
    ],
  }) || 'damage'
  if (answer === 'tzu' && rule.shiftKey !== false) {
    shiftShadeReaper(state, inv.seat, api, { by: 'tzuSanNiang' })
    addCharges(state, Number(rule.charges) || 2, api)
    return
  }
  const damage = Number(rule.damage) || 1
  const horror = Number(rule.horror) || 1
  for (const member of aliveInvestigators(state)) {
    safeCall(api, 'harm', member.seat, { damage, horror })
  }
  api?.info?.(`🎭 魂灵收割：每位调查员受到 ${damage} 点伤害和 ${horror} 点恐惧。`)
}
const TREACHERY_HANDLERS = Object.freeze({ excruciate, spiritHarvest })
function treacheryHandlerFor(code) {
  const rule = treacheryRuleFor(code) || {}
  if (rule.resolveKind && TREACHERY_HANDLERS[rule.resolveKind]) return TREACHERY_HANDLERS[rule.resolveKind]
  return TREACHERY_HANDLERS[code] || null
}

// ---------------------------------------------------------------------------
// 影穑（绯红密钥）的 Shift：两面效果都由条目 `assetRule.shift` 声明，本函数只结算 + 翻面。
// ---------------------------------------------------------------------------
export function shiftShadeReaper(state, seat, api = null, { by = 'investigator' } = {}) {
  const face = shadeReaperFace(state)
  const rule = assetRuleFor(face)?.shift
  if (!rule) return null
  const inv = (state.investigators || []).find(item => item.seat === seat) || aliveInvestigators(state)[0] || null
  if (rule.kind === 'moveAndClash') {
    const excluded = new Set((rule.excludeTraits || [ELITE_TRAIT]).map(value => String(value).toLowerCase()))
    const here = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === inv?.location
      && !(enemy.traits || []).some(trait => excluded.has(String(trait).toLowerCase())))
    if (here.length) {
      const picked = here.length === 1 ? here[0].id : choiceFor(api, {
        kind: 'enemy', source: SHADE_REAPER_KEY.stableFace, seat: inv?.seat ?? 0,
        prompt: '「影穑」（稳定面）：选择你所在地点的一个非[[精英]]敌人。',
        options: here.map(enemy => ({ id: enemy.id, label: cardNameOf(codeOf(enemy)) })),
      })
      const enemy = here.find(item => item.id === picked) || here[0]
      const connections = (locationOf(state, enemy.location)?.connections || []).filter(id => locationOf(state, id))
      if (connections.length) {
        const moveTo = choiceFor(api, {
          kind: 'location', source: SHADE_REAPER_KEY.stableFace, seat: inv?.seat ?? 0,
          prompt: `可以把这个敌人移动到一个连接地点（${cardNameOf(codeOf(enemy))}）。`,
          options: [{ id: 'skip', label: '不移动' }, ...connections.map(id => ({ id, label: locationName(state, id) }))],
        })
        if (connections.includes(moveTo)) {
          safeCall(api, 'moveEnemy', enemy, moveTo)
          api?.info?.(`🔑 影穑：把「${cardNameOf(codeOf(enemy))}」移动到「${locationName(state, moveTo)}」。`)
        }
      }
      const others = (state.enemies || []).filter(item => item !== enemy && !item.defeated
        && item.location === enemy.location)
      if (others.length) {
        const targetId = choiceFor(api, {
          kind: 'enemy', source: SHADE_REAPER_KEY.stableFace, seat: inv?.seat ?? 0,
          prompt: `可以强迫「${cardNameOf(codeOf(enemy))}」攻击同地点的另一个敌人（以它的恐惧作为伤害）。`,
          options: [{ id: 'skip', label: '不攻击' }, ...others.map(item => ({ id: item.id, label: cardNameOf(codeOf(item)) }))],
        })
        const target = others.find(item => item.id === targetId)
        if (target) {
          const amount = Number(enemy.horror) || 0
          if (amount > 0) safeCall(api, 'damageEnemy', target.id, amount, inv?.seat ?? null, SHADE_REAPER_KEY.stableFace)
          api?.info?.(`🔑 影穑：「${cardNameOf(codeOf(enemy))}」对「${cardNameOf(codeOf(target))}」造成 ${amount} 点伤害。`)
        }
      }
    }
  } else if (rule.kind === 'loseActions') {
    const perInvestigator = Number(rule.actionsPerInvestigator) || 1
    for (const member of aliveInvestigators(state)) {
      if (member.seat === state.currentSeat) {
        safeCall(api, 'loseActions', member.seat, perInvestigator)
      } else {
        const data = chapterState(state)
        data.pendingActionLoss[member.seat] = (Number(data.pendingActionLoss[member.seat]) || 0) + perInvestigator
      }
    }
    api?.info?.('🔑 影穑（动荡面）：每位调查员失去 1 个行动（不在自己回合的延到其下个回合）。')
  }
  let shifted = null
  const flipRule = rule.flipOnShift || 'always'
  const shouldFlip = flipRule === 'always' || (flipRule === 'investigatorOnly' && by === 'investigator')
  if (shouldFlip) {
    let blocked = false
    if (typeof api?.mechanics?.tsk?.keys?.shift === 'function') {
      try {
        shifted = api.mechanics.tsk.keys.shift(SHADE_REAPER_KEY.id, by === 'tzuSanNiang' ? { force: true } : undefined)
      } catch (error) {
        if (/本轮已经变换过/.test(String(error?.message || ''))) blocked = true
        shifted = null
      }
    }
    if (!shifted && !blocked) {
      const record = shadeReaperKey(state)
      if (record) {
        record.stable = !record.stable
        shifted = { id: record.id, stable: record.stable }
      }
    }
    if (blocked) {
      api?.info?.('🔑 影穑本轮已经变换过：不再翻面。')
      return { face, kind: rule.kind, stable: shadeReaperKey(state)?.stable ?? null, blocked: true }
    }
    api?.info?.(`🔑 影穑变换：${shifted?.stable ? '动荡面 → 稳定面' : '稳定面 → 动荡面'}`
      + `${by === 'tzuSanNiang' ? '（朱三娘变换）' : ''}。`)
  } else {
    api?.info?.('🔑 影穑（动荡面）：由朱三娘变换，不翻回稳定面。')
  }
  return { face, kind: rule.kind, stable: shadeReaperKey(state)?.stable ?? null }
}

// ---------------------------------------------------------------------------
// behavior
// ---------------------------------------------------------------------------
const REFERENCE_ACT_CODE = RAW_CODES.act1
export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes: Object.freeze([
    ...GEIST_ENEMY_CODES, ...TZU_FACE_CODES, RAW_CODES.excruciate, RAW_CODES.spiritHarvest,
    ...GEIST_PAIRS.map(pair => pair.story), RAW_CODES.shadeReaperStable, RAW_CODES.shadeReaperUnstable,
  ]),
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: SHADES_OF_SUFFERING_TOKEN_MEANINGS,
  recordReads: RECORD_READS,
  recordWrites: RECORD_WRITES,
  resolutions: Object.keys(resolutions),
  gatherGroups: GATHER_GROUPS,

  // ---- 起始地点：福林重归 → 雪兰莪俱乐部；否则吉隆坡火车站（西翼） ----
  startLocation(state) {
    return flintRejoined(state) ? SELANGOR_CLUB : STATION_WEST_WING
  },

  // 福林探员从牌组搜索入场（Setup 时「重归特别小组」分支；不占盟友槽）。
  playInspectorFlint,

  // ---- 开场：福林去过吉隆坡 → Intro 1（记录重归 + 可把福林加入牌组）；否则 Intro 2 ----
  preScenarioSetup(state, events, api) {
    const data = chapterState(state)
    if (data.introResolved) return
    data.introResolved = true
    const records = recordsFor(state)
    const traveled = Boolean(records.flintTraveledToKualaLumpur)
    data.intro = traveled ? 'rejoined' : 'missing'
    if (traveled) {
      recordFact(state, 'flintRejoinedTheCell', true)
      recordFact(state, 'agentFlintIsMissing', false)
      api?.info?.(scenario.introBranches?.flintTraveledToKualaLumpur || '开场 1：福林重归特别小组。')
      if (typeof campaignCardChange === 'function' && state.campaign?.investigators?.length) {
        const alive = aliveInvestigators(state)
        const answer = alive.length > 1 ? choiceFor(api, {
          kind: 'story', source: 'shadesIntro', seat: state.campaign.leadSeat ?? alive[0].seat,
          prompt: '福林重归特别小组：哪位调查员把「福林探员」加入牌组（不计入牌组张数）？',
          options: [{ id: 'skip', label: '不加入' },
            ...alive.map(inv => ({ id: String(inv.seat), label: inv.name }))],
        }) : String(alive[0]?.seat ?? 0)
        const seat = Number(answer)
        if (Number.isInteger(seat) && state.campaign.investigators[seat]) {
          try {
            campaignCardChange(state.campaign, seat, INSPECTOR_FLINT, 'add', 'shadesOfSuffering')
            // 引擎在准备调查员牌组之后才调 preScenarioSetup，因此同一次执行里也要把这张剧情卡
            // 放进本场的在局牌组（战役记录 + 在局牌组两处一致，供 Setup 时搜索入场）。
            const inPlayDeck = state.investigators?.[seat]?.deck
            if (Array.isArray(inPlayDeck) && !inPlayDeck.includes(INSPECTOR_FLINT)) inPlayDeck.push(INSPECTOR_FLINT)
            data.flintSeat = seat
            api?.info?.(`🕵️ 福林探员加入座位 ${seat + 1} 的牌组（不计入牌组张数）。`)
          } catch (error) {
            api?.info?.(`🕵️ 福林探员无法加入牌组：${error?.message || '战役记录不可用'}。`)
          }
        }
      }
    } else {
      api?.info?.(scenario.introBranches?.agentFlintIsMissing || '开场 2：福林特工失踪。')
    }
    ensureShadeReaper(state, api)
  },

  // ---- 布置：4 张地点入场、三张放一边、三对灵怪各留一张、朱三娘隐匿 2、影穑按时间充能 ----
  setupLocations(state, events, helper = {}) {
    const data = chapterState(state)
    behavior.preScenarioSetup(state, events, helper.api)
    const start = behavior.startLocation(state)
    data.startLocation = start
    for (const id of SETUP_LOCATION_IDS) placeLocationInstance(state, id, { revealed: true })
    connectLocations(state)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside ||= []
    state.scenarioZones.victory ||= []
    state.scenarioZones.removed ||= []
    const geists = chooseGeists(state, helper)
    for (const code of Object.values(geists)) {
      if (!state.scenarioZones.setAside.includes(code)) state.scenarioZones.setAside.push(code)
    }
    for (const code of data.removedGeists) {
      if (!state.scenarioZones.removed.includes(code)) state.scenarioZones.removed.push(code)
    }
    for (const code of [TZU_SAN_NIANG, RAW_CODES.shadeReaperStable]) {
      if (!state.scenarioZones.setAside.includes(code)) state.scenarioZones.setAside.push(code)
    }
    // 密谋 2「单人游戏毁灭阈值 +1」（在阶段数据上改写；引擎没有阈值修正读点）。
    const agenda2 = (state.agendas || [])[1]
    if (agenda2 && numInvestigators(state) === 1) {
      agenda2.doomThreshold = (Number(agenda2.doomThreshold) || AGENDA2.doomThreshold) + 1
    }
    ensureShadeReaper(state, helper.api)
    setupChargesByTime(state, helper.api)
    resolveTzuConcealed(state)
    // 「福林重归特别小组」时，调查员可以从牌组搜索福林并让他入场（本场景不占盟友槽）。
    if (flintRejoined(state) && Number.isInteger(data.flintSeat)) playInspectorFlint(state, helper.api, data.flintSeat)
    helper.info?.(state, events, `🏙️ 苦痛之影：起始地点「${locationName(state, start)}」；`
      + `灵怪 ${Object.values(geists).map(code => cardNameOf(code)).join('、')} 放一边；`
      + `朱三娘以隐匿 ${CONCEALED_AMOUNT} 入场；影穑 ${chargesOf(state)} 充能（${shadeReaperFace(state) === SHADE_REAPER_KEY.unstableFace ? '动荡面' : '稳定面'}）。`)
    // 已把地点写进 state.locations；返回空数组避免引擎再把 startLocation 字符串当数组迭代。
    return []
  },

  // ---- 混乱标记：X 依赖影穑充能；灵怪在场时 tablet 会额外揭示/自动失败 ----
  resolveChaosToken(state, inv, token, api = null) {
    return shadesOfSufferingChaosToken(state, inv, token, api)
  },

  // ---- 检定后的标记连带效果 + 锡矿的「失败后受到 1 点伤害」 ----
  afterTest(state, inv, result, api) {
    const riders = shadesOfSufferingAfterTest(state, inv, result)
    for (const rider of riders) {
      if (rider === 'cultistCharge') {
        addCharges(state, 1, api)
        api?.info?.('🎭 [cultist]：检定失败且低于难度至少 2 点，在影穑上放置 1 充能。')
      }
    }
    if (inv?.location === TIN_MINE && result?.success === false) {
      safeCall(api, 'damage', inv.seat, 1)
      api?.info?.(`⛏️ 锡矿：${inv.name || '调查员'} 在锡矿技能检定失败，受到 1 点伤害。`)
    }
    return riders
  },

  // ---- Wayang Kulit 的帷幕 = ⌈影穑充能 / 2⌉（上限 8） ----
  locationShroudModifier(state, location) {
    if (location?.id !== WAYANG_KULIT_THEATER) return 0
    return Math.min(8, Math.ceil(chargesOf(state) / 2))
  },

  // ---- 灵怪生成：记下它的剧情面（条目声明） ----
  enemySpawned(state, enemy, api = null) {
    if (isGeistEnemy(enemy)) {
      const plot = geistStoryOf(state, codeOf(enemy))
      enemy.geistStoryCode = plot.story
      if (chapterState(state).agenda3) {
        enemy.hunter = true
        enemy.retaliate = true
      }
    }
    if (codeOf(enemy) === TZU_SAN_NIANG_OUT_FOR_BLOOD) {
      const bonus = Number(enemyRuleFor(TZU_SAN_NIANG_OUT_FOR_BLOOD)?.healthPerPlayerBonus) || 2
      enemy.health = (Number(ALL_CARDS[TZU_SAN_NIANG_OUT_FOR_BLOOD]?.health) || 4) + bonus * numInvestigators(state)
      enemy.victory = 1
    }
    void api
  },

  // ---- 幕 2「灵怪不能离开闹鬼地点」：补偿钩子（把刚离开的灵怪送回去） ----
  enemyMoved(state, enemy, previous, api = null) {
    if (!isGeistEnemy(enemy) || !previous || enemy.location === previous) return
    if (currentActCode(state) !== RAW_CODES.act2) return
    if (!locationHasTrait(state, previous, HAUNTED_TRAIT)) return
    if (enemy.geistHoldGuard) return
    enemy.geistHoldGuard = true
    safeCall(api, 'moveEnemy', enemy, previous)
    delete enemy.geistHoldGuard
    api?.info?.(`👻 「${cardNameOf(codeOf(enemy))}」不能离开[[闹鬼]]地点：回到「${locationName(state, previous)}」。`)
  },

  // ---- 灵怪「将要被击败」：翻面结算剧情（密谋 3 期间不能被翻面） ----
  enemyDefeated(state, enemy, api = null) {
    const code = codeOf(enemy)
    const data = chapterState(state)
    if (isGeistEnemy(enemy)) {
      if (data.agenda3) {
        api?.info?.(`👻 「${cardNameOf(code)}」在「畏惧收割者」期间不能被翻面：击败被取消。`)
        return true
      }
      resolveGeistStory(state, enemy, api, { outOfPlay: true })
      return true
    }
    if (code === TZU_SAN_NIANG) {
      // 强制 - 将要被击败：改为治愈全部伤害、移除场上所有毁灭、返回阴影并把迷你卡重新分配。
      const rule = enemyRuleFor(TZU_SAN_NIANG) || {}
      if (rule.returnsToShadowsWhenDefeated === false) return false
      enemy.damageTaken = 0
      clearDoomInPlay(state, api, { except: null })
      returnTzuToShadows(state, api, { redistribute: rule.distributesConcealedToGeistLocations !== false })
      api?.info?.('🌂 朱三娘将要被击败：改为返回阴影，迷你卡在灵怪地点重新分配。')
      return true
    }
    if (code === TZU_SAN_NIANG_OUT_FOR_BLOOD) {
      data.tzuDefeated = true
      bindShadeReaper(state, api, 'tzuSanNiang')
      api?.info?.('🌂 朱三娘（血债血偿）被击败了。')
      return false
    }
    return false
  },

  // ---- 血债血偿的强制：攻击/躲避她成功 → 按超过难度的点数移除充能并承受伤害/恐惧 ----
  enemyAttackedSuccessfully(state, inv, enemy, api = null, context = null) {
    if (codeOf(enemy) !== TZU_SAN_NIANG_OUT_FOR_BLOOD) return
    if (context?.defeated) return
    drainShadeReaperOnSuccess(state, inv, successByOf(state), api)
  },

  afterEvade(state, inv, enemy, result, api = null) {
    if (codeOf(enemy) !== TZU_SAN_NIANG_OUT_FOR_BLOOD) return
    drainShadeReaperOnSuccess(state, inv, successByOf(state, result), api)
  },

  // ---- 与朱三娘交战：幕 1 目标（付团队线索推进）/ 密谋 2 强制（付线索或抽遭遇） ----
  enemyEngaged(state, enemy, inv, api = null) {
    const code = codeOf(enemy)
    if (code !== TZU_SAN_NIANG && code !== TZU_SAN_NIANG_OUT_FOR_BLOOD) return
    const data = chapterState(state)
    const act = currentActCode(state)
    if (act === RAW_CODES.act1 && !data.act1Advanced) {
      const cost = numInvestigators(state)
      const total = groupCluesAnywhere(state)
      if (total >= cost) {
        spendGroupClues(state, api, cost, { anywhere: true })
        data.act1Advanced = true
        api?.info?.(`📜 幕 1 目标达成：与朱三娘交战并共同花费 ${cost} 个线索，推进幕。`)
        if (typeof api?.advanceAct === 'function') api.advanceAct()
        return
      }
      api?.info?.(`📜 线索不足（需要 ${cost} 个团队线索）：朱三娘返回阴影并重新结算隐匿。`)
      returnTzuToShadows(state, api)
      return
    }
    if (currentAgendaCode(state) === RAW_CODES.agenda2) {
      const cost = numInvestigators(state)
      if (groupCluesAt(state, inv?.location) >= cost) {
        spendGroupClues(state, api, cost, { locationId: inv?.location })
        api?.info?.(`📜 「亡灵未眠」：本地点的调查员共同花费 ${cost} 个线索，避免了遭遇牌。`)
      } else if (typeof api?.drawEncounter === 'function') {
        api.drawEncounter(inv.seat)
        api?.info?.('📜 「亡灵未眠」：线索不足，改为抽取遭遇牌库顶的卡牌。')
      }
    }
  },

  // ---- 幕 3 强制：毁灭放到本密谋时，把朱三娘底下的一个灵怪翻出来生成 ----
  doomPlaced(state, context, api = null) {
    if (!context?.agenda) return
    if (currentAgendaCode(state) !== RAW_CODES.agenda3) return
    const tzu = enemyOf(state, TZU_SAN_NIANG_OUT_FOR_BLOOD)
    if (!tzu || !Array.isArray(tzu.beneath) || !tzu.beneath.length) return
    const index = tzu.beneath.findIndex(card => isGeistCode(codeOf(card)))
    if (index < 0) return
    const [card] = tzu.beneath.splice(index, 1)
    spawnGeist(state, api, codeOf(card), tzu.location)
    api?.info?.(`👻 「畏惧收割者」：朱三娘底下的「${cardNameOf(codeOf(card))}」在她所在地点生成。`)
  },

  // ---- 密谋 ----
  agendaReveal(state, agenda, api = null) {
    const code = codeOf(agenda)
    const data = chapterState(state)
    if (code === RAW_CODES.agenda1) {
      data.agenda1BackResolving = true
      for (const inv of aliveInvestigators(state)) safeCall(api, 'loseClues', inv.seat, Number(inv.clues) || 0)
      resolvePainfulHistory(state, api)
      const actCode = currentActCode(state)
      if (actCode === RAW_CODES.act1) {
        if (typeof api?.advanceAct === 'function') api.advanceAct()
      }
      data.agenda1BackResolving = false
      return
    }
    if (code === RAW_CODES.agenda2) {
      resolveRestlessDeadBack(state, api)
      return
    }
    if (code === RAW_CODES.agenda3) {
      const trauma = aliveInvestigators(state).length
      for (const inv of aliveInvestigators(state)) {
        safeCall(api, 'addTrauma', inv.seat, 'mental', 1)
        safeCall(api, 'defeatInvestigator', inv.seat)
        if (typeof api?.defeatInvestigator !== 'function') inv.defeated = true
      }
      api?.info?.(`💀 「别怕」：${trauma} 位调查员被击败并各承受 1 点精神创伤（→ 结局 3）。`)
      if (typeof api?.finish === 'function') api.finish('resolution3')
    }
  },

  // ---- 幕 ----
  actReveal(state, act, api = null) {
    const code = codeOf(act)
    if (code === RAW_CODES.act1) {
      resolveBomohInterlude(state, api)
      return
    }
    if (code === RAW_CODES.act2) {
      resolveGhostLightBack(state, api)
      return
    }
    if (code === RAW_CODES.act3) {
      const alive = aliveInvestigators(state)
      const answer = alive.length ? choiceFor(api, {
        kind: 'story', source: RAW_CODES.act3, seat: state.campaign?.leadSeat ?? alive[0].seat,
        prompt: '「别怕收割者」：调查员必须选择一项。',
        options: [
          { id: 'resolution1', label: '用这把伞对付她。（→ 结局 1）' },
          { id: 'resolution2', label: '放她走。（→ 结局 2）' },
        ],
      }) : 'resolution2'
      const key = answer === 'resolution1' ? 'resolution1' : 'resolution2'
      chapterState(state).pendingResolution = key
      api?.info?.(key === 'resolution1' ? '🌂 用伞对付她（结局 1）。' : '🌂 放她走（结局 2）。')
      if (typeof api?.finish === 'function') api.finish(key)
    }
  },

  // ---- 目标 ----
  checkObjectives(state, api = null) {
    const data = chapterState(state)
    syncAgenda3(state, api)
    const act = currentActCode(state)
    const advance = () => {
      if (typeof api?.advanceAct !== 'function') return false
      api.advanceAct()
      return true
    }
    if (act === RAW_CODES.act1) {
      const tzu = enemyOf(state, TZU_SAN_NIANG)
      if (tzu && tzu.engagedSeat != null && !data.act1Advanced) {
        data.act1Advanced = true
        return advance()
      }
      return false
    }
    if (act === RAW_CODES.act2) {
      return nonWeaknessGeists(state).length === 0 ? advance() : false
    }
    if (act === RAW_CODES.act3) {
      return data.tzuDefeated === true ? advance() : false
    }
    return false
  },

  // ---- 轮末：幕 2 目标（没有非弱点灵怪 → 推进） ----
  roundEnded(state, api = null) {
    if (currentActCode(state) !== RAW_CODES.act2) return
    if (nonWeaknessGeists(state).length > 0) return
    api?.info?.('🌙 轮末：场上没有非弱点[[灵怪]]敌人，幕 2 目标达成。')
    if (typeof api?.advanceAct === 'function') api.advanceAct()
  },

  // ---- 回合开始：结算影穑动荡面延迟失去的行动 ----
  turnBegins(state, inv, api = null) {
    const data = chapterState(state)
    const pending = Number(data.pendingActionLoss?.[inv.seat]) || 0
    if (!pending) return
    delete data.pendingActionLoss[inv.seat]
    for (let index = 0; index < pending; index += 1) safeCall(api, 'loseActions', inv.seat, 1)
    api?.info?.(`🔑 影穑（动荡面）：${inv.name || '调查员'} 在本回合失去 ${pending} 个行动。`)
  },

  // ---- 遭遇卡 ----
  resolveEncounter(state, inv, card, api = null) {
    const handler = treacheryHandlerFor(codeOf(card))
    if (!handler) return false
    handler(state, inv, card, api)
    return true
  },

  // ---- 剧本行动：地点能力 + 灵怪谈判 ----
  actions(state, inv) {
    const moves = []
    const locationId = inv?.location
    const data = chapterState(state)
    if (locationId === STATION_EAST_WING) {
      const fastUsed = eastWingFastUsed(state, inv)
      moves.push({
        action: 'scenarioAction', rule: 'loc:eastWingMove', locationId, actions: 0,
        label: '[快速] 支付 2 资源：移动到一个连接地点（每回合一次）',
        ...(fastUsed ? { reason: '本回合已经用过了' } : (Number(inv.resources) || 0) < 2 ? { reason: '需要 2 资源' } : {}),
      })
      moves.push({
        action: 'scenarioAction', rule: 'loc:eastWingKitten', locationId,
        label: '[行动] 弃掉一个你控制的支援：获得半价资源并记住「换到了一只小猫」（团队每场游戏一次）',
        ...(data.kittenUsed ? { reason: '团队本场游戏已经用过' }
          : !(inv.assets || []).length ? { reason: '没有可弃掉的支援' } : {}),
      })
    }
    if (locationId === STATION_WEST_WING) {
      const cost = numInvestigators(state)
      moves.push({
        action: 'scenarioAction', rule: 'loc:westWingMemento', locationId,
        label: `[行动] 本地点的调查员共同花费 ${cost} 个线索：各治愈 2 点恐惧并记住「找到了一件便宜的纪念品」`,
        ...(groupCluesAt(state, locationId) < cost ? { reason: `需要 ${cost} 个线索` } : {}),
      })
    }
    if (locationId === SELANGOR_CLUB) {
      moves.push({
        action: 'scenarioAction', rule: 'loc:selangorParley', locationId,
        label: '[行动] 花费 2 资源：谈判。治愈一位调查员或一个[[盟友]]支援 1 点伤害与 1 点恐惧（每轮一次）',
        ...((Number(inv.resources) || 0) < 2 ? { reason: '需要 2 资源' }
          : data.selangorRound === state.round ? { reason: '本轮已经用过' } : {}),
      })
    }
    if (locationId === SELANGOR_CLUB_PADANG) {
      moves.push({
        action: 'scenarioAction', rule: 'loc:padangParley', locationId,
        label: '[行动] 谈判：检定[战斗](4) 加入球赛（成功获得 3 资源，本轮最多成功一次；失败记住「让领事蒙羞」）',
        ...(data.padangRound === state.round ? { reason: '本轮已经成功过' } : {}),
      })
    }
    if (locationId === MELATIS_SHOP) {
      const cost = numInvestigators(state)
      moves.push({
        action: 'scenarioAction', rule: 'loc:melatiPeek', locationId,
        label: `[行动] 本地点的调查员共同花费 ${cost} 个线索：记住「眺望彼端」并查看一张迷你卡/一个灵怪的另一面`,
        ...(groupCluesAt(state, locationId) < cost ? { reason: `需要 ${cost} 个线索` } : {}),
      })
    }
    if (locationId === WAYANG_KULIT_THEATER) {
      const cost = numInvestigators(state)
      moves.push({
        action: 'scenarioAction', rule: 'loc:wayangHeal', locationId,
        label: `[行动] 本地点的调查员共同花费 ${cost} 个线索：各治愈 2 点伤害并记住「分担了深沉的痛苦」`,
        ...(groupCluesAt(state, locationId) < cost ? { reason: `需要 ${cost} 个线索` } : {}),
      })
    }
    if (locationId === TIN_MINE) {
      moves.push({
        action: 'scenarioAction', rule: 'loc:tinMineTest', locationId,
        label: '[行动] 检定[敏捷](6)：成功抽 2 张牌并记住「找到了掩埋的遗骨」（可花团队线索自动成功；团队每场游戏一次）',
        ...(data.tinMineUsed ? { reason: '团队本场游戏已经用过' } : {}),
      })
    }
    // 灵怪谈判：同地点、尚未翻面、密谋 3 期间不能被翻面。
    if (!data.agenda3) {
      for (const enemy of geistEnemiesAt(state, locationId)) {
        const spec = geistStoryOf(state, codeOf(enemy)).parley
        if (!spec) continue
        moves.push({
          action: 'scenarioAction', rule: `parley:${enemy.id}`, enemyId: enemy.id, locationId,
          label: `谈判：${cardNameOf(codeOf(enemy))}（${parleyCostLabel(spec)}；检定难度 ${spec.difficulty}）`,
          noOpportunityAttack: true,
        })
      }
    }
    return moves
  },

  performAction(state, inv, move, api = null) {
    const rule = String(move?.rule || '')
    if (rule === 'loc:eastWingMove') return performEastWingFast(state, inv, api)
    if (rule === 'loc:eastWingKitten') return performEastWingKitten(state, inv, api)
    if (rule === 'loc:westWingMemento') return performWestWingMemento(state, inv, api)
    if (rule === 'loc:selangorParley') return performSelangorParley(state, inv, api)
    if (rule === 'loc:padangParley') return performPadangParley(state, inv, api)
    if (rule === 'loc:melatiPeek') return performMelatiPeek(state, inv, api)
    if (rule === 'loc:wayangHeal') return performWayangHeal(state, inv, api)
    if (rule === 'loc:tinMineTest') return performTinMineTest(state, inv, api)
    if (rule.startsWith('parley:')) {
      const enemy = (state.enemies || []).find(item => item.id === rule.slice('parley:'.length))
      if (!enemy || enemy.location !== inv.location || chapterState(state).agenda3) return false
      return resolveGeistParley(state, inv, enemy, api)
    }
    return false
  },

  // ---- 结局 ----
  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    const data = chapterState(state)
    const bonusXp = data.storyVictories.length
    if (key === 'noResolution') {
      recordFact(state, 'youHaventSeenTheLastOfTzuSanNiang', true)
      records.shadeReaperBearer = 'tzuSanNiang'
      bindShadeReaper(state, api, 'tzuSanNiang')
      markTime(state, 1)
      return { bonus: bonusXp, story: { title: '未达成', paragraphs: [resolutions.noResolution] } }
    }
    if (key === 'resolution1') {
      recordFact(state, 'tzuSanNiangIsUnderYourSway', true)
      for (const inv of aliveInvestigators(state)) safeCall(api, 'addTrauma', inv.seat, 'physical', 1)
      const seat = chooseBearerSeat(state, api)
      records.shadeReaperBearer = seat
      bindShadeReaper(state, api, seat)
      markTime(state, 1)
      return { bonus: bonusXp + 1, story: { title: '结局 1', paragraphs: [resolutions.resolution1] } }
    }
    if (key === 'resolution2') {
      recordFact(state, 'youHaventSeenTheLastOfTzuSanNiang', true)
      const seat = chooseBearerSeat(state, api)
      records.shadeReaperBearer = seat
      bindShadeReaper(state, api, seat)
      markTime(state, 1)
      return { bonus: bonusXp, story: { title: '结局 2', paragraphs: [resolutions.resolution2] } }
    }
    if (key === 'resolution3') {
      recordFact(state, 'tzuSanNiangHasYouUnderHerSway', true)
      records.shadeReaperBearer = 'tzuSanNiang'
      bindShadeReaper(state, api, 'tzuSanNiang')
      markTime(state, 1)
      return { bonus: bonusXp, story: { title: '结局 3', paragraphs: [resolutions.resolution3] } }
    }
    return { bonus: bonusXp }
  },

  finalResolution(state) {
    const data = chapterState(state)
    if (data.pendingResolution) return data.pendingResolution
    if (data.tzuDefeated) return 'resolution2'
    return 'noResolution'
  },

  // ---- 开场正文（按福林状态选分支；未注册时引擎回落到 scenario.intro） ----
  introduction(sc, records = {}) {
    const traveled = Boolean(records.flintTraveledToKualaLumpur)
    const intro = traveled
      ? (scenario.introBranches?.flintTraveledToKualaLumpur || '')
      : (scenario.introBranches?.agentFlintIsMissing || '')
    const sections = [{ title: scenario.introTitle, paragraphs: [intro].filter(Boolean) }]
    return {
      version: 3,
      title: scenario.introTitle,
      sections,
      paragraphs: sections.flatMap(section => section.paragraphs),
      code: REFERENCE_ACT_CODE,
    }
  },
}

function parleyCostLabel(spec) {
  if (!spec) return ''
  if (spec.cost === 'discardRandomCards') return `随机弃掉 1-${spec.max || 3} 张手牌`
  if (spec.cost === 'takeHorror') return `受到 1-${spec.max || 3} 点恐惧`
  return '弃掉一个你控制的支援'
}

// ---------------------------------------------------------------------------
// 密谋 1b：痛苦的历史
// ---------------------------------------------------------------------------
export function resolvePainfulHistory(state, api = null) {
  const alive = aliveInvestigators(state)
  const allies = alive.flatMap(owner => (owner.assets || [])
    .filter(asset => hasTrait(ALL_CARDS[codeOf(asset)], 'Ally'))
    .map(asset => ({ owner, asset })))
  const highest = allies.sort((left, right) =>
    (Number(ALL_CARDS[codeOf(right.asset)]?.cost) || 0) - (Number(ALL_CARDS[codeOf(left.asset)]?.cost) || 0))[0] || null
  const lead = alive.find(inv => inv.seat === state.campaign?.leadSeat) || alive[0] || null
  const options = []
  if (highest) options.push({ id: 'ally', label: `弃掉「${cardNameOf(codeOf(highest.asset))}」并检定意志` })
  options.push({ id: 'doom', label: '在朱三娘上放置 1 个毁灭' })
  const answer = options.length === 1 ? options[0].id : (choiceFor(api, {
    kind: 'story', source: RAW_CODES.agenda1, seat: lead?.seat ?? 0,
    prompt: '「苦难历史」：领队必须选择一项。', options,
  }) || 'doom')
  if (answer === 'ally' && highest) {
    const cost = Number(ALL_CARDS[codeOf(highest.asset)]?.cost) || 0
    safeCall(api, 'discardAsset', highest.owner.seat, highest.asset.id)
    api?.test?.(lead?.seat ?? highest.owner.seat, 'willpower', cost, result => {
      if (result?.success) return
      addCharges(state, cost, api)
      api?.info?.(`🎭 「苦难历史」：检定失败，在影穑上放置 ${cost} 充能。`)
    }, 0, { type: 'scenario', label: '检定：苦难历史', code: RAW_CODES.agenda1 })
    api?.info?.(`🎭 「苦难历史」：弃掉「${cardNameOf(codeOf(highest.asset))}」（印刷费用 ${cost}），检定意志(${cost})。`)
    return { choice: 'ally', cost }
  }
  placeDoomOnTzu(state, api, 1)
  api?.info?.('🎭 「苦难历史」：在朱三娘上放置 1 个毁灭。')
  return { choice: 'doom' }
}
function placeDoomOnTzu(state, api, amount = 1) {
  const enemy = tzuEnemy(state)
  if (enemy && typeof api?.doomOn === 'function') {
    api.doomOn(enemy, amount)
    return true
  }
  const data = chapterState(state)
  data.tzuDoom = (Number(data.tzuDoom) || 0) + amount
  return false
}

// ---------------------------------------------------------------------------
// 密谋 2b：饥饿的苦痛（收割）
// ---------------------------------------------------------------------------
export function resolveRestlessDeadBack(state, api = null) {
  const data = chapterState(state)
  const tzu = tzuEnemy(state)
  const inShadows = !tzu || data.tzuInShadows
  if (!inShadows) {
    // 分支 A：她在某个地点 —— 她攻击该地点的每位调查员，然后返回阴影并重新分配迷你卡，
    // 最后翻回密谋 2a（卡面没有「推进幕」这一步）。
    for (const inv of investigatorsAt(state, tzu.location)) safeCall(api, 'attack', tzu, inv)
    api?.info?.(`🌂 「饥饿的苦痛」：朱三娘攻击了「${locationName(state, tzu.location)}」的每位调查员。`)
    returnTzuToShadows(state, api, { redistribute: true })
    safeCall(api, 'revertAgenda')
    return { branch: 'inPlay' }
  }
  // 分支 B：她在阴影中 —— 揭露全部隐匿迷你卡，与她的真身迷你卡交换；抓走该地点的灵怪压在底下。
  const miniLocation = tzuMiniCardLocation(state)
  clearTzuConcealed(state)
  const enemy = spawnTzuAt(state, api, miniLocation || chapterState(state).startLocation)
  const grabbed = geistEnemiesAt(state, enemy?.location || miniLocation)
  if (enemy && grabbed.length) {
    enemy.beneath ||= []
    for (const geist of grabbed) {
      removeEnemyFromPlay(state, geist, api)
      enemy.beneath.push({ code: codeOf(geist), originalCode: codeOf(geist), facedown: true })
    }
    addCharges(state, 4, api)
    api?.info?.(`🌂 「饥饿的苦痛」：朱三娘把 ${grabbed.length} 个灵怪压在身下，影穑获得 4 充能。`)
  }
  const before = state.agendaIndex
  if (nonWeaknessGeists(state).length === 0) {
    api?.info?.('📜 场上没有非弱点[[灵怪]]：幕 2 目标达成，推进幕（到幕 2b）。')
    if (typeof api?.advanceAct === 'function') api.advanceAct()
  } else {
    returnTzuToShadows(state, api, { redistribute: true })
  }
  if (state.agendaIndex === before) safeCall(api, 'revertAgenda')
  return { branch: 'shadows', grabbed: grabbed.length }
}

// ---------------------------------------------------------------------------
// 幕 2b：卷起旋风（翻到血债血偿并直接推进到密谋 3a）
// ---------------------------------------------------------------------------
export function resolveGhostLightBack(state, api = null) {
  const tzu = tzuEnemy(state)
  const buried = Array.isArray(tzu?.beneath) ? tzu.beneath.filter(card => isGeistCode(codeOf(card))) : []
  if (tzu && buried.length) {
    clearTzuConcealed(state)
    flipTzuOutForBlood(state, api, { locationId: tzu.location, healAll: true })
    const lead = aliveInvestigators(state).find(inv => inv.seat === state.campaign?.leadSeat)
      || aliveInvestigators(state)[0]
    if (lead) safeCall(api, 'engage', tzuEnemy(state), lead.seat)
    api?.info?.('🌂 幕 2 背面：朱三娘治愈全部伤害、翻到「血债血偿」并与领队交战。')
  } else {
    const miniLocation = tzuMiniCardLocation(state)
    clearTzuConcealed(state)
    flipTzuOutForBlood(state, api, { locationId: miniLocation || chapterState(state).startLocation })
    api?.info?.('🌂 幕 2 背面：朱三娘在真身迷你卡的位置翻到「血债血偿」。')
  }
  const before = state.agendaIndex
  if (typeof api?.advanceAgendaTo === 'function' && before < 2) {
    clearDoomInPlay(state, api)
    api.advanceAgendaTo(2)
    api?.info?.('🌑 密谋直接推进到 3a（不结算密谋 2b）。')
  }
  return { agendaIndex: state.agendaIndex }
}

// 密谋 3 的被动：灵怪获得猎手/反击且不能被翻面（幂等；在目标检查/生成/轮末统一同步）。
function syncAgenda3(state, api = null) {
  const data = chapterState(state)
  if (currentAgendaCode(state) !== RAW_CODES.agenda3) {
    if (data.agenda3) data.agenda3 = false
    return false
  }
  const first = !data.agenda3
  data.agenda3 = true
  for (const enemy of geistEnemiesAt(state, null)) {
    enemy.hunter = true
    enemy.retaliate = true
  }
  if (first) api?.info?.('🌑 「畏惧收割者」：每个[[灵怪]]敌人获得猎手与反击，且不能被翻面。')
  return true
}

function chooseBearerSeat(state, api) {
  const alive = aliveInvestigators(state)
  if (!alive.length) return 'none'
  if (alive.length === 1) return alive[0].seat
  const answer = choiceFor(api, {
    kind: 'story', source: 'shadeReaper', seat: state.campaign?.leadSeat ?? alive[0].seat,
    prompt: '选择一位调查员持有「影穑」。',
    options: alive.map(inv => ({ id: String(inv.seat), label: inv.name || `调查员${inv.seat + 1}` })),
  })
  const seat = Number(answer)
  return alive.some(inv => inv.seat === seat) ? seat : alive[0].seat
}

// ---------------------------------------------------------------------------
// 只读投影：桌面/测试读得懂的章节摘要（不写状态）。
// ---------------------------------------------------------------------------
export function chapterSummary(state) {
  const data = state?.scenarioFlags?.[CHAPTER_ID] || {}
  return {
    intro: data.intro || null,
    flint: flintStatus(state),
    startLocation: data.startLocation || null,
    charges: chargesOf(state),
    keyFace: shadeReaperFace(state),
    keyBearer: state?.campaign?.records?.shadeReaperBearer ?? null,
    tzuInShadows: data.tzuInShadows !== false,
    tzuDoom: Number(data.tzuDoom) || 0,
    tzuDefeated: data.tzuDefeated === true,
    agenda3: data.agenda3 === true,
    geists: Object.values(data.geists || {}),
    removedGeists: [...(data.removedGeists || [])],
    concealed: tzuMiniCards(state).map(card => ({
      kind: card.kind, decoy: card.decoy, locationId: card.locationId,
    })),
    remembered: rememberedFacts(state),
    storyVictories: [...(data.storyVictories || [])],
  }
}

// 只读：某灵怪的剧情面（UI/日志用）。
export function geistStoryFor(code) {
  const pair = geistPairOf(code)
  return pair ? pair.story : null
}
export const geistStories = () => GEIST_PAIRS.map(pair => ({ ...pair }))

export const implementedEncounterCodes = behavior.implementedEncounterCodes
export const entryCodes = () => [...implementedEncounterCodes]
export default behavior
