// 《万象无终 · 死亡门前》（At Death's Doorstep，05065）· 卡面数据装配。
//
// 规则事实源：参考实现 `Scenario/Scenarios/TheCircleUndone/AtDeathsDoorstep.hs` +
// `{Act,Agenda,Enemy,Location,Story}/CardDefs|Cards/TheCircleUndone/AtDeathsDoorstep*`。
// 本文件只做「本章怎么用这些卡」：印刷数值/卡文全部来自 `../card-data.js`（ALL_CARDS），
// 行为在 behavior.js（挑战线在测试里直接调钩子）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, printed, stages, encounterCards, encounterDefinitions, encounterDeck,
  storyCards, identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// 印刷卡号（地点 id 与卡号分离：地点 id 是运行期键，卡号是目录身份）。
export const ENTRY_HALL = '05071'
export const VICTORIAN_HALLS = '05072'
export const TROPHY_ROOM = '05073'
export const BILLIARDS_ROOM = '05074'
export const MASTER_BEDROOM = '05075'
export const BALCONY = '05076'
export const OFFICE = '05077'
export const JOSEF = '05085'
export const JOSEFS_PLAN = '05085b'
export const SPECTRAL_WATCHER = '05086'
export const WATCHERS_GRASP = '05087'

// 7 张幽灵面卡（放在一边，幕 1b 时替换对应普通地点；本仓库用 `back` 数据表达）。
export const SPECTRAL_LOCATION_CODES = Object.freeze({
  entryHall: '05078',
  victorianHalls: '05079',
  trophyRoom: '05080',
  billiardsRoom: '05081',
  masterBedroom: '05082',
  balcony: '05083',
  office: '05084',
})

// 幽灵面的闹鬼能力（卡面原文 → P2.1 闭集子句）。翻面时由 behavior.locationFlipped
// 写到地点实例上（`flipSpectral` 只换印刷字段，不换 haunted 数据）。
export const SPECTRAL_HAUNTED = Object.freeze({
  victorianHalls: [{ text: '闹鬼 - 失去 1 个行动。', effect: [{ kind: 'loseAction', amount: 1 }] }],
  trophyRoom: [{ text: '闹鬼 - 失去 2 资源。每有 1 个无法失去的资源，受到 1 点恐惧。',
    effect: [{ kind: 'loseResource', amount: 2, overflowHorror: true }] }],
  billiardsRoom: [{ text: '闹鬼 - 你必须弃掉一个你控制的支援，或受到 1 点伤害。',
    effect: [{ kind: 'choice', options: [
      { id: 'damage', label: '受到 1 点伤害', effect: [{ kind: 'damage', amount: 1 }] },
      { id: 'asset', label: '弃掉一个支援', effect: [{ kind: 'discardAsset', amount: 1 }] },
    ] }] }],
  masterBedroom: [{ text: '闹鬼 - 将你的 1 个线索放到主卧。',
    effect: [{ kind: 'placeClue', amount: 1 }] }],
  balcony: [{ text: '闹鬼 - 你每张带有生命值的卡牌受到 1 点直接伤害。',
    effect: [{ kind: 'damageAssets', amount: 1 }] }],
  office: [{ text: '闹鬼 - 选择并弃掉你一张手牌。',
    effect: [{ kind: 'discardChosen', amount: 1 }] }],
})

// 遭遇组：参考实现 gather（Realm of Death / The Watcher 是 gatherAndSetAside）。
const DECK_GROUPS = [
  'atDeathsDoorstep', 'silverTwilightLodge', 'spectralPredators', 'trappedSpirits',
  'inexorableFate', 'chillingCold',
]
const SET_ASIDE_CODES = [
  JOSEF, SPECTRAL_WATCHER, WATCHERS_GRASP, WATCHERS_GRASP,
  '05105', '05105', '05106', '05106',
  ...Object.values(SPECTRAL_LOCATION_CODES),
]
const setAside = new Set(SET_ASIDE_CODES)
const gathered = encounterCards(DECK_GROUPS).filter(card => !setAside.has(card.code))
// 放一边的卡也要敌人/诡计定义（生成 05086、洗回 05087/05105/05106）：定义表包含它们，
// 但 `encounterDeck` 只放普通组（区域不得重复入牌）。
const extraDefinitions = [...new Set(SET_ASIDE_CODES)]
  .filter(code => ['enemy', 'treachery'].includes(ALL_CARDS[code]?.type))
  .map(code => ALL_CARDS[code])
const definitions = encounterDefinitions([...gathered, ...extraDefinitions])

