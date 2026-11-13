// 战争疮痍（Dogs of War · 09635 · 亚历山大）· 引擎钩子（版本化布置 + 三路线分支 + 巡逻 + 钥匙节点 + 密钥）。
//
// 约定（与 EotE / TDE / 同循环各章 behavior 相同）：
//   · 逐卡规则写在单卡条目（enemyRule / assetRule / encounterResolve）里，behavior 只做分派；
//   · 内容层（behavior）可以读写 state；卡条目只能通过 `ctx.api`（R1）；
//   · 绯红密钥走 P2 原语 `src/engine/tsk-scarlet-keys.js`（入口 `api.mechanics.tsk.keys`），
//     巡逻走 `api.mechanics.tsk.patrol`（tsk-coterie#patrolTargetLocation / patrolDestination），
//     隐匿迷你卡走 `api.mechanics.tsk.concealed`（tsk-concealed）。
//
// 本章机械（参考 `Scenarios/TheScarletKeys/DogsOfWar.hs`）：
//   1. 开场（PreScenarioSetup）：按剧本日志的 time 选版本（<20 → Intro 2；>=20 → Intro 3），
//      接受/拒绝决定版本一/二/三 + 战役记录 + 混乱袋换标记；版本决定本局唯一的幕与密谋。
//   2. 布置：五张普通地点 + 证券交易所/地下陵墓的版本面 + 四个[[节点地]]各一张钥匙节点；
//      版本一：暗红骑士（剧情支援面）在证券交易所、深红斗篷的恶兽（红衣毁灭者）在地下陵墓；
//      版本二：暗红骑士（敌人面）在证券交易所、恶兽移出游戏、结社刺客 A 结算隐匿；
//      版本三：恶兽（披着羊皮的狼）在地下陵墓、暗红骑士移出游戏。
//   3. 路线分支：版本一「保卫骑士」、版本二「帮西里攻打骑士」、版本三「夺回被恶兽偷走的钥匙」。
//   4. 巡逻：有钥匙节点的地方是巡逻目标；敌军阶段开始移动一步（tsk-coterie）。
//   5. 钥匙节点：可被攻击（防御屏障）/ 可用线索治愈（最后堡垒）；被击败决定进胜利区还是移出游戏。
//   6. 法罗斯之光：附属到首领；地点行动放资源，3 个资源后由调查员控制（＝版本二/三的推进条件）。
//   7. 幕/密谋：版本一密谋背面推进幕（幕背 R1）或骑士被击败（R3）；版本二/三密谋背面「创伤或撤退 +
//      翻回 + 10 毁灭」；幕背按版本进 R1/R2/R5/R6。
//   8. 结局：R1→R8、R5→R8；时间 1/2/3 点；密钥持有者写战役记录。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { isPendingChoice } from '../../../../../src/engine/resolution.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { encounterResolveFor, enemyRuleFor } from '../../../../../src/cards/card-rules.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACTS, AGENDAS, CHAPTER_ENTRY_CODES, CHAPTER_ID, GATHER_GROUPS, INTRO, KEY_LOCUS_DATA,
  LIGHT_OF_PHAROS, LOCATIONS, LOCUS_SITE_IDS, NO_RESOLUTION_TARGET, RAW_CODES, RECORD_KEYS, RECORD_READS,
  RECORD_WRITES, SET_ASIDE_CODES, START_LOCATION, VERSION_CODES, VERSION_GATHER_GROUPS, VERSION_SETUPS,
  clueValueOf, encounterDeckForVersion, locationFaceFor, locusSitesInPlay, resolutions,
} from './definition.js'
import {
  DOGS_OF_WAR_TOKEN_MEANINGS, cardNameOf, dogsOfWarAfterTest, dogsOfWarChaosToken,
  keyLocusEntities, keyLocusLocations, locationHasKeyLocus,
} from './chaos.js'

const CHAPTER_STATE_VERSION = 1
const STATE_KEY = 'dogsOfWar'
const LEAD_SEAT = state => Number(state?.campaign?.leadSeat ?? state?.currentSeat ?? 0)
const isInvestigatorEntity = entry => entry && !entry.defeated && !entry.resigned

export const scenarioApproximations = Object.freeze([
  '钥匙节点（Key Locus）用**敌人实例**承载：印刷是剧情支援，但引擎没有「把在场支援当作敌人攻击」的读点，'
    + '而「可以攻击钥匙节点，如同它是攻击值 4 的敌人」是本章的核心交互。因此 09653a/09653b 在 definition 的 '
    + '`enemies` 表里各有一条定义（fight 4 / 无躲避 / 伤害与恐惧 0 / 具体生命），条目仍是剧情支援 scope。'
    + '副作用：引擎的自动交战会把它当普通敌人（伤害 0、恐惧 0，不影响结算）。见 primitive-requests/09653a.json。',
  '钥匙节点「生命值 3×调查员」用 `healthPerInvestigator: 3` 表达（引擎 spawnEnemy 的计算读点）；'
    + '版本一的「最后堡垒」是固定 6 点生命。',
  '暗红骑士（版本一）用 `state.storyAssets` 的剧情支援实例表达（引擎没有「由所有调查员控制、无槽位」的形态）：'
    + '它的 [fast] 资源搬运实现为章节提供的剧本行动（`knightToAsset` / `knightFromAsset`），'
    + '资源记在实例的 `resources` 字段；被敌军攻击的伤害由本章 `enemyPhaseEnd` 结算。',
  '证券交易所（版本一）「敌人不能进入/生成在此」：生成改道由 `spawnLocation` 钩子接线（改为连接地点）；'
    + '**移动**路径没有内容层钩子（`enemyConnections` 只能加边），敌人仍可能走进来。见 primitive-requests/09642.json。',
  '版本一密谋「检查毁灭阈值时，其它卡上的毁灭改为从总数中扣减」用 `doomPlaced` 钩子近似：'
    + '其它卡每次放置 N 个毁灭时，把密谋上的毁灭 -2N（净效果 = 该卡贡献 -N）。毁灭被移除时不会反向补回。',
  '维多利亚学院「将要抽取正好 1 张时改为看 2 张抽 1 张」用**快速剧本行动**（0 行动）近似：'
    + '引擎没有「替换抽 1 张」的窗口（`cardDrawn` 是抽完之后），行动里用 `api.lookAt` 看牌库顶 2 张并取 1 张，'
    + '其余洗回牌库。见 primitive-requests/09646.json。',
  '妇女市集「战斗时花 1 行动，否则该敌人本次攻击值 +2」用两件东西近似：`enemyStatModifier` 给 +2，'
    + '另给一个「花 1 行动免除」的剧本行动（先付后打）。见 primitive-requests/09649.json。',
  '节点脉冲的「附属到有钥匙节点的最近地点」用 `api.attachEncounterToLocation` 真实附属：'
    + '「附属地点没有钥匙节点时弃掉」由本章在钥匙节点被击败 / 轮末 / 阶段开始时检查并 `api.detachLocationAttachment`。',
  '版本二的「结社刺客 (A) 结算隐匿」用 P2 的隐匿原语：1 张真身迷你卡（kind `enemy09727a`）+ 每位调查员 1 张诱饵，'
    + '平均分到该地点与连接地点，然后把该敌人放到一边（阴影）。真身被揭露时从放一边区还原敌人。',
  '「3 个资源后由调查员控制法罗斯之光」的 3 个资源记在章节状态（`chapter.keyResources`）：'
    + '密钥原语只记持有者与朝向，没有卡上资源容器（见 primitive-requests/09659a.json）。',
  '「未达成任何结局」按版本应用结局 3/4/7 的记录与时间，但战役结果键仍是 `noResolution`：'
    + '结果键由引擎在 finishScenario 时传入，内容层只能在 resolution 钩子里补记（如需改键要新原语）。',
])

export const scenarioGaps = Object.freeze([
  '共享遭遇组（猩红巫术/空间异常/腐败扩散/黑暗异教徒/扫荡团伙）的卡牌行为属于共享组，本章只声明 '
    + 'requiredEncounterGroupIds；敌人不能进入证券交易所的移动限制见 scenarioApproximations 与 09642 请求。',
  '世界地图的时间阈值（状况报告 α–ω）与启程循环由战役流程层结算；本章只累加 `time` 记录。',
  '「其它卡上的毁灭扣减毁灭总数」的**移除**方向（毁灭被移除时总数回升）未实现：只处理放置方向（见近似披露）。',
])

