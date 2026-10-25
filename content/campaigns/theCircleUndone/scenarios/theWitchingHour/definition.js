// 巫异时刻（The Witching Hour · 05050）· 剧本数据。
//
// 参考实现：Scenario/Scenarios/TheCircleUndone/TheWitchingHour.hs + Location/Act/Agenda/Enemy
// CardDefs|Cards/TheCircleUndone/TheWitchingHour*。卡面只从 `card-data.js` 取印刷数据，
// 中文剧情只从 zh locale（theWitchingHour.json）取摘要。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

export const ANETTE_MASON = '05057'
export const WITCHES_CIRCLE = '05055b'
export const DAEMONIC_PIPING = '05089'
export const PIPER_OF_AZATHOTH = '05088'
// 核心包「噬魔者之下」的两位黑山羊：由本章 set aside 并按 act1 背面生成。
export const GOAT_SPAWN = '01180'
export const RELENTLESS_DARK_YOUNG = '01179'

// 7 张「女巫作祟之林」：印刷正面同名，背面（unrevealed 数据）给出具体副标题。
export const TaintedWellCode = '05062'
export const OvergrownBarnCode = '05064'
export const WOODS = Object.freeze([
  { id: 'abandonedMine', code: '05058' },
  { id: 'cairnStones', code: '05059' },
  { id: 'theLonelyTree', code: '05060' },
  { id: 'childsTreeHouse', code: '05061' },
  { id: 'taintedWell', code: '05062' },
  { id: 'hermitsHouse', code: '05063' },
  { id: 'overgrownBarn', code: '05064' },
])

// 6 张「阿卡姆密林」（核心包·噬魔者之下）：本章按 setup 把 6 张全部 set aside，
// 由 act1 背面按人数随机放到调查员面前。核心包地点不进 377 张 TCU 记录，但卡池有卡，
// 因此以本章地点 id 声明并引用原卡号（跨内容复用，见 specs/theWitchingHour.md §3-3）。
export const ARKHAM_WOODS = Object.freeze([
  { id: 'arkhamWoodsUnhallowedGround', code: '01150' },
  { id: 'arkhamWoodsTwistingPaths', code: '01151' },
  // 01152 老屋 / 01153 悬崖边 / 01154 一团乱麻：调查改用特定技能（卡面文本），以数据声明。
  { id: 'arkhamWoodsOldHouse', code: '01152', investigateSkill: 'willpower' },
  { id: 'arkhamWoodsCliffside', code: '01153', investigateSkill: 'agility' },
  { id: 'arkhamWoodsTangledThicket', code: '01154', investigateSkill: 'combat' },
  { id: 'arkhamWoodsQuietGlade', code: '01155' },
])

const WOODS_SYMBOL = { symbol: 'squiggle', links: ['squiggle', 'plus'] }

function unrevealedFace(code) {
  const card = ALL_CARDS[code]
  return {
    nameZh: card.nameZh || card.name,
    subnameZh: card.subnameZh || card.subname || '',
    traits: [...(card.traitsZh || card.traits || [])],
    symbol: 'squiggle',
    links: ['squiggle', 'plus'],
  }
}

function woodsLocation(id, code) {
  return location(id, code, {
    ...WOODS_SYMBOL,
    // 正面只印「女巫作祟之林」；副标题在揭示后才出现（unrevealed 保存揭示面数据）。
    subname: '',
    unrevealed: unrevealedFace(code),
  })
}

const locations = {
  ...Object.fromEntries(WOODS.map(entry => [entry.id, woodsLocation(entry.id, entry.code)])),
  // 女巫圆环：act3 背面放置入场（显现时生成安妮特·梅森）。
  witchesCircle: location('witchesCircle', WITCHES_CIRCLE, {
    symbol: 'plus', links: ['squiggle'],
  }),
  // 6 张阿卡姆密林：静态邻接只用于「区域/连接」契约，运行时按面前的组重连。
  ...Object.fromEntries(ARKHAM_WOODS.map((entry, index, list) => {
    const previous = list[index - 1]
    const next = list[index + 1]
    return [entry.id, location(entry.id, entry.code, {
      subname: ALL_CARDS[entry.code]?.subnameZh || '',
      connections: [previous?.id, next?.id].filter(Boolean),
      ...(entry.investigateSkill ? { investigateSkill: entry.investigateSkill } : {}),
    })]
  })),
}
linkSymbolLocations(locations)

const ACT_CODES = ['05053', '05054', '05055', '05056']
const AGENDA_CODES = ['05051', '05052']

// 幕/议程的章节流程数据（按卡号查表，不在 behavior 里写 `code === '05xxxx'` 分支）。
// advanceRule 由 behavior.actions 通用读取；chapterFlow/objectiveRule 是章节流程的规则 id。
const ACT_EXTRA = Object.freeze({
  '05053': {
    chapterFlow: 'resolveLostInTheWoods',
    // act1：轮末团队花费 2×人数线索（引擎 objective + roundEndActIndex）。
    objective: { type: 'clues', perInvestigator: 2 },
  },
  '05054': {
    advanceRule: {
      rule: 'advanceWitchHauntings', perInvestigator: 1,
      label: '🔮 花费 {required} 个线索推进场景（女巫作祟）',
    },
  },
  '05055': {
    advanceRule: {
      rule: 'advancePathsIntoTwilight', perInvestigator: 3, group: true,
      label: '🌒 团队花费 {required} 个线索推进场景（通向曙光）',
    },
  },
  '05056': { objectiveRule: 'aCircleUnbroken' },
})
const AGENDA_EXTRA = Object.freeze({
  // 深夜号叫：轮末每有 1 个圆环内的女巫敌人放 1 毁灭（强制）。
  '05052': { forced: { roundEnd: { type: 'campaignRule' } } },
})

