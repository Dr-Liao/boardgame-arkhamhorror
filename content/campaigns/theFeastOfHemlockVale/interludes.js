// 《铁杉谷盛宴》（The Feast of Hemlock Vale）· 4 段序曲整备 / 2 段纯叙事夜 / 夜探分支 /
// 白日整备与线索保留 / 跳过勘察的调度重抽 / 居民访问与法典触发（P7）。
//
// 事实源（锁定，只读）：
//   · 参考实现 `Campaigns/TheFeastOfHemlockVale.hs` 的
//       `CampaignSpecificStep "preludeTheFirstEvening"`（用餐选择、法典六选一、`resolution1` 的
//       `searchForBertie`/`gatherMoreInformation` 分支、`addChaosToken`）；
//       `CampaignSpecificStep "preludeTheSecondEvening"`（Simeon 存亡、六段 resolution、
//       八名居民 + alone + omega + theta 的法典选择、`followDrMarquez`/`gatherMoreInformation`）；
//   · `Campaigns/TheFeastOfHemlockVale/Helpers.hs#makePreparationsForNextSurvey`（保留 1 张非起始支援、
//     弃到开手牌数、资源回落到起始值、弃牌堆洗回）与 `#getAreasSurveyed`（未勘察区域过滤）；
//   · 四段可游玩序曲的 `EndOfScenario` 分支（`afterPrelude` / `campaignStepEdit_ … noUpgrade`）；
//   · 英文指南 `base.json`：`prelude1`–`prelude4`（四段序曲）、`prelude.theFirstEvening` /
//     `prelude.theSecondEvening`（两段纯叙事夜）、`label.chooseAssetToKeepForNextSurvey`、
//     `key.[areasSurveyed]`、`fatigue`。
//
// 引擎读点（全部是既有原语，不新增状态字段、不改引擎）：
//   · 整备：`src/engine/survey-preparation.js#prepareSurvey` 由引擎在关卡结算时执行（关卡声明
//     `scenario.mechanics.survey`），整备包裹写在 `campaign.surveyPreparation`（含 `destinations`/
//     `seats[].hand|assets|resources|clues`）。本文件只做「选择下一场勘察关卡」的记账
//     （`chooseSurveyDestination`）与战役记录同步；
//   · 线索保留：线索随整备包裹跨关（`restoreSurveyInvestigator` 在下一关开局写回），战役层只做记录；
//   · 法典：`src/engine/scenario-calendar.js#canResolveCodex/resolveCodex`（章节 definition 的
//     `mechanics.codex` + `mechanics.residents`），两段纯叙事夜的选择由本文件按记录结算；
//   · 混乱袋：`{type:'chaos'}` 效果 → `changeChaosBag(..., { permanent: true })`（flow.js 声明）。
//
// P7 approximation（逐条披露，见文件末 §5）：
//   1. 参考实现按**每位调查员**逐个询问法典选择；战役流程图只能给领队一张清单 → 一晚一次选择；
//   2. 「跳过本次勘察」是战役层新增的调度重抽（参考实现没有该选项）；
//   3. 疲劳（`fatigue`）只登记数据与读点，实际替换由后续原语完成（`replaceFatigueChaosTokens` 无引擎实现）。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { awardExperience, campaignCardChange } from '../../../src/campaign/campaign.js'
import { chooseSurveyDestination } from '../../../src/engine/survey-preparation.js'
import {
  FHV_HEIRLOOM_CODES, FHV_RESIDENTS, FHV_RESIDENT_BY_ID, residentLevel,
} from './records.js'
import {
  FHV_HANDLE_TIME, FHV_SLOT_DATE, areaOfScenario, campaignStoryHeading, campaignStoryText, fhvNextStep, fhvSlot,
  fhvSurveyCandidates, scenarioOfArea,
} from './parts.js'

export const INTERLUDE_HANDLER_ID = 'fhvInterludes'

