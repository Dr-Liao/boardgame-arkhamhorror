// 05238《聚合幻灭》（Union and Disillusion）
//
// 规则事实源：参考实现 `Scenario/Scenarios/TheCircleUndone/UnionAndDisillusion.hs` +
// `{Act,Agenda,Enemy,Treachery,Story}/CardDefs|Cards/TheCircleUndone/UnionAndDisillusion` +
// `Location/CardDefs|Cards/TheCircleUndone/UnionAndDisillusion`。
// 印刷数据只从战役 card-data.js 读取。
//
// 本章要点（规格见 artifacts/migration/tcu/p8/specs/unionAndDisillusion.md）：
//   · 序章二选一：支持秘社 / 支持女巫集会（写战役记录，决定幕 3/4 版本与火盆初始状态）；
//   · 阵法（P2.5）：05250–05257 的 Circle 行动，2–4 技能求和检定 + actionKind:'circle'；
//   · 火盆（P2.11）：locationFlag 'brazier'，成功阵法后点燃/熄灭；
//   · 4 张命运剧情卡（05262–05265）：没有「冒险参考牌底」原语 → state.scenarioFlags.fateCards；
//   · 幽灵敌人：命运敌人 05262b–05265b + 夜鹰/幽灵乌鸦；幽灵看守人 05086 被击败不弃掉。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'
import {
  INTRO, SETUP, RESOLUTION_NO, RESOLUTION_1, RESOLUTION_2, RESOLUTION_3, RESOLUTION_4,
  RESOLUTION_5, RESOLUTION_6, RESOLUTION_7, RESOLUTION_8, RESOLUTION_9, RESOLUTION_10,
} from './story-text.js'

// ---- 卡号常量 -----------------------------------------------------------------
export const SCENARIO_CARD = '05238'
// 地点
export const MISKATONIC_RIVER = '05249'
export const FORBIDDING_SHORE = '05250'
export const UNVISITED_ISLES = Object.freeze({
  standingStones: '05251',
  mistyClearing: '05252',
  forsakenWoods: '05253',
  mossCoveredSteps: '05254',
  hauntedSpring: '05255',
  decayedWillow: '05256',
})
export const GEIST_TRAP = '05257'
export const ISLE_CODES = Object.freeze(Object.values(UNVISITED_ISLES))
// 幕/议程
export const ACT_UNVISITED_ISLE = '05241'
export const ACT_FATED_SOULS = '05242'
export const ACT_BEYOND_V1 = '05243'
export const ACT_BEYOND_V2 = '05244'
export const ACT_BEYOND_V3 = '05245'
export const ACT_BEYOND_V4 = '05246'
export const ACT_BINDING_RITE = '05247'
export const ACT_BROKEN_RITE = '05248'
export const AGENDA_LOVERS = '05239'
export const AGENDA_CROSSROADS = '05240'
// 敌人 / 诡计 / 剧情资产
export const WHIPPOORWILL = '05266'
export const SPECTRAL_RAVEN = '05267'
export const TREACHERY_CODES = Object.freeze({
  eagerForDeath: '05268', psychopompsSong: '05269', deathApproaches: '05270',
  markedForDeath: '05271', watchersGaze: '05272',
})
export const FATE_ENEMIES = Object.freeze({
  加弗瑞拉: { story: '05262', enemy: '05262b', ally: '05258', person: '05046', trail: 'theInvestigatorsAreOnGavriellasTrail', alive: 'gavriellaIsAlive', dead: 'gavriellaIsDead' },
  杰罗姆: { story: '05263', enemy: '05263b', ally: '05259', person: '05047', trail: 'theInvestigatorsAreOnJeromesTrail', alive: 'jeromeIsAlive', dead: 'jeromeIsDead' },
  佩妮: { story: '05264', enemy: '05264b', ally: '05260', person: '05048', trail: 'theInvestigatorsAreOnPennysTrail', alive: 'pennyIsAlive', dead: 'pennyIsDead' },
  瓦伦蒂诺: { story: '05265', enemy: '05265b', ally: '05261', person: '05049', trail: 'theInvestigatorsAreOnValentinosTrail', alive: 'valentinoIsAlive', dead: 'valentinoIsDead' },
})
export const FATE_LIST = Object.freeze(Object.entries(FATE_ENEMIES).map(([name, data]) => ({ name, ...data })))
export const THE_SPECTRAL_WATCHER = '05086'
export const ANETTE_MASON = '05057'
export const JOSEF_MEIGER = '05085'
export const COVEN_INITIATE = '05090'
export const LODGE_NEOPHYTE = '05095'
export const KEEPER_OF_SECRETS = '05096'