// 遭遇牌库：收齐 6 个组的敌人/诡计；set aside 的卡从牌库里剔除。
const DECK_GROUPS = [
  'theWitchingHour', 'anettesCoven', 'cityOfSins', 'witchcraft', 'ancientEvils', 'strikingFear',
]
const SET_ASIDE_CODES = new Set([ANETTE_MASON, PIPER_OF_AZATHOTH, DAEMONIC_PIPING, GOAT_SPAWN, RELENTLESS_DARK_YOUNG])
const deckCards = encounterCards(DECK_GROUPS).filter(card => !SET_ASIDE_CODES.has(card.code))
const definitions = encounterDefinitions([
  ...deckCards,
  ...[...SET_ASIDE_CODES].map(code => ALL_CARDS[code]),
])

export const scenario = {
  id: 'theWitchingHour',
  originalCode: '05050',
  name: '万象无终 · 巫异时刻',
  // 文案事实源：参考资源 frontend/locales/zh/theCircleUndone/scenarios/theWitchingHour.json。
  intro: '十一月的阿卡姆，安娜·卡斯洛为你摆开塔罗牌阵；最后一张「高塔·XVI」让在场所有人都安静下来。'
    + '「你看见了自己未来的命运吗？」她问道。雷声轰鸣，你在一处树木繁茂的小路上醒来，雨水浸透全身，视野里一个人都没有。'
    + '远处，女巫们的咒歌正顺着林间小径飘来。',
  setup: '收齐巫异时刻、安妮特的女巫集会、罪恶之城、巫法、远古恶魔、恐惧打击与地底噬魔（只收 6 张阿卡姆密林）遭遇组；'
    + '把阿撒托斯的使徒与莎布·尼古拉斯的使徒放在一边，位于场外。按玩家顺序把 5 张女巫作祟之林随机放到调查员面前；'
    + '其余女巫作祟之林移出游戏。把每张阿卡姆密林地点与安妮特·梅森放在一边。每位调查员随机从自己面前的地点开始游戏。'
    + '密谋牌库：节制·XIV、深夜号叫。场景牌库：森林迷途、女巫作祟、通向曙光、未毁之环。',
  startLocation: 'abandonedMine',
  locations,
  // 女巫圆环 + 6 张阿卡姆密林：setup 时放在一边；7 张森林中未抽到的 2 张在运行时移出游戏。
  setAsideLocations: ['witchesCircle', ...ARKHAM_WOODS.map(entry => entry.id)],
  agentSets: {
    agentsOfAzathoth: [PIPER_OF_AZATHOTH, DAEMONIC_PIPING, DAEMONIC_PIPING, DAEMONIC_PIPING],
    agentsOfShubNiggurath: [RELENTLESS_DARK_YOUNG, GOAT_SPAWN, GOAT_SPAWN, GOAT_SPAWN],
  },
  acts: stages(ACT_CODES, 'act').map(act => ({
    ...act,
    reveal: { type: 'campaignRule' },
    ...(ACT_EXTRA[act.originalCode] || {}),
  })),
  agendas: stages(AGENDA_CODES, 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
    ...(AGENDA_EXTRA[agenda.originalCode] || {}),
  })),
  // 05054 的 [fast] 能力：一位调查员花费 1×人数线索推进场景（归 act 脚本卡）。
  scriptCards: {
    rules: { advanceWitchHauntings: { card: 'act', codes: ['05054'] } },
  },
  ...definitions,
  storyAssets: storyCards([]),
  encounterDeck: encounterDeck(deckCards),
  resolutions: {
    noResolution: '未达成任何结局：若冒险结束时的场景为场景 4，转至结局 4（女巫的法术成功施放）；'
      + '否则转至结局 3（同样记录法术成功施放，场景 3 时另有遗留记忆）。',
    resolution1: '你打败了安妮特·梅森，女巫集会从树林中现身却未再动手。'
      + '记录「女巫的法术被破坏」，在遗留记忆下记录「催眠长笛」「仪式道具」；每位调查员获得 1 点奖励经验。',
    resolution2: '你打破了女巫圆环，法术反噬了施术者。记录「女巫的法术被破坏」，'
      + '在遗留记忆下记录「催眠长笛」「残影碎片」；每位调查员获得 1 点奖励经验。',
    resolution3: '你力竭倒地，异界的笛声击碎了你的意识。记录「女巫的法术成功施放」；'
      + '若冒险结束时的场景为场景 3，在遗留记忆下记录「催眠长笛」并各得 1 点奖励经验。',
    resolution4: '安妮特命令女巫们把你拖到树林边缘，你在绞刑者河边醒来。'
      + '记录「女巫的法术成功施放」，在遗留记忆下记录「催眠长笛」；每位调查员获得 1 点奖励经验。',
    resolution5: '女巫们完成了最后的仪式；只有伊琳留了下来，要你在祖先长眠之地与她相见。'
      + '记录「女巫的法术成功施放」「伊琳想要见面」，在遗留记忆下记录「催眠长笛」「奇异咒文」；每位调查员获得 3 点奖励经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