// 白日活动的遭遇组（参考 `setupHemlockDay`：Day1 = The First Day / DayOfRest，Day2 = The Second Day /
// DayOfRain，Day3 = The Final Day / DayOfTheFeast）。战役层只用它做「白日活动」身份与展示。
export const FHV_DAY_ACTIVITIES = Object.freeze({
  day1: Object.freeze({
    id: 'day_of_rest', encounterCode: 'day_of_rest', preludeStep: 'welcomeToHemlockVale',
    titleKey: 'prelude1.setup.gatherSets', chapter: 'welcomeToHemlockVale',
  }),
  day2: Object.freeze({
    id: 'day_of_rain', encounterCode: 'day_of_rain', preludeStep: 'dawnOfTheSecondDay',
    titleKey: 'prelude2.setup.gatherSets', chapter: 'dawnOfTheSecondDay',
  }),
  day3: Object.freeze({
    id: 'day_of_the_feast', encounterCode: 'day_of_the_feast', preludeStep: 'dawnOfTheFinalDay',
    titleKey: 'prelude3.setup.gatherSets', chapter: 'dawnOfTheFinalDay',
  }),
})
export const FHV_DAY_ACTIVITY_IDS = Object.freeze(Object.values(FHV_DAY_ACTIVITIES).map(row => row.id))

// 居民访问 / 法典触发的展示标题键（两段纯叙事夜选择清单的上位标题）。
export const FHV_EVENING_CODEX_TITLES = Object.freeze({
  preludeTheFirstEvening: 'prelude.theFirstEvening.codexChoice',
  preludeTheSecondEvening: 'prelude.theSecondEvening.codexChoice',
})

// ---------------------------------------------------------------------------
// 1. 通用辅助
// ---------------------------------------------------------------------------
const logLine = (log, line) => { if (typeof log === 'function') log(line) }

const recordsOf = state => state?.campaign?.records || null

function appendStory (state, line) {
  if (!line) return
  const visit = state?.campaign?.flow?.history?.at?.(-1)
  if (visit) visit.storyText = [visit.storyText, line].filter(Boolean).join('\n\n')
}

function activeRecords (state) {
  return Object.values(state?.campaign?.investigators || {})
    .filter(record => record && record.status === 'active')
}

/** 参考 `interludeXpAll`：每名现役调查员 +n（引擎 `awardExperience` 累加未花费经验）。 */
export function awardPreludeXp (state, amount, log) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return 0
  let awarded = 0
  for (const record of activeRecords(state)) {
    awardExperience(state.campaign, record.seat, amount)
    awarded += 1
  }
  if (awarded) logLine(log, `✨ 序曲奖励经验：每名调查员 +${amount} 点经验值（记入未花费经验）。`)
  return awarded
}

/** 未花费经验快照（战役记录读点；权威值仍是各席位的 `record.xp`）。 */
export function syncUnspentXp (state) {
  const records = recordsOf(state)
  if (!records) return 0
  const total = Object.values(state?.campaign?.investigators || {})
    .reduce((sum, record) => sum + Math.max(0, Number(record?.xp) || 0), 0)
  records.unspentXp = total
  return total
}

/** 时钟同步：把记录写回 `day` / `time` / `hemlockDate` 三处（章节 chaos.js 与引擎日历共用）。 */
export function syncClock (state, slot, log) {
  const records = recordsOf(state)
  if (!records) return null
  const date = FHV_SLOT_DATE[slot] || null
  if (!date) return null
  records.hemlockDate = `${date.day}:${date.period}`
  records.day = date.day
  records.time = date.period
  logLine(log, `🕰️ 时钟推进到第 ${date.day} 日${date.period === 'night' ? '夜晚' : '白天'}（${slot}）。`)
  return date
}

// ---------------------------------------------------------------------------
// 2. 序曲整备（四个 `*Prep` interlude 节点）
// ---------------------------------------------------------------------------
/**
 * 序曲整备：参考 `makePreparationsForNextSurvey`（保留 1 张支援 / 弃到开手牌数 / 资源回落 / 弃牌堆洗回）。
 * 引擎已在关卡结算时用 `prepareSurvey` 做完实际整备（写 `campaign.surveyPreparation`），这里只：
 *   · 记账（未花费经验、当前时钟、勘察包裹的 destinations）；
 *   · 打开升级窗（引擎读 `node.upgrades`）；
 *   · 给大厅/审计一份只读摘要。
 */
