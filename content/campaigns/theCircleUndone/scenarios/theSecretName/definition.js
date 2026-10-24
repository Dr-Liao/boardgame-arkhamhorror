// 隐秘之名（The Secret Name · 05120）· 剧本数据。
//
// 参考实现：Scenario/Scenarios/TheCircleUndone/TheSecretName.hs + Location/Act/Agenda/Enemy/
// Treachery CardDefs|Cards/TheCircleUndone/TheSecretName*。卡面只从 `card-data.js` 取印刷数据，
// 中文剧情只从 zh locale（theSecretName.json）取摘要。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

export const NAHAB = '05149'
export const BROWN_JENKIN = '05148'
export const THE_BLACK_BOOK = '05150'
export const GHOSTLY_PRESENCE = '05144'
export const STRANGE_GEOMETRY = '05142'
export const SWARM_OF_RATS = '01159'
export const MOLDY_HALLS = '05128'
export const WALTER_GILMANS_ROOM = '05132'
export const KEZIAHS_ROOM = '05133'
export const SITE_OF_THE_SACRIFICE = '05141'

// 15 张地点：9 张巫宅（含 3 张未揭示的破旧房门）+ 7 张异次元「未知地点」+ 古怪图形（2 张副本）。
// `unrevealed` 保存**揭示面**数据（参考 location-map.json）：未揭示时只显示正面名称/符号。
export const LOCATION_ENTRIES = Object.freeze([
  { id: 'moldyHalls', code: MOLDY_HALLS, symbol: 'triangle', links: ['plus', 'circle', 'heart', 'square', 'diamond'] },
  {
    id: 'walterGilmansRoom', code: WALTER_GILMANS_ROOM, symbol: 'square', links: ['triangle'],
    // 揭示面就是它自己；锁定入场的额外费用写在 locationRule.entryError。
  },
  {
    id: 'landlordsQuarters', code: '05129', frontName: '破旧房门', symbol: 'plus', links: ['triangle'],
    unrevealed: { nameZh: '屋主的住处', symbol: 'circle', links: ['triangle'] },
  },
  {
    id: 'joeMazurewiczsRoom', code: '05130', frontName: '破旧房门', symbol: 'plus', links: ['triangle'],
    unrevealed: { nameZh: '乔·马祖尔维奇的房间', symbol: 'heart', links: ['triangle'] },
  },
  {
    id: 'frankElwoodsRoom', code: '05131', frontName: '破旧房门', symbol: 'plus', links: ['triangle'],
    unrevealed: { nameZh: '弗兰克·埃尔伍德的房间', symbol: 'diamond', links: ['triangle'] },
  },
  {
    id: 'moldyHallsEarlierTonight', code: '05134', frontName: '未知地点', symbol: 'moon', links: ['square'],
    unrevealed: { nameZh: '发霉的走道', subnameZh: '今晚早些时候', traitsZh: ['异次元', '巫宅'], symbol: 'moon', links: ['square'] },
  },
  {
    id: 'twilightAbyss', code: '05135', frontName: '未知地点', symbol: 'moon', links: ['square'], victory: 1,
    unrevealed: { nameZh: '暮光深渊', traitsZh: ['异次元', '异界'], symbol: 'equals', links: ['square', 'squiggle'] },
  },
  {
    id: 'cityOfElderThings', code: '05136', frontName: '未知地点', symbol: 'moon', links: ['square'], victory: 1,
    unrevealed: { nameZh: '古老者之城', traitsZh: ['异次元', '异界'], symbol: 'moon', links: ['square'] },
  },
  {
    id: 'salemGaol1692', code: '05138', frontName: '未知地点', symbol: 'moon', links: ['square'],
    unrevealed: { nameZh: '1692年的塞勒姆监狱', traitsZh: ['异次元', '塞勒姆'], symbol: 'moon', links: ['square'] },
  },
  {
    id: 'physicsClassroom', code: '05139', frontName: '未知地点', symbol: 'moon', links: ['square'], victory: 1,
    unrevealed: { nameZh: '物理教室', traitsZh: ['异次元', '米斯卡塔尼克'], symbol: 'moon', links: ['square'] },
  },
  {
    id: 'courtOfTheGreatOldOnes', code: '05140', frontName: '未知地点', symbol: 'moon', links: ['square'], victory: 1,
    unrevealed: { nameZh: '旧日支配者皇廷', subnameZh: '不远的将来', traitsZh: ['异次元', '异界'], symbol: 'squiggle', links: ['square', 'equals'] },
  },
  {
    id: 'witchHouseRuins', code: '05137', frontName: '未知地点', symbol: 'moon', links: ['square'],
    unrevealed: { nameZh: '巫宅遗址', traitsZh: ['异次元', '巫宅'], symbol: 'hourglass', links: ['square', 't'] },
  },
  { id: 'keziahsRoom', code: KEZIAHS_ROOM, symbol: 'square', links: ['moon', 'hourglass', 't', 'equals', 'squiggle'], spectral: true },
  { id: 'siteOfTheSacrifice', code: SITE_OF_THE_SACRIFICE, symbol: 't', links: ['hourglass'] },
  { id: 'strangeGeometry1', code: STRANGE_GEOMETRY, connections: ['moldyHalls'] },
  { id: 'strangeGeometry2', code: STRANGE_GEOMETRY, connections: ['moldyHalls'] },
])

