// 《沉没之城》（The Drowned City）· Interlude I–IV / 终章前叙事与战役层结算（P7）。
//
// 事实源（锁定，只读）：
//   · 参考实现 `Campaigns/TheDrownedCity.hs`：
//       CampaignStep (InterludeStep 1) —— 《无法拒绝的提议》：逐人领任务，随后 accept/refuse；
//       CampaignStep (InterludeStep 2) —— 《拉莱耶远征》：选西线/东线，记录 headedWest/East、
//         发放 Andy / Ruby 剧情资产、西线混乱袋换标记；
//       CampaignStep (InterludeStep 3) —— 《苏醒》：有文物则符号族各换 2 枚，否则 1/1/2；
//       CampaignStep (InterludeStep 4) —— 《重返阿卡姆》：每人按任务进度结算经验与完成/失败分支；
//       CampaignStep Finale —— 《阿卡姆的毁灭》开场；
//   · `Campaigns/TheDrownedCity/Helpers.hs#tasks`（8 条任务的卡号 / 完成记录 / i18n 标签）；
//   · 英文指南 `frontend/src/locales/en/theDrownedCity/interludes.json`（正文键）。
//
// 引擎读点（全部是既有原语，不新增状态字段、不改引擎）：
//   · 逐人选择：flow `choice` 节点 `perInvestigator: true` + `next` + `afterChoiceEffects`；
//     引擎对每个 active 调查员依次 requestChoice（seat=该座位），答案写入
//     `campaign.flow.history.at(-1).choices = { seat: optionId }`，处理器据此落账
//     （参考 CampaignStep (InterludeStep 1) 的 investigatorStoryWithChooseOneM' 与
//     ForInvestigator (InterludeStep 4) 的 No Place Like Home 二选一创伤）；
//   · 任务进度：`campaign.progressTracks`（`src/campaign/progress-tracks.js`，轨道 'tdcTask'
//     与 `src/engine/tdc-interactions.js` 同源）；
//   · 任务卡：`campaignCardChange`（战役牌组，不占 30 张）；
//   · 经验：`awardExperience`；创伤：`campaign.trauma` + `record.trauma`（与
//     `src/campaign/campaign.js#updateCampaignStatus` 同口径）；
//   · 混乱袋：流程节点用 `{type:'chaos'}` / `{type:'replaceChaosFamily'}` 效果；
//     Toe the Line 失败用引擎 P7 新原语 `replaceChaosTokens` + `lowerChaosToken`（非符号标记各降 2 档）；
//   · 基础弱点：`basicWeaknessPool(state)`（引擎引擎态）+ ALL_CARDS traits 过滤 + campaignCardChange。
//     注意：`src/engine/engine.js` **不能在本文件静态 import**（engine.js → content/registered.js →
//     本战役 manifest → 本文件，会形成 TDZ 循环：Cannot access 'campaignFlowExtras' before initialization）。
//     因此用非阻塞 `import()` 预载 + 同口径本地回退（core 基础弱点，排除 Random Basic Weakness）；
//     实际对局进入 Interlude IV 前引擎模块必然已加载，走真实 `basicWeaknessPool(state)`。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import {
  awardExperience, campaignCardChange, updateCampaignStatus,
} from '../../../src/campaign/campaign.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { changeChaosBag, lowerChaosToken, replaceChaosTokens } from '../../../src/engine/chaos-bag.js'
import { randomValue } from '../../../src/engine/rules-state.js'
import { changeProgress, claimProgress, progressFor } from '../../../src/campaign/progress-tracks.js'
import {
  TDC_EXPEDITION_STORY_ASSETS, TDC_TASK_BY_CARD, TDC_TASK_BY_ID, TDC_TASK_COMPLETION_PROGRESS,
  TDC_TASK_TRACK, TDC_TASKS,
} from './records.js'
import {
  TDC_AWAKENING_TOKENS, TDC_EXPEDITION_PREP_STEP, anyRlyehArtifact, notOf,
} from './parts.js'

export const INTERLUDE_HANDLER_ID = 'tdcInterludes'

// ---------------------------------------------------------------------------
// 1. 只读/记账辅助
// ---------------------------------------------------------------------------
const logLine = (log, line) => { if (typeof log === 'function') log(line) }
const activeRecords = campaign => Object.values(campaign?.investigators || {})
  .filter(record => record && record.status === 'active')
  .sort((left, right) => left.seat - right.seat)

/** 追加一条战役记录集合（string[]；已存在则不重复）。 */
export function addRecordValue (campaign, key, value) {
  campaign.records ||= {}
  const list = Array.isArray(campaign.records[key]) ? campaign.records[key] : []
  if (list.includes(value)) return false
  campaign.records[key] = [...list, value]
  return true
}

/** 战役混乱袋变更（带 state.chaosBag 时走引擎原语；纯内容夹具直接改战役袋）。 */
export function changeCampaignTokens (state, token, amount) {
  const campaign = state?.campaign
  if (!campaign) return false
  if (Array.isArray(state?.chaosBag)) {
    changeChaosBag(state, token, amount, { permanent: true })
    return true
  }
  campaign.chaosBag = Array.isArray(campaign.chaosBag) ? [...campaign.chaosBag] : []
  if (amount > 0) {
    for (let index = 0; index < amount; index += 1) campaign.chaosBag.push(token)
    return true
  }
  for (let index = 0; index < -amount; index += 1) {
    const found = campaign.chaosBag.indexOf(token)
    if (found < 0) return false
    campaign.chaosBag.splice(found, 1)
  }
  return true
}