export function runPrepare (state, payload = {}, log) {
  const records = recordsOf(state)
  if (!records) return null
  const slot = payload.slot || fhvSlot(records)
  // 序曲整备同时是时间卡（Day/Time）的推进点：参考 `setupHemlockDay` 在序曲开局摆下当日时间卡，
  // 战役层在这里把 `day` / `time` / `hemlockDate` 同步成该槽位的日期（章节自行写同值时幂等）。
  if (slot) syncClock(state, slot, log)
  const parcel = state?.campaign?.surveyPreparation || null
  const summary = {
    slot,
    step: payload.step || null,
    date: records.hemlockDate,
    unspentXp: syncUnspentXp(state),
    official: Boolean(parcel),
    destinations: parcel?.destinations ? [...parcel.destinations] : [],
    seats: parcel ? Object.keys(parcel.seats || {}).map(Number).sort() : [],
  }
  const label = payload.step ? campaignStoryHeading(`headings.${payload.step}`) : ''
  logLine(log, `🧳 序曲整备（${slot}）${label ? `：${label}` : ''}——保留 1 张支援、手牌弃至开手牌数、`
    + `资源回落到起始值；线索随整备包裹进入下一场勘察；未花费经验 ${summary.unspentXp}。`)
  if (parcel?.destinations?.length) {
    logLine(log, `🗺️ 下一次勘察的可选关卡：${parcel.destinations.join('、')}。`)
  }
  appendStory(state, campaignStoryText('label.chooseAssetToKeepForNextSurvey'))
  return summary
}

// ---------------------------------------------------------------------------
// 3. 勘察选择 / 调度重抽 / 时间推进
// ---------------------------------------------------------------------------
/** 选择下一场勘察关卡：写入整备包裹的 `chosenDestination`（引擎读点），并同步记录。 */
export function runSurveyChosen (state, payload = {}, log) {
  const records = recordsOf(state)
  if (!records) return null
  const { scenarioId, slot, areaId } = payload
  const seat = Number.isInteger(state?.campaign?.leadSeat) ? state.campaign.leadSeat : 0
  let chosen = null
  if (state?.campaign?.surveyPreparation) {
    // 引擎读点：候选必须已在整备包裹的 `destinations` 里（`chooseSurveyDestination` 会校验）。
    try {
      chosen = chooseSurveyDestination(state, seat, scenarioId)
    } catch (error) {
      logLine(log, `⚠️ 勘察选择未写入整备包裹：${error.message}`)
    }
  }
  const area = areaId || areaOfScenario(scenarioId)?.id || null
  records.surveyChoices = [...(Array.isArray(records.surveyChoices) ? records.surveyChoices : []),
    `${slot || fhvSlot(records) || '?'}:${scenarioId}`]
  const label = scenarioOfArea(area) ? campaignStoryText(`key.[areasSurveyed].${area}.name`) : scenarioId
  logLine(log, `🧭 选择下一场勘察：${label || scenarioId}（${slot || '?'}）`
    + `${chosen ? '' : '；整备包裹未就绪，只记录选择'}。`)
  appendStory(state, campaignStoryText(`key.[areasSurveyed].${area}.scenarioName`))
  return { scenarioId, slot: slot || fhvSlot(records), areaId: area, written: Boolean(chosen) }
}

/** 跳过本次勘察（战役层新增的调度重抽）：推进时钟，记录选择；路由由流程图的边决定。 */
export function runReschedule (state, payload = {}, log) {
  const records = recordsOf(state)
  if (!records) return null
  const from = payload.slot || fhvSlot(records)
  const to = payload.nextSlot || null
  if (to) syncClock(state, to, log)
  // P8 修复：勘察整备包裹在「下一场勘察开局」时消费（`setup.js` 的 `delete campaign.surveyPreparation`）。
  // 跳过本次勘察时那条消费路径不会发生，包裹会一直挂着；再遇到 dawnOfTheFinalDay 这类
  // 自带 `mechanics.survey` 的序曲结算，`prepareSurvey` 就会抛「已有待使用的勘察整备」，
  // 整条「跳过勘察」路线在真实引擎里直接崩。跳过的槽位不会再开局，包裹里的手牌/支援/
  // 资源快照已经过期，这里直接丢弃；下一段会做整备的序曲会重新生成一份。
  let discarded = false
  if (state.campaign?.surveyPreparation) {
    delete state.campaign.surveyPreparation
    discarded = true
  }
  records.rescheduledSurveys = [...(Array.isArray(records.rescheduledSurveys) ? records.rescheduledSurveys : []),
    `${from || '?'}->${to || '?'}`]
  const handler = FHV_HANDLE_TIME[to] || null
  logLine(log, `⏭️ 跳过本次白日勘察：时钟从 ${from || '?'} 推进到 ${to || '?'}`
    + `${handler ? `，时间轴下一段 ${handler}` : ''}（战役层调度重抽）`
    + `${discarded ? '；已丢弃本次勘察的整备包裹（跳过的槽位不再开局）' : ''}。`)
  return { from, to, handleTimeNext: handler, discardedPreparation: discarded }
}