// ---- 遭遇牌库 -----------------------------------------------------------------
// 参考实现收齐：UAD + 在劫难逃 + 冥界 + 幽灵捕食者 + 远古恶魔 + 寒冷刺骨；
// 后两个核组不在 TCU 21 个遭遇组里（见 gaps）。安妮特的女巫集会 / 银暮秘社 / 看守人
// 三组整组放在一边（act 3 背面会洗回），不是初始牌堆。
const deckGroups = ['unionAndDisillusion', 'inexorableFate', 'realmOfDeath', 'spectralPredators']
// 命运卡背面敌人与看守人的注视不在初始遭遇牌库；它们由 setup 放在一边。
const setAsideCodes = [
  TREACHERY_CODES.watchersGaze,
  FATE_ENEMIES.加弗瑞拉.enemy, FATE_ENEMIES.杰罗姆.enemy,
  FATE_ENEMIES.佩妮.enemy, FATE_ENEMIES.瓦伦蒂诺.enemy,
]
const setAside = new Set(setAsideCodes)
const gathered = encounterCards(deckGroups).filter(card => !setAside.has(card.code))
const definitions = encounterDefinitions([
  ...gathered,
  ...setAsideCodes.map(code => ALL_CARDS[code]),
  // 共享组敌人：整组放在一边，act 3 背面生成（含黑暗异教徒/女巫集会/看守人）。
  ...[THE_SPECTRAL_WATCHER, ANETTE_MASON, JOSEF_MEIGER, COVEN_INITIATE, LODGE_NEOPHYTE, KEEPER_OF_SECRETS]
    .map(code => ALL_CARDS[code]),
])

// 印刷卡面修正。
Object.assign(definitions.enemies[SPECTRAL_RAVEN], { prey: 'lowestIntellect' })
for (const fate of FATE_LIST) Object.assign(definitions.enemies[fate.enemy], { victory: 0 })
// 印刷卡面修正：catalog 的 en.json 对三张命运敌人缺 enemy_horror 字段，导致 cards-data 记为 0；
// 参考实现 Enemy/CardDefs/TheCircleUndone/UnionAndDisillusion.hs 明确 cdSanityDamage：
// 05263b（杰罗姆）=1、05264b（佩妮）=2、05265b（瓦伦蒂诺）=1。05262b（加弗瑞拉）参考无该字段，保持 0。
Object.assign(definitions.enemies['05263b'], { horror: 1 })
Object.assign(definitions.enemies['05264b'], { horror: 2 })
Object.assign(definitions.enemies['05265b'], { horror: 1 })
Object.assign(definitions.enemies[THE_SPECTRAL_WATCHER], { spectral: true })