/** 战役创伤（写 `campaign.trauma[seat]` 与 `record.trauma`，随后重算击杀/疯狂状态）。 */export function addCampaignTrauma (campaign, seat, kind, amount = 1) {
  if (!campaign || !Number.isSafeInteger(amount) || amount <= 0) return 0
  if (!['physical', 'mental'].includes(kind)) throw new Error(`未知创伤类型：${String(kind)}`)
  campaign.trauma ||= {}
  campaign.trauma[seat] ||= { physical: 0, mental: 0 }
  campaign.trauma[seat][kind] += amount
  const record = campaign.investigators?.[seat]
  if (record) {
    record.trauma ||= { physical: 0, mental: 0 }
    record.trauma[kind] = (Number(record.trauma[kind]) || 0) + amount
  }
  try {
    updateCampaignStatus(campaign, seat)
  } catch { /* 单测夹具可能没有真实调查员定义：状态在下一关开局重算 */ }
  return amount
}

function taskOfProgress (progress) {
  if (!progress?.option) return null
  return TDC_TASK_BY_ID[progress.option] || TDC_TASK_BY_CARD[progress.option] || null
}

function ensureTaskCard (campaign, seat, task) {
  const record = campaign.investigators?.[seat]
  if (!record) return false
  record.deck ||= []
  if (record.deck.includes(task.card)) return false
  try {
    campaignCardChange(campaign, seat, task.card, 'add', '任务（Task）')
    return true
  } catch (error) {
    logLine(null, `⚠️ 任务卡 ${task.card} 未能加入牌组：${error.message}`)
    return false
  }
}

function removeTaskCard (campaign, seat, task) {
  const record = campaign.investigators?.[seat]
  if (!record?.deck?.includes(task.card)) return false
  try {
    campaignCardChange(campaign, seat, task.card, 'remove', '任务结算')
    return true
  } catch { return false }
}

// ---------------------------------------------------------------------------
// 1b. 引擎基础弱点池（非阻塞预载；见文件头「不能静态 import engine.js」的循环说明）
// ---------------------------------------------------------------------------
const RANDOM_BASIC_WEAKNESS_CODE = '01000'
let basicWeaknessPoolFn = null
let basicWeaknessPoolPromise = null

/**
 * 预载引擎 `basicWeaknessPool`（`src/engine/engine.js`）。返回 Promise<fn|null>。
 * 模块加载时自动触发一次；对局进入 Interlude IV 前必然已解析。测试可 await 后再结算弱点。
 */
export function preloadCampaignPrimitives () {
  basicWeaknessPoolPromise ||= import('../../../src/engine/engine.js')
    .then(module => {
      basicWeaknessPoolFn = typeof module.basicWeaknessPool === 'function' ? module.basicWeaknessPool : null
      return basicWeaknessPoolFn
    })
    .catch(() => null)
  return basicWeaknessPoolPromise
}
void preloadCampaignPrimitives()

/** 与引擎同口径的本地回退池（core 基础弱点，排除 Random Basic Weakness）。 */
function fallbackBasicWeaknessPool () {
  return Object.values(ALL_CARDS)
    .filter(card => card.pack === 'core' && card.subtype === 'basicweakness'
      && card.code !== RANDOM_BASIC_WEAKNESS_CODE)
    .map(card => card.code)
    .sort()
}

function campaignBasicWeaknessPool (state) {
  if (basicWeaknessPoolFn) {
    try { return basicWeaknessPoolFn(state) } catch { /* 落到本地回退 */ }
  }
  return fallbackBasicWeaknessPool()
}

/** 基础弱点去重键：同印刷（duplicateOf）与同名都视为已持有。 */
const canonicalOf = code => ALL_CARDS[code]?.duplicateOfCode || code

/**
 * 按 traits 搜收藏发一张基础弱点（Good Money 失败：Injury/Criminal）。
 * 排除已持有同名/同印刷；多候选按卡号升序取第一张（印刷文面的「搜索收藏」是玩家选择，
 * 本层自动取最低卡号，已在 literal 账本登记为残余近似）。返回加入的卡号或 null。
 */
export function addBasicWeaknessForSeat (state, seat, traits = ['Injury', 'Criminal'], log) {
  const campaign = state?.campaign
  const record = campaign?.investigators?.[seat]
  if (!record) return null
  record.deck ||= []
  const heldCanonical = new Set(record.deck.map(canonicalOf))
  const heldNames = new Set(record.deck.map(code => ALL_CARDS[code]?.name).filter(Boolean))
  const wanted = new Set(traits.map(trait => String(trait).toLowerCase()))
  const candidates = campaignBasicWeaknessPool(state)
    .filter(code => {
      const card = ALL_CARDS[code]
      if (!card) return false
      if (!(card.traits || []).some(trait => wanted.has(String(trait).toLowerCase()))) return false
      if (heldCanonical.has(canonicalOf(code)) || heldNames.has(card.name)) return false
      return true
    })
    .sort()
  if (!candidates.length) {
    logLine(log, `⚠️ 基础弱点池里没有可加入的 ${traits.join('/')} 基础弱点（或该调查员已持有同名/同印刷）。`)
    return null
  }
  const code = candidates[0]
  try {
    campaignCardChange(campaign, seat, code, 'add', '基础弱点（Good Money 失败）')
  } catch (error) {
    logLine(log, `⚠️ 基础弱点 ${code} 未能加入牌组：${error.message}`)
    return null
  }
  logLine(log, `💀 调查员 ${seat + 1} 搜索收藏，将基础弱点「${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}」`
    + `（${code}，${(ALL_CARDS[code].traits || []).filter(trait => wanted.has(String(trait).toLowerCase())).join('/')}）加入牌组。`)
  return code
}