// 闹鬼（P2.1 闭集子句）：文本取自卡面，需要章节脚本的两条用 `script` 交给 behavior.hauntedScript。
const HAUNTED_BY_ID = Object.freeze({
  moldyHalls: [{ text: '闹鬼 - 失去 3 资源。', effect: [{ kind: 'loseResource', amount: 3 }] }],
  landlordsQuarters: [{
    text: '闹鬼 - 查找遭遇牌库和遭遇弃牌堆，找出一张鼠群并将其生成在发霉的走道。混洗遭遇牌库。',
    effect: [{ kind: 'script', id: 'landlordsQuartersRats' }],
  }],
  joeMazurewiczsRoom: [{
    text: '闹鬼 - 你必须受到 1 点恐惧，或选择并弃掉 1 个你控制的支援。',
    effect: [{
      kind: 'choice', prompt: '乔·马祖尔维奇的房间（闹鬼）',
      options: [
        { id: 'horror', label: '受到 1 点恐惧', effect: [{ kind: 'horror', amount: 1 }] },
        { id: 'discardAsset', label: '弃掉一个你控制的支援', effect: [{ kind: 'discardAsset', amount: 1 }] },
      ],
    }],
  }],
  frankElwoodsRoom: [{
    text: '闹鬼 - 你必须将你的 1 个线索放在弗兰克·埃尔伍德的房间上，或在当前密谋上放置 1 个毁灭标记。',
    effect: [{
      kind: 'choice', prompt: '弗兰克·埃尔伍德的房间（闹鬼）',
      options: [
        { id: 'placeClue', label: '将 1 个线索放在此地点', effect: [{ kind: 'placeClue', amount: 1 }] },
        { id: 'agendaDoom', label: '在当前密谋上放置 1 个毁灭标记', effect: [{ kind: 'doom', target: 'agenda', amount: 1 }] },
      ],
    }],
  }],
  keziahsRoom: [{
    text: '闹鬼 - 从遭遇牌库顶弃牌，直到弃到一张巫术卡牌。抽取该卡牌。',
    effect: [{ kind: 'script', id: 'keziahsRoomHex' }],
  }],
  salemGaol1692: [{
    text: '闹鬼 - 移动到凯夏的房间。',
    effect: [{ kind: 'moveTo', locationId: 'keziahsRoom' }],
  }],
  courtOfTheGreatOldOnes: [{
    text: '闹鬼 - 你本轮执行的下一个行动必须是调查行动。',
    effect: [{ kind: 'script', id: 'courtMustInvestigate' }],
  }],
  siteOfTheSacrifice: [{
    text: '闹鬼 - 你必须在那赫卜上面放置 1 个毁灭标记，或那赫卜攻击你。',
    effect: [{
      kind: 'choice', prompt: '献祭场所（闹鬼）',
      options: [
        { id: 'placeDoom', label: '在那赫卜上放置 1 个毁灭标记', effect: [{ kind: 'doom', target: 'enemy', code: NAHAB, amount: 1 }] },
        { id: 'nahabAttacks', label: '那赫卜攻击你', effect: [{ kind: 'attack', target: 'code', code: NAHAB }] },
      ],
    }],
  }],
  witchHouseRuins: [{ text: '闹鬼 - 失去 1 次行动。', effect: [{ kind: 'loseAction', amount: 1 }] }],
  walterGilmansRoom: [{
    text: '闹鬼 - 弃掉遭遇牌库顶的 2 张卡牌。',
    effect: [{ kind: 'script', id: 'walterGilmansRoomDiscard' }],
  }],
})