// ---- 地点 ---------------------------------------------------------------------
// 符号与连线取自 Location/CardDefs/TheCircleUndone/UnionAndDisillusion.hs。
// 未访之岛 6 张与灵怪陷阱入场时都未揭示：入口受「鬼灵迷雾」限制（behavior.investigatorEntryError）。
const SHORE_HAUNTED = [{
  text: '闹鬼 - 你必须失去 1 次行动或失去 2 点资源。',
  effect: [{
    kind: 'choice',
    options: [
      { id: 'action', label: '失去 1 次行动', effect: [{ kind: 'loseAction', amount: 1 }] },
      { id: 'resource', label: '失去 2 点资源', effect: [{ kind: 'loseResource', amount: 2 }] },
    ],
  }],
}]
const MISTY_CLEARING_HAUNTED = [{
  text: '闹鬼 - 你必须在本地点上放置 1 个毁灭标记，或受到 1 点伤害和 1 点恐惧。',
  effect: [{
    kind: 'choice',
    options: [
      { id: 'doom', label: '在本地点放置 1 个毁灭', effect: [{ kind: 'doom', amount: 1, target: 'location' }] },
      { id: 'harm', label: '受到 1 点伤害和 1 点恐惧', effect: [{ kind: 'damage', amount: 1 }, { kind: 'horror', amount: 1 }] },
    ],
  }],
}]
// 闹鬼 - 你必须弃掉你控制的一张支援，或受到 1 点伤害。
// 用 script 而非 choice：choice 子句会把不可结算的选项也交给玩家（没有支援时选「弃支援」会以空选项抛错，
// 同时规避本应承受的伤害）；script 由 behavior.hauntedScript 过滤合法选项（参考 HauntedSpring.hs:48-53 同口径）。
const HAUNTED_SPRING_HAUNTED = [{
  text: '闹鬼 - 你必须弃掉你控制的一张支援，或受到 1 点伤害。',
  effect: [{ kind: 'script', id: 'hauntedSpring' }],
}]
const DECAYED_WILLOW_HAUNTED = [{ text: '闹鬼 - 选择并弃掉你的 1 张手牌。', effect: [{ kind: 'discardChosen', amount: 1 }] }]
const GEIST_TRAP_HAUNTED = [{ text: '闹鬼 - 受到 1 点伤害和 1 点恐惧。', effect: [{ kind: 'damage', amount: 1 }, { kind: 'horror', amount: 1 }] }]

const locations = {
  // 05249 卡面 [action]：撤退（引擎直读 loc.resign，见 src/engine/moves.js:448-453）。
  miskatonicRiver: location('miskatonicRiver', MISKATONIC_RIVER, {
    symbol: 'triangle', links: ['moon'], resign: true,
  }),
  forbiddingShore: location('forbiddingShore', FORBIDDING_SHORE, {
    symbol: 'moon', links: ['triangle', 'squiggle'],
    brazier: true, haunted: SHORE_HAUNTED,
  }),
  geistTrap: location('geistTrap', GEIST_TRAP, {
    symbol: 'plus', links: ['squiggle'],
    brazier: true, haunted: GEIST_TRAP_HAUNTED,
  }),
}
const ISLE_EXTRA = {
  standingStones: { haunted: [{ text: '闹鬼 - 直到本轮结束，阵法行动期间的每次技能检定难度提升 2 点。', effect: [{ kind: 'script', id: 'standingStones' }] }] },
  mistyClearing: { haunted: MISTY_CLEARING_HAUNTED },
  forsakenWoods: { haunted: [{ text: '闹鬼 - 你必须查找遭遇牌库和遭遇弃牌堆，找出一张夜鹰并将其生成在本地点，或者最近的夜鹰攻击你。', effect: [{ kind: 'script', id: 'forsakenWoods' }] }] },
  mossCoveredSteps: { haunted: [{ text: '闹鬼 - 本轮你的下一次移动行动花费额外 1 个行动。', effect: [{ kind: 'script', id: 'mossSteps' }] }] },
  hauntedSpring: { haunted: HAUNTED_SPRING_HAUNTED },
  decayedWillow: { haunted: DECAYED_WILLOW_HAUNTED },
}
for (const [key, code] of Object.entries(UNVISITED_ISLES)) {
  locations[key] = location(key, code, {
    symbol: 'squiggle', links: ['squiggle', 'moon', 'plus'],
    brazier: true,
    ...ISLE_EXTRA[key],
    unrevealed: { name: '未访之岛', subname: '', symbol: 'squiggle', links: ['squiggle', 'moon', 'plus'] },
  })
}
linkSymbolLocations(locations)