// 7 个普通地点：符号/连接来自 Haskell 顶部地图（location-map.json 已解析）。
// `back` 是幽灵面（P2.3 数据形状，只换 code/name：翻面保留线索与毁灭）。
const spectralBack = (id) => ({
  code: SPECTRAL_LOCATION_CODES[id],
  name: printed(SPECTRAL_LOCATION_CODES[id]).name,
})
const locations = {
  entryHall: location('entryHall', ENTRY_HALL, {
    symbol: 'square', links: ['t'], back: spectralBack('entryHall'),
  }),
  victorianHalls: location('victorianHalls', VICTORIAN_HALLS, {
    symbol: 't', links: ['square', 'star', 'triangle', 'heart'], back: spectralBack('victorianHalls'),
  }),
  trophyRoom: location('trophyRoom', TROPHY_ROOM, {
    symbol: 'triangle', links: ['t', 'diamond'], back: spectralBack('trophyRoom'),
  }),
  billiardsRoom: location('billiardsRoom', BILLIARDS_ROOM, {
    symbol: 'diamond', links: ['triangle'], back: spectralBack('billiardsRoom'),
  }),
  masterBedroom: location('masterBedroom', MASTER_BEDROOM, {
    symbol: 'heart', links: ['t', 'moon'], back: spectralBack('masterBedroom'),
  }),
  balcony: location('balcony', BALCONY, {
    symbol: 'moon', links: ['heart'], back: spectralBack('balcony'),
  }),
  office: location('office', OFFICE, {
    symbol: 'star', links: ['t'], back: spectralBack('office'),
  }),
}
linkSymbolLocations(locations)

// 本章逐卡规则键（数据驱动）：单卡条目 `flags` 携带同一份键；behavior 先读条目
// （entryFlags），索引未重建时回退本表，所以章节行为不写 `code === '05xxx'` 分支。
export const CARD_RULES = Object.freeze({
  '05066': { advanceRule: 'justiceXI' },
  '05067': { advanceRule: 'overTheThreshold' },
  '05068': { advanceRule: 'hiddenAgendas' },
  '05069': { advanceRule: 'spectralRealm' },
  '05070': { advanceRule: 'escapeTheCage' },
})
export const scenario = {
  id: 'atDeathsDoorstep',
  originalCode: '05065',
  name: '万象无终 · 死亡门前',
  // P9 会从 zh locale 导入整段正文；这里先放同源的中文摘要（审计 storyText 的 fallback 口径）。
  intro: '四人失踪，下落不明。银暮秘社在约瑟夫·梅吉尔的庄园举行慈善晚宴，数名宾客与工作人员在宴会期间凭空消失。'
    + '你带着邀请函走进法兰西山的庄园，想弄清失踪案与那晚树林里的女巫集会之间到底有什么联系——'
    + '而你很快会发现，庄园的走廊与幽灵国度只隔着一层薄雾。',
  setup: '收齐“死亡门前”“银暮秘社”“幽灵捕食者”“被困的灵魂”“在劫难逃”“寒冷刺骨”遭遇组；'
    + '把“冥界”“看守人”两组、约瑟夫·梅吉尔与 7 张幽灵地点放在一边。放置 7 张非幽灵地点，'
    + '全员从入口大厅开始。检查“失踪人口”：未被划掉者对应的地点各放 6 个线索，'
    + '再按“留下的证据”数量尽量平均移除线索。混乱袋加入石板与古神标记。',
  startLocation: 'entryHall',
  locations,
  acts: stages(['05068', '05069', '05070'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    // 推进规则键来自 CARD_RULES（behavior 只按 rule id 分派，不写卡号分支）。
    advanceRule: CARD_RULES[act.originalCode]?.advanceRule || null,
    // 05069 幽灵国度：团队共同支付 4×人数线索（Haskell groupClueCost (PerPlayer 4)）。
    ...(index === 1 ? { objective: { type: 'clues', perInvestigator: 4 } } : {}),
  })),
  agendas: stages(['05066', '05067'], 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
    advanceRule: CARD_RULES[agenda.originalCode]?.advanceRule || null,
  })),
  // 露台（05076）印着 [action] 谈判；入口大厅（05071）印着 [action] 撤退；
  // 两者都在条目 locationRule 里声明，由 behavior.actions 分派。
  scriptCards: {},
  ...definitions,
  storyAssets: storyCards([JOSEFS_PLAN]),
  encounterDeck: encounterDeck(gathered),
  // 05066 的 [tablet] / [elder_thing] 不在 TCU 基础袋里：本章按参考实现的 standaloneChaosTokens 追加。
  chaosBagExtra: ['tablet', 'elderthing'],
  resolutions: {
    noResolution: '未达成任何结局：每位调查员都已撤退或被击败。按本场冒险结束时所在的幕结算：'
      + '幕 1 转结局 2，幕 2 转结局 3，幕 3 转结局 1。',
    r1: '结局 1：你们冲出庄园的庭院，被银暮秘社的打手团团围住。卡尔·桑福德亲自出面，'
      + '请你们为秘社保留体面。剧本日志记录“调查员逃出了幽灵国度”；每位调查员获得等于胜利区卡牌胜利点之和的经验；'
      + '随后进入幕间故事 II：进步的代价。',
    r2: '结局 2：你走出庄园，晚风扑面。关于四起失踪案，你什么也没查出来，甚至开始怀疑这一切根本没什么。'
      + '剧本日志记录“调查员没有发现秘社的阴谋”；获得胜利点经验；跳过幕间故事 II，直接开始冒险 III：隐秘之名。',
    r3: '结局 3：你逃向入口大厅，鬼灵迷雾的障壁却依旧堵住去路。戴兜帽的看守人从雾中现身，'
      + '在它眼中红光闪过的瞬间，你最后的意识也被夺走了。剧本日志记录“调查员就此音讯全无”；'
      + '每位没有撤退的调查员阵亡；获得胜利点经验；跳过幕间故事 II，直接开始冒险 III：隐秘之名。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