/**
 * The Doom of Arkham Part I 无结局（noResolution）的弱点补入（参考 `searchCollectionForRandomBasicWeakness`：
 * 每位调查员随机搜一张 Injury 或 Madness 基础弱点加入牌组）。
 * 由 `theDoomOfArkhamPartII` 场景节点的进入效果触发（Part I 已经结算、Part II 尚未开局）；
 * 非 noResolution 时不做任何事。多候选人选随机（`randomValue`），同批尽量不重复发给不同调查员。
 */
export function runDoomPartOneWeaknesses (state, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const partOne = [...(campaign.scenarioResults || [])]
    .reverse()
    .find(row => row?.scenarioId === 'theDoomOfArkhamPartI')
  if (partOne?.resolution !== 'noResolution') return { applied: [], skipped: true }
  const wanted = new Set(['injury', 'madness'])
  const pool = campaignBasicWeaknessPool(state)
  const used = new Set()
  const applied = []
  for (const record of activeRecords(campaign)) {
    record.deck ||= []
    const heldCanonical = new Set(record.deck.map(canonicalOf))
    const heldNames = new Set(record.deck.map(code => ALL_CARDS[code]?.name).filter(Boolean))
    const candidates = pool
      .filter(code => {
        const card = ALL_CARDS[code]
        if (!card) return false
        if (!(card.traits || []).some(trait => wanted.has(String(trait).toLowerCase()))) return false
        if (heldCanonical.has(canonicalOf(code)) || heldNames.has(card.name)) return false
        return true
      })
      .sort()
      .filter(code => !used.has(code))
    if (!candidates.length) {
      logLine(log, `⚠️ 调查员 ${record.seat + 1}：基础弱点池里没有可加入的 Injury/Madness 基础弱点。`)
      continue
    }
    const index = Math.min(candidates.length - 1, Math.floor(randomValue(state) * candidates.length))
    const code = candidates[index]
    try {
      campaignCardChange(campaign, record.seat, code, 'add', '基础弱点（阿卡姆的毁灭 I 无结局）')
    } catch (error) {
      logLine(log, `⚠️ 基础弱点 ${code} 未能加入调查员 ${record.seat + 1} 的牌组：${error.message}`)
      continue
    }
    used.add(code)
    applied.push({ seat: record.seat, code })
    logLine(log, `💀 调查员 ${record.seat + 1} 随机搜到基础弱点「${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}」（${code}）。`)
  }
  return { applied }
}

// ---------------------------------------------------------------------------
// 2. Interlude I：领任务（参考 ForInvestigator (InterludeStep 1)）
// ---------------------------------------------------------------------------
/**
 * 单座位领任务（辅助/测试用）：把 `taskId` 交给领队（若领队还没领）或第一位还没领任务的
 * 现役调查员，任务卡进其战役牌组。返回 `{ seat, taskId }`（无状态可改/任务已被领时返回 null）。
 * 正常流程走 `claimTasksFromChoices`（逐人选择节点落账）。
 */
export function claimTask (state, taskId, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const task = TDC_TASK_BY_ID[taskId]
  if (!task) throw new Error(`未知任务：${String(taskId)}`)
  const active = activeRecords(campaign)
  if (!active.length) return null
  const assigned = seat => progressFor(campaign, TDC_TASK_TRACK, seat)
  const taken = new Set(active.map(record => assigned(record.seat)?.option).filter(Boolean))
  if (taken.has(task.id)) {
    logLine(log, `⚠️ 任务「${task.name}」已被其他调查员领取，忽略本次选择。`)
    return null
  }
  const preferred = Number.isInteger(campaign.leadSeat) ? campaign.leadSeat : active[0].seat
  const target = (!assigned(preferred) ? preferred : null)
    ?? active.find(record => !assigned(record.seat))?.seat
  if (target == null) return null
  claimProgress(campaign, TDC_TASK_TRACK, target, task.id)
  ensureTaskCard(campaign, target, task)
  logLine(log, `📜 调查员 ${target + 1} 领取任务「${task.name}」（${task.card}）。`)
  return { seat: target, taskId: task.id }
}

/**
 * 逐人领任务（perInvestigator `choice` 节点的 afterChoiceEffects 处理器）。
 * 读 `campaign.flow.history.at(-1).choices = { seat: taskId }`，按座位升序落账：
 *   · 选项按座位独立询问（引擎 `perInvestigator`），同一任务不能被两名调查员重复领取；
 *   · 若两名调查员选了同一任务（选项集未按座位过滤），后一位按 TDC_TASKS 规范顺序
 *     回退到尚未被领取的任务（内容层去重；此回退已登记为残余近似）。
 */