/** 关卡结束后的时间推进（`surveyRouter` 的规则效果）：只做时钟/日志，路由由 `stepReturn` 决定。 */
export function runAdvanceTime (state, payload = {}, log) {
  const records = recordsOf(state)
  if (!records) return null
  const slot = payload.slot || fhvSlot(records)
  const next = payload.next || (slot ? fhvNextStep('writtenInRock', { slot })[0] : null)
  logLine(log, `⌛ 时间检查：当前 ${records.hemlockDate || '?'} → 下一段 ${next || '?'}。`)
  return { slot, next }
}

// ---------------------------------------------------------------------------
// 4. 纯叙事夜（两段序曲夜）与夜探分支
// ---------------------------------------------------------------------------
/**
 * 序曲夜入场：把时钟拨到夜间（参考 `meta.time = Night`），读当晚正文。
 * 参考实现里法典选择按调查员逐个询问；本层给领队一次选择（见 approximation 1）。
 */
export function runEvening (state, payload = {}, log) {
  const records = recordsOf(state)
  if (!records) return null
  const slot = payload.slot || 'night1'
  syncClock(state, slot, log)
  const scope = payload.step === 'preludeTheSecondEvening' ? 'prelude.theSecondEvening' : 'prelude.theFirstEvening'
  const body = campaignStoryText(`${scope}.body`) || campaignStoryText(`prelude.theFirstEvening.body`)
  appendStory(state, body)
  logLine(log, `🌙 ${payload.step || '序曲夜'}：法典与居民访问（关系等级见 Campaign Log）。`)
  // 第二夜 Resolution 2（「教授把苏珊·珀尔的日记递给你」）：找回日记后，任一调查员可把
  // The Pearl Diary 加入牌组；本层按领队席位发放（流程图为每夜一次选择，见 approximation 1）。
  if (payload.step === 'preludeTheSecondEvening' && records.madamePearlsDiaryWasRecovered === true) {
    grantHeirloom(state, state.campaign?.leadSeat ?? 0, '10715', log)
  }
  return { step: payload.step || null, slot, date: records.hemlockDate }
}

// 两段纯叙事夜的法典选择 → 居民关系等级 +1 与 1 点奖励经验（参考 `incrementRecordCount` + `interludeXpAll`）。
// 键 = 流程图选项 id；值 = 受影响的居民（`null` = 没有居民，只给经验/资源）。
export const FHV_EVENING_CODEX_EFFECTS = Object.freeze({
  preludeTheFirstEvening: Object.freeze({
    theta: Object.freeze({ resident: 'motherRachel', note: null }),
    delta: Object.freeze({ resident: 'riverHawthorne', note: null }),
    sigma: Object.freeze({ resident: 'gideonMizrah', note: null }),
    omega: Object.freeze({ resident: 'theoPeters', note: null }),
    gamma: Object.freeze({ resident: 'simeonAtwood', note: 'simeonHatchedAPlan' }),
    pi: Object.freeze({ resident: null, note: null, campaignCard: true, heirloom: '10713' }),
  }),
  preludeTheSecondEvening: Object.freeze({
    motherRachel: Object.freeze({ resident: 'motherRachel', note: 'motherRachelSharedHerDoubts' }),
    leah: Object.freeze({ resident: 'leahAtwood', note: 'leahSharedADance' }),
    simeon: Object.freeze({ resident: 'simeonAtwood', note: 'simeonSharedADance', minLevel: 3 }),
    william: Object.freeze({ resident: 'williamHemlock', note: 'williamSharedADance', minLevel: 3 }),
    river: Object.freeze({ resident: 'riverHawthorne', note: 'riverSharedADance', minLevel: 3 }),
    gideon: Object.freeze({ resident: 'gideonMizrah', note: 'gideonSharedADance', minLevel: 3 }),
    judith: Object.freeze({ resident: 'judithPark', note: 'judithSharedADance', minLevel: 3 }),
    theo: Object.freeze({ resident: 'theoPeters', note: 'theoSharedADance', minLevel: 3 }),
    alone: Object.freeze({ resident: null, note: null, xp: 1 }),
    omega: Object.freeze({ resident: 'theoPeters', note: 'theoRejectedHisFamily' }),
    theta: Object.freeze({ resident: null, note: null, resources: 2 }),
  }),
})