function locationDefinition(entry) {
  const card = ALL_CARDS[entry.code]
  return location(entry.id, entry.code, {
    ...(entry.frontName ? { name: entry.frontName } : {}),
    ...(entry.symbol ? { symbol: entry.symbol, links: entry.links || [] } : {}),
    ...(entry.connections ? { connections: entry.connections } : {}),
    ...(entry.spectral ? { spectral: true } : {}),
    ...(entry.victory ? { victory: entry.victory } : {}),
    ...(HAUNTED_BY_ID[entry.id] ? { haunted: HAUNTED_BY_ID[entry.id] } : {}),
    // 未揭示的「破旧房门/未知地点」正面只印通用名，揭示面数据在 unrevealed 里。
    ...(entry.unrevealed ? { subname: '', unrevealed: { ...entry.unrevealed } } : {}),
    ...(entry.code === STRANGE_GEOMETRY ? { subname: '' } : {}),
  })
}

const locations = Object.fromEntries(LOCATION_ENTRIES.map(entry => [entry.id, locationDefinition(entry)]))
linkSymbolLocations(locations)

// 未知地点牌库的 7 张（6 张随机池 + 巫宅遗址）。
export const UNKNOWN_PLACES = Object.freeze([
  'moldyHallsEarlierTonight', 'twilightAbyss', 'cityOfElderThings',
  'salemGaol1692', 'physicsClassroom', 'courtOfTheGreatOldOnes',
])
export const UNKNOWN_PLACES_WITH_RUINS = Object.freeze([...UNKNOWN_PLACES, 'witchHouseRuins'])

const DECK_GROUPS = [
  'theSecretName', 'cityOfSins', 'inexorableFate', 'realmOfDeath', 'witchcraft',
]
// 放一边：那赫卜、黑书、2 张鬼影骤现（章节 05144 全部副本）。布朗·詹金也可被「找出」，
// 因此定义里保留他的印刷数据，但同样列在 set aside 区（manifest 张数一致）。
const SET_ASIDE_CODES = new Set([NAHAB, BROWN_JENKIN, THE_BLACK_BOOK, GHOSTLY_PRESENCE])
// 老鼠遭遇组只有 Swarm of Rats（01159，数量 3）：encounterDeck 会按印刷 quantity 展开。
const rats = ALL_CARDS[SWARM_OF_RATS]
const deckCards = [
  ...encounterCards(DECK_GROUPS).filter(card => !SET_ASIDE_CODES.has(card.code)),
  rats,
]
const definitions = encounterDefinitions([
  ...deckCards,
  ALL_CARDS[NAHAB], ALL_CARDS[BROWN_JENKIN],
  // 2 张鬼影骤现：背面/后续效果把它们洗入遭遇牌库，因此定义里必须有它们。
  ALL_CARDS[GHOSTLY_PRESENCE], ALL_CARDS[GHOSTLY_PRESENCE],
])

// 幕的团队线索推进数据（behavior.actions 通用读取；不按卡号写分支）。
// act1：所有未击败调查员都在沃尔特房间，团队线索支付；act2：只有巫宅遗址的调查员支付。
const ACT_EXTRA = Object.freeze({
  '05125': {
    advanceRule: {
      rule: 'advanceInvestigatingTheWitchHouse', perInvestigator: 3,
      allAtLocationId: 'walterGilmansRoom',
      label: '🔍 共同花费 {required} 个线索推进场景（探访巫宅）',
    },
  },
  '05126': {
    advanceRule: {
      rule: 'advanceBeyondTheWitchHouse', perInvestigator: 5,
      payAtLocationId: 'witchHouseRuins',
      label: '🏚️ 巫宅遗址的调查员共同花费 {required} 个线索推进场景（巫宅之外）',
    },
  },
})

