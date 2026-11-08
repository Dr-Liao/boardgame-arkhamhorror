// 《地球边缘》（Edge of the Earth）· 检查点 I–III（P7）。
//
// 事实源（锁定）：
//   · 参考实现 `Campaigns/EdgeOfTheEarth.hs`：
//       Checkpoint 1（失踪事件）：按当前营地庇护值随机保留「庇护值」名伙伴，其余为失踪；
//         选择「他们只能靠自己」→ 失踪者划去并直接跳检查点 II；
//         选择「去寻找失踪队员」→ 失踪者记为 MIA 并进入《亡命冰原》第 II 部分。
//       Checkpoint 2（袭击）：选择「逃进山脉」→ 记 `theTeamFledToTheMountains`，跳过第 III 部分进幕间 I；
//         选择「留下战斗」→ 进入《亡命冰原》第 III 部分。
//       Checkpoint 3：读完 `theOtherSide1/3` 后直接进入《疯狂之心》第 II 部分。
//   · 正文键：`checkpoint1.theDisappearance1/2/3`、`checkpoint2.theAttack1/2/3`、`checkpoint3.theOtherSide1/2/3`。
//   · 升级权限：检查点只是「继续/分段休息」窗口，**不允许**升级（升级只发生在幕间；引擎读点
//     `campaign.upgradesAllowed = node.type === 'interlude' && node.upgrades !== false`）。
//
// 失踪分配用 P2 原语 `chooseMissingPartners`（同一规则只实现一次，见 src/campaign/eote-partners.js）。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import {
  chooseMissingPartners, initializePartners, partnerState, setPartnerStatus,
} from '../../../src/campaign/eote-partners.js'
import {
  CAMP_SHELTER, PARTNERS, PARTNER_CODES, PARTNER_RESOLUTE_BY_CODE,
  campShelterFromRecords, partnerStatusEntries, storyBody, storyHeading,
} from './records.js'

export const CHECKPOINT_HANDLER_ID = 'edgeOfTheEarthCheckpoints'

const text = (key, fallback) => storyBody(key) || fallback
const heading = (key, fallback) => storyHeading(key) || fallback

// ---------------------------------------------------------------------------
// 检查点子图
// ---------------------------------------------------------------------------