/** 记录一条居民笔记（`<resident>Notes` 集合 + 印刷复选框同写；与章节行为同一口径）。 */
export function addResidentNote (state, residentId, noteKey, log) {
  const records = recordsOf(state)
  const row = FHV_RESIDENT_BY_ID[residentId]
  if (!records || !row || !noteKey) return false
  if (records[row.record.crossedOut] === true) return false
  const list = Array.isArray(records[row.record.notes]) ? records[row.record.notes] : []
  if (!list.includes(noteKey)) records[row.record.notes] = [...list, noteKey]
  records[noteKey] = true
  logLine(log, `📝 ${row.name}的笔记：${noteKey}。`)
  return true
}

/** 关系等级 +n（双写 `relationships[id]` 与 `<id>RelationshipLevel`，与章节行为同一口径）。 */
export function increaseRelationship (state, residentId, amount = 1, log) {
  const records = recordsOf(state)
  const row = FHV_RESIDENT_BY_ID[residentId]
  if (!records || !row || !Number.isSafeInteger(amount) || amount === 0) return false
  if (records[row.record.crossedOut] === true) return false
  const next = Math.max(0, Math.min(row.record.max, residentLevel(records, residentId) + amount))
  records[row.record.level] = next
  records.relationships ||= {}
  records.relationships[residentId] = next
  logLine(log, `💚 ${row.name}的关系等级 → ${next}。`)
  return next
}

/**
 * 发放传家宝剧情资产（Heirlooms 10713–10715）：加入战役牌组（不计牌组张数），并写
 * `records.heirloomsAwarded`（P8 接线：此前该记录只有 schema/尾声读取、没有写入路径）。
 * 引擎/内容双路径：优先 `campaignCardChange`（战役层权威牌组），纯内容测试直接落记录。
 */
export function grantHeirloom (state, seat, code, log) {
  const records = recordsOf(state)
  if (!records || !FHV_HEIRLOOM_CODES.includes(String(code))) return false
  const active = activeRecords(state)
  const record = active.find(row => row.seat === Number(seat)) || active[0]
  if (!record) return false
  const awarded = Array.isArray(records.heirloomsAwarded) ? records.heirloomsAwarded : []
  if (awarded.includes(code)) return false
  try {
    campaignCardChange(state.campaign, record.seat, code, 'add', '传家宝（Heirlooms）')
  } catch (error) {
    logLine(log, `⚠️ 传家宝 ${code} 未加入战役牌组：${error.message}`)
  }
  records.heirloomsAwarded = [...awarded, code]
  logLine(log, `🏺 获得传家宝 ${code}（${campaignStoryText('key.[areasSurveyed].pearlRidge.name') ? '' : ''}已登记 heirloomsAwarded）。`)
  return true
}

