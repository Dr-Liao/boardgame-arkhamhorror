// 万象无终（The Circle Undone）· 战役级塔罗数据（序章 05043 + 巫异时刻 05050）。
//
// 本文件只放**数据 + 纯函数**，不 import 引擎、不 import 卡牌条目：
//   · 序章：22 张大阿卡纳的「命运」结果表（参考实现 DisappearanceAtTheTwilightEstate.hs
//     DoStep 3 / ForInvestigator 的 case 分支）——4 个 string[] 记录 + 证据计数；
//   · 巫异时刻：8 张固定的 Campaign Reading 占卜表（TheWitchingHour.hs PickDestiny），
//     供 theWitchingHour 章节只读 import。
//
// 引擎原语在 src/engine/tarot.js（22 张唯一牌堆、正逆位、抽/选/洗回）；本文件只描述
// 「抽到第几张意味着什么」，不复制牌堆实现。随机全部由调用方的 api.tarot 注入，
// 因此对局与单元测试都可确定性复算。

import { recordTypes } from './shared.js'
// P9：22 条结果文案的唯一事实源是导入生成物（来源 frontend/locales/zh/.../disappearanceAtTheTwilightExstate.json）。
// 下面的 PROLOGUE_RESULT_TEXT 只作为来源缺失时的兜底，不再冒充完整正文。
import { TCU_STORY_TEXT } from './story-text.js'

// 22 张大阿卡纳的展示名（与 src/engine/tarot.js 的 MAJOR_ARCANA id 一一对应：0 愚者 … 21 世界）。
// 内容层不 import 引擎模块，因此这里保留一份只读展示表；id 才是唯一事实。
export const ARCANA_NAMES = Object.freeze([
  { id: 0, name: '愚者', nameEn: 'The Fool' },
  { id: 1, name: '魔术师', nameEn: 'The Magician' },
  { id: 2, name: '女祭司', nameEn: 'The High Priestess' },
  { id: 3, name: '女皇', nameEn: 'The Empress' },
  { id: 4, name: '皇帝', nameEn: 'The Emperor' },
  { id: 5, name: '教皇', nameEn: 'The Hierophant' },
  { id: 6, name: '恋人', nameEn: 'The Lovers' },
  { id: 7, name: '战车', nameEn: 'The Chariot' },
  { id: 8, name: '力量', nameEn: 'Strength' },
  { id: 9, name: '隐士', nameEn: 'The Hermit' },
  { id: 10, name: '命运之轮', nameEn: 'Wheel of Fortune' },
  { id: 11, name: '正义', nameEn: 'Justice' },
  { id: 12, name: '倒吊人', nameEn: 'The Hanged Man' },
  { id: 13, name: '死神', nameEn: 'Death' },
  { id: 14, name: '节制', nameEn: 'Temperance' },
  { id: 15, name: '恶魔', nameEn: 'The Devil' },
  { id: 16, name: '高塔', nameEn: 'The Tower' },
  { id: 17, name: '星星', nameEn: 'The Star' },
  { id: 18, name: '月亮', nameEn: 'The Moon' },
  { id: 19, name: '太阳', nameEn: 'The Sun' },
  { id: 20, name: '审判', nameEn: 'Judgement' },
  { id: 21, name: '世界', nameEn: 'The World' },
])

export function arcanaName(raw) {
  const id = Number(raw)
  const arcana = ARCANA_NAMES.find(entry => entry.id === id)
  return arcana ? { ...arcana } : { id, name: `大阿卡纳 ${id}`, nameEn: `Major Arcana ${id}` }
}

// 序章 4 个命运记录（shared.js recordTypes 全部为 string[]；证据是 number）。
export const PROLOGUE_FATE_RECORDS = Object.freeze([
  'disappearedIntoTheMist',
  'wasClaimedBySpecters',
  'wasPulledIntoTheSpectralRealm',
  'wasTakenByTheWatcher',
])

