// 《地球边缘》（Edge of the Earth）· 序幕与伙伴介绍（P7）。
//
// 事实源（锁定）：
//   · 参考实现 `Campaigns/EdgeOfTheEarth.hs`：`CampaignStep PrologueStep` → `DoStep 2/3/4`。
//   · 正文键：`edgeOfTheEarth.madnessUnderTheIce` / `prologue` / `prologue1`–`prologue4` /
//     `partnerIntros`（伙伴介绍 8 段：amyKensler…williamDyer）。
//   · 记录/混乱袋：相信戴尔 → 记 `theInvestigatorsConvincedDyerToAllowTheExpedition` + [cultist]；
//     不信 → 记 `theInvestigatorsDidNotBelieveDyersReport` + [tablet]。
//
// 本文件导出可通过 `campaignGraph` 校验的序幕子图与一个已注册的战役效果处理器：
//   · `campaignStart`：初始化 9 位伙伴（Safe）、7 件物资、5 枚封印，并写伙伴状态镜像；
//   · `partnerIntros`：按正文依次讲述 8 位伙伴的介绍（正文来自 story-access）。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { initializePartners, partnerState } from '../../../src/campaign/eote-partners.js'
import { initializeSupplies } from '../../../src/campaign/eote-supplies.js'
import { initializeSeals } from '../../../src/campaign/eote-seals.js'
import {
  PARTNERS, PARTNER_CODES, PARTNER_RESOLUTE_BY_CODE, PARTNER_KEY_BY_CODE,
  SUPPLIES, SUPPLY_CODES, SEALS, partnerStatusEntries, storyBody, storyHeading,
} from './records.js'

export const PROLOGUE_HANDLER_ID = 'edgeOfTheEarthPrologue'

const text = (key, fallback) => storyBody(key) || fallback
const heading = (key, fallback) => storyHeading(key) || fallback

// ---------------------------------------------------------------------------
// 序幕子图（story / choice）：从 `prologue` 走到 `iceAndDeathPart1`。
// ---------------------------------------------------------------------------

/** 序幕节点；正文 key 供 flow.js 统一本地化，文字兜底用于生成物缺键时不至于空白。 */
export const PROLOGUE_NODES = Object.freeze({
  prologue: {
    type: 'story',
    title: '序幕',
    textKey: 'madnessUnderTheIce',
    text: text('madnessUnderTheIce', '冰雪之下疯狂肆虐。'),
    // 战役开始的第一批初始化：伙伴名册/物资/封印；旧存档或非战役开局不会走到这里。
    effects: [{ type: 'registered', handler: PROLOGUE_HANDLER_ID, event: 'campaignStart' }],
    next: 'prologuePrelude',
  },
  prologuePrelude: {
    type: 'story',
    title: heading('prologue', '序幕'),
    textKey: 'prologue',
    text: text('prologue', '由于科学家在了解事情原委前就拒绝听取我的忠告，因此我被迫公开发表这篇声明。'),
    next: 'prologueChoice',
  },
  prologueChoice: {
    type: 'choice',
    title: heading('prologue1', '序幕 1'),
    textKey: 'prologue1',
    text: text('prologue1', '威廉·戴尔教授请求你帮助阻止下一次南极探险。'),
    prompt: '你相信戴尔教授的叙述吗？',
    options: [
      {
        id: 'believe',
        label: text('label.prologue1Believe', '我相信你，但如果这些都是真的，我们难道不该进一步调查吗？'),
        next: 'prologueBelieve',
      },
      {
        id: 'disbelieve',
        label: text('label.prologue1Wild', '抱歉，但这听上去太疯狂了，不可能是真的。'),
        next: 'prologueWild',
      },
    ],
  },
  prologueBelieve: {
    type: 'story',
    title: heading('prologue2', '序幕 2'),
    textKey: 'prologue2',
    text: text('prologue2', '戴尔长舒一口气，平静了下来。'),
    effects: [
      { type: 'record', key: 'theInvestigatorsConvincedDyerToAllowTheExpedition', value: true },
      { type: 'chaos', token: 'cultist', amount: 1 },
      { type: 'log', text: '📔 在剧本日志中记录：调查员们说服戴尔允许探险；混乱袋加入 1 枚 [cultist] 标记。' },
    ],
    next: 'prologue4',
  },
  prologueWild: {
    type: 'story',
    title: heading('prologue3', '序幕 3'),
    textKey: 'prologue3',
    text: text('prologue3', '戴尔咬紧牙关，两颊发红。'),
    effects: [
      { type: 'record', key: 'theInvestigatorsDidNotBelieveDyersReport', value: true },
      { type: 'chaos', token: 'tablet', amount: 1 },
      { type: 'log', text: '📔 在剧本日志中记录：调查员们不相信戴尔的报告；混乱袋加入 1 枚 [tablet] 标记。' },
    ],
    next: 'prologue4',
  },
  prologue4: {
    type: 'choice',
    title: heading('prologue4', '序幕 4'),
    textKey: 'prologue4',
    text: text('prologue4', '你抬头望着乌云密布的天空，继续朝波士顿港码头的边缘走去。'),
    prompt: '是否阅读探险队每位成员的介绍？',
    options: [
      {
        id: 'readIntros',
        label: '阅读探险队成员介绍',
        effects: [{ type: 'registered', handler: PROLOGUE_HANDLER_ID, event: 'partnerIntros' }],
        next: 'iceAndDeathPart1',
      },
      {
        id: 'skipIntros',
        label: '跳过成员介绍',
        next: 'iceAndDeathPart1',
      },
    ],
  },
})