/** 两段纯叙事夜的法典选择结算（关系 +1、笔记、奖励经验；pi 的 Worry Rock 在 P8 接线发放）。 */
export function runCodex (state, payload = {}, log) {
  const records = recordsOf(state)
  if (!records) return null
  const step = payload.step || 'preludeTheFirstEvening'
  const entry = payload.entry || null
  const table = FHV_EVENING_CODEX_EFFECTS[step] || {}
  const effect = entry ? table[entry] : null
  const record = { step, entry, resident: effect?.resident || null, note: effect?.note || null }
  if (effect) {
    if (effect.minLevel != null && residentLevel(records, effect.resident) < effect.minLevel) {
      logLine(log, `📖 法典 ${entry}：关系等级不足 ${effect.minLevel}，只读印刷小节（无加成）。`)
    } else {
      if (effect.resident) increaseRelationship(state, effect.resident, 1, log)
      if (effect.note) addResidentNote(state, effect.resident, effect.note, log)
      if (effect.resources) {
        // 参考 `eachInvestigator \iid' -> gainResources iid' CampaignSource 2`：资源不是战役记录，
        // 由引擎在下一关开局读 `campaign.startingAdjustments`（与 campaign-effects 的 adjustNextScenario 同容器）。
        state.campaign.startingAdjustments ||= {}
        for (const seat of activeRecords(state).map(row => row.seat)) {
          const current = state.campaign.startingAdjustments[seat] || { resources: 0, clues: 0 }
          state.campaign.startingAdjustments[seat] = {
            resources: current.resources + effect.resources,
            clues: current.clues || 0,
          }
        }
        logLine(log, `🪙 法典 ${entry}：每名调查员下一关起始资源 +${effect.resources}。`)
      }
      awardPreludeXp(state, effect.xp || 1, log)
      if (effect.heirloom) grantHeirloom(state, payload.seat ?? state.campaign?.leadSeat ?? 0, effect.heirloom, log)
    }
  }
  if (Array.isArray(records.codexRead) && entry && !records.codexRead.includes(entry)) {
    records.codexRead = [...records.codexRead, entry]
  }
  appendStory(state, campaignStoryText(`prelude.${step === 'preludeTheSecondEvening' ? 'theSecondEvening' : 'theFirstEvening'}.codexChoice`))
  syncUnspentXp(state)
  return record
}

/** 夜探分支：固定夜章（`theTwistedHollow`/`theLongestNight`）或「再查一处」（勘察选择）。 */
export function runNightBranch (state, payload = {}, log) {
  const records = recordsOf(state)
  if (!records) return null
  const slot = payload.slot || null
  const scenarioId = payload.scenarioId || null
  const branch = payload.branch || null
  records.nightBranches = [...(Array.isArray(records.nightBranches) ? records.nightBranches : []),
    `${slot || '?'}:${branch || '?'}${scenarioId ? `:${scenarioId}` : ''}`]
  logLine(log, `🌘 ${slot === 'night2' ? '第二夜' : '第一夜'}：${scenarioId || '再查一处未勘察区域'}。`)
  return { slot, branch, scenarioId }
}

/** 疲劳（参考 `Helpers.hs#replaceFatigueChaosTokens`）：把 2 枚非符号标记换成低 1 档的标记。 */
export const FATIGUE_LOWERING = Object.freeze({
  '+1': '0', 0: '-1', '-1': '-2', '-2': '-3', '-3': '-4', '-4': '-5', '-5': '-6', '-6': '-7', '-7': '-8',
})
export const FATIGUE_REPLACEMENTS = 2

/**
 * 疲劳结算（`theLongestNight` 之后的战役记录）。P7 approximation：引擎没有「抽出 N 枚非符号标记」
 * 的原语，这里只把「已结算/待替换次数」记进 `records.fatiguePending`，并把正文写进历史；
 * 标记替换留给后续原语（`replaceFatigueChaosTokens` 的引擎侧实现）。
 */
export function runFatigue (state, log) {
  const records = recordsOf(state)
  if (!records) return 0
  const pending = Number(records.fatiguePending) || 0
  records.fatiguePending = pending + FATIGUE_REPLACEMENTS
  appendStory(state, campaignStoryText('fatigue.body'))
  logLine(log, `😩 疲劳：还需要把 ${records.fatiguePending} 枚非符号混乱标记换成低 1 档的标记`
    + `（标记替换原语尚未在引擎侧实现，记录保留待结算）。`)
  return records.fatiguePending
}

// ---------------------------------------------------------------------------
// 5. 效果分派 + 节点表
// ---------------------------------------------------------------------------
export function runInterludeEffect (state, effect, log) {
  const payload = effect.payload || {}
  switch (effect.event) {
    case 'prepare': return runPrepare(state, payload, log)
    case 'surveyChosen': return runSurveyChosen(state, payload, log)
    case 'reschedule': return runReschedule(state, payload, log)
    case 'advanceTime': return runAdvanceTime(state, payload, log)
    case 'evening': return runEvening(state, payload, log)
    case 'codex': return runCodex(state, payload, log)
    case 'nightBranch': return runNightBranch(state, payload, log)
    case 'fatigue': return runFatigue(state, log)
    case 'sync': {
      syncUnspentXp(state)
      return { date: recordsOf(state)?.hemlockDate || '', unspentXp: recordsOf(state)?.unspentXp || 0 }
    }
    default: throw new Error(`未知序曲/幕间效果：${String(effect.event)}`)
  }
}