// zh locale `intro.<ArcanaEnum>` 的 22 条结果文案（文案事实源：frontend/locales/zh/.../disappearanceAtTheTwilightEstate.json）。
// `{name}` 在运行时替换成调查员中文名；证据数与本表 evidence 一致（文案里的「留下了N个证据」）。
const PROLOGUE_RESULT_TEXT = Object.freeze({
  TheFool0: '0: {name} 消失在迷雾之中。留下了2个证据。',
  TheMagicianI: '1–2: {name} 消失在迷雾之中。留下了0个证据。',
  TheHighPriestessII: '1-2: {name} 消失在迷雾之中。留下了0个证据。',
  TheEmpressIII: '3–6: {name} 被幽灵夺走性命。留下了3个证据。',
  TheEmperorIV: '3–6: {name} 被幽灵夺走性命。留下了3个证据。',
  TheHierophantV: '3–6: {name} 被幽灵夺走性命。留下了3个证据。',
  TheLoversVI: '3–6: {name} 被幽灵夺走性命。留下了3个证据。',
  TheChariotVII: '7–9: {name} 被幽灵夺走性命。留下了5个证据。',
  StrengthVIII: '7–9: {name} 被幽灵夺走性命。留下了5个证据。',
  TheHermitIX: '7–9: {name} 被幽灵夺走性命。留下了5个证据。',
  WheelOfFortuneX: '10–12: {name} 被拉入幽灵国度。留下了2个证据。',
  JusticeXI: '10–12: {name} 被拉入幽灵国度。留下了2个证据。',
  TheHangedManXII: '10–12: {name} 被拉入幽灵国度。留下了2个证据。',
  DeathXIII: '13–16: {name} 被拉入幽灵国度。留下了4个证据。',
  TemperanceXIV: '13-16: {name} 被拉入幽灵国度。留下了4个证据。',
  TheDevilXV: '13-16: {name} 被拉入幽灵国度。留下了4个证据。',
  TheTowerXVI: '13-16: {name} 被拉入幽灵国度。留下了4个证据。',
  TheStarXVII: '17–18: {name} 被拉入幽灵国度。留下了6个证据。',
  TheMoonXVIII: '17-18: {name} 被拉入幽灵国度。留下了6个证据。',
  TheSunXIX: '19-20: {name} 被看守人抓走。留下了3个证据。',
  JudgementXX: '19-20: {name} 被看守人抓走。留下了3个证据。',
  TheWorldXXI: '21: {name} 被看守人抓走。留下了5个证据。',
})

// 22 行序章结果表。`key` = Haskell 的构造函数名（也是 zh locale 的 intro 子键）。
// record + evidence 逐行对照 DisappearanceAtTheTwilightEstate.hs:193-255。
export const PROLOGUE_TAROT_RESULTS = Object.freeze([
  { arcana: 0, key: 'TheFool0', record: 'disappearedIntoTheMist', evidence: 2 },
  { arcana: 1, key: 'TheMagicianI', record: 'disappearedIntoTheMist', evidence: 0 },
  { arcana: 2, key: 'TheHighPriestessII', record: 'disappearedIntoTheMist', evidence: 0 },
  { arcana: 3, key: 'TheEmpressIII', record: 'wasClaimedBySpecters', evidence: 3 },
  { arcana: 4, key: 'TheEmperorIV', record: 'wasClaimedBySpecters', evidence: 3 },
  { arcana: 5, key: 'TheHierophantV', record: 'wasClaimedBySpecters', evidence: 3 },
  { arcana: 6, key: 'TheLoversVI', record: 'wasClaimedBySpecters', evidence: 3 },
  { arcana: 7, key: 'TheChariotVII', record: 'wasClaimedBySpecters', evidence: 5 },
  { arcana: 8, key: 'StrengthVIII', record: 'wasClaimedBySpecters', evidence: 5 },
  { arcana: 9, key: 'TheHermitIX', record: 'wasClaimedBySpecters', evidence: 5 },
  { arcana: 10, key: 'WheelOfFortuneX', record: 'wasPulledIntoTheSpectralRealm', evidence: 2 },
  { arcana: 11, key: 'JusticeXI', record: 'wasPulledIntoTheSpectralRealm', evidence: 2 },
  { arcana: 12, key: 'TheHangedManXII', record: 'wasPulledIntoTheSpectralRealm', evidence: 2 },
  { arcana: 13, key: 'DeathXIII', record: 'wasPulledIntoTheSpectralRealm', evidence: 4 },
  { arcana: 14, key: 'TemperanceXIV', record: 'wasPulledIntoTheSpectralRealm', evidence: 4 },
  { arcana: 15, key: 'TheDevilXV', record: 'wasPulledIntoTheSpectralRealm', evidence: 4 },
  { arcana: 16, key: 'TheTowerXVI', record: 'wasPulledIntoTheSpectralRealm', evidence: 4 },
  { arcana: 17, key: 'TheStarXVII', record: 'wasPulledIntoTheSpectralRealm', evidence: 6 },
  { arcana: 18, key: 'TheMoonXVIII', record: 'wasPulledIntoTheSpectralRealm', evidence: 6 },
  { arcana: 19, key: 'TheSunXIX', record: 'wasTakenByTheWatcher', evidence: 3 },
  { arcana: 20, key: 'JudgementXX', record: 'wasTakenByTheWatcher', evidence: 3 },
  { arcana: 21, key: 'TheWorldXXI', record: 'wasTakenByTheWatcher', evidence: 5 },
])