export function claimTasksFromChoices (state, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const visit = campaign.flow?.history?.at?.(-1) || null
  const choices = visit?.choices || {}
  const assigned = seat => progressFor(campaign, TDC_TASK_TRACK, seat)
  const taken = new Set(activeRecords(campaign)
    .map(record => assigned(record.seat)?.option).filter(Boolean))
  const assignedRows = []
  const fallbacks = []
  for (const record of activeRecords(campaign)) {
    if (assigned(record.seat)) continue
    const wanted = TDC_TASK_BY_ID[choices[record.seat]]
    let task = wanted && !taken.has(wanted.id) ? wanted : null
    if (!task) {
      task = TDC_TASKS.find(row => !taken.has(row.id)) || null
      if (wanted && task) fallbacks.push({ seat: record.seat, wanted: wanted.id, assigned: task.id })
    }
    if (!task) {
      logLine(log, `⚠️ 调查员 ${record.seat + 1} 没有可领的任务（8 条任务已被领完）。`)
      continue
    }
    claimProgress(campaign, TDC_TASK_TRACK, record.seat, task.id)
    ensureTaskCard(campaign, record.seat, task)
    taken.add(task.id)
    assignedRows.push({ seat: record.seat, taskId: task.id })
    logLine(log, `📜 调查员 ${record.seat + 1} 领取任务「${task.name}」（${task.card}）。`)
  }
  if (fallbacks.length) {
    logLine(log, `⚠️ 重复选择按规范顺序回退（内容层去重）：`
      + fallbacks.map(row => `调查员 ${row.seat + 1} ${row.wanted}→${row.assigned}`).join('、') + '。')
  }
  return { assigned: assignedRows, fallbacks }
}

// ---------------------------------------------------------------------------
// 3. Interlude II：远征方向（参考 CampaignStep (InterludeStep 2)）
// ---------------------------------------------------------------------------
// 西线：Andy Van Nortwick + 混乱袋移除 1 tablet / 加入 1 cultist；
// 东线：Ruby Standish（参考实现还留了一个 "swap a chaos token" 的 TODO，印刷文面未给具体标记，
// 本层东线不换标记——已披露为近似）。
export const TDC_EXPEDITION_CHOICES = Object.freeze({
  west: Object.freeze({
    id: 'west',
    recordKey: 'theExpeditionHeadedWest',
    storyAsset: TDC_EXPEDITION_STORY_ASSETS.andyVanNortwick,
    storyAssetName: '安迪·范·诺特维克',
    labelKey: 'expeditionToRlyeh.label.west',
    label: '向西：西墙（The Western Wall）',
    chaos: Object.freeze([Object.freeze({ token: 'tablet', amount: -1 }), Object.freeze({ token: 'cultist', amount: 1 })]),
    next: 'theWesternWall',
  }),
  east: Object.freeze({
    id: 'east',
    recordKey: 'theExpeditionHeadedEast',
    storyAsset: TDC_EXPEDITION_STORY_ASSETS.rubyStandish,
    storyAssetName: '露比·斯坦迪什',
    labelKey: 'expeditionToRlyeh.label.east',
    label: '向东：黑曜石峡谷（Obsidian Canyons）',
    chaos: Object.freeze([]),
    next: 'obsidianCanyons',
  }),
})

/** 远征方向记账：发放剧情资产到领队牌组（参考 `addCampaignCardToDeckChoice_`）。 */
export function runExpedition (state, payload = {}, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const side = payload.side === 'east' ? 'east' : 'west'
  const choice = TDC_EXPEDITION_CHOICES[side]
  const seat = Number.isInteger(campaign.leadSeat) ? campaign.leadSeat : 0
  let added = false
  try {
    const record = campaign.investigators?.[seat]
    if (record && !record.deck?.includes(choice.storyAsset)) {
      campaignCardChange(campaign, seat, choice.storyAsset, 'add', '远征剧情资产')
      added = true
    }
  } catch (error) {
    logLine(log, `⚠️ 远征剧情资产未能加入牌组：${error.message}`)
  }
  logLine(log, `🧭 远征方向：${side === 'west' ? '西线' : '东线'}——剧情资产「${choice.storyAssetName}」`
    + `${added ? `加入调查员 ${seat + 1} 的牌组` : '已在牌组中'}。`)
  return { side, storyAsset: choice.storyAsset, added }
}

// ---------------------------------------------------------------------------
// 4. Interlude III：苏醒（参考 CampaignStep (InterludeStep 3)）
// ---------------------------------------------------------------------------
// 混乱袋替换由流程节点的 `{type:'replaceChaosFamily'}` 效果完成（引擎 `campaign-effects.js` 读点：
// 移除全部 cultist/tablet/elderthing 后写入 tokens）；这里只做叙事与派生记录/日志。
export function runAwakening (state, payload = {}, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const records = campaign.records || (campaign.records = {})
  const withArtifact = Object.keys(records).some(key =>
    ['barrierNode', 'obsidianClaw', 'shardOfYchlecht', 'tidalTablet', 'grislyMask'].includes(key)
    && records[key] === true)
  if (payload.replaceChaos === false) return { withArtifact, replaced: false }
  logLine(log, withArtifact
    ? '🎲 苏醒：移除全部邪教徒/石板/旧日标记，各加入 2 枚。'
    : '🎲 苏醒：移除全部邪教徒/石板/旧日标记，加入 1 邪教徒 / 1 石板 / 2 旧日。')
  return { withArtifact, replaced: true }
}

