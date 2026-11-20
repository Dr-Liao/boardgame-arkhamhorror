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
//   · 任务进度：`campaign.progressTracks`（`src/campaign/progress-tracks.js`，轨道 'tdcTask'
//     与 `src/engine/tdc-interactions.js` 同源；文件末尾 §P7 approximation 已披露领队代选）；
//   · 任务卡：`campaignCardChange`（战役牌组，不占 30 张）；
//   · 经验：`awardExperience`；创伤：`campaign.trauma` + `record.trauma`（与
//     `src/campaign/campaign.js#updateCampaignStatus` 同口径）；
//   · 混乱袋：流程节点用 `{type:'chaos'}` / `{type:'replaceChaosFamily'}` 效果，
//     处理器里用 `changeChaosBag(..., { permanent:true })`。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import {
  awardExperience, campaignCardChange, updateCampaignStatus,
} from '../../../src/campaign/campaign.js'
import { changeChaosBag } from '../../../src/engine/chaos-bag.js'
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

/** 战役创伤（写 `campaign.trauma[seat]` 与 `record.trauma`，随后重算击杀/疯狂状态）。 */
export function addCampaignTrauma (campaign, seat, kind, amount = 1) {
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
// 2. Interlude I：领任务（参考 ForInvestigator (InterludeStep 1)）
// ---------------------------------------------------------------------------
/**
 * 领任务。参考实现按**每位调查员**逐个询问（`investigatorStoryWithChooseOneM'`）。
 * 战役流程图一次只能问领队，因此这里：
 *   · 领队（或第一位未领任务的现役调查员）拿到所选任务；
 *   · 其余现役调查员按 `TDC_TASKS` 的规范顺序**自动补领**尚未被选的任务卡（近似，已披露）。
 * 返回 `{ seat, taskId, autoAssigned }`（无状态可改时返回 null）。
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
  const preferred = Number.isInteger(state?.campaign?.leadSeat) ? state.campaign.leadSeat : active[0].seat
  const target = (!assigned(preferred) ? preferred : null)
    ?? active.find(record => !assigned(record.seat))?.seat
  if (target == null) return null
  claimProgress(campaign, TDC_TASK_TRACK, target, task.id)
  ensureTaskCard(campaign, target, task)
  logLine(log, `📜 调查员 ${target + 1} 领取任务「${task.name}」（${task.card}）。`)

  const autoAssigned = []
  for (const record of activeRecords(campaign)) {
    if (assigned(record.seat)) continue
    const next = TDC_TASKS.find(row => !taken.has(row.id) && row.id !== task.id
      && !activeRecords(campaign).some(other => assigned(other.seat)?.option === row.id))
    if (!next) break
    claimProgress(campaign, TDC_TASK_TRACK, record.seat, next.id)
    ensureTaskCard(campaign, record.seat, next)
    autoAssigned.push({ seat: record.seat, taskId: next.id })
    logLine(log, `📜（近似：领队代选）调查员 ${record.seat + 1} 自动领取任务「${next.name}」。`)
  }
  return { seat: target, taskId: task.id, autoAssigned }
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
//   goodMoney             肉体创伤 1 +（参考：搜收藏找 Injury/Criminal 基础弱点；本层近似不搜）
//   dreamsOfDestruction   精神创伤 1 + 移除 1 枚 elderSign
//   noPlaceLikeHome       二选一创伤（由 flow 的 `nplhTraumaChoice` 节点/处理器结算）
//   doNoHarm              精神创伤 1 + 加入 1 枚 tablet
//   toeTheLine            肉体创伤 1 +（参考：把 2 枚非符号标记各降 2 档；本层近似不替换）
//   proveYourWorth        精神创伤 1
//   plumbTheDepths        精神创伤 1 + 加入 1 枚 skull
// 完成（进度 ≥ 5）：换完成版任务卡 + 写对应 §4 记录；Dreams of Destruction 另加 1 枚 +1 标记。
export const TDC_TASK_FAILURE_EFFECTS = Object.freeze({
  walkInFaith: Object.freeze({ trauma: Object.freeze({ mental: 1 }), records: Object.freeze(['lostTheirFaith']) }),
  goodMoney: Object.freeze({ trauma: Object.freeze({ physical: 1 }), notes: '搜索基础弱点（Injury/Criminal）无引擎原语，近似跳过。' }),
  dreamsOfDestruction: Object.freeze({ trauma: Object.freeze({ mental: 1 }), chaos: Object.freeze([Object.freeze({ token: 'eldersign', amount: -1 })]) }),
  noPlaceLikeHome: Object.freeze({ trauma: null, notes: '二选一创伤由 nplhTraumaChoice 节点结算。' }),
  doNoHarm: Object.freeze({ trauma: Object.freeze({ mental: 1 }), chaos: Object.freeze([Object.freeze({ token: 'tablet', amount: 1 })]) }),
  toeTheLine: Object.freeze({ trauma: Object.freeze({ physical: 1 }), notes: '把 2 枚非符号标记降 2 档无引擎原语，近似跳过。' }),
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
    logLine(log, `💢 调查员 ${record.seat + 1} 未完成任务「${task.name}」（进度 ${value}）：`
      + `${failure?.trauma ? `承受 ${Object.entries(failure.trauma).map(([kind, amount]) => `${amount} 点${{ physical: '肉体', mental: '精神' }[kind]}创伤`).join('、')}` : '见后续选择'}。`)
    if (failure?.notes) logLine(log, `⚠️ ${task.name} 的失败分支近似：${failure.notes}`)
  }
  return { resolved, completed, failed }
}

/** No Place Like Home 失败的二选一创伤（参考 `sufferPhysicalTrauma` / `sufferMentalTrauma`）。 */
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
    case 'claimTask': return claimTask(state, payload.option, log)
    case 'expedition': return runExpedition(state, payload, log)
    case 'awakening': return runAwakening(state, payload, log)
    case 'returnToArkham': return resolveTasks(state, log)
    case 'nplhTrauma': return runNplhTrauma(state, payload, log)
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
    taskChoice: {
      type: 'choice',
      titleKey: 'anOfferYouCantRefuse.chooseTask',
      textKey: 'anOfferYouCantRefuse.chooseTask',
      options: TDC_TASKS.map(task => ({
        id: task.id,
        label: task.name,
        labelKey: task.labelKey,
        effects: [registered('claimTask', { option: task.id })],
        next: 'interludeOneDecision',
      })),
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
    // 参考实现里「没有比家更好的地方」的失败把二选一创伤嵌进同一条任务结算正文；
    // 流程图只能问领队，这里单独给一次选择，处理器只对失败者生效（无失败者时空操作）。
    nplhTraumaChoice: {
      type: 'choice',
      titleKey: 'returnToArkham.tasks.noPlaceLikeHome.title',
      textKeys: [
        'returnToArkham.tasks.noPlaceLikeHome.readOnly',
        'returnToArkham.tasks.noPlaceLikeHome.otherwise',
        'returnToArkham.tasks.noPlaceLikeHome.failed',
      ],
      options: [
        { id: 'physical', label: '承受 1 点肉体创伤', effects: [registered('nplhTrauma', { kind: 'physical' })], next: 'finale' },
        { id: 'mental', label: '承受 1 点精神创伤', effects: [registered('nplhTrauma', { kind: 'mental' })], next: 'finale' },
      ],
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

// P7 approximation 登记（供报告/账本读取，不参与引擎读点）。
export const TDC_INTERLUDE_APPROXIMATIONS = Object.freeze([
  Object.freeze({ id: 'perInvestigatorTaskChoice', detail: '参考实现按调查员逐个询问领任务；流程图只问领队一次，其余调查员按规范顺序自动补领。' }),
  Object.freeze({ id: 'easternChaosSwap', detail: '参考实现东方远征留了「swap a chaos token」TODO（无印刷文面）；本层东线不改混乱袋。' }),
  Object.freeze({ id: 'goodMoneyWeakness', detail: 'Good Money 失败应搜收藏找 Injury/Criminal 基础弱点；无对应战役层原语，近似跳过。' }),
  Object.freeze({ id: 'toeTheLineTokens', detail: 'Toe the Line 失败应把 2 枚非符号标记各降 2 档；无对应原语，近似跳过。' }),
  Object.freeze({ id: 'nplhTraumaChoice', detail: 'No Place Like Home 失败的二选一创伤由单独流程选择节点结算（只影响失败者，无失败者时空操作）。' }),
])