export const CHECKPOINT_NODES = Object.freeze({
  // 检查点 I：进入时先做失踪分配（参考实现的 CheckpointStep 1 入口逻辑）。
  checkpoint1: {
    type: 'checkpoint',
    title: '检查点 I：失踪事件',
    textKey: 'checkpoint1.theDisappearance1',
    text: text('checkpoint1.theDisappearance1', '一声惊叫打断了你的休息：有几名同伴失踪了。'),
    upgrades: false,
    effects: [{ type: 'registered', handler: CHECKPOINT_HANDLER_ID, event: 'checkpoint1Missing' }],
    next: 'checkpoint1Route',
  },
  checkpoint1Route: {
    type: 'stepReturn',
    title: '检查点 I：失踪事件',
    rules: [
      {
        id: 'someoneMissing',
        when: { record: 'eoteMissingCount', atLeast: 1 },
        next: 'checkpoint1Choice',
      },
    ],
    next: 'checkpoint1NoLoss',
  },
  checkpoint1NoLoss: {
    type: 'story',
    title: heading('checkpoint1.theDisappearance2', '检查点 I：失踪事件'),
    textKey: 'checkpoint1.theDisappearance2',
    text: text('checkpoint1.theDisappearance2', '第二天，你们养精蓄锐，为下一段旅程做准备。'),
    next: 'checkpoint2',
  },
  checkpoint1Choice: {
    type: 'choice',
    title: heading('checkpoint1.theDisappearance1', '检查点 I：失踪事件'),
    textKey: 'checkpoint1.theDisappearance1',
    text: text('checkpoint1.theDisappearance1', '足迹离开营地，延伸进冰冻荒野。'),
    prompt: '要怎么处理失踪的队员？',
    options: [
      {
        id: 'search',
        label: '去寻找失踪的队员',
        next: 'checkpoint1SearchStory',
      },
      {
        id: 'abandon',
        label: '他们只能靠自己了',
        next: 'checkpoint1AbandonStory',
      },
    ],
  },
  checkpoint1SearchStory: {
    type: 'story',
    title: heading('checkpoint1.theDisappearance3', '检查点 I：失踪事件'),
    textKey: 'checkpoint1.theDisappearance3',
    text: text('checkpoint1.theDisappearance3', '你决定去寻找失踪的队员，前往《亡命冰原》第 II 部分。'),
    effects: [{ type: 'registered', handler: CHECKPOINT_HANDLER_ID, event: 'checkpoint1Search' }],
    next: 'iceAndDeathPart2',
  },
  checkpoint1AbandonStory: {
    type: 'story',
    title: heading('checkpoint1.theDisappearance2', '检查点 I：失踪事件'),
    textKey: 'checkpoint1.theDisappearance2',
    text: text('checkpoint1.theDisappearance2', '失踪的队员肯定熬不过晚上，你只能继续前进。'),
    effects: [{ type: 'registered', handler: CHECKPOINT_HANDLER_ID, event: 'checkpoint1Abandon' }],
    next: 'checkpoint2',
  },

  // 检查点 II：逃离还是坚守。
  checkpoint2: {
    type: 'checkpoint',
    title: '检查点 II：袭击',
    textKey: 'checkpoint2.theAttack1',
    text: text('checkpoint2.theAttack1', '营地遭到袭击。'),
    upgrades: false,
    effects: [{ type: 'registered', handler: CHECKPOINT_HANDLER_ID, event: 'checkpointSync' }],
    next: 'checkpoint2Choice',
  },
  checkpoint2Choice: {
    type: 'choice',
    title: heading('checkpoint2.theAttack1', '检查点 II：袭击'),
    textKey: 'checkpoint2.theAttack1',
    text: text('checkpoint2.theAttack1', '营地遭到袭击，你们必须立刻做决定。'),
    prompt: '逃跑还是留下战斗？',
    options: [
      {
        id: 'flee',
        label: text('label.runForYourLives', '各自逃命！'),
        next: 'checkpoint2FleeStory',
      },
      {
        id: 'stand',
        label: text('label.standAndFight', '留下战斗！'),
        next: 'checkpoint2StandStory',
      },
    ],
  },
  checkpoint2FleeStory: {
    type: 'story',
    title: heading('checkpoint2.theAttack2', '检查点 II：袭击'),
    textKey: 'checkpoint2.theAttack2',
    text: text('checkpoint2.theAttack2', '你们逃进山脉，把营地留给了袭击者。'),
    effects: [
      { type: 'record', key: 'theTeamFledToTheMountains', value: true },
      { type: 'log', text: '📔 在剧本日志中记录：队伍逃进了群山。' },
    ],
    next: 'interlude1',
  },
  checkpoint2StandStory: {
    type: 'story',
    title: heading('checkpoint2.theAttack3', '检查点 II：袭击'),
    textKey: 'checkpoint2.theAttack3',
    text: text('checkpoint2.theAttack3', '你们留下来战斗，进入《亡命冰原》第 III 部分。'),
    next: 'iceAndDeathPart3',
  },

  // 检查点 III：进入《疯狂之心》第 II 部分。
  checkpoint3: {
    type: 'checkpoint',
    title: '检查点 III：另一边',
    textKey: 'checkpoint3.theOtherSide1',
    text: text('checkpoint3.theOtherSide1', '你们穿过了伊夸之门。'),
    upgrades: false,
    effects: [{ type: 'registered', handler: CHECKPOINT_HANDLER_ID, event: 'checkpointSync' }],
    next: 'checkpoint3Story',
  },
  checkpoint3Story: {
    type: 'story',
    title: heading('checkpoint3.theOtherSide3', '检查点 III：另一边'),
    textKey: 'checkpoint3.theOtherSide3',
    text: text('checkpoint3.theOtherSide3', '门的另一边，是无名狂魔的终局。'),
    next: 'theHeartOfMadnessPart2',
  },
})

// ---------------------------------------------------------------------------
// 检查点效果处理器
// ---------------------------------------------------------------------------

const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function appendStory (state, line) {
  const visit = state?.campaign?.flow?.history?.at?.(-1)
  if (visit) visit.storyText = [visit.storyText, line].filter(Boolean).join('\n\n')
}

function ensurePartners (state) {
  if (state?.campaign?.eote?.partners) return true
  initializePartners(state, {
    partners: PARTNERS.map(partner => ({ code: partner.code, damage: 0, horror: 0 })),
    resoluteForms: PARTNERS.map(partner => [partner.code, partner.resolute]),
  })
  return true
}