// ---------------------------------------------------------------------------
// 5. Interlude IV：任务结算（参考 ForInvestigator (InterludeStep 4)）
// ---------------------------------------------------------------------------
// 每条任务的失败分支（参考 TheDrownedCity.hs#ForInvestigator InterludeStep 4 的 case）：
//   walkInFaith           精神创伤 1 + 记录 lostTheirFaith
//   goodMoney             肉体创伤 1 + 搜收藏加 1 张 Injury/Criminal 基础弱点
//                         （`addBasicWeaknessForSeat`；多候选自动取最低卡号 = 残余近似）
//   dreamsOfDestruction   精神创伤 1 + 移除 1 枚 elderSign
//   noPlaceLikeHome       二选一创伤（由 flow 的 `nplhTraumaChoice` 逐人选择节点结算）
//   doNoHarm              精神创伤 1 + 加入 1 枚 tablet
//   toeTheLine            肉体创伤 1 + 混乱袋 2 枚非符号标记各降 2 档
//                         （引擎原语 `replaceChaosTokens` + `lowerChaosToken`）
//   proveYourWorth        精神创伤 1
//   plumbTheDepths        精神创伤 1 + 加入 1 枚 skull
// 完成（进度 ≥ 5）：换完成版任务卡 + 写对应 §4 记录；Dreams of Destruction 另加 1 枚 +1 标记。
export const TDC_TASK_FAILURE_EFFECTS = Object.freeze({
  walkInFaith: Object.freeze({ trauma: Object.freeze({ mental: 1 }), records: Object.freeze(['lostTheirFaith']) }),
  goodMoney: Object.freeze({ trauma: Object.freeze({ physical: 1 }), basicWeaknessTraits: Object.freeze(['Injury', 'Criminal']) }),
  dreamsOfDestruction: Object.freeze({ trauma: Object.freeze({ mental: 1 }), chaos: Object.freeze([Object.freeze({ token: 'eldersign', amount: -1 })]) }),
  noPlaceLikeHome: Object.freeze({ trauma: null, note: '二选一创伤由 nplhTraumaChoice 逐人选择节点结算。' }),
  doNoHarm: Object.freeze({ trauma: Object.freeze({ mental: 1 }), chaos: Object.freeze([Object.freeze({ token: 'tablet', amount: 1 })]) }),
  toeTheLine: Object.freeze({ trauma: Object.freeze({ physical: 1 }), lowerChaosTokens: Object.freeze({ count: 2, by: 2 }) }),
  proveYourWorth: Object.freeze({ trauma: Object.freeze({ mental: 1 }) }),
  plumbTheDepths: Object.freeze({ trauma: Object.freeze({ mental: 1 }), chaos: Object.freeze([Object.freeze({ token: 'skull', amount: 1 })]) }),
})

/**
 * 任务结算（每位现役调查员一次；幂等性交给引擎的关间流程——只在 Interlude IV 节点进入一次）。
 * 返回 `{ resolved: [...], completed: [...], failed: [...] }`。
 */
export function resolveTasks (state, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const records = campaign.records || (campaign.records = {})
  const resolved = []
  const completed = []
  const failed = []
  for (const record of activeRecords(campaign)) {
    const progress = progressFor(campaign, TDC_TASK_TRACK, record.seat)
    const task = taskOfProgress(progress)
    if (!task) continue
    const value = Number(progress.value) || 0
    if (value > 0) {
      awardExperience(campaign, record.seat, value)
      logLine(log, `✨ 调查员 ${record.seat + 1} 的任务进度 ${value}：获得 ${value} 点经验。`)
    }
    removeTaskCard(campaign, record.seat, task)
    if (value >= TDC_TASK_COMPLETION_PROGRESS) {
      try { campaignCardChange(campaign, record.seat, task.completedCard, 'add', '任务完成') } catch { /* 已有完成面 */ }
      records[task.completedRecord] = true
      if (task.id === 'dreamsOfDestruction') changeCampaignTokens(state, '+1', 1)
      completed.push({ seat: record.seat, taskId: task.id, value })
      logLine(log, `🏅 调查员 ${record.seat + 1} 完成任务「${task.name}」：换成完成版 ${task.completedCard}，`
        + `记录 ${task.completedRecord}。`)
      continue
    }
    failed.push({ seat: record.seat, taskId: task.id, value })
    const failure = TDC_TASK_FAILURE_EFFECTS[task.id]
    if (failure?.trauma) {
      for (const [kind, amount] of Object.entries(failure.trauma)) addCampaignTrauma(campaign, record.seat, kind, amount)
    }
    for (const key of failure?.records || []) records[key] = true
    for (const change of failure?.chaos || []) changeCampaignTokens(state, change.token, change.amount)
    // Good Money 失败：搜索收藏加 1 张 Injury/Criminal 基础弱点。
    if (failure?.basicWeaknessTraits) addBasicWeaknessForSeat(state, record.seat, failure.basicWeaknessTraits, log)
    // Toe the Line 失败：抽 2 枚非符号混乱标记，各降 2 档（引擎 P7 原语；-7/-8 与符号不变）。
    if (failure?.lowerChaosTokens) {
      const { count, by } = failure.lowerChaosTokens
      const replaced = replaceChaosTokens(state, count, token => lowerChaosToken(token, by), { permanent: true })
      logLine(log, `🎲 混乱袋降档：${replaced} 枚非符号标记各降低 ${by} 档（Toe the Line 失败）。`)
    }
    logLine(log, `💢 调查员 ${record.seat + 1} 未完成任务「${task.name}」（进度 ${value}）：`
      + `${failure?.trauma ? `承受 ${Object.entries(failure.trauma).map(([kind, amount]) => `${amount} 点${{ physical: '肉体', mental: '精神' }[kind]}创伤`).join('、')}` : '见后续选择'}。`)
    if (failure?.note) logLine(log, `⚠️ ${task.name} 的失败分支：${failure.note}`)
  }
  return { resolved, completed, failed }
}