// ---------------------------------------------------------------------------
// 序幕效果处理器
// ---------------------------------------------------------------------------

const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function appendStory (state, line) {
  const visit = state?.campaign?.flow?.history?.at?.(-1)
  if (visit) visit.storyText = [visit.storyText, line].filter(Boolean).join('\n\n')
}

function partnerRoster (state) {
  return PARTNER_CODES
    .map(code => partnerState(state, code))
    .filter(Boolean)
    .map(entry => ({ code: entry.code, status: entry.status }))
}

function syncPartnerMirror (state) {
  const campaign = state?.campaign
  if (!campaign?.records) return
  campaign.records.eotePartnerStatuses = partnerStatusEntries(partnerRoster(state))
}

/** 战役开始：幂等初始化（已初始化则跳过），并把伙伴名册镜像写进记录便于存档/审计。 */
function startCampaign (state, log) {
  const campaign = state?.campaign
  if (!campaign) return
  if (!campaign.eote?.partners) {
    initializePartners(state, {
      partners: PARTNERS.map(partner => ({ code: partner.code, damage: 0, horror: 0 })),
      resoluteForms: PARTNERS.map(partner => [partner.code, partner.resolute]),
    })
    logLine(log, `🧭 探险队伙伴名册已建立：${PARTNERS.length} 位伙伴（安全状态）。`)
  }
  if (!campaign.eote?.supplies) {
    initializeSupplies(state, {
      items: SUPPLIES.map(supply => ({ code: supply.code, label: supply.label })),
      recoveredKey: 'suppliesRecovered',
    })
    logLine(log, `🎒 探险物资已建立：${SUPPLIES.length} 件（物资控制权由章节内容分配）。`)
  }
  if (!campaign.eote?.seals) {
    initializeSeals(state, { kinds: SEALS })
    logLine(log, `🪬 五枚古老封印已建立：A–E（休眠、无控制者）。`)
  }
  if (!campaign.records.eoteShelterValue) campaign.records.eoteShelterValue = 0
  syncPartnerMirror(state)
}

const INTRO_ORDER = Object.freeze([
  'amyKensler', 'roaldEllsworth', 'jamesFredericks', 'takadaHiroko',
  'averyClaypool', 'malaSinha', 'eliyahAshevak', 'williamDyer',
])

function partnerIntros (state, log) {
  for (const key of INTRO_ORDER) {
    const body = storyBody(key)
    if (!body) continue
    const name = PARTNER_KEY_BY_CODE && Object.values(PARTNER_KEY_BY_CODE).includes(key)
      ? PARTNERS.find(partner => partner.key === key)?.name : key
    const line = `【${name ?? key}】${body}`
    appendStory(state, body)
    logLine(log, line)
  }
}

export function runPrologueEffect (state, effect, log) {
  if (effect.event === 'campaignStart') return startCampaign(state, log)
  if (effect.event === 'partnerIntros') return partnerIntros(state, log)
  throw new Error(`未知序幕效果：${String(effect.event)}`)
}

registerCampaignEffectHandler(PROLOGUE_HANDLER_ID, runPrologueEffect)

// 供 flow.js 统一本地化使用（不写死正文；生成物更新后自动生效）。
export const PROLOGUE_TEXT_KEYS = Object.freeze([
  'madnessUnderTheIce', 'prologue', 'prologue1', 'prologue2', 'prologue3', 'prologue4',
  ...INTRO_ORDER,
])
export { PARTNER_RESOLUTE_BY_CODE, PARTNER_KEY_BY_CODE, SUPPLY_CODES }
