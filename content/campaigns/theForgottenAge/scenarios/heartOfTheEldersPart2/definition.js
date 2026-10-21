import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor,
  linkSymbolLocations,
} from '../../card-data.js'

// Haskell setup（HeartOfTheElders.hs，scenarioStep Two）：收齐 K'n-yan、Heart of the
// Elders、Agents of Yig、Yig's Venom、Forgotten Ruins、Deadly Traps 与 Poison；把深入
// 幽嘶、未进入牌组的中毒弱点与「the jungle watches」列出的卡牌分别放在一边／胜利区。
const deckGroups = ['knyan', 'sharedHeartOfTheElders', 'agentsOfYig', 'venom', 'ruins', 'traps', 'poison']
// 中毒（04102）是弱点，不进遭遇牌库；未进入牌组的副本按印刷放在一边。
const gathered = encounterCards(deckGroups).filter(card => card.code !== '04102')
const SET_ASIDE_CARDS = ['04227', '04062', '04102', '04102', '04102', '04102']
const definitions = encounterDefinitions([
  ...gathered, ...SET_ASIDE_CARDS.map(code => ALL_CARDS[code]),
])
// 04062 只作为战役放一边的敌人回到本关（它在埃兹特里的覆灭里被放在一边）；
// 「生命值 10[per_investigator]、复仇 5」由 card-data.js 的 ENEMY_RULES 提供。

// 探索牌库：K'n-yan 的 5 处单面地点 + 各 1 张印刷指定的诡计。
export const EXPLORATION_LOCATIONS = [
  'vastPassages', 'hallOfIdolatry', 'darkHollow', 'perilousGulch', 'crystalPillars',
]
export const EXPLORATION_TREACHERIES = {
  pitfall: '04215',
  noTurningBack: '04228',
  deepDark: '04094',
  finalMistake: '04088',
}
export const DESCENT_TO_YOTH = '04227'
export const HARBINGER = '04062'

// 印刷的诡计数量固定：建探索牌库时从遭遇牌库总量里各取走 1 张，避免凭空多出卡牌。
const deckCodes = encounterDeck(gathered)
for (const code of Object.values(EXPLORATION_TREACHERIES)) {
  const index = deckCodes.indexOf(code)
  if (index >= 0) deckCodes.splice(index, 1)
}

// 地点符号来自 Location/CardDefs/TheForgottenAge/HeartOfTheElders.hs。本关使用
// 昆扬之口系列卡 04206 的背面「深藏其下（04206b）」，它的相连符号是圆形／三角／菱形。
const locations = {
  mouthOfKnYan: location('mouthOfKnYan', '04206b', {
    symbol: 'equals', links: ['circle', 'triangle', 'diamond'],
  }),
  vastPassages: location('vastPassages', '04222', {
    symbol: 'circle', links: ['equals', 'triangle', 'diamond', 'square', 'moon'],
  }),
  hallOfIdolatry: location('hallOfIdolatry', '04223', {
    symbol: 'square', links: ['heart', 'triangle', 'circle'],
  }),
  darkHollow: location('darkHollow', '04224', {
    symbol: 'triangle', links: ['equals', 'circle', 'square'],
  }),
  perilousGulch: location('perilousGulch', '04225', {
    symbol: 'diamond', links: ['equals', 'circle', 'moon'],
  }),
  crystalPillars: location('crystalPillars', '04226', {
    symbol: 'moon', links: ['heart', 'diamond', 'circle'],
  }),
  descentToYoth: location('descentToYoth', '04227', {
    symbol: 'heart', links: ['square', 'moon'],
  }),
}
linkSymbolLocations(locations)

export const scenario = {
  id: 'heartOfTheEldersPart2',
  originalCode: '04205',
  name: '久远腹地（下）',
  intro: '柱子上的凹槽终于对齐，昆扬之口在你们面前张开。你们踏着向下的石阶走进黑暗，'
    + '身后的丛林声息渐远，前方是蛇族逃离瓦卢西亚时留下的城市。',
  setup: '收齐“昆扬、久远腹地、伊格的使徒、伊格的毒液、被遗忘的废墟、致命陷阱、毒素”遭遇组；'
    + '把深入幽嘶、未进入牌组的中毒弱点放在一边；把剧本日志“丛林在注视”列出的卡牌放进胜利区。'
    + '昆扬之口（深藏其下）入场并作为起始地点。建立探索牌库（5 处昆扬地点 + 落入陷阱、无路可退、'
    + '一片漆黑、致命错误各 1 张）。',
  startLocation: 'mouthOfKnYan',
  locations,
  acts: stages(['04213', '04214'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    // 失落时代的洞穴：每位调查员共同支付 3 个线索。
    ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 3 } } : {}),
  })),
  agendas: stages(['04211', '04212'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  // 04211/04212 印着 [action]：探索（仅当地点无线索时）。
  scriptCards: { explore: { card: 'agenda' } },
  ...definitions,
  encounterDeck: deckCodes,
  resolutions: {
    noResolution: '你们在昆扬的石室里醒来，比之前更深、更冷。红光照着石柱，也照着那扇被推开的石门。'
      + '检查剧本日志：如果调查员解救了亚历山卓，前往结局 1；如果亚历山卓已失踪，前往结局 2。'
      + '（本实现按同一份记录继续结算结局 1／2 的复仇、预示者与经验。）',
    r1: '亚历山卓在幽嘶的入口迎接你们，眼中满是狂热。“终于！幽嘶，蛇族的洞穴！那些逃离瓦卢西亚毁灭的受诅咒者！”'
      + '他身后的黑暗里，十尺高、四条长短不一附肢的异形生物爬了出来。“取走他们的心智，”亚历山卓下令，'
      + '“我们不再需要他们了。”这是你们作为人类的最后一段记忆。'
      + '如果预示者本关入场：它在胜利区则划掉“预示者还活着”，否则在括号里记下它受到的伤害。'
      + '胜利区每有 1 点复仇，在“伊格之怒”下记 1 笔勾。获得等于胜利区胜利点数的经验。',
    r2: '你们还没能跨进洞穴的下一层，身后就响起爪甲相击的声音。十尺高、四条长短不一附肢的异形生物从黑暗中走出，'
      + '而它们的领头者是亚历山卓·维拉。“取走他们的心智，”他下令，“我们不再需要他们了。”'
      + '这是你们作为人类的最后一段记忆。'
      + '如果预示者本关入场：它在胜利区则划掉“预示者还活着”，否则在括号里记下它受到的伤害。'
      + '胜利区每有 1 点复仇，在“伊格之怒”下记 1 笔勾。获得等于胜利区胜利点数的经验。',
  },
}

export const identities = identitiesFor(scenario)
// 目录只登记了 04206（正面）→ 04206b（背面）的单向链接；本关使用的是背面
// 「深藏其下」，手动补回另一面，让 manifest 记录这张双面地点的真实身份。
identities.locations.mouthOfKnYan.linkedOriginalCode ||= '04206'
bindScenarioIdentities(scenario, identities)