/**
 * No Place Like Home 失败的二选一创伤（辅助/测试用：对**所有**失败的 NPLH 调查员施加同一 kind）。
 * 正常流程走 `runNplhTraumaChoices`（逐人选择节点落账）。
 */
export function runNplhTrauma (state, payload = {}, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const kind = payload.kind === 'physical' ? 'physical' : 'mental'
  const affected = []
  for (const record of activeRecords(campaign)) {
    const progress = progressFor(campaign, TDC_TASK_TRACK, record.seat)
    const task = taskOfProgress(progress)
    if (task?.id !== 'noPlaceLikeHome') continue
    if ((Number(progress.value) || 0) >= TDC_TASK_COMPLETION_PROGRESS) continue
    addCampaignTrauma(campaign, record.seat, kind, 1)
    affected.push(record.seat)
  }
  logLine(log, affected.length
    ? `💢 「没有比家更好的地方」失败：调查员 ${affected.map(seat => seat + 1).join('、')} 各承受 1 点`
      + `${kind === 'physical' ? '肉体' : '精神'}创伤。`
    : '💢 「没有比家更好的地方」失败创伤：没有满足条件的调查员（无效果）。')
  return { kind, affected }
}

/**
 * 逐人二选一创伤（perInvestigator `choice` 节点的 afterChoiceEffects 处理器）。
 * 读 `campaign.flow.history.at(-1).choices = { seat: 'physical' | 'mental' }`，只对
 * 「No Place Like Home 未完成」的调查员结算其本人所选创伤（参考 `sufferPhysicalTrauma` /
 * `sufferMentalTrauma`）。通过/未领取该任务的调查员的答案被忽略。
 */
export function runNplhTraumaChoices (state, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const choices = campaign.flow?.history?.at?.(-1)?.choices || {}
  const applied = []
  for (const record of activeRecords(campaign)) {
    const progress = progressFor(campaign, TDC_TASK_TRACK, record.seat)
    const task = taskOfProgress(progress)
    if (task?.id !== 'noPlaceLikeHome') continue
    if ((Number(progress.value) || 0) >= TDC_TASK_COMPLETION_PROGRESS) continue
    const kind = choices[record.seat] === 'physical' ? 'physical' : 'mental'
    addCampaignTrauma(campaign, record.seat, kind, 1)
    applied.push({ seat: record.seat, kind })
    logLine(log, `💢 调查员 ${record.seat + 1} 的「没有比家更好的地方」失败：承受 1 点`
      + `${kind === 'physical' ? '肉体' : '精神'}创伤（本人选择）。`)
  }
  if (!applied.length) logLine(log, '💢 「没有比家更好的地方」失败创伤：没有满足条件的调查员（无效果）。')
  return { applied }
}

// ---------------------------------------------------------------------------
// 6. Sepulchre 第三步：know better（参考 CampaignStep (InterludeStep 3)）
// ---------------------------------------------------------------------------
/** 每名调查员的任务进度 +1，并记录「调查员没有直面梦魇」。 */
export function runSepulchreKnowBetter (state, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const records = campaign.records || (campaign.records = {})
  const advanced = []
  for (const record of activeRecords(campaign)) {
    const progress = progressFor(campaign, TDC_TASK_TRACK, record.seat)
    if (!progress) continue
    const next = changeProgressReceipt(campaign, record.seat, 1, 'sepulchreKnowBetter')
    advanced.push({ seat: record.seat, value: next })
  }
  records.theInvestigatorsDidNotConfrontTheNightmare = true
  logLine(log, `🌑 调查员选择「更清楚地知道」：${advanced.length} 名调查员的任务进度 +1；`
    + '记录 theInvestigatorsDidNotConfrontTheNightmare。')
  return { advanced }
}

function changeProgressReceipt (campaign, seat, amount, receipt) {
  // 复用引擎进度原语（同一回执幂等，支持结算重试）。
  return changeProgress(campaign, TDC_TASK_TRACK, seat, amount, receipt)
}

// ---------------------------------------------------------------------------
// 7. 效果分派
// ---------------------------------------------------------------------------
export function runInterludeEffect (state, effect, log) {
  const payload = effect.payload || {}
  switch (effect.event) {
    // 逐人选择节点（perInvestigator: true）的 afterChoiceEffects：从 history.choices 落账。
    case 'claimTasks': return claimTasksFromChoices(state, log)
    case 'nplhTraumaChoices': return runNplhTraumaChoices(state, log)
    // 单座位辅助（旧事件保留给夹具/直接调用；正常流程不走这里）。
    case 'claimTask': return claimTask(state, payload.option, log)
    case 'nplhTrauma': return runNplhTrauma(state, payload, log)
    case 'expedition': return runExpedition(state, payload, log)
    case 'awakening': return runAwakening(state, payload, log)
    case 'returnToArkham': return resolveTasks(state, log)
    case 'doomWeaknesses': return runDoomPartOneWeaknesses(state, log)
    case 'sepulchreKnowBetter': return runSepulchreKnowBetter(state, log)
    case 'layItToRest': {
      logLine(log, '🌑 调查员选择「让它安息」：进入《沉睡者墓穴》。')
      return { next: 'sepulchreOfTheSleeper' }
    }
    case 'routeShortcut': {
      logLine(log, `🗺️ 跳章：${payload.from || '?'} → ${payload.to || '?'}（结局分支直跳）。`)
      return { from: payload.from || null, to: payload.to || null }
    }
    case 'addZeroToken': {
      logLine(log, '🎲 Sepulchre 门槛未满足：混乱袋永久加入 1 个 0 标记，跳过《沉睡者墓穴》。')
      return { added: '0' }
    }
    default: throw new Error(`未知幕间/战役效果：${String(effect.event)}`)
  }
}