// ---------------------------------------------------------------------------
// 基础读点
// ---------------------------------------------------------------------------
const codeOf = card => card?.originalCode || card?.code || card
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const aliveInvestigators = state => (state?.investigators || []).filter(inv => isInvestigatorEntity(inv))
const numInvestigators = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const enemyOf = (state, code) => (state?.enemies || []).find(enemy => !enemy.defeated && codeOf(enemy) === code) || null
const hasTrait = (card, trait) =>
  (card?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const recordFact = (state, key, value = true) => {
  const records = recordsFor(state)
  if (value === false) delete records[key]
  else records[key] = value
  return records[key]
}
const hasRecord = (state, key) => {
  const value = recordsFor(state)[key]
  return value === true || value === 'true'
}
const locationName = (state, id) => LOCATIONS[id]?.name || locationOf(state, id)?.name || String(id || '')
const isWeakness = code => (ALL_CARDS[code]?.subtype === 'weakness' || ALL_CARDS[code]?.subtype === 'basicweakness')

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

function chooseOption(api, request) {
  const options = request?.options || []
  if (!options.length) return null
  if (options.length === 1) return options[0].id
  const answer = choiceFor(api, request)
  return options.some(option => String(option.id) === String(answer)) ? answer : options[0].id
}

function shuffleWith(state, list, helper) {
  if (typeof helper?.shuffle === 'function') return helper.shuffle([...list], () => helper.randomValue(state))
  const copy = [...list]
  const random = typeof helper?.random === 'function' ? helper.random : () => randomValue(state)
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

// ---------------------------------------------------------------------------
// 章节状态（纯 JSON，随存档往返）
// ---------------------------------------------------------------------------
export function chapterState(state) {
  const flags = (state.scenarioFlags ||= {})
  const data = flags[STATE_KEY] ||= {}
  data.version ||= CHAPTER_STATE_VERSION
  if (data.variant == null) data.variant = null
  if (data.branch == null) data.branch = null
  if (data.keyResources == null) data.keyResources = 0
  if (data.keyControlledSeat === undefined) data.keyControlledSeat = null
  if (data.claretKnightDefeated == null) data.claretKnightDefeated = false
  if (data.beastDefeated == null) data.beastDefeated = false
  if (data.beastFledRound == null) data.beastFledRound = null
  if (data.qaitbayLockRound == null) data.qaitbayLockRound = null
  if (data.cornicheBoostRound == null) data.cornicheBoostRound = null
  if (data.zanettPaidRound == null) data.zanettPaidRound = null
  if (data.zanettPaidSeat == null) data.zanettPaidSeat = null
  data.keyLociDefeated ||= []
  data.pulses ||= []
  data.replacementUsed ||= {}
  data.victoriaUsedRound ||= null
  data.miniCards ||= []
  if (data.bloodyNexusUsed == null) data.bloodyNexusUsed = false
  if (data.lightOfPharosAttachedTo == null) data.lightOfPharosAttachedTo = null
  return data
}

export const currentVersion = state => chapterState(state).variant
export const currentBranch = state => chapterState(state).branch
export const versionCodes = state => VERSION_CODES[currentVersion(state)] || VERSION_CODES.v1

/** 剧本日志里的 time（与 `campaign.tsk.map.time` 取较大值）。 */
export function timePassed(state) {
  const recorded = Number(recordsFor(state)[RECORD_KEYS.time]) || 0
  const mapped = Number(state?.campaign?.tsk?.map?.time) || 0
  return Math.max(recorded, mapped)
}

export function markTime(state, amount) {
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  if (!value) return timePassed(state)
  const records = recordsFor(state)
  const total = (Number(records[RECORD_KEYS.time]) || 0) + value
  records[RECORD_KEYS.time] = total
  const map = state.campaign?.tsk?.map
  if (map) map.time = Math.max(Number(map.time) || 0, total)
  return total
}

// ---------------------------------------------------------------------------
// 绯红密钥：法罗斯之光（稳定面 09659a / 动荡面 09659b）
// ---------------------------------------------------------------------------
const keyApiOf = api => api?.mechanics?.tsk?.keys || api?.tsk?.keys || null

/** 登记法罗斯之光（战役级 `campaign.tsk.keys`；已登记其它钥匙时只读，回落到章节记录）。 */
export function ensureLightOfPharos(state, api = null) {
  const keys = keyApiOf(api)
  if (!keys) return false
  try {
    keys.get(LIGHT_OF_PHAROS.id)
    return true
  } catch {
    /* 未登记，下面尝试初始化 */
  }
  try {
    if ((keys.all() || []).length) return false
    keys.initialize([{
      id: LIGHT_OF_PHAROS.id,
      stableFace: LIGHT_OF_PHAROS.stableFace,
      unstableFace: LIGHT_OF_PHAROS.unstableFace,
    }])
    return true
  } catch {
    return false
  }
}

/** 法罗斯之光的只读记录：优先原语，回落到章节记录（战役里已有别的钥匙时）。 */
export function keyRecord(state, api = null) {
  const keys = keyApiOf(api)
  if (keys) {
    try {
      return keys.get(LIGHT_OF_PHAROS.id)
    } catch {
      /* 未登记 */
    }
  }
  const data = chapterState(state)
  const recorded = data.lightOfPharos
  if (!recorded) return null
  return { ...recorded, bearer: { ...(recorded.bearer || { type: 'none' }) } }
}

export function keyFaceCode(state, api = null) {
  const record = keyRecord(state, api)
  if (record) return record.stable ? LIGHT_OF_PHAROS.stableFace : LIGHT_OF_PHAROS.unstableFace
  const data = chapterState(state)
  return data.lightOfPharosStable === false ? LIGHT_OF_PHAROS.unstableFace : LIGHT_OF_PHAROS.stableFace
}

export function keyBearer(state, api = null) {
  const record = keyRecord(state, api)
  if (record) return record.bearer
  return chapterState(state).lightOfPharosBearer || { type: 'none' }
}

/** 绑定/转移（有原语时先写原语，再镜像到章节记录）。 */
export function bindLightOfPharos(state, api, bearer, { steal = false } = {}) {
  const keys = keyApiOf(api)
  if (keys) {
    try {
      if (steal) keys.steal(LIGHT_OF_PHAROS.id, bearer)
      else keys.bind(LIGHT_OF_PHAROS.id, bearer)
    } catch {
      /* 密钥实体未初始化：只写章节记录 */
    }
  }
  const data = chapterState(state)
  data.lightOfPharosBearer = { ...bearer }
  if (bearer?.type === 'investigator') {
    data.lightOfPharosStable = true
    data.keyControlledSeat = bearer.seat
    // 调查员取得控制权后，密钥不再「附属」到某个首领。
    data.lightOfPharosAttachedTo = null
  } else if (bearer?.type === 'enemy') {
    data.lightOfPharosStable = false
    data.keyControlledSeat = null
  } else {
    data.keyControlledSeat = null
  }
  return { ...(keyRecord(state, api)?.bearer || bearer) }
}

/** 调查员是否控制了法罗斯之光（版本二/三的幕目标）。 */
export function keyControlledByInvestigator(state, api = null) {
  const data = chapterState(state)
  if (data.lightOfPharosAttachedTo === 'claretKnight' || data.lightOfPharosAttachedTo === 'beast') return false
  if (data.keyControlledSeat != null) return true
  const bearer = keyBearer(state, api)
  return bearer?.type === 'investigator' && data.lightOfPharosAttachedTo == null
}

/** 法罗斯之光上的资源（章节状态；密钥原语没有卡上资源容器）。 */
export const keyResourcesOf = state => Number(chapterState(state).keyResources) || 0

export function addKeyResource(state, api, amount = 1) {
  const data = chapterState(state)
  data.keyResources = Math.max(0, (Number(data.keyResources) || 0) + Number(amount || 0))
  return data.keyResources
}

/** 3 个资源后由本地点的 1 位调查员取得控制权。 */
export function maybeClaimKey(state, api, locationId) {
  const data = chapterState(state)
  if (data.keyResources < LIGHT_OF_PHAROS.resourcesToControl) return null
  const here = aliveInvestigators(state).filter(inv => inv.location === locationId)
  if (!here.length) return null
  const answer = here.length === 1 ? String(here[0].seat) : choiceFor(api, {
    kind: 'investigator', source: RAW_CODES.scenario, seat: LEAD_SEAT(state),
    prompt: '法罗斯之光上的资源达到 3：选择本地点的 1 位调查员取得它的控制权。',
    options: here.map(inv => ({ id: String(inv.seat), label: inv.name || `调查员${inv.seat + 1}` })),
  })
  const seat = here.some(inv => String(inv.seat) === String(answer)) ? Number(answer) : here[0].seat
  bindLightOfPharos(state, api, { type: 'investigator', seat }, { steal: true })
  api?.info?.(`🔑 法罗斯之光由 ${state.investigators?.[seat]?.name || '调查员'} 控制（调查员控制了法罗斯之光）。`)
  return seat
}

/** 当前面的变换声明（条目 `assetRule.keyShift`）。 */
export function keyShiftRule(state, api) {
  const face = keyFaceCode(state, api)
  const rule = registeredEntry(face)?.assetRule?.keyShift
  return rule ? { face, rule } : null
}

/**
 * 结算一次「变换」（内容层唯一执行点）：先按当前面的 `assetRule.keyShift.resolve` 结算效果，再翻面。
 * `by`: 'investigator'（调查员变换：结算后翻到另一面）| 'enemy'（敌人身上的钥匙只结算效果、不翻面）。
 */
export function resolveKeyShift(state, seat, api, { by = 'investigator' } = {}) {
  const keys = keyApiOf(api)
  const rule = keyShiftRule(state, api)
  if (!rule) return null
  const inv = state.investigators?.[seat] || null
  const resolved = typeof rule.rule.resolve === 'function'
    ? rule.rule.resolve({ state, api, inv, keyId: LIGHT_OF_PHAROS.id })
    : null
  const flipped = by === 'investigator'
  if (flipped && keys) {
    try {
      keys.shift(LIGHT_OF_PHAROS.id, { force: true })
    } catch (error) {
      api?.info?.(`法罗斯之光翻面失败：${error.message}`)
    }
  }
  if (flipped) {
    // 章节记录同步当前面（原语不可用时也要能读）：翻面后稳定面 = 原来的面不是稳定面。
    chapterState(state).lightOfPharosStable = rule.face !== 'stable'
  }
  return { face: rule.face, effect: resolved, flipped }
}

// ---------------------------------------------------------------------------
// 钥匙节点 / 暗红骑士（剧情支援实例）
// ---------------------------------------------------------------------------
export const keyLocusCodeOf = state => versionCodes(state).keyLocus

export const keyLociInPlay = state => keyLocusEntities(state)

/** 场上没有其它钥匙节点时：版本一/二暗红骑士算钥匙节点；版本三地下陵墓算钥匙节点。 */
export function syncCountsAsKeyLocus(state) {
  const version = currentVersion(state)
  // 先清掉上一次的「算作钥匙节点」标记，再按当前局面重算。
  for (const asset of state.storyAssets || []) {
    if (asset.countsAsLocus) {
      asset.countsAsLocus = false
      asset.keyLocus = false
    }
  }
  for (const location of state.locations || []) {
    if (location.countsAsLocus) {
      location.countsAsLocus = false
      location.keyLocus = false
    }
  }
  const real = keyLocusEntities(state).filter(entry => !entry.countsAsLocus)
  if (real.length) return null
  if (version === 'v3') {
    const catacombs = (state.locations || []).find(location =>
      codeOf(location) === RAW_CODES.catacombsDenOfTheBeast)
    if (catacombs) {
      catacombs.countsAsLocus = true
      catacombs.keyLocus = true
      return { kind: 'location', id: catacombs.id }
    }
    return null
  }
  const knight = knightAsset(state)
  if (knight) {
    knight.countsAsLocus = true
    knight.keyLocus = true
    return { kind: 'asset', id: knight.id }
  }
  return null
}

export function knightAsset(state) {
  return (state.storyAssets || []).find(asset => codeOf(asset) === RAW_CODES.claretKnightAsset) || null
}

/** 暗红骑士（剧情支援面）入场：放在证券交易所，由所有调查员控制（无槽位）。 */
export function putKnightAssetInPlay(state, api, locationId) {
  const existing = knightAsset(state)
  if (existing) return existing
  const card = ALL_CARDS[RAW_CODES.claretKnightAsset]
  const asset = {
    id: `story:${RAW_CODES.claretKnightAsset}:1`,
    code: RAW_CODES.claretKnightAsset, originalCode: RAW_CODES.claretKnightAsset,
    name: card?.nameZh || card?.name || '暗红骑士',
    location: locationId, exhausted: false, damage: 0, horror: 0, resources: 0,
    health: Number(card?.health) || 4, sanity: Number(card?.sanity) || 2,
    traits: [...(card?.traits || [])], slots: [],
    controlledByAll: true,
  }
  state.storyAssets ||= []
  state.storyAssets.push(asset)
  api?.info?.('🎩 暗红骑士（剧情支援面）在证券交易所入场：由所有调查员控制。')
  return asset
}

export function damageKnightAsset(state, api, amount) {
  const asset = knightAsset(state)
  if (!asset) return 0
  asset.damage = (Number(asset.damage) || 0) + Math.max(0, Number(amount) || 0)
  api?.info?.(`⚔️ 暗红骑士受到 ${amount} 点伤害（${asset.damage}/${asset.health}）。`)
  if (asset.damage >= (Number(asset.health) || 4)) defeatKnightAsset(state, api)
  return asset.damage
}

export function defeatKnightAsset(state, api) {
  const asset = knightAsset(state)
  if (!asset) return false
  state.storyAssets = (state.storyAssets || []).filter(item => item !== asset)
  const data = chapterState(state)
  data.claretKnightDefeated = true
  api?.info?.('💀 暗红骑士被击败：密谋 1 的目标达成，推进密谋。')
  syncCountsAsKeyLocus(state)
  syncWindsorCost(state)
  if (codeOf(state.agendas?.[state.agendaIndex]) === RAW_CODES.agendaV1) api?.advanceAgenda?.()
  return true
}

/** 版本一敌军阶段：每个重整的敌人还攻击其所在地点的每个钥匙节点（恐惧改为伤害）。 */
export function enemyAttacksKeyLoci(state, api) {
  if (codeOf(state.acts?.[state.actIndex]) !== RAW_CODES.actV1) return []
  const hits = []
  for (const enemy of [...(state.enemies || [])]) {
    if (enemy.defeated || !state.enemies.includes(enemy)) continue
    if (enemy.keyLocus === true || !enemy.location) continue
    if (enemy.exhausted) continue
    const amount = (Number(enemy.damage) || 0) + (Number(enemy.horror) || 0)
    if (!amount) continue
    for (const target of keyLocusEntities(state).filter(entry => entry.location === enemy.location)) {
      if (state.enemies.includes(target)) {
        api?.damageEnemy?.(target.id, amount, null, enemy.code)
      } else {
        damageKnightAsset(state, api, amount)
      }
      hits.push({ enemyId: enemy.id, targetId: target.id || target.code, amount })
    }
  }
  if (hits.length) api?.info?.(`⚔️ 敌军阶段：${hits.length} 次攻击落在钥匙节点上（恐惧按伤害结算）。`)
  return hits
}

/** 维多利亚学院 / 温莎宫酒店的持续修正：钥匙节点在同一地点时费用 +1，否则 -1（只接 +1 的一半）。 */
export function syncWindsorCost(state) {
  const windsor = (state.locations || []).find(location =>
    codeOf(location) === RAW_CODES.windsorPalaceHotel)
  if (!windsor) return
  if (locationHasKeyLocus(state, windsor.id)) windsor.playCostIncrease = 1
  else delete windsor.playCostIncrease
}

// ---------------------------------------------------------------------------
// 节点脉冲（09658）：附属地点没有钥匙节点时弃掉
// ---------------------------------------------------------------------------
export function pulsesInPlay(state) {
  const out = []
  for (const location of state.locations || []) {
    for (const attachment of location.attachments || []) {
      if (codeOf(attachment) === RAW_CODES.locusPulse) out.push({ location, attachment })
    }
  }
  return out
}

export function discardOrphanPulses(state, api) {
  const dropped = []
  for (const { location, attachment } of pulsesInPlay(state)) {
    if (locationHasKeyLocus(state, location.id)) continue
    api?.detachLocationAttachment?.(location.id, attachment.id)
    api?.info?.(`🌀 「${locationName(state, location.id)}」没有钥匙节点：弃掉节点脉冲。`)
    dropped.push({ locationId: location.id, attachmentId: attachment.id })
  }
  return dropped
}

// ---------------------------------------------------------------------------
// 版本化布置
// ---------------------------------------------------------------------------
/** 开场分支：时间 → Intro 2 / Intro 3；接受/拒绝 → 版本与阵营。 */
export function resolveIntro(state, api) {
  const data = chapterState(state)
  if (data.variant) return { variant: data.variant, branch: data.branch }
  const time = timePassed(state)
  const late = time >= 20
  const prompt = late
    ? INTRO.knightAlreadyRobbed
    : [INTRO.knightMeeting.part1, INTRO.knightMeeting.part2].filter(Boolean).join('\n\n')
  const answer = chooseOption(api, {
    kind: 'story', source: RAW_CODES.scenario, seat: LEAD_SEAT(state),
    prompt: prompt || '暗红骑士提议合作：接受，还是拒绝？',
    options: [{ id: 'accept', label: INTRO.labels.accept }, { id: 'refuse', label: INTRO.labels.refuse }],
  })
  const accepted = answer !== 'refuse'
  if (late) data.variant = 'v3'
  else data.variant = accepted ? 'v1' : 'v2'
  data.branch = accepted ? 'knight' : 'sirry'
  if (accepted) {
    recordFact(state, RECORD_KEYS.dealWithKnight, true)
    swapChaosToken(state, 'elderthing', 'tablet', api)
  } else {
    recordFact(state, RECORD_KEYS.assistingSirry, true)
    swapChaosToken(state, 'tablet', 'elderthing', api)
  }
  api?.info?.(`📖 ${VERSION_SETUPS[data.variant].title}：${accepted ? '与暗红骑士合作' : '帮助西里特工'}`
    + `（流逝时间 ${time}）。`)
  // 版本决定本局唯一的幕与密谋（其余从游戏中移除）。
  state.acts = [{ ...ACTS[data.variant] }]
  state.agendas = [{ ...AGENDAS[data.variant] }]
  state.actIndex = 0
  state.agendaIndex = 0
  ensureLightOfPharos(state, api)
  return { variant: data.variant, branch: data.branch, accepted }
}

/** 混乱袋换标记：目标标记已有 4 个时改为每位调查员 +1 经验。 */
export function swapChaosToken(state, from, to, api = null) {
  const bag = Array.isArray(state.chaosBag) ? state.chaosBag : (state.chaosBag = [])
  if (bag.filter(token => token === to).length >= 4) {
    for (const inv of state.investigators || []) inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + 1
    api?.info?.(`混乱袋里已经有 4 个 ${to}：改为每位调查员取得 1 点经验值。`)
    return false
  }
  const index = bag.indexOf(from)
  if (index >= 0) bag.splice(index, 1)
  bag.push(to)
  api?.info?.(`🎲 混乱袋：移除 1 个 ${from}，加入 1 个 ${to}。`)
  return true
}

function applyLocationFace(state, face) {
  state.locationVariants ||= {}
  state.locationVariants[face.id] = {
    name: face.name, nameEn: face.nameEn,
    ...(face.subname ? { subname: face.subname } : {}),
    text: face.text, textEn: face.textEn,
    shroud: face.shroud,
    cluesPerInvestigator: face.cluesPerInvestigator,
    ...(face.victory ? { victory: face.victory } : {}),
    code: face.code, originalCode: face.code, artCode: face.code,
    traits: [...face.traits],
  }
  return state.locationVariants[face.id]
}

function placeVersionLocation(state, api, version, id) {
  const face = locationFaceFor(version, id)
  if (!face) return null
  applyLocationFace(state, face)
  if (typeof api?.place === 'function') api.place(id)
  const location = locationOf(state, id)
  if (!location) return null
  if (face.revealedAtStart) {
    if (!location.revealed && typeof api?.reveal === 'function') api.reveal(id)
  } else {
    location.revealed = false
    location.clues = 0
  }
  return location
}

export function setupVersion(state, api) {
  const version = currentVersion(state) || 'v1'
  const codes = VERSION_CODES[version]
  // 五张普通地点 + 两张版本地点的物理面。
  for (const id of ['windsorPalaceHotel', 'victoriaCollege', 'qaitbayCitadel', 'theCorniche', 'zanEtElSettat']) {
    placeVersionLocation(state, api, version, id)
  }
  const bourse = placeVersionLocation(state, api, version, 'theBourse')
  const catacombs = placeVersionLocation(state, api, version, 'catacombs')
  // 钥匙节点：四个[[节点地]]各一张（版本一「最后堡垒」面，版本二/三「防御屏障」面）。
  const loci = []
  for (const id of locusSitesInPlay(state)) {
    const enemy = typeof api?.spawn === 'function' ? api.spawn(codes.keyLocus, id) : null
    if (enemy) {
      enemy.keyLocus = true
      enemy.keyLocusFace = KEY_LOCUS_DATA[codes.keyLocus].face
      enemy.keyLocusOrigin = 'enemy'
      loci.push({ locationId: id, enemyId: enemy.id })
    }
    // 版本一：这些地点各放 1 个毁灭标记。
    if (version === 'v1') {
      if (typeof api?.doomOn === 'function') api.doomOn(locationOf(state, id), 1)
      else {
        const location = locationOf(state, id)
        if (location) location.doom = (Number(location.doom) || 0) + 1
      }
    }
  }
  // 首领与密钥。
  const data = chapterState(state)
  if (version === 'v1' || version === 'v2') {
    if (version === 'v1') {
      const asset = putKnightAssetInPlay(state, api, bourse?.id || null)
      // 法罗斯之光附属到暗红骑士（剧情支援面）；持有者记「骑士」，不是调查员。
      data.lightOfPharosAttachedTo = 'claretKnight'
      bindLightOfPharos(state, api, { type: 'none' })
      if (asset) api?.info?.('🔑 法罗斯之光附属到暗红骑士（由所有调查员控制）。')
      if (typeof api?.spawn === 'function') {
        const beast = api.spawn(RAW_CODES.beastRavager, catacombs?.id || null)
        if (beast) data.beastEnemyId = beast.id
      }
    } else {
      if (typeof api?.spawn === 'function') {
        const knight = api.spawn(RAW_CODES.claretKnightEnemy, bourse?.id || null)
        if (knight) {
          data.knightEnemyId = knight.id
          data.lightOfPharosAttachedTo = 'claretKnight'
          bindLightOfPharos(state, api, { type: 'enemy', enemyId: knight.id }, { steal: true })
        }
      }
    }
  } else {
    if (typeof api?.spawn === 'function') {
      const beast = api.spawn(RAW_CODES.beastWolf, catacombs?.id || null)
      if (beast) {
        data.beastEnemyId = beast.id
        data.lightOfPharosAttachedTo = 'beast'
        bindLightOfPharos(state, api, { type: 'enemy', enemyId: beast.id }, { steal: true })
      }
    }
  }
  // 版本二：收齐诱饵与结社刺客/打手迷你卡放在一边，队长抽结社刺客 (A) 结算隐匿。
  if (version === 'v2') startConcealedAssassin(state, api)
  syncCountsAsKeyLocus(state)
  syncWindsorCost(state)
  api?.info?.(`🗺️ 战争疮痍（${VERSION_SETUPS[version].title}）：`
    + `${LOCUS_SITE_IDS.length} 张钥匙节点已放到[[节点地]]，证券交易所=${bourse?.name || '?'}，`
    + `地下陵墓=${catacombs?.name || '?'}。`)
  return { version, bourseId: bourse?.id || null, catacombsId: catacombs?.id || null, loci }
}

/** 版本二：结社刺客 (A) 的隐匿关键词（1 张真身 + 每位调查员 1 张诱饵）。 */
export function startConcealedAssassin(state, api) {
  const concealed = api?.mechanics?.tsk?.concealed || api?.tsk?.concealed || null
  const lead = state.investigators?.[LEAD_SEAT(state)] || state.investigators?.[0] || null
  if (!lead?.location) return []
  const code = '09727a'
  const data = chapterState(state)
  // 结社刺客 (A) 作为遭遇卡被抽取：先在队长地点生成，再放进阴影（放一边区），迷你卡留在原地点。
  const enemy = typeof api?.spawn === 'function' ? api.spawn(code, lead.location) : null
  const cards = [{ kind: `enemy${code}`, code, decoy: false }]
  const decoys = Math.max(1, numInvestigators(state))
  for (let index = 0; index < decoys; index += 1) cards.push({ kind: `enemy${code}`, decoy: true })
  const here = locationOf(state, lead.location)
  const slots = [lead.location, ...((here?.connections || []).filter(id => locationOf(state, id)))]
  const placements = new Map()
  cards.forEach((card, index) => {
    const locationId = slots[index % slots.length]
    const entry = placements.get(locationId) || { locationId, count: 0 }
    entry.count += 1
    placements.set(locationId, entry)
  })
  const created = concealed?.distribute
    ? concealed.distribute({ cards, placements: [...placements.values()] })
    : []
  if (enemy) {
    if (typeof api?.setEnemyAside === 'function') api.setEnemyAside(enemy)
    data.miniCards.push({ enemyCode: code, enemyId: enemy.id, locationId: lead.location })
  }
  api?.info?.(`🕯️ 结社刺客 (A)：结算隐匿（1 张真身 + ${decoys} 张诱饵），迷你卡分到 `
    + `${placements.size} 处地点，敌人进入阴影。`)
  return created
}

/** 揭露一张迷你卡：真身 → 从放一边区还原敌人；诱饵 → 翻面移除。 */
export function exposeMini(state, inv, miniCardId, api = null) {
  const concealed = api?.mechanics?.tsk?.concealed || api?.tsk?.concealed || null
  if (!concealed?.expose) return null
  const card = (concealed.byId?.(miniCardId)) || (concealed.miniCards?.() || []).find(item => item.id === miniCardId)
  if (!card) return null
  const locationId = card.locationId
  const result = concealed.expose(miniCardId)
  if (result.decoy) {
    api?.info?.(`🔓 揭露诱饵（${locationName(state, locationId)}）：翻面移除。`)
    return { ...result, locationId, enemyCode: null }
  }
  const code = String(result.kind || '').replace(/^enemy/, '')
  const record = chapterState(state).miniCards.find(entry => entry.enemyCode === code)
  let enemy = null
  if (record && typeof api?.restoreEnemyFromAside === 'function') {
    enemy = api.restoreEnemyFromAside(record.enemyId, locationId)
  }
  if (!enemy && code && typeof api?.spawn === 'function') enemy = api.spawn(code, locationId)
  api?.info?.(`🔓 揭露真身：${cardNameOf(code)}在「${locationName(state, locationId)}」现身。`)
  return { ...result, locationId, enemyCode: code, enemyId: enemy?.id || null }
}

// ---------------------------------------------------------------------------
// 遭遇卡分派
// ---------------------------------------------------------------------------
export function resolveEncounterEntry(state, inv, card, api) {
  const code = codeOf(card)
  const entryResolve = encounterResolveFor(code)
  if (entryResolve) return entryResolve(state, inv, card, api, { location: locationOf(state, inv?.location) })
  return false
}

// ---------------------------------------------------------------------------
// 剧本行动
// ---------------------------------------------------------------------------
export const ACTION_RULES = Object.freeze({
  expose: 'expose',
  keyLocusDamage: 'keyLocusDamage',
  keyLocusHeal: 'keyLocusHeal',
  keyResource: 'keyResource',
  bourseRemoveDoom: 'bourseRemoveDoom',
  ancientTombDraw: 'ancientTombDraw',
  commercialResources: 'commercialResources',
  bloodyNexusEvade: 'bloodyNexusEvade',
  victoriaDraw: 'victoriaDraw',
  zanettTax: 'zanettTax',
  knightToAsset: 'knightToAsset',
  knightFromAsset: 'knightFromAsset',
})

const keyLocusAtLocation = (state, locationId) =>
  keyLocusEntities(state).find(entry => entry.location === locationId) || null

function keyLocusAvailableReason(state, locus) {
  if (!locus) return '这里没有钥匙节点'
  if (locus.defeated) return '这个钥匙节点已经被击败'
  return null
}

function groupClueCost(state) {
  return Math.max(1, numInvestigators(state))
}

function canPayGroupClues(state, inv, required) {
  const group = aliveInvestigators(state).filter(other => other.location === inv.location)
  return group.reduce((sum, other) => sum + (Number(other.clues) || 0), 0) >= required
}

function payGroupClues(state, inv, api, required) {
  if (typeof api?.payGroupClues === 'function') {
    const paid = api.payGroupClues(required, { atLocation: inv.location })
    if (paid) return true
  }
  const group = aliveInvestigators(state).filter(other => other.location === inv.location)
  const total = group.reduce((sum, other) => sum + (Number(other.clues) || 0), 0)
  if (total < required) return false
  let left = required
  for (const other of group) {
    const spend = Math.min(left, Number(other.clues) || 0)
    other.clues -= spend
    left -= spend
    if (!left) break
  }
  return true
}

function keyLocusDamageAction(state, inv, api, move) {
  const locus = keyLocusAtLocation(state, inv.location)
  if (!locus) return false
  const clue = Number(inv.clues) || 0
  if (clue < 1) return false
  if (typeof api?.spendClues === 'function') api.spendClues(inv.seat, 1)
  else inv.clues = clue - 1
  if (typeof api?.damageEnemy === 'function') api.damageEnemy(locus.id, 2, inv.seat, RAW_CODES.keyLocusDefensiveBarrier)
  else locus.damageTaken = (Number(locus.damageTaken) || 0) + 2
  api?.info?.(`🪨 花费 1 个线索：对钥匙节点「${locus.name}」造成 2 点伤害。`)
  void move
  return true
}

function keyLocusHealAction(state, inv, api) {
  const locus = keyLocusAtLocation(state, inv.location)
  if (!locus) return false
  if ((Number(inv.clues) || 0) < 1) return false
  if (typeof api?.spendClues === 'function') api.spendClues(inv.seat, 1)
  else inv.clues -= 1
  api?.test?.(inv.seat, 'willpower', 2, result => {
    const succeededBy = result?.success ? Math.max(0, Number(result.successBy) || 0) : 0
    const heal = result?.success ? 1 + succeededBy : 0
    if (!heal) {
      api?.info?.(`🪨 「${locus.name}」：检定失败，没有治愈。`)
      return
    }
    if (typeof api?.healEnemy === 'function') api.healEnemy(locus, heal)
    else locus.damageTaken = Math.max(0, (Number(locus.damageTaken) || 0) - heal)
    api?.info?.(`🪨 花费 1 个线索并检定[意志](2)：治愈「${locus.name}」${heal} 点伤害。`)
  }, 0, { code: RAW_CODES.keyLocusLastBastion, name: '钥匙节点（最后堡垒）', action: 'activate' })
  return true
}

function keyResourceAction(state, inv, api) {
  const location = locationOf(state, inv.location)
  const code = codeOf(location)
  const skill = chooseOption(api, {
    kind: 'choice', source: code, seat: inv.seat,
    prompt: '选择检定的技能：意志或敏捷（4）。',
    options: [{ id: 'willpower', label: '意志(4)' }, { id: 'agility', label: '敏捷(4)' }],
  }) || 'willpower'
  api?.test?.(inv.seat, skill, 4, result => {
    if (!result?.success) {
      api?.info?.('🔑 检定失败：不能在法罗斯之光上放置资源。')
      return
    }
    const required = groupClueCost(state)
    if (!canPayGroupClues(state, inv, required)) {
      api?.info?.(`🔑 本地点的调查员线索不足（需要 ${required}），不能放置资源。`)
      return
    }
    if (!payGroupClues(state, inv, api, required)) return
    addKeyResource(state, api, 1)
    api?.info?.(`🔑 法罗斯之光上放置 1 个资源（共 ${keyResourcesOf(state)} 个）。`)
    maybeClaimKey(state, api, inv.location)
  }, 0, { code, name: location?.name || '证券交易所', action: 'activate' })
  return true
}

function bourseRemoveDoomAction(state, inv, api) {
  const required = groupClueCost(state)
  if (!canPayGroupClues(state, inv, required)) return false
  const candidates = []
  for (const location of state.locations || []) {
    if ((Number(location.doom) || 0) > 0) candidates.push({ id: `location:${location.id}`, label: `地点：${location.name}`, location })
  }
  for (const owner of aliveInvestigators(state)) {
    for (const asset of owner.assets || []) {
      if ((Number(asset.doom) || 0) > 0) candidates.push({ id: `asset:${owner.seat}:${asset.id}`, label: `支援：${cardNameOf(asset.code)}`, asset })
    }
  }
  if (!candidates.length) return false
  if (!payGroupClues(state, inv, api, required)) return false
  const answer = chooseOption(api, {
    kind: 'choice', source: RAW_CODES.bourseLocusSafeguard, seat: inv.seat,
    prompt: '选择移除 1 个毁灭标记的地点或你控制的支援。',
    options: candidates.map(entry => ({ id: entry.id, label: entry.label })),
  })
  const chosen = candidates.find(entry => entry.id === answer) || candidates[0]
  if (typeof api?.removeDoomFromCard === 'function') {
    api.removeDoomFromCard(chosen.location || chosen.asset, 1)
  } else if (chosen.location) chosen.location.doom = Math.max(0, (Number(chosen.location.doom) || 0) - 1)
  else chosen.asset.doom = Math.max(0, (Number(chosen.asset.doom) || 0) - 1)
  api?.info?.(`🛡️ 证券交易所（节点护卫）：共同花费 ${required} 个线索，移除 1 个毁灭标记。`)
  return true
}

function investigateReplacementAction(state, inv, api, kind) {
  const location = locationOf(state, inv.location)
  if (!location) return false
  const key = `${codeOf(location)}:${state.round}`
  const data = chapterState(state)
  if (data.replacementUsed[key]) {
    api?.info?.('这个地点的「降低难度」能力本轮已经用过。')
    return false
  }
  data.replacementUsed[key] = true
  const difficulty = Math.max(0, (Number(location.shroud) || 0) - 2)
  api?.test?.(inv.seat, 'intellect', difficulty, result => {
    if (!result?.success) return
    if (kind === 'draw') {
      if (typeof api?.drawCards === 'function') api.drawCards(inv.seat, 2)
      api?.info?.(`📜 ${location.name}：降低难度调查成功，改为抽取 2 张卡牌。`)
    } else {
      if (typeof api?.gainResources === 'function') api.gainResources(inv.seat, 2)
      else inv.resources = (Number(inv.resources) || 0) + 2
      api?.info?.(`💱 ${location.name}：降低难度调查成功，改为获得 2 资源。`)
    }
  }, 0, { code: codeOf(location), name: location.name, action: 'investigate' })
  return true
}

function bloodyNexusEvadeAction(state, inv, api) {
  const data = chapterState(state)
  if (data.bloodyNexusUsed) return false
  api?.test?.(inv.seat, 'willpower', 6, result => {
    if (!result?.success) return
    data.bloodyNexusUsed = true
    const beast = (state.enemies || []).find(enemy => !enemy.defeated
      && [RAW_CODES.beastRavager, RAW_CODES.beastWolf].includes(String(codeOf(enemy))))
    if (!beast) {
      api?.info?.('🔓 血腥联结：深红斗篷的恶兽不在场上，没有可躲避的目标。')
      return
    }
    if (typeof api?.evadeEnemy === 'function') api.evadeEnemy(beast, { automatic: true })
    api?.info?.(`🔓 血腥联结：自动躲避「${beast.name}」（无论其当前地点）。`)
  }, 0, { code: RAW_CODES.catacombsBloodyNexus, name: '亚历山大地下陵墓（血腥联结）', action: 'activate' })
  return true
}

function victoriaDrawAction(state, inv, api) {
  const data = chapterState(state)
  if (data.victoriaUsedRound === state.round) return false
  data.victoriaUsedRound = state.round
  if (typeof api?.lookAt === 'function') {
    api.lookAt(inv.seat, { zone: 'deck', count: 2, choose: 1, source: RAW_CODES.victoriaCollege,
      prompt: '维多利亚学院：查看牌库顶 2 张，选择 1 张抽取。' })
  }
  // 「另一张洗回牌库」：lookAt 把剩余牌放回牌库顶，这里再洗一次牌库。
  const deck = state.investigators?.[inv.seat]?.deck
  if (Array.isArray(deck) && typeof api?.shuffle === 'function') {
    state.investigators[inv.seat].deck = api.shuffle([...deck])
  }
  api?.info?.('📚 维多利亚学院：调整本次抽牌（看牌库顶 2 张、抽 1 张、其余洗回）。')
  return true
}

function zanettTaxAction(state, inv, api) {
  const data = chapterState(state)
  data.zanettPaidRound = state.round
  data.zanettPaidSeat = inv.seat
  api?.info?.(`💸 妇女市集：花费 1 个行动 —— 本轮在此攻击敌人时攻击值不提升。`)
  return true
}

function knightAssetAction(state, inv, api, direction) {
  const asset = knightAsset(state)
  if (!asset) return false
  if (direction === 'in') {
    const available = Math.min(3, Number(inv.resources) || 0)
    if (available <= 0) return false
    const amount = Math.max(1, available)
    if (typeof api?.loseResources === 'function') api.loseResources(inv.seat, amount)
    else inv.resources = Math.max(0, (Number(inv.resources) || 0) - amount)
    asset.resources = (Number(asset.resources) || 0) + amount
    asset.exhausted = true
    api?.info?.(`🎩 暗红骑士：${inv.name || '调查员'} 把 ${amount} 资源移到暗红骑士上。`)
    return true
  }
  const available = Math.min(3, Number(asset.resources) || 0)
  if (available <= 0) return false
  const target = chooseOption(api, {
    kind: 'choice', source: RAW_CODES.claretKnightAsset, seat: inv.seat,
    prompt: '把暗红骑士上的资源移到哪里？',
    options: [{ id: 'pool', label: '自己的资源池' }, { id: 'asset', label: '你控制的一个支援（充能/子弹/补给/秘密）' }],
  }) || 'pool'
  const amount = 1
  asset.resources = Math.max(0, Number(asset.resources) - amount)
  asset.exhausted = true
  if (target === 'asset') {
    const candidates = (inv.assets || []).filter(assetEntry => ['charge', 'ammo', 'supply', 'secret']
      .some(usesType => registeredEntry(assetEntry.code)?.usesType === usesType))
    if (candidates.length && typeof api?.addUses === 'function') {
      api.addUses(candidates[0], amount)
      api?.info?.(`🎩 暗红骑士：把 ${amount} 个资源移到「${cardNameOf(candidates[0].code)}」上。`)
      return true
    }
  }
  if (typeof api?.gainResources === 'function') api.gainResources(inv.seat, amount)
  else inv.resources = (Number(inv.resources) || 0) + amount
  api?.info?.(`🎩 暗红骑士：把 ${amount} 个资源移到${inv.name || '调查员'}的资源池。`)
  return true
}

// ---------------------------------------------------------------------------
// 巡逻（钥匙节点目标）
// ---------------------------------------------------------------------------
function nearestKeyLocusLocation(state, api, fromId) {
  const candidates = keyLocusLocations(state)
  if (!candidates.length) return null
  if (candidates.includes(fromId)) return fromId
  const distance = id => {
    const value = api?.locationDistance?.(fromId, [id])
    return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY
  }
  return [...candidates].sort((left, right) => distance(left) - distance(right)
    || String(left).localeCompare(String(right)))[0] || null
}

function stepTowardLocation(state, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return null
  const queue = [[fromId, null]]
  const seen = new Set([fromId])
  while (queue.length) {
    const [id, first] = queue.shift()
    for (const next of locationOf(state, id)?.connections || []) {
      if (seen.has(next)) continue
      const step = first || next
      if (next === toId) return step
      seen.add(next)
      queue.push([next, step])
    }
  }
  return null
}

function resolvePatrol(state, api, enemy) {
  const rule = enemyRuleFor(codeOf(enemy))?.patrol || (codeOf(enemy) === RAW_CODES.beastRavager)
  if (!rule) return null
  const target = nearestKeyLocusLocation(state, api, enemy.location)
  if (!target) return null
  const patrolApi = api?.mechanics?.tsk?.patrol || null
  const resolved = patrolApi?.target?.({ kind: 'named', locationId: target }) || target
  enemy.patrol = { kind: 'named', locationId: resolved }
  // 巡逻路径优先用 P2 原语；钥匙节点本身在本章是「敌人实例」，会被原语的「路径上不能有敌人」规则挡住，
  // 因此原语返回 null 时回落到不考虑占位的 BFS（见 scenarioApproximations 第 1 条）。
  const destination = patrolApi?.destination?.(enemy) || stepTowardLocation(state, enemy.location, resolved)
  if (!destination) return null
  if (typeof api?.moveEnemy === 'function') api.moveEnemy(enemy, destination)
  else enemy.location = destination
  api?.info?.(`🐾 「${enemy.name || '巡逻敌人'}」巡逻到「${locationName(state, destination)}」。`)
  return destination
}

// ---------------------------------------------------------------------------
// 幕 / 密谋推进
// ---------------------------------------------------------------------------
const actCodeOf = state => codeOf((state.acts || [])[state.actIndex])
const agendaCodeOf = state => codeOf((state.agendas || [])[state.agendaIndex])

/** 幕背：版本一 R1；版本二 R2；版本三按剧本日志分流 R5/R6。 */
export function resolveActBack(state, api, act = null) {
  const code = codeOf(act) || actCodeOf(state)
  if (code === RAW_CODES.actV1) {
    for (const enemy of [...(state.enemies || [])]) {
      if (enemy.keyLocus === true && typeof api?.addEnemyToVictory === 'function') api.addEnemyToVictory(enemy)
    }
    const beast = enemyOf(state, RAW_CODES.beastRavager)
    if (beast && typeof api?.addEnemyToVictory === 'function') api.addEnemyToVictory(beast)
    api?.info?.('🏁 惊弓之鸟（版本一）背面：深红斗篷的恶兽与场上每个钥匙节点加入胜利区 → 结局 1。')
    if (typeof api?.finish === 'function') api.finish('resolution1')
    return 'resolution1'
  }
  if (code === RAW_CODES.actV2) {
    api?.info?.('🏁 惊弓之鸟（版本二）背面 → 结局 2。')
    if (typeof api?.finish === 'function') api.finish('resolution2')
    return 'resolution2'
  }
  if (code === RAW_CODES.actV3) {
    const dealt = hasRecord(state, RECORD_KEYS.dealWithKnight)
    const key = dealt ? 'resolution5' : 'resolution6'
    api?.info?.(`🏁 惊弓之鸟（版本三）背面：检查剧本日志 —— ${dealt ? '与暗红骑士达成交易' : '帮助西里特工'}`
      + ` → ${key === 'resolution5' ? '结局 5（接结局 8）' : '结局 6'}。`)
    if (typeof api?.finish === 'function') api.finish(key)
    return key
  }
  return null
}

/** 密谋背：版本一推进幕或 R3；版本二/三「创伤或撤退 + 翻回 + 10 毁灭」。 */
export function resolveAgendaBack(state, api, agenda = null) {
  const code = codeOf(agenda) || agendaCodeOf(state)
  if (code === RAW_CODES.agendaV1) {
    if (chapterState(state).claretKnightDefeated) {
      api?.info?.('💀 密谋背面：暗红骑士已被击败 → 结局 3。')
      if (typeof api?.finish === 'function') api.finish('resolution3')
      return 'resolution3'
    }
    api?.info?.('🌩️ 密谋背面：风暴仍在继续 —— 推进场景。')
    api?.advanceAct?.()
    return 'advanceAct'
  }
  if (code === RAW_CODES.agendaV2 || code === RAW_CODES.agendaV3) {
    const survivors = aliveInvestigators(state)
    const answer = chooseOption(api, {
      kind: 'story', source: code, seat: LEAD_SEAT(state),
      prompt: '调查员必须决定（选择一项）：受到 1 点直接伤害与 1 点肉体创伤，或全体撤退。',
      options: [{ id: 'trauma', label: '每位幸存者受到 1 点直接伤害并获得 1 点肉体创伤' },
        { id: 'resign', label: '每位幸存者立即撤退' }],
    }) || 'trauma'
    if (answer === 'resign') {
      for (const inv of survivors) api?.resign?.(inv.seat)
      api?.info?.('🏳️ 密谋背面：全体幸存者立即撤退。')
    } else {
      for (const inv of survivors) {
        api?.directDamage?.(inv.seat, 1)
        if (typeof api?.addTrauma === 'function') api.addTrauma(inv.seat, 'physical', 1)
        else {
          state.campaign.trauma ||= {}
          state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
          state.campaign.trauma[inv.seat].physical += 1
        }
      }
      api?.info?.('🩸 密谋背面：每位幸存者受到 1 点直接伤害与 1 点肉体创伤。')
    }
    api?.revertAgenda?.()
    if (typeof api?.addDoom === 'function') api.addDoom(10)
    else state.doom = (Number(state.doom) || 0) + 10
    api?.info?.('🌪️ 密谋翻回正面，并在上面放置 10 个毁灭标记。')
    return answer
  }
  return null
}

/** 幕目标（引擎 checkObjectives 读点）。 */
export function checkActObjectives(state, api) {
  const code = actCodeOf(state)
  if (code === RAW_CODES.actV2) {
    const knightDefeated = chapterState(state).claretKnightDefeated
    if (knightDefeated || keyControlledByInvestigator(state, api)) {
      api?.info?.('🎯 暗红骑士被击败或调查员控制了法罗斯之光：推进场景。')
      api?.advanceAct?.()
      return true
    }
  }
  if (code === RAW_CODES.actV3) {
    const beastDefeated = chapterState(state).beastDefeated
    if (beastDefeated || keyControlledByInvestigator(state, api)) {
      api?.info?.('🎯 深红斗篷的恶兽被击败或调查员控制了法罗斯之光：推进场景。')
      api?.advanceAct?.()
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// 行为（引擎钩子）
// ---------------------------------------------------------------------------
export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes: Object.freeze([...CHAPTER_ENTRY_CODES]),
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: DOGS_OF_WAR_TOKEN_MEANINGS,
  recordReads: RECORD_READS,
  recordWrites: RECORD_WRITES,
  resolutions: Object.keys(resolutions),
  gatherGroups: GATHER_GROUPS,

  // ---- 开场：版本选择 + 混乱袋 + 章节密钥登记 ----
  preScenarioSetup(state, events, api) {
    const data = chapterState(state)
    ensureLightOfPharos(state, api)
    if (!data.variant) resolveIntro(state, api)
    else {
      // 读档后再次进入布置：幕/密谋按已记录版本恢复。
      if (codeOf(state.acts?.[0]) !== VERSION_CODES[data.variant].act) {
        state.acts = [{ ...ACTS[data.variant] }]
        state.agendas = [{ ...AGENDAS[data.variant] }]
      }
    }
    const version = data.variant || 'v1'
    api?.info?.(`📖 战争疮痍 · ${VERSION_SETUPS[version].title}`
      + `（${data.branch === 'sirry' ? '帮助西里特工' : '与暗红骑士合作'}）。`)
    return version
  },

  // ---- 布置 ----
  // 2026-11-13 P0：遭遇牌库按开场选定的版本重建（v.II/III 换扫荡团伙/黑暗异教等共享组）。
  // 引擎的 modifyDeck 读点在 setupScenarioDecks（locations 之后、洗牌之前），此时 variant 已由
  // preScenarioSetup 写入。
  modifyDeck(state) {
    return [...encounterDeckForVersion(currentVersion(state) || 'v1')]
  },

  setupLocations(state, events, helper = {}) {
    const api = helper.api || null
    behavior.preScenarioSetup(state, events, api)
    const data = chapterState(state)
    state.scenarioZones ||= {}
    const aside = new Set(state.scenarioZones.setAside || [])
    for (const code of SET_ASIDE_CODES) aside.add(code)
    state.scenarioZones.setAside = [...aside]
    state.scenarioZones.victory ||= []
    state.scenarioZones.removed ||= []
    data.replacementUsed = {}
    const result = setupVersion(state, api)
    helper.info?.(state, events, `🏺 战争疮痍：亚历山大 ${Object.keys(LOCATIONS).length} 张地点入场`
      + `（${VERSION_SETUPS[data.variant || 'v1'].title}）；钥匙节点 ${result?.loci?.length || 0} 张。`)
    return []
  },

  // ---- 混乱标记：skull 依赖「你所在地点是否有钥匙节点」 ----
  resolveChaosToken(state, inv, token) {
    return dogsOfWarChaosToken(state, inv, token)
  },

  // ---- 检定之后：cultist / tablet / elderthing 后果 + 首领换钥 + 地点强制 ----
  afterTest(state, inv, result, api, context = null) {
    const riders = dogsOfWarAfterTest(state, inv, result, context)
    for (const rider of riders) {
      if (rider === 'cultistHarmOrDoom') cultistHarmOrDoom(state, inv, api)
      else if (rider === 'loseResourcesPerPoint') loseResourcesPerPoint(state, inv, result, api)
      else if (rider === 'patrolDisengage' || rider === 'patrolAttackDisengage') {
        patrolAttackRider(state, inv, api, context, rider === 'patrolAttackDisengage')
      }
    }
    // 首领（敌人面）的强制：你在它所在地点检定失败后，如果它是重整状态，它变换身上的每个钥匙。
    const enemy = (state.enemies || []).find(item => !item.defeated && item.location === inv?.location
      && [RAW_CODES.claretKnightEnemy, RAW_CODES.beastWolf].includes(String(codeOf(item))))
    if (enemy && result?.success === false && !enemy.exhausted) {
      api?.info?.(`🔑 「${enemy.name}」：你在它所在地点检定失败 —— 它变换身上的法罗斯之光。`)
      resolveKeyShift(state, inv?.seat ?? LEAD_SEAT(state), api, { by: 'enemy' })
    }
    // 奎贝堡：调查失败后本轮不能再发现线索 / 揭露迷你卡。
    const here = locationOf(state, inv?.location)
    if (here && codeOf(here) === RAW_CODES.qaitbayCitadel && result?.success === false
      && (context?.test?.actionKind === 'investigate' || !context?.test)) {
      chapterState(state).qaitbayLockRound = state.round
      api?.info?.('🏰 奎贝堡：调查失败 —— 本轮不能在这里发现线索或揭露迷你卡。')
    }
    // 滨海大道：成功调查后，本轮在此的其他检定难度 +2。
    if (here && codeOf(here) === RAW_CODES.theCorniche && result?.success === true
      && (context?.test?.actionKind === 'investigate' || !context?.test)) {
      chapterState(state).cornicheBoostRound = state.round
      api?.info?.('🌊 滨海大道：成功调查 —— 本轮在此的其他检定难度 +2。')
    }
    return riders
  },

  // ---- 敌军阶段：巡逻移动 → 版本一「敌人攻击钥匙节点」→ 脉冲检查 ----
  enemyPhaseStart(state, api = {}) {
    for (const enemy of [...(state.enemies || [])]) {
      if (enemy.defeated || enemy.exhausted || enemy.engagedSeat != null) continue
      if (enemy.keyLocus === true) continue
      resolvePatrol(state, api, enemy)
    }
  },

  enemyPhaseEnd(state, api = {}) {
    enemyAttacksKeyLoci(state, api)
    discardOrphanPulses(state, api)
    syncCountsAsKeyLocus(state)
    syncWindsorCost(state)
  },

  // ---- 敌人数值/攻击限制 ----
  enemyStatModifier(state, enemy, kind, inv) {
    const location = locationOf(state, enemy.location)
    if (codeOf(enemy) === RAW_CODES.scarletBeast && hasTrait(location, 'Locus Site')) {
      if (kind === 'fight') return 2
      if (kind === 'evade') return -2
    }
    if (kind === 'fight' && codeOf(location) === RAW_CODES.zanEtElSettat && inv) {
      const data = chapterState(state)
      const paid = data.zanettPaidRound === state.round && data.zanettPaidSeat === inv.seat
      if (!paid) return 2
    }
    return 0
  },

  canFightEnemy(state, inv, enemy) {
    if (!inv || !enemy) return undefined
    if (enemy.location !== inv.location) return undefined
    const provocateur = (state.enemies || []).find(item => !item.defeated && !item.exhausted
      && codeOf(item) === RAW_CODES.coterieProvocateur && item.location === inv.location)
    if (!provocateur) return undefined
    if (codeOf(enemy) === RAW_CODES.coterieProvocateur) return undefined
    return false
  },

  enemySpawned(state, enemy, api) {
    if (codeOf(enemy) === RAW_CODES.coterieProvocateur) {
      const target = nearestKeyLocusLocation(state, api, enemy.location)
      if (target && enemy.location !== target) {
        if (typeof api?.moveEnemy === 'function') api.moveEnemy(enemy, target)
        else enemy.location = target
        api?.info?.(`🐾 结社煽动者生成在最近的钥匙节点「${locationName(state, target)}」。`)
      }
    }
    syncCountsAsKeyLocus(state)
  },

  enemyDefeated(state, enemy, api) {
    const code = codeOf(enemy)
    const keyLocus = KEY_LOCUS_DATA[code] || null
    if (keyLocus) {
      const data = chapterState(state)
      data.keyLociDefeated.push(code)
      api?.info?.(`🪨 钥匙节点（${keyLocus.name}）被击败。`)
      syncCountsAsKeyLocus(state)
      syncWindsorCost(state)
      discardOrphanPulses(state, api)
      if (keyLocus.defeatedToVictory) return undefined
      // 最后堡垒：从游戏中移除（不加入胜利区）。
      if (typeof api?.removeFromGameCards === 'function') api.removeFromGameCards([code])
      else state.removedFromGame = [...new Set([...(state.removedFromGame || []), code])]
      return true
    }
    if (code === RAW_CODES.claretKnightEnemy) {
      chapterState(state).claretKnightDefeated = true
      if (keyBearer(state, api)?.type === 'enemy') bindLightOfPharos(state, api, { type: 'none' })
      api?.info?.('💀 暗红骑士（敌人面）被击败。')
      checkActObjectives(state, api)
    }
    if (code === RAW_CODES.beastWolf || code === RAW_CODES.beastRavager) {
      chapterState(state).beastDefeated = true
      if (keyBearer(state, api)?.type === 'enemy') bindLightOfPharos(state, api, { type: 'none' })
      checkActObjectives(state, api)
    }
    void enemy
    return undefined
  },

  // 「深红斗篷的恶兽（红衣毁灭者）将被击败时：改为治愈全部伤害、横置并移动到地下陵墓」。
  // 读点两层：enemyDamaged 在伤害结算后做「本该被击败」的替换，enemyCanBeDefeated 拦住同一次击败。
  enemyDamaged(state, enemy, api) {
    if (codeOf(enemy) !== RAW_CODES.beastRavager) return
    const health = Number(enemy.health) || 0
    if ((Number(enemy.damageTaken) || 0) < health) return
    const data = chapterState(state)
    if (data.beastFledRound === state.round) return
    data.beastFledRound = state.round
    enemy.damageTaken = 0
    enemy.exhausted = true
    if (enemy.engagedSeat != null) {
      const owner = state.investigators?.[enemy.engagedSeat]
      if (owner) owner.engaged = (owner.engaged || []).filter(id => id !== enemy.id)
      enemy.engagedSeat = null
    }
    const catacombs = (state.locations || []).find(location =>
      [RAW_CODES.catacombsBloodyNexus, RAW_CODES.catacombsDenOfTheBeast, RAW_CODES.catacombsAncientTomb]
        .includes(String(codeOf(location))))
    if (catacombs && typeof api?.moveEnemy === 'function') api.moveEnemy(enemy, catacombs.id)
    else if (catacombs) enemy.location = catacombs.id
    api?.info?.('🐺 深红斗篷的恶兽将被击败：改为治愈全部伤害、横置并退到亚历山大地下陵墓。')
  },

  enemyCanBeDefeated(state, enemy) {
    if (codeOf(enemy) !== RAW_CODES.beastRavager) return undefined
    return chapterState(state).beastFledRound === state.round ? false : undefined
  },

  // ---- 毁灭：版本一的「扣减」规则 + 地下陵墓（血腥联结）的强制揭示 ----
  doomPlaced(state, payload, api) {
    const version = currentVersion(state)
    if (version === 'v1' && payload?.target && payload.agenda === false) {
      const amount = Number(payload.amount) || 0
      if (amount > 0) {
        state.doom = (Number(state.doom) || 0) - 2 * amount
        api?.info?.(`🌑 版本一：其它卡上的 ${amount} 个毁灭改为扣减毁灭总数（当前 ${state.doom}）。`)
      }
    }
    const bloody = (state.locations || []).find(location => codeOf(location) === RAW_CODES.catacombsBloodyNexus)
    if (bloody && !bloody.revealed && (Number(state.doom) || 0) >= 6) {
      if (typeof api?.reveal === 'function') api.reveal(bloody.id)
      api?.info?.('🩸 密谋上已有 6 个毁灭：揭示亚历山大地下陵墓（血腥联结）。')
    }
  },

  // ---- 地点：进入限制 / 敌人生成改道 ----
  investigatorEntryError(state, location, inv) {
    return entryErrorFor(state, location, inv)
  },

  moveError(state, inv, location, id) {
    const target = location || locationOf(state, id)
    return entryErrorFor(state, target, inv)
  },

  spawnLocation(state, code, defaultLocation) {
    const bourse = (state.locations || []).find(location => codeOf(location) === RAW_CODES.bourseLocusSafeguard)
    if (!bourse || defaultLocation !== bourse.id) return defaultLocation
    if (keyLocusEntities(state).length <= 1) return defaultLocation
    const candidates = (bourse.connections || []).filter(id => locationOf(state, id))
    const destination = candidates[0] || defaultLocation
    if (destination !== defaultLocation) {
      // 无 api 时只记录：引擎的 spawnEnemy 会用返回值当生成点。
      return destination
    }
    return defaultLocation
  },

  // ---- 调查：版本地点改写 + 奎贝堡的封锁 ----
  investigateResult(state, inv, location, result, api) {
    const code = codeOf(location)
    if (!result?.success) return undefined
    if (code === RAW_CODES.bourseCommercialCenter || code === RAW_CODES.catacombsAncientTomb) {
      const key = `${code}:${state.round}`
      const data = chapterState(state)
      if (data.replacementUsed[key]) return undefined
      data.replacementUsed[key] = true
      if (code === RAW_CODES.bourseCommercialCenter) {
        if (typeof api?.gainResources === 'function') api.gainResources(inv.seat, 4)
        else inv.resources = (Number(inv.resources) || 0) + 4
        api?.info?.('💱 证券交易所（商贸中心）：成功调查改为获得 4 资源（不发现线索）。')
      } else {
        if (typeof api?.drawCards === 'function') api.drawCards(inv.seat, 3)
        api?.info?.('📜 亚历山大地下陵墓（古代坟墓）：成功调查改为抽取 3 张卡牌（不发现线索）。')
      }
      return false
    }
    if (code === RAW_CODES.qaitbayCitadel && chapterState(state).qaitbayLockRound === state.round) {
      api?.info?.('🏰 奎贝堡：本轮你已经调查失败，不能再发现线索。')
      return false
    }
    return undefined
  },

  canDiscoverClues(state, inv, location) {
    if (codeOf(location) !== RAW_CODES.qaitbayCitadel) return undefined
    return chapterState(state).qaitbayLockRound === state.round ? false : undefined
  },

  testDifficultyModifier(state, inv, skillContext, difficulty) {
    const here = locationOf(state, inv?.location)
    if (here && codeOf(here) === RAW_CODES.theCorniche
      && chapterState(state).cornicheBoostRound === state.round) return 2
    void skillContext
    void difficulty
    return 0
  },

  // ---- 轮末：脉冲检查 ----
  roundEnded(state, api) {
    discardOrphanPulses(state, api)
    syncCountsAsKeyLocus(state)
    syncWindsorCost(state)
  },

  // ---- 幕 / 密谋 ----
  actReveal(state, act, api) {
    const code = codeOf(act)
    if (![RAW_CODES.actV1, RAW_CODES.actV2, RAW_CODES.actV3].includes(code)) return false
    resolveActBack(state, api, act)
    return true
  },

  agendaReveal(state, agenda, api) {
    const code = codeOf(agenda)
    if (![RAW_CODES.agendaV1, RAW_CODES.agendaV2, RAW_CODES.agendaV3].includes(code)) return false
    resolveAgendaBack(state, api, agenda)
    return true
  },

  checkObjectives(state, api) {
    return checkActObjectives(state, api)
  },

  // ---- 剧本行动：钥匙节点、法罗斯之光、地点能力 ----
  actions(state, inv) {
    const moves = []
    if (!inv || inv.defeated || inv.resigned) return moves
    moveActions(state, inv, moves)
    return moves
  },

  performAction(state, inv, move, api) {
    const rule = String(move?.rule || '')
    if (rule.startsWith(`${ACTION_RULES.expose}:`)) {
      return Boolean(exposeMini(state, inv, rule.slice(ACTION_RULES.expose.length + 1), api))
    }
    switch (rule) {
      case ACTION_RULES.keyLocusDamage: return keyLocusDamageAction(state, inv, api, move)
      case ACTION_RULES.keyLocusHeal: return keyLocusHealAction(state, inv, api)
      case ACTION_RULES.keyResource: return keyResourceAction(state, inv, api)
      case ACTION_RULES.bourseRemoveDoom: return bourseRemoveDoomAction(state, inv, api)
      case ACTION_RULES.ancientTombDraw: return investigateReplacementAction(state, inv, api, 'draw')
      case ACTION_RULES.commercialResources: return investigateReplacementAction(state, inv, api, 'resources')
      case ACTION_RULES.bloodyNexusEvade: return bloodyNexusEvadeAction(state, inv, api)
      case ACTION_RULES.victoriaDraw: return victoriaDrawAction(state, inv, api)
      case ACTION_RULES.zanettTax: return zanettTaxAction(state, inv, api)
      case ACTION_RULES.knightToAsset: return knightAssetAction(state, inv, api, 'in')
      case ACTION_RULES.knightFromAsset: return knightAssetAction(state, inv, api, 'out')
      default: return false
    }
  },

  // ---- 遭遇卡 ----
  resolveEncounter(state, inv, card, api) {
    return resolveEncounterEntry(state, inv, card, api)
  },

  // ---- 结局 ----
  resolution(state, key, events, api = {}) {
    const data = chapterState(state)
    const version = data.variant || 'v1'
    const effective = key === 'noResolution' ? (NO_RESOLUTION_TARGET[version] || 'resolution7') : key
    if (key === 'noResolution') {
      api?.info?.(`📕 未达成任何结局（${VERSION_SETUPS[version].title}）：跳至 `
        + `${effective === 'resolution3' ? '结局 3' : effective === 'resolution4' ? '结局 4' : '结局 7'}。`)
    }
    const bearerRecord = value => {
      recordsFor(state).keyLightOfPharosBearer = value
    }
    if (effective === 'resolution1' || effective === 'resolution5') {
      api?.info?.(`📕 ${effective === 'resolution1' ? '结局 1' : '结局 5'}：接结局 8。`)
      return finishResolution(state, api, 'resolution8')
    }
    if (effective === 'resolution2') {
      recordFact(state, RECORD_KEYS.youHaventSeenTheLastOfTheClaretKnight, true)
      const seat = chooseBearerSeat(state, api)
      bindLightOfPharos(state, api, seat == null ? { type: 'none' } : { type: 'investigator', seat }, { steal: true })
      bearerRecord(seat == null ? 'investigator' : seat)
      markTime(state, 2)
      api?.info?.('📕 结局 2：暗红骑士离开亚历山大；记 2 点时间。')
      return { bonus: 0 }
    }
    if (effective === 'resolution3') {
      recordFact(state, RECORD_KEYS.failedToFendOffTheBeast, true)
      recordFact(state, RECORD_KEYS.youHaventSeenTheLastOfTheBeast, true)
      for (const inv of state.investigators || []) {
        if (inv.defeated || inv.resigned) continue
        if (typeof api?.addTrauma === 'function') api.addTrauma(inv.seat, 'mental', 1)
        else {
          state.campaign.trauma ||= {}
          state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
          state.campaign.trauma[inv.seat].mental += 1
        }
      }
      bindLightOfPharos(state, api, { type: 'none' })
      bearerRecord('beast')
      markTime(state, 1)
      api?.info?.('📕 结局 3：特别小组未能阻挡恶兽；恶兽拥有法罗斯之光；记 1 点时间。')
      return { bonus: 0 }
    }
    if (effective === 'resolution4') {
      recordFact(state, RECORD_KEYS.youHaventSeenTheLastOfTheClaretKnight, true)
      bindLightOfPharos(state, api, { type: 'none' })
      bearerRecord('claretKnight')
      markTime(state, 1)
      api?.info?.('📕 结局 4：暗红骑士拥有法罗斯之光；记 1 点时间。')
      return { bonus: 0 }
    }
    if (effective === 'resolution6') {
      recordFact(state, RECORD_KEYS.youHaventSeenTheLastOfTheBeast, true)
      const seat = chooseBearerSeat(state, api)
      bindLightOfPharos(state, api, seat == null ? { type: 'none' } : { type: 'investigator', seat }, { steal: true })
      bearerRecord(seat == null ? 'investigator' : seat)
      markTime(state, 2)
      api?.info?.('📕 结局 6：恶兽逃离；调查员持有法罗斯之光；记 2 点时间。')
      return { bonus: 0 }
    }
    if (effective === 'resolution7') {
      recordFact(state, RECORD_KEYS.theDogsAreAtWar, true)
      markTime(state, 1)
      api?.info?.('📕 结局 7：大战打响；记 1 点时间。')
      return { bonus: 0 }
    }
    if (effective === 'resolution8') return finishResolution(state, api, 'resolution8')
    return {}
  },
}

function finishResolution(state, api, key) {
  if (key !== 'resolution8') return {}
  recordFact(state, RECORD_KEYS.theCellAidedTheKnight, true)
  recordFact(state, RECORD_KEYS.youHaventSeenTheLastOfTheBeast, true)
  chapterState(state).claretKnightDefeated = false
  bindLightOfPharos(state, api, { type: 'none' })
  recordsFor(state).keyLightOfPharosBearer = 'claretKnight'
  markTime(state, 3)
  api?.info?.('📕 结局 8：特别小组援助了骑士，暗红骑士拥有法罗斯之光；记 3 点时间。')
  return { bonus: 0 }
}

function chooseBearerSeat(state, api) {
  const alive = aliveInvestigators(state)
  if (!alive.length) return null
  const answer = alive.length === 1 ? String(alive[0].seat) : choiceFor(api, {
    kind: 'investigator', source: RAW_CODES.scenario, seat: LEAD_SEAT(state),
    prompt: '选择一位调查员成为法罗斯之光的持有者。',
    options: alive.map(inv => ({ id: String(inv.seat), label: inv.name || `调查员${inv.seat + 1}` })),
  })
  return alive.some(inv => String(inv.seat) === String(answer)) ? Number(answer) : alive[0].seat
}

// ---------------------------------------------------------------------------
// 行动清单（actions 钩子的实现）
// ---------------------------------------------------------------------------
function moveActions(state, inv, moves) {
  const location = locationOf(state, inv.location)
  const code = codeOf(location)
  // 钥匙节点行动（所在的地点上）：防御屏障 → 花 1 线索造成 2 伤害；最后堡垒 → 花 1 线索检定治愈。
  const locus = keyLocusAtLocation(state, inv.location)
  if (locus && !locus.defeated) {
    const face = locus.keyLocusFace || KEY_LOCUS_DATA[codeOf(locus)]?.face
    const clues = Number(inv.clues) || 0
    if (face === 'defensiveBarrier' || codeOf(locus) === RAW_CODES.keyLocusDefensiveBarrier) {
      moves.push({
        action: 'scenarioAction', rule: ACTION_RULES.keyLocusDamage, locationId: inv.location,
        label: '花费 1 个线索：对钥匙节点（防御屏障）造成 2 点伤害',
        ...(clues < 1 ? { reason: '线索不足（需要 1 个）' } : {}),
      })
    } else {
      moves.push({
        action: 'scenarioAction', rule: ACTION_RULES.keyLocusHeal, locationId: inv.location,
        label: '花费 1 个线索：检定[意志](2)，治愈钥匙节点（最后堡垒）',
        ...(clues < 1 ? { reason: '线索不足（需要 1 个）' } : {}),
      })
    }
  }
  // 地点能力。
  if (code === RAW_CODES.bourseLocusSafeguard) {
    const required = groupClueCost(state)
    moves.push({
      action: 'scenarioAction', rule: ACTION_RULES.bourseRemoveDoom, locationId: inv.location, required,
      label: `共同花费 ${required} 个线索：从任意地点或你控制的支援上移除 1 个毁灭标记`,
      ...(canPayGroupClues(state, inv, required) ? {} : { reason: `线索不足（需要 ${required}）` }),
    })
  }
  if (code === RAW_CODES.bourseCoteriePost || code === RAW_CODES.catacombsDenOfTheBeast) {
    const required = groupClueCost(state)
    moves.push({
      action: 'scenarioAction', rule: ACTION_RULES.keyResource, locationId: inv.location, required,
      label: `检定[意志]或[敏捷](4)：成功后共同花费 ${required} 个线索，在法罗斯之光上放 1 资源`
        + `（${LIGHT_OF_PHAROS.resourcesToControl} 个后由调查员控制）`,
    })
  }
  if (code === RAW_CODES.bourseCommercialCenter) {
    moves.push({
      action: 'scenarioAction', rule: ACTION_RULES.commercialResources, locationId: inv.location,
      label: '调查（难度 -2）：成功改为获得 2 资源（团队每轮一次）',
    })
  }
  if (code === RAW_CODES.catacombsAncientTomb) {
    moves.push({
      action: 'scenarioAction', rule: ACTION_RULES.ancientTombDraw, locationId: inv.location,
      label: '调查（难度 -2）：成功改为抽取 2 张卡牌（团队每轮一次）',
    })
  }
  if (code === RAW_CODES.catacombsBloodyNexus && location?.revealed) {
    moves.push({
      action: 'scenarioAction', rule: ACTION_RULES.bloodyNexusEvade, locationId: inv.location,
      label: '检定[意志](6)：自动躲避深红斗篷的恶兽（团队每场游戏一次）',
      ...(chapterState(state).bloodyNexusUsed ? { reason: '本场游戏已经用过这个能力', used: true } : {}),
    })
  }
  if (code === RAW_CODES.victoriaCollege && chapterState(state).victoriaUsedRound !== state.round) {
    moves.push({
      action: 'scenarioAction', rule: ACTION_RULES.victoriaDraw, locationId: inv.location, actions: 0, fast: true,
      label: '快速：查看牌库顶 2 张，抽 1 张，其余洗回（每轮一次）',
    })
  }
  if (code === RAW_CODES.zanEtElSettat && (state.enemies || []).some(enemy =>
    !enemy.defeated && enemy.location === inv.location)) {
    const data = chapterState(state)
    const paid = data.zanettPaidRound === state.round && data.zanettPaidSeat === inv.seat
    moves.push({
      action: 'scenarioAction', rule: ACTION_RULES.zanettTax, locationId: inv.location,
      label: '花费 1 个行动：本轮在妇女市集攻击敌人时攻击值不提升',
      ...(paid ? { reason: '本轮已经付过', used: true } : {}),
    })
  }
  // 暗红骑士（剧情支援面）的 [fast] 资源搬运。
  const knight = knightAsset(state)
  if (knight && knight.location === inv.location) {
    moves.push({
      action: 'scenarioAction', rule: ACTION_RULES.knightToAsset, locationId: inv.location, actions: 0, fast: true,
      label: '快速，横置暗红骑士：把你最多 3 个资源移到暗红骑士上',
      ...((Number(inv.resources) || 0) < 1 ? { reason: '你没有资源' } : {}),
    })
    moves.push({
      action: 'scenarioAction', rule: ACTION_RULES.knightFromAsset, locationId: inv.location, actions: 0, fast: true,
      label: '快速，横置暗红骑士：把暗红骑士上的 1 个资源移到你的资源池或支援上',
      ...((Number(knight.resources) || 0) < 1 ? { reason: '暗红骑士上没有资源' } : {}),
    })
  }
  // 隐匿迷你卡：本地点每张迷你卡一个揭露行动。
  const concealed = state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
  for (const mini of concealed) {
    if (mini.locationId !== inv.location) continue
    moves.push({
      action: 'scenarioAction', rule: `${ACTION_RULES.expose}:${mini.id}`, miniCardId: mini.id, locationId: inv.location,
      label: '揭露一张隐匿迷你卡（Expose）',
      ...(code === RAW_CODES.qaitbayCitadel && chapterState(state).qaitbayLockRound === state.round
        ? { reason: '本轮在奎贝堡的调查失败：不能揭露迷你卡' } : {}),
    })
  }
}

function entryErrorFor(state, location, inv) {
  void inv
  const code = codeOf(location)
  if (!location) return null
  const loci = keyLocusEntities(state).length
  if (code === RAW_CODES.catacombsBloodyNexus && !location.revealed) {
    return '通往地下陵墓的道路尚未打开：当前密谋上有 6 个毁灭标记时才会揭示。'
  }
  if (code === RAW_CODES.bourseCoteriePost && !location.revealed && loci > 1) {
    return '证券交易所重兵把守：只有在它是场上唯一的钥匙节点时才能进入。'
  }
  if (code === RAW_CODES.catacombsDenOfTheBeast && !location.revealed && loci > 1) {
    return '地下陵墓的入口尚未发现：只有在它是场上唯一的钥匙节点时才能进入。'
  }
  return null
}

// ---------------------------------------------------------------------------
// 混乱标记后果
// ---------------------------------------------------------------------------
function cultistHarmOrDoom(state, inv, api) {
  const answer = chooseOption(api, {
    kind: 'choice', source: RAW_CODES.scenario, seat: inv.seat,
    prompt: '检定失败：受到 1 点伤害和 1 点恐惧，或在最近的钥匙节点 / [[节点地]]地点上放 1 个毁灭标记。',
    options: [{ id: 'harm', label: '受到 1 点伤害和 1 点恐惧' },
      { id: 'doom', label: '在最近的钥匙节点或[[节点地]]地点上放置 1 个毁灭标记' }],
  }) || 'harm'
  if (answer === 'doom') {
    const candidates = [...keyLocusEntities(state), ...(state.locations || []).filter(location => hasTrait(location, 'Locus Site'))]
    const target = candidates.find(entry => entry.locationId === inv.location || entry.location === inv.location)
      || candidates[0] || null
    if (target) {
      if (typeof api?.doomOn === 'function') api.doomOn(target, 1)
      else target.doom = (Number(target.doom) || 0) + 1
      api?.info?.(`🌑 [cultist]：在「${target.name || locationName(state, target.location)}」上放置 1 个毁灭标记。`)
      return
    }
  }
  if (typeof api?.harm === 'function') api.harm(inv.seat, { damage: 1, horror: 1 })
  api?.info?.('🌑 [cultist]：受到 1 点伤害和 1 点恐惧。')
}

function loseResourcesPerPoint(state, inv, result, api) {
  const max = DOGS_OF_WAR_TOKEN_MEANINGS.standard.elderthing.max
  const hard = !['easy', 'standard'].includes(String(state?.difficulty || 'standard'))
  const failedBy = Math.max(0, Number(result?.failedBy) || 0)
  const amount = hard || max == null ? failedBy : Math.min(max, failedBy)
  if (!amount) return
  if (typeof api?.loseResources === 'function') api.loseResources(inv.seat, amount)
  else inv.resources = Math.max(0, (Number(inv.resources) || 0) - amount)
  api?.info?.(`💸 [elderthing]：低于难度 ${failedBy} 点，失去 ${amount} 个资源。`)
}

function patrolAttackRider(state, inv, api, context, attackFirst) {
  const enemy = context?.test?.target || null
  if (!enemy || !(state.enemies || []).includes(enemy)) return
  if (attackFirst && typeof api?.attack === 'function') api.attack(enemy, inv)
  if (typeof api?.disengage === 'function') api.disengage(enemy)
  resolvePatrol(state, api, enemy)
  api?.info?.(`🎲 [tablet]：本次攻击后「${enemy.name || '敌人'}」解除交战并结算巡逻。`)
}

// ---------------------------------------------------------------------------
// 只读投影（桌面/测试读得懂的章节摘要）
// ---------------------------------------------------------------------------
export function chapterSummary(state) {
  const data = chapterState(state)
  return {
    version: data.variant,
    branch: data.branch,
    stage: data.variant ? VERSION_SETUPS[data.variant].title : null,
    time: timePassed(state),
    keyResources: keyResourcesOf(state),
    keyFace: keyFaceCode(state),
    keyBearer: keyBearer(state),
    keyControlled: keyControlledByKey(state),
    keyLoci: keyLocusEntities(state).map(entry => ({
      id: entry.id || entry.code, code: codeOf(entry), location: entry.location,
      countsAsLocus: entry.countsAsLocus === true,
    })),
    knightDefeated: data.claretKnightDefeated === true,
    beastDefeated: data.beastDefeated === true,
    pulses: pulsesInPlay(state).map(entry => ({ locationId: entry.location.id, id: entry.attachment.id })),
    miniCards: (state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []).map(card => ({
      id: card.id, kind: card.kind, decoy: card.decoy === true, locationId: card.locationId,
    })),
    currentAct: actCodeOf(state) || null,
    currentAgenda: agendaCodeOf(state) || null,
    entryCodes: [...behavior.implementedEncounterCodes],
    clueValueOfStart: clueValueOf(state, START_LOCATION),
    resolutions: Object.keys(resolutions),
  }
}

const keyControlledByKey = state => keyControlledByInvestigator(state)

export const implementedEncounterCodes = behavior.implementedEncounterCodes
export const entryCodes = () => [...implementedEncounterCodes]
export { ACTS, AGENDAS, GATHER_GROUPS, LOCATIONS, RAW_CODES, VERSION_GATHER_GROUPS }
export default behavior