export function prologueTarotResult(raw) {
  const arcana = Number(raw)
  return PROLOGUE_TAROT_RESULTS.find(entry => entry.arcana === arcana) || null
}

// 中文结果文案：`{name}` → 调查员名。未知 arcana 返回空串（调用方自行兜底）。
// P9：优先读导入正文（story-text.js 的 prologue.tarotResults），旧内联摘要只在缺失时兜底。
export function prologueResultText(raw, name = '该角色') {
  const result = prologueTarotResult(raw)
  if (!result) return ''
  const imported = TCU_STORY_TEXT.prologue?.tarotResults?.[result.key]?.text
  const template = imported || PROLOGUE_RESULT_TEXT[result.key] || ''
  return template.replaceAll('{name}', String(name))
}

// 战役记录的唯一写入口（纯函数，state.campaign.records must 已是可写对象）。
// 返回 { record, evidence, totalEvidence }；重复调用同一位调查员/同一张牌不会重复写。
export function applyPrologueTarotResult(state, inv, raw) {
  const result = prologueTarotResult(raw)
  if (!result) throw new Error(`未知的大阿卡纳：${JSON.stringify(raw)}`)
  const records = recordForWrite(state)
  const code = String(inv?.code || '')
  if (!code) throw new Error('塔罗结果需要调查员卡号')
  const list = Array.isArray(records[result.record]) ? records[result.record] : []
  if (!list.includes(code)) list.push(code)
  records[result.record] = list
  records.piecesOfEvidenceWereLeftBehind = Number(records.piecesOfEvidenceWereLeftBehind || 0) + result.evidence
  return {
    ...result,
    arcanaName: arcanaName(result.arcana),
    text: prologueResultText(result.arcana, inv?.name || code),
    totalEvidence: records.piecesOfEvidenceWereLeftBehind,
  }
}

// 序章开局 `missingPersons` 语义：记录**已选**的故事调查员卡号（未选者不出现 = 划掉）。
// recordTypes 里它是 string[]，没有 crossedOut 字段（见 spec §6-3）。
export function writeMissingPersons(state, chosenCodes = []) {
  const records = recordForWrite(state)
  const codes = [...new Set(chosenCodes.map(code => String(code)).filter(Boolean))]
  records.missingPersons = codes
  return codes
}

// 确保记录键存在（campaign.records 一般是全键初始化的；纯 hook 测试夹具可能只有空对象）。
export function ensurePrologueRecords(state) {
  const records = recordForWrite(state)
  for (const key of PROLOGUE_FATE_RECORDS) {
    if (!Array.isArray(records[key])) records[key] = []
  }
  if (typeof records.piecesOfEvidenceWereLeftBehind !== 'number') records.piecesOfEvidenceWereLeftBehind = 0
  if (!Array.isArray(records.missingPersons)) records.missingPersons = []
  return records
}

function recordForWrite(state) {
  if (!state.campaign) throw new Error('塔罗结果需要 state.campaign')
  if (!state.campaign.records || typeof state.campaign.records !== 'object') state.campaign.records = {}
  return state.campaign.records
}