// 威胁区卡的「回合结束强制」由 definition 声明规则 id（behavior.turnEnded 通用分派）。
const THREAT_TURN_END = Object.freeze({
  '05146': 'pulledByTheStars',
  '05147': 'disquietingDreams',
})

export const scenario = {
  id: 'theSecretName',
  originalCode: '05120',
  name: '万象无终 · 隐秘之名',
  intro: '银暮秘社的书房里，卡尔·桑福德听你讲述森林里的女巫与法阵。他提到一个名字：凯夏·梅森。'
    + '两百多年前从塞勒姆逃出的女巫，据说她的幽灵仍在法兰西山的「巫宅」出没。'
    + '你要找的答案，或许就藏在那栋老房子里。',
  setup: '收齐隐秘之名、罪恶之城、在劫难逃、冥界、巫法与老鼠遭遇组。将发霉的走道、沃尔特·吉尔曼的房间，'
    + '以及 3 张破旧房门地点放置入场；每位调查员从发霉的走道开始游戏。'
    + '将 7 张「未知地点」按规则组成未知地点牌库（巫宅遗址与 3 张随机牌放底部，其余 3 张放顶部，全部未揭示面朝上）。'
    + '把那赫卜、献祭场所、凯夏的房间、黑书、2 张古怪图形、2 张鬼影骤现放在一边。'
    + '密谋牌库：隐士·IX、魔宠、巫异光芒、献祭标志。场景牌库：探访巫宅、巫宅之外、阻止仪式。',
  startLocation: 'moldyHalls',
  locations,
  setAsideLocations: ['siteOfTheSacrifice', 'keziahsRoom', 'strangeGeometry1', 'strangeGeometry2'],
  acts: stages(['05125', '05126', '05127'], 'act').map(act => ({
    ...act,
    reveal: { type: 'campaignRule' },
    ...(ACT_EXTRA[act.originalCode] || {}),
  })),
  agendas: stages(['05121', '05122', '05123', '05124'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  // 威胁区卡的回合结束强制（behavior.turnEnded 读数据分派，不按卡号写分支）。
  threatTurnEnd: THREAT_TURN_END,
  // act1/act2 的团队线索推进（回合中，同地点团队支付）归幕脚本卡。
  scriptCards: {
    rules: {
      advanceInvestigatingTheWitchHouse: { card: 'act', codes: ['05125'] },
      advanceBeyondTheWitchHouse: { card: 'act', codes: ['05126'] },
    },
  },
  ...definitions,
  storyAssets: storyCards([THE_BLACK_BOOK]),
  // 卡面/参考实现：本章混乱袋含 1 个石板与 1 个古神标记（战役连续性下由死亡门前带入；
  // 独立/战役重建袋都保证存在，避免 setupChaosBag 重建后丢失）。
  chaosBagExtra: ['tablet', 'elderthing'],
  encounterDeck: encounterDeck(deckCards),
  resolutions: {
    noResolution: '你被拖行在肮脏的木质地板上，画面闪过脑海：污秽的仪式、那栋房子、那赫卜、盘旋的黑色漩涡。'
      + '你没能阻止某些可怕的事情发生（→ 结局 1）。',
    resolution1: '你在巫宅前的草地上醒来。你知道了凯夏·梅森的一些信息，但再也没有勇气回到那栋可怕的房子。'
      + '若冒险结束时的场景为场景 2，在遗留记忆下记录「吉尔曼的日记」；场景 3 再记录「凯夏的公式」。'
      + '任意一位调查员可以选择把黑书支援加入其牌库（不计入牌组张数），若如此做混乱袋加入 1 个骷髅标记。',
    resolution2: '你醒在沃尔特·吉尔曼房间的木地板上。角落里有东西在闪光——一枚磨损的镀镍十字架。'
      + '在遗留记忆下记录「吉尔曼的日记」「凯夏的公式」「磨损的十字架」；任意一位调查员可以选择把黑书加入牌库'
      + '（混乱袋 +1 骷髅标记）。调查员们得知阿卡姆神秘的往昔，各获得 2 点奖励经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