function syncPartnerMirror (state) {
  const campaign = state?.campaign
  if (!campaign?.records) return
  campaign.records.eotePartnerStatuses = partnerStatusEntries(
    PARTNER_CODES.map(code => partnerState(state, code)).filter(Boolean))
  campaign.records.eoteEliminatedPartners = PARTNER_CODES
    .map(code => partnerState(state, code))
    .filter(entry => entry && entry.status === 'eliminated').length
}

/** 当前营地庇护值：优先章节记录的 eoteShelterValue，其次从 Camp_* 记录反查。 */
function shelterValueOf (state) {
  const records = state?.campaign?.records || {}
  const direct = Number(records.eoteShelterValue)
  if (Number.isSafeInteger(direct) && direct > 0) return direct
  const camp = campShelterFromRecords(records)
  if (camp) return camp.shelter
  return CAMP_SHELTER.campCrashSite.shelter
}

function checkpoint1Missing (state, log) {
  ensurePartners(state)
  const records = state.campaign.records
  const shelter = shelterValueOf(state)
  records.eoteShelterValue = shelter
  records.eoteMissingCount = 0
  records.eoteMissingPartners = []
  let missing = []
  try {
    missing = chooseMissingPartners(state, shelter)
  } catch (error) {
    // 伙伴名册不在（旧存档/非战役初始化）时只记录庇护值，不阻断流程。
    logLine(log, `⚠️ 检查点 I：无法分配失踪伙伴（${error.message}）。`)
    return
  }
  const codes = missing.map(entry => entry.code)
  records.eoteMissingCount = codes.length
  records.eoteMissingPartners = codes
  syncPartnerMirror(state)
  const names = codes.map(code => PARTNERS.find(partner => partner.code === code)?.name || code)
  const line = `⛺ 检查点 I：营地庇护值 ${shelter}；失踪伙伴 ${codes.length} 名${names.length ? `（${names.join('、')}）` : ''}。`
  appendStory(state, line)
  logLine(log, line)
}

function checkpoint1Search (state, log) {
  if (!ensurePartners(state)) return
  const codes = Array.isArray(state.campaign.records.eoteMissingPartners) ? state.campaign.records.eoteMissingPartners : []
  for (const code of codes) {
    const entry = partnerState(state, code)
    if (entry?.status === 'safe') setPartnerStatus(state, code, 'mia')
  }
  syncPartnerMirror(state)
  // 「去寻找」分支的失踪者保持 MIA（第 II 部分可救回）；不在这里划去。
  const line = `🔎 检查点 I：调查员决定去寻找失踪队员（${codes.length} 名失踪）。`
  appendStory(state, line)
  logLine(log, line)
}

function checkpoint1Abandon (state, log) {
  if (!ensurePartners(state)) return
  const codes = Array.isArray(state.campaign.records.eoteMissingPartners) ? state.campaign.records.eoteMissingPartners : []
  for (const code of codes) {
    const entry = partnerState(state, code)
    if (entry && entry.status !== 'eliminated') setPartnerStatus(state, code, 'eliminated')
  }
  syncPartnerMirror(state)
  const line = `✖️ 检查点 I：失踪队员被划去（${PARTNERS.length} 人中的 ${codes.length} 人）。`
  appendStory(state, line)
  logLine(log, line)
}

function checkpointSync (state, log) {
  ensurePartners(state)
  const records = state.campaign.records
  const camp = campShelterFromRecords(records)
  if (camp) records.eoteShelterValue = camp.shelter
  syncPartnerMirror(state)
  const eliminated = Number(records.eoteEliminatedPartners) || 0
  logLine(log, `⛺ 检查点：当前庇护值 ${records.eoteShelterValue ?? 0}，已被划去的伙伴 ${eliminated} 名。`)
}

export function runCheckpointEffect (state, effect, log) {
  if (effect.event === 'checkpoint1Missing') return checkpoint1Missing(state, log)
  if (effect.event === 'checkpoint1Search') return checkpoint1Search(state, log)
  if (effect.event === 'checkpoint1Abandon') return checkpoint1Abandon(state, log)
  if (effect.event === 'checkpointSync') return checkpointSync(state, log)
  throw new Error(`未知检查点效果：${String(effect.event)}`)
}

registerCampaignEffectHandler(CHECKPOINT_HANDLER_ID, runCheckpointEffect)