registerCampaignEffectHandler(INTERLUDE_HANDLER_ID, runInterludeEffect)

// ---------------------------------------------------------------------------
// 8. 幕间节点表（Interlude I–IV + Finale；流程由 flow.js 组装）
// ---------------------------------------------------------------------------
const registered = (event, payload) => ({
  type: 'registered', handler: INTERLUDE_HANDLER_ID, event, ...(payload ? { payload } : {}),
})

function interludeNode (id, spec) {
  return {
    type: spec.type || 'interlude',
    titleKey: spec.titleKey,
    textKey: spec.textKey,
    textKeys: spec.textKeys ? [...spec.textKeys] : undefined,
    effects: spec.effects ? [...spec.effects] : undefined,
    next: spec.next,
    ...(spec.upgrades === false ? { upgrades: false } : {}),
    ...(spec.options ? { options: spec.options } : {}),
    ...(spec.rules ? { rules: spec.rules } : {}),
  }
}

export function interludeNodes () {
  return {
    // Interlude I：《无法拒绝的提议》——逐人领任务。
    interludeOne: interludeNode('interludeOne', {
      titleKey: 'anOfferYouCantRefuse.title',
      textKeys: ['anOfferYouCantRefuse.interlude1', 'anOfferYouCantRefuse.interlude1Continued'],
      next: 'taskChoice',
    }),
    // Interlude I 第 2 步：每位调查员各选 1 条任务（引擎 `perInvestigator` 节点：逐个 requestChoice，
    // 答案写 history.choices；选项不需要 next，节点只有一个出口 → interludeOneDecision）。
    taskChoice: {
      type: 'choice',
      perInvestigator: true,
      titleKey: 'anOfferYouCantRefuse.chooseTask',
      textKey: 'anOfferYouCantRefuse.chooseTask',
      options: TDC_TASKS.map(task => ({
        id: task.id,
        label: task.name,
        labelKey: task.labelKey,
      })),
      afterChoiceEffects: [registered('claimTasks')],
      next: 'interludeOneDecision',
    },
    interludeOneDecision: {
      type: 'choice',
      titleKey: 'anOfferYouCantRefuse.title',
      textKey: 'anOfferYouCantRefuse.interlude2',
      options: [
        {
          id: 'accept',
          label: '接受提议',
          labelKey: 'anOfferYouCantRefuse.label.accept',
          next: 'anOfferAccepted',
        },
        {
          id: 'refuse',
          label: '拒绝提议',
          labelKey: 'anOfferYouCantRefuse.label.refuse',
          next: 'anOfferRefused',
        },
      ],
    },
    anOfferAccepted: interludeNode('anOfferAccepted', {
      type: 'interlude',
      upgrades: false,
      titleKey: 'anOfferYouCantRefuse.title',
      textKey: 'anOfferYouCantRefuse.interlude4',
      next: 'expeditionChoice',
    }),
    anOfferRefused: interludeNode('anOfferRefused', {
      type: 'interlude',
      upgrades: false,
      titleKey: 'anOfferYouCantRefuse.title',
      textKey: 'anOfferYouCantRefuse.interlude3',
      next: 'campaignLostEnd',
    }),

    // Interlude II：《拉莱耶远征》——西线 / 东线。
    expeditionChoice: {
      type: 'choice',
      titleKey: 'expeditionToRlyeh.title',
      textKey: 'expeditionToRlyeh.body',
      options: ['west', 'east'].map(side => {
        const choice = TDC_EXPEDITION_CHOICES[side]
        return {
          id: side,
          label: choice.label,
          labelKey: choice.labelKey,
          effects: [
            { type: 'record', key: choice.recordKey, value: true },
            ...choice.chaos.map(change => ({ type: 'chaos', token: change.token, amount: change.amount })),
            registered('expedition', { side }),
          ],
          next: choice.next,
        }
      }),
    },

    // Interlude III：《苏醒》——符号族混乱标记替换。
    theAwakening: interludeNode('theAwakening', {
      titleKey: 'theAwakening.title',
      textKeys: ['theAwakening.awakening1', 'theAwakening.checkCampaignLog'],
      next: 'theAwakeningBranch',
    }),
    theAwakeningBranch: {
      type: 'stepReturn',
      titleKey: 'theAwakening.title',
      rules: [
        { id: 'withArtifact', when: anyRlyehArtifact(), next: 'theAwakeningArtifact' },
        { id: 'withoutArtifact', when: notOf(anyRlyehArtifact()), next: 'theAwakeningNoArtifact' },
      ],
      next: 'theAwakeningNoArtifact',
    },
    theAwakeningArtifact: interludeNode('theAwakeningArtifact', {
      type: 'interlude',
      upgrades: false,
      titleKey: 'theAwakening.title',
      textKeys: ['theAwakening.awakening2', 'theAwakening.replaceChaosTokensWithTwo'],
      effects: [
        { type: 'replaceChaosFamily', tokens: [...TDC_AWAKENING_TOKENS.withArtifact] },
        registered('awakening', { withArtifact: true }),
      ],
      next: 'theAwakeningConclusion',
    }),
    theAwakeningNoArtifact: interludeNode('theAwakeningNoArtifact', {
      type: 'interlude',
      upgrades: false,
      titleKey: 'theAwakening.title',
      textKeys: ['theAwakening.awakening3', 'theAwakening.replaceChaosTokens'],
      effects: [
        { type: 'replaceChaosFamily', tokens: [...TDC_AWAKENING_TOKENS.withoutArtifact] },
        registered('awakening', { withArtifact: false }),
      ],
      next: 'theAwakeningConclusion',
    }),
    theAwakeningConclusion: interludeNode('theAwakeningConclusion', {
      titleKey: 'theAwakening.title',
      textKeys: ['theAwakening.awakening4', 'theAwakening.proceedToReturnToArkham'],
      next: 'returnToArkhamBranch',
    }),

    // Interlude IV：《重返阿卡姆》——任务结算。
    returnToArkhamBranch: {
      type: 'stepReturn',
      titleKey: 'returnToArkham.title',
      rules: [
        { id: 'withArtifact', when: anyRlyehArtifact(), next: 'returnToArkhamWithArtifact' },
        { id: 'withoutArtifact', when: notOf(anyRlyehArtifact()), next: 'returnToArkhamWithoutArtifact' },
      ],
      next: 'returnToArkhamWithoutArtifact',
    },
    returnToArkhamWithArtifact: interludeNode('returnToArkhamWithArtifact', {
      titleKey: 'returnToArkham.title',
      textKeys: ['returnToArkham.checkCampaignLog', 'returnToArkham.proceedToReturnToArkham1', 'returnToArkham.returnToArkham1'],
      effects: [registered('returnToArkham')],
      next: 'nplhTraumaChoice',
    }),
    returnToArkhamWithoutArtifact: interludeNode('returnToArkhamWithoutArtifact', {
      titleKey: 'returnToArkham.title',
      textKeys: ['returnToArkham.checkCampaignLog', 'returnToArkham.skipToReturnToArkham2', 'returnToArkham.returnToArkham2'],
      effects: [registered('returnToArkham')],
      next: 'nplhTraumaChoice',
    }),
    // 参考实现里「没有比家更好的地方」的失败把二选一创伤嵌进该调查员的任务结算正文；
    // 这里用 `perInvestigator` 节点逐人询问（答案写 history.choices），处理器只对
    // 「NPLH 未完成」的失败者结算其本人所选创伤（未失败的答案被忽略）。
    nplhTraumaChoice: {
      type: 'choice',
      perInvestigator: true,
      titleKey: 'returnToArkham.tasks.noPlaceLikeHome.title',
      textKeys: [
        'returnToArkham.tasks.noPlaceLikeHome.readOnly',
        'returnToArkham.tasks.noPlaceLikeHome.otherwise',
        'returnToArkham.tasks.noPlaceLikeHome.failed',
      ],
      options: [
        { id: 'physical', label: '承受 1 点肉体创伤' },
        { id: 'mental', label: '承受 1 点精神创伤' },
      ],
      afterChoiceEffects: [registered('nplhTraumaChoices')],
      next: 'finale',
    },

    // Finale：《阿卡姆的毁灭》开场（参考 CampaignStep Finale → nextStep TheDoomOfArkhamPartI）。
    finale: interludeNode('finale', {
      upgrades: false,
      titleKey: 'finale.title',
      textKey: 'finale.body',
      next: 'theDoomOfArkhamPartI',
    }),

    // 每关之后的整备停点（引擎唯一的购牌窗读点：`interlude` + upgrades）。
    [TDC_EXPEDITION_PREP_STEP]: {
      type: 'interlude',
      title: '远征整备（关卡间）',
      next: 'routeRouter',
    },
  }
}