// ---- 幕 / 议程 ----------------------------------------------------------------
const actStage = (code, index) => {
  const [stage] = stages([code], 'act')
  return {
    ...stage, id: `act${index + 1}`, stage: `${index + 1}a`,
    reveal: { type: 'campaignRule' },
    ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 3 } } : {}),
    ...(index === 1 ? { objective: { type: 'clues', perInvestigator: 2 } } : {}),
  }
}
export const ACT_VARIANTS = Object.freeze({
  v1: { act3: ACT_BEYOND_V1, act4: ACT_BINDING_RITE },
  v2: { act3: ACT_BEYOND_V2, act4: ACT_BROKEN_RITE },
  v3: { act3: ACT_BEYOND_V3, act4: ACT_BROKEN_RITE },
  v4: { act3: ACT_BEYOND_V4, act4: ACT_BROKEN_RITE },
})
// 默认（无记录时）用 v4；preScenarioSetup 按记录替换 act3/act4。
export const ACT_DECKS = Object.freeze(Object.fromEntries(Object.entries(ACT_VARIANTS).map(([version, codes]) => [
  version,
  [
    actStage(ACT_UNVISITED_ISLE, 0),
    actStage(ACT_FATED_SOULS, 1),
    actStage(codes.act3, 2),
    actStage(codes.act4, 3),
  ],
])))
export const ACT_DECK = ACT_DECKS.v4
export const AGENDA_DECK = stages([AGENDA_LOVERS, AGENDA_CROSSROADS], 'agenda')
  .map(agenda => ({ ...agenda, reveal: { type: 'campaignRule' } }))

// ---- 剧情资产 ----------------------------------------------------------------
// 4 张命运剧情卡（story）+ 4 张失踪者剧情支援（asset）都在 storyAssets——
// 引擎的剧情资产注册表按卡号查定义，命运卡翻回敌人面时用 spawnStoryEnemy 生成。
export const FATE_STORY_CODES = FATE_LIST.map(fate => fate.story)
export const FATE_ALLY_CODES = FATE_LIST.map(fate => fate.ally)
export const STORY_ASSETS = storyCards([...FATE_STORY_CODES, ...FATE_ALLY_CODES])

export const scenario = {
  id: 'unionAndDisillusion',
  originalCode: SCENARIO_CARD,
  // 计划里按「本关临时追加」处理：05238 的 [tablet]/[elder_thing] 不在 TCU 基础袋里
  // （参考实现的 standaloneChaosTokens）。与 atDeathsDoorstep/theWagesOfSin 同口径。
  chaosBagExtra: ['tablet', 'elderthing'],
  name: '万象无终 · 聚合幻灭',
  intro: INTRO,
  setup: SETUP,
  startLocation: 'miskatonicRiver',
  locations,
  setAsideLocations: ['geistTrap', 'standingStones', 'mistyClearing', 'forsakenWoods', 'mossCoveredSteps', 'hauntedSpring', 'decayedWillow'],
  acts: ACT_DECK,
  agendas: AGENDA_DECK,
  ...definitions,
  storyAssets: STORY_ASSETS,
  encounterDeck: encounterDeck(gathered),
  resolutions: {
    noResolution: RESOLUTION_NO,
    r1: RESOLUTION_1,
    r2: RESOLUTION_2,
    r3: RESOLUTION_3,
    r4: RESOLUTION_4,
    r5: RESOLUTION_5,
    r6: RESOLUTION_6,
    r7: RESOLUTION_7,
    r8: RESOLUTION_8,
    r9: RESOLUTION_9,
    r10: RESOLUTION_10,
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