// ---------------------------------------------------------------------------
// 巫异时刻（05050）：8 张固定的 Campaign Reading 占卜表
// ---------------------------------------------------------------------------
// 参考 TheWitchingHour.hs:190-222（Return To 的「performTarotReading」分支）：
// 固定 8 张牌、按固定章节顺序读出命运；牌是正位，不洗牌、不重复。
// 章节 id 用本仓库 camelCase（与 shared.js chapters 一致）。
export const WITCHING_HOUR_DIVINATION = Object.freeze([
  { scenarioId: 'theWitchingHour', scenarioName: '巫异时刻', arcana: 14, arcanaName: '节制', arcanaNameEn: 'Temperance' },
  { scenarioId: 'atDeathsDoorstep', scenarioName: '死亡门前', arcana: 11, arcanaName: '正义', arcanaNameEn: 'Justice' },
  { scenarioId: 'theSecretName', scenarioName: '隐秘之名', arcana: 9, arcanaName: '隐士', arcanaNameEn: 'The Hermit' },
  { scenarioId: 'theWagesOfSin', scenarioName: '恶罪报应', arcana: 12, arcanaName: '倒吊人', arcanaNameEn: 'The Hanged Man' },
  { scenarioId: 'forTheGreaterGood', scenarioName: '崇高利益', arcana: 5, arcanaName: '教皇', arcanaNameEn: 'The Hierophant' },
  { scenarioId: 'unionAndDisillusion', scenarioName: '聚合幻灭', arcana: 6, arcanaName: '恋人', arcanaNameEn: 'The Lovers' },
  { scenarioId: 'inTheClutchesOfChaos', scenarioName: '混沌魔掌', arcana: 7, arcanaName: '战车', arcanaNameEn: 'The Chariot' },
  { scenarioId: 'beforeTheBlackThrone', scenarioName: '黑色王座', arcana: 10, arcanaName: '命运之轮', arcanaNameEn: 'Wheel of Fortune' },
])

export const WITCHING_HOUR_DIVINATION_ORDER = Object.freeze(
  WITCHING_HOUR_DIVINATION.map(entry => entry.scenarioId))

export function witchingHourDivination(scenarioId) {
  return WITCHING_HOUR_DIVINATION.find(entry => entry.scenarioId === String(scenarioId)) || null
}

// 占卜牌的弧ana 顺序（正位、固定；给章节建 8 张占卜牌堆/展示用）。
export function witchingHourDivinationArcanas() {
  return WITCHING_HOUR_DIVINATION.map(entry => entry.arcana)
}

// 注册期/测试自检：22 行结果表必须恰好覆盖 0–21，记录键必须在 recordTypes 内。
export function validateTarotTables() {
  const seen = new Set()
  for (const result of PROLOGUE_TAROT_RESULTS) {
    if (!Number.isInteger(result.arcana) || result.arcana < 0 || result.arcana > 21) {
      throw new Error(`序章塔罗表 arcana 越界：${result.arcana}`)
    }
    if (seen.has(result.arcana)) throw new Error(`序章塔罗表重复：${result.arcana}`)
    seen.add(result.arcana)
    if (!PROLOGUE_FATE_RECORDS.includes(result.record)) throw new Error(`序章塔罗表记录无效：${result.record}`)
    if (!Number.isInteger(result.evidence) || result.evidence < 0) throw new Error(`序章塔罗表证据数无效：${result.arcana}`)
  }
  if (seen.size !== 22) throw new Error(`序章塔罗表必须 22 张（收到 ${seen.size}）`)
  for (const key of [...PROLOGUE_FATE_RECORDS, 'missingPersons', 'piecesOfEvidenceWereLeftBehind']) {
    if (!recordTypes[key]) throw new Error(`战役记录未登记：${key}`)
  }
  const divinationSeen = new Set()
  for (const entry of WITCHING_HOUR_DIVINATION) {
    if (divinationSeen.has(entry.scenarioId)) throw new Error(`占卜表章节重复：${entry.scenarioId}`)
    divinationSeen.add(entry.scenarioId)
    if (!Number.isInteger(entry.arcana) || entry.arcana < 0 || entry.arcana > 21) {
      throw new Error(`占卜表 arcana 越界：${entry.arcana}`)
    }
  }
  return { prologueRows: PROLOGUE_TAROT_RESULTS.length, divinationRows: WITCHING_HOUR_DIVINATION.length }
}