// 只读：任务结算前各调查员的进度快照（大厅/测试共用；不写状态）。
export function taskProgressSnapshot (state) {
  const campaign = state?.campaign
  if (!campaign) return []
  return activeRecords(campaign).map(record => {
    const progress = progressFor(campaign, TDC_TASK_TRACK, record.seat)
    const task = taskOfProgress(progress)
    return {
      seat: record.seat,
      name: record.name,
      taskId: task?.id || null,
      task: task ? { name: task.name, card: task.card, completedCard: task.completedCard } : null,
      value: Number(progress?.value) || 0,
      completed: (Number(progress?.value) || 0) >= TDC_TASK_COMPLETION_PROGRESS,
    }
  })
}

// P7 残余近似登记（供报告/账本读取，不参与引擎读点）。第二轮已接线的项不再登记。
export const TDC_INTERLUDE_APPROXIMATIONS = Object.freeze([
  Object.freeze({ id: 'perInvestigatorTaskChoice', detail: '逐人领任务已用 perInvestigator 节点接线；引擎按同一选项集询问每位调查员（选项不按座位过滤），若两人选同一任务，后一位按 TDC_TASKS 规范顺序回退到未领取任务（内容层去重）。' }),
  Object.freeze({ id: 'easternChaosSwap', detail: '参考实现东方远征留了「swap a chaos token」TODO（无印刷文面）；本层东线不改混乱袋。' }),
  Object.freeze({ id: 'nplhTraumaChoice', detail: 'No Place Like Home 二选一创伤已用 perInvestigator 节点逐人接线；引擎会对全部 active 调查员询问该项（未领取/已完成 NPLH 者的答案被忽略），与印刷「只问失败者」略有差异。' }),
  Object.freeze({ id: 'goodMoneyWeaknessPool', detail: 'Good Money 失败搜收藏已接线（basicWeaknessPool + Injury/Criminal traits）；多候选时按卡号升序自动取第一张，替代印刷的玩家选择。' }),
])