/**
 * 幕间子图里的补充节点（四段序曲整备之外的部分）：
 *   · `fatigue`：最长一夜之后的疲劳（参考 `Helpers.hs#replaceFatigueChaosTokens` 的演出位置：
 *     `theLongestNight` 结算后、`dawnOfTheFinalDay` 之前）。
 * 它在 `interludeFlow: 'continuous'` 的幕间子图里一次读完，不额外开休息窗。
 */
export function interludeNodes () {
  return {
    fatigue: {
      type: 'story',
      titleKey: 'fatigue.title',
      textKey: 'fatigue.body',
      effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'fatigue' }],
      next: 'dawnOfTheFinalDay',
    },
  }
}

/** 只读：当晚可读的法典条目（居民 id → 关系等级/是否划掉），大厅与测试共用。 */
export function eveningCodexCandidates (state) {
  const records = recordsOf(state) || {}
  return FHV_RESIDENTS.map(row => ({
    id: row.id,
    level: residentLevel(records, row.id),
    crossedOut: records[row.record.crossedOut] === true,
  }))
}

/** 只读：某个时间槽的可勘察关卡（规则在 parts.js，本处只做转发，便于章节/大厅同源）。 */
export function surveyCandidatesFor (slot, records) {
  return fhvSurveyCandidates(slot, records)
}

/** 只读：传家宝身份表（发放由序曲法典小节完成，战役层只登记）。 */
export const HEIRLOOM_CODES = FHV_HEIRLOOM_CODES

// 线索保留 / 起始支援保留的引擎读点（P7 只声明口径，不重复实现）：
//   引擎在关卡结算时用 `prepareSurvey` 把「保留的 1 张非起始支援 + 手牌 + 资源 + 线索」写进
//   `campaign.surveyPreparation.seats[seat]`，下一场勘察开局由 `restoreSurveyInvestigator` 写回。
//   战役层只记录「未花费经验」与时钟，不改这条链路。
export const FHV_PREPARATION_READPOINTS = Object.freeze({
  parcel: 'campaign.surveyPreparation',
  seats: 'campaign.surveyPreparation.seats[<seat>]',
  clues: 'campaign.surveyPreparation.seats[<seat>].clues',
  resources: 'campaign.surveyPreparation.seats[<seat>].resources',
  hand: 'campaign.surveyPreparation.seats[<seat>].hand',
  assets: 'campaign.surveyPreparation.seats[<seat>].assets',
  preparedBy: 'src/engine/survey-preparation.js#prepareSurvey',
  restoredBy: 'src/engine/survey-preparation.js#restoreSurveyInvestigator',
  chosenBy: 'src/engine/survey-preparation.js#chooseSurveyDestination',
})

// 参考实现的两段纯叙事夜的正文键（测试/账本用）。
export const EVENING_TEXT_KEYS = Object.freeze([
  'prelude.theFirstEvening.body', 'prelude.theFirstEvening.mealChoice',
  'prelude.theFirstEvening.codexChoice', 'prelude.theFirstEvening.resolution1.body',
  'prelude.theSecondEvening.theSecondEvening1', 'prelude.theSecondEvening.codexChoice',
  'prelude.theSecondEvening.resolution1.body', 'prelude.theSecondEvening.resolution6.body',
])

// P7 approximation 登记（供报告/账本读取，不参与引擎读点）。
export const FHV_INTERLUDE_APPROXIMATIONS = Object.freeze([
  Object.freeze({ id: 'perInvestigatorCodex', detail: '参考实现按调查员逐个询问法典选择；流程图只给领队一张清单（一晚一次）。' }),
  Object.freeze({ id: 'skipSurveyReschedule', detail: '「跳过本次勘察」是本层新增的调度重抽，参考实现没有该选项。' }),
  Object.freeze({ id: 'fatigueTokens', detail: '疲劳的标记替换原语未落地：只记录待替换次数与正文。' }),
  Object.freeze({ id: 'piCampaignCard', detail: 'pi（友善的陌生人）的剧情资产入牌组走引擎 addCampaignCardToDeck，战役层只记录经验。' }),
])

registerCampaignEffectHandler(INTERLUDE_HANDLER_ID, runInterludeEffect)
