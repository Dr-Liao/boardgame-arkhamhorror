// 精益酒店谋杀案（Murder at the Excelsior Hotel · 84001）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/MurderAtTheExcelsiorHotel.hs（Setup / 随机真凶 / 结局 R1–R3 / playAgain）
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/MurderAtTheExcelsiorHotel.hs
//   frontend/src/locales/en/standalone/murderAtTheExcelsiorHotel.json
//
// 本关特有口径：
//   1. 随机真凶：Setup 从 10 张「The True Culprit (v. I–X)」（84043–84052）随机 1 张作为第 3 张议程；
//      每张真凶卡指定不同的「敌对真凶」目标与被击败/毁灭阈值两种结局分支（R1 / R2）。
//      本实现把 10 张真凶卡的「目标敌人」映射成数据表（behavior.CULPRIT_TARGETS）；敌人被击败→R1，
//      议程因毁灭阈值推进→R2（参考实现相同）。
//   2. 迹象牌库（Leads deck）：84028/84031/84034/84037/84040 洗成额外牌堆，幕 1 行动抽取；
//      幕 1 背面按场上迹象把对应的 3 张副组卡洗入遭遇牌库（本实现按已抽迹象把对应副组洗入）。
//   3. 幕 2 目标：每张迹象上至少 1[per_investigator] 线索时可选择推进；幕 2 背面读完「真相」后进入
//      真凶议程；R2/R3 首次达成时可通过 flow.choice 选择「再玩一次」（参考 playAgain）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'murderAtTheExcelsiorHotel'
export const REFERENCE_CODE = '84001'
export const ENCOUNTER_CODE = 'murder_at_the_excelsior_hotel'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT1_CODE = '84004' // What Happened...?
export const ACT2_CODE = '84005' // Following Leads
export const ACT_CODES = Object.freeze([ACT1_CODE, ACT2_CODE])
export const AGENDA1_CODE = '84002' // The Murder
export const AGENDA2_CODE = '84003' // Special Investigation
export const CULPRIT_CODES = Object.freeze([
  '84043', '84044', '84045', '84046', '84047', '84048', '84049', '84050', '84051', '84052',
])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3'])

// 真凶议程 → 目标敌人（参考各真凶卡目标；84048–84052 按同位循环近似）。
export const CULPRIT_TARGETS = Object.freeze({
  84043: '84041', // Vengeful Specter
  84044: '84029', // Otherworldly Meddler
  84045: '84032', // Hotel Manager
  84046: '84035', // Dimensional Shambler
  84047: '84036', // Cultist of the Enclave
  84048: '84041',
  84049: '84029',
  84050: '84032',
  84051: '84035',
  84052: '84036',
})

// 迹象（Leads）与对应副组：抽取/在场时幕 1 背面把 3 张副组洗入遭遇牌库。
export const LEADS = Object.freeze([
  Object.freeze({ code: '84028', name: '异星装置', group: 'alienInterference', setAsideCodes: Object.freeze(['84030', '84030', '84030']) }),
  Object.freeze({ code: '84031', name: '经理的钥匙', group: 'excelsiorManagement', setAsideCodes: Object.freeze(['84033', '84033', '84033']) }),
  Object.freeze({ code: '84034', name: '仪式古书', group: 'darkRituals', setAsideCodes: Object.freeze(['84036', '84036', '84036']) }),
  Object.freeze({ code: '84037', name: '不祥溶液', group: 'vileExperiments', setAsideCodes: Object.freeze(['84039', '84039', '84039']) }),
  Object.freeze({ code: '84040', name: '陈旧的挂坠盒', group: 'sinsOfThePast', setAsideCodes: Object.freeze(['84042', '84042', '84042']) }),
])
export const LEAD_CODES = Object.freeze(LEADS.map(lead => lead.code))
export const MINI_SET_ENEMIES = Object.freeze(['84029', '84032', '84033', '84035', '84036', '84041', '84030', '84039', '84042'])
export const DAGGER_CODE = '84006'
export const MONROE_CODE = '84008'
export const WHAT_HAVE_YOU_DONE_CODE = '84007'
export const OFFICER_CODE = '84009'

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
export const START_LOCATION = 'room225'
export const SETUP_LOCATION_IDS = Object.freeze(['room225', 'foyer', 'suiteBalcony', 'secondFloorHall', 'restaurant'])
export const SET_ASIDE_LOCATION_IDS = Object.freeze(['hotelRoof', 'room212', 'room245', 'office', 'basement'])

export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['room225', '84010', Object.freeze(['secondFloorHall', 'room245', 'suiteBalcony', 'office'])]),
  Object.freeze(['foyer', '84013', Object.freeze(['secondFloorHall', 'restaurant', 'office', 'basement'])]),
  Object.freeze(['suiteBalcony', '84011', Object.freeze(['room225', 'office'])]),
  Object.freeze(['secondFloorHall', '84012', Object.freeze(['hotelRoof', 'room212', 'room225', 'foyer'])]),
  Object.freeze(['restaurant', '84014', Object.freeze(['room212', 'foyer'])]),
  Object.freeze(['hotelRoof', '84015', Object.freeze(['room212', 'room245', 'secondFloorHall'])]),
  Object.freeze(['room212', '84016', Object.freeze(['hotelRoof', 'secondFloorHall', 'restaurant'])]),
  Object.freeze(['room245', '84017', Object.freeze(['hotelRoof', 'room225'])]),
  Object.freeze(['office', '84018', Object.freeze(['room225', 'suiteBalcony', 'foyer'])]),
  Object.freeze(['basement', '84019', Object.freeze(['foyer'])]),
])

export const LOCATION_COORDINATES = Object.freeze({
  hotelRoof: { x: 2, y: 0 },
  room245: { x: 3, y: 0 },
  room212: { x: 1, y: 1 },
  room225: { x: 3, y: 1 },
  suiteBalcony: { x: 4, y: 1 },
  secondFloorHall: { x: 2, y: 2 },
  restaurant: { x: 1, y: 2 },
  foyer: { x: 2, y: 3 },
  office: { x: 3, y: 3 },
  basement: { x: 2, y: 4 },
})

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Murder at the Excelsior Hotel card: ${code}`)
  return {
    code, originalCode: code,
    name: c.nameZh || c.name, nameEn: c.name,
    subname: c.subnameZh || c.subname || '', subnameEn: c.subname || '',
    text: c.textZh || c.text || '', textEn: c.text || '',
    backText: c.backTextZh || c.backText || '', backTextEn: c.backText || '',
    type: c.type, traits: [...(c.traits || [])],
    ...(c.victory != null ? { victory: c.victory } : {}),
  }
}

export function location(data) {
  const { id, code, cluesFixed, clues, connections, ...rest } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Excelsior location: ${code}`)
  return {
    ...printed(code), id, shroud: c.shroud,
    connections: [...(connections || [])],
    ...rest,
    ...(cluesFixed ? { cluesFixed } : { cluesPerInvestigator: clues ?? c.clues ?? 0 }),
    unrevealedName: c.backNameZh || c.backName || c.nameZh || c.name,
    unrevealedNameEn: c.backName || c.name,
  }
}

export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Excelsior stage: ${code}`)
  const { number, doom, ...rest } = extra
  return {
    ...printed(code),
    id: `${c.type}${code}`,
    type: c.type,
    stage: `${number ?? c.stage ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...rest,
    ...(c.type === 'agenda' ? { doomThreshold: doom ?? c.doom } : {}),
  }
}

const PREY_KEYS = Object.freeze({ 'Most clues': 'mostClues', 'Fewest clues': 'fewestClues' })

export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const c = ALL_CARDS[code]
    if (!c) throw new RangeError(`Unknown Excelsior encounter definition: ${code}`)
    const base = printed(code)
    if (c.type === 'enemy') {
      const keywords = String(c.text || '')
      const preyText = /Prey - ([^.]+)\./.exec(keywords)?.[1]?.trim()
      enemies[code] = {
        ...base,
        fight: c.fight ?? null, evade: c.evade ?? null,
        health: c.health ?? null, damage: c.damage || 0, horror: c.horror || 0,
        ...(c.victory != null ? { victory: c.victory } : {}),
        ...(PREY_KEYS[preyText] ? { prey: PREY_KEYS[preyText] } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert']
          .filter(k => new RegExp(`\\b${k}\\.`).test(keywords)).map(k => [k.toLowerCase(), true])),
        elite: (c.traits || []).includes('Elite'),
      }
    } else if (c.type === 'treachery') {
      treacheries[code] = { ...base, entryRevelation: true, surge: /^Surge\./m.test(c.text || '') }
    } else if (c.type === 'asset' || c.type === 'story') {
      storyAssets[code] = { ...base, global: true, ...(c.health != null ? { health: c.health } : {}) }
    }
  }
  return { enemies, treacheries, storyAssets }
}

export function identitiesFor(scenarioData) {
  const identity = value => ({ originalCode: value.originalCode || value.code, artCode: value.originalCode || value.code })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category, Object.fromEntries(Object.values(scenarioData[category] || {})
      .map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 遭遇牌库 / 放一边
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze([
  'murderAtTheExcelsiorHotel', 'alienInterference', 'excelsiorManagement',
  'darkRituals', 'vileExperiments', 'sinsOfThePast',
])
export const SET_ASIDE_CODES = Object.freeze([
  MONROE_CODE, WHAT_HAVE_YOU_DONE_CODE, OFFICER_CODE, OFFICER_CODE, OFFICER_CODE,
  ...LEAD_CODES, ...MINI_SET_ENEMIES,
])
export const ENCOUNTER_DECK = Object.freeze(Object.entries(ALL_CARDS)
  .filter(([, card]) => ['enemy', 'treachery'].includes(card.type)
    && String(card.encounterCode).toLowerCase() === ENCOUNTER_CODE
    && !SET_ASIDE_CODES.includes(card.code))
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])
export const SET_ASIDE_ALIASES = Object.freeze([...new Set(SET_ASIDE_CODES)])

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  // 目标：调查员控制 2 张 [[迹象]] 支援（本实现用「已抽迹象」计数近似，见 behavior 注释）。
  [ACT1_CODE]: Object.freeze({ ...stage(ACT1_CODE, { number: 1 }), objective: { type: 'custom' } }),
  // 目标：每张迹象上至少 1[per_investigator] 线索（本实现按每迹象线索计数）。
  [ACT2_CODE]: Object.freeze({ ...stage(ACT2_CODE, { number: 2 }), objective: { type: 'custom' } }),
})
export const AGENDA_STAGES = Object.freeze({
  [AGENDA1_CODE]: Object.freeze({ ...stage(AGENDA1_CODE, { number: 1 }), doomThreshold: 3 }),
  [AGENDA2_CODE]: Object.freeze({ ...stage(AGENDA2_CODE, { number: 2 }), doomThreshold: 12 }),
})
export const CULPRIT_STAGES = Object.freeze(Object.fromEntries(CULPRIT_CODES.map(code =>
  [code, { ...stage(code, { number: 3 }), doomThreshold: Number(ALL_CARDS[code]?.doom) || 6 }])))
export const ACTS = Object.freeze(ACT_CODES.map(code => structuredClone(ACT_STAGES[code])))
export const AGENDAS = Object.freeze([AGENDA1_CODE, AGENDA2_CODE].map(code => structuredClone(AGENDA_STAGES[code])))
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  ...Object.entries(ACT_STAGES), ...Object.entries(AGENDA_STAGES), ...Object.entries(CULPRIT_STAGES),
]))

// ---------------------------------------------------------------------------
// 地点定义
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, connections]) =>
  [id, location({ id, code, connections })])))

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: { delta: -1, text: '-X（X = 场上客人/无辜者相关，本实现按 -1）' },
    cultist: { delta: -1, text: '-1' },
    tablet: { delta: -3, text: '-3' },
    elderthing: { delta: -3, text: '-3；若失败且胜利区有[[无辜]]敌人，受到 1 恐惧' },
  }),
  hard: Object.freeze({
    skull: { delta: -2, text: '-2（客人相关，本实现按 -2）' },
    cultist: { delta: -2, text: '-2' },
    tablet: { delta: -5, text: '-5' },
    elderthing: { delta: -3, text: '-3；失败时按[[无辜]]敌人数量受恐惧' },
  }),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale; guide source is authoritative)',
  heading: '精益酒店谋杀案',
  intro: '艾肖希尔酒店本应是阿卡姆最体面的地方。但今夜，225 房间的客人死在了自己的血泊里，'
    + '而所有证据都指向你们。警察即将赶到，你们必须赶在他们之前查明真相——或者至少洗清自己的嫌疑。',
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集精益酒店谋杀案遭遇组的所有卡牌。' },
    { key: 'placeLocations', text: '把 225 房间、门厅、套房阳台、二楼走廊、餐厅放入场；其余地点放到一边（场外）。' },
    { key: 'startAt', text: '队长从 225 房间开始游戏；其他调查员从门厅开始游戏。' },
    { key: 'radiant', text: '把放一边的门罗警司、3 张阿卡姆警官、「你都做了什么？」弱点放到一边（场外）。' },
    { key: 'trueCulprit', text: '从 10 张「真凶」议程中随机选择 1 张，作为第 3 张议程；其余真凶卡放回盒中。' },
    { key: 'leads', text: '把异星装置、经理的钥匙、仪式古书、不祥溶液、陈旧的挂坠盒洗成迹象牌库（额外牌堆）。' },
  ]),
  specialRules: Object.freeze([
    '随机真凶：第 3 张议程由 10 张「The True Culprit」随机决定；真凶被击败（完成议程目标）→ 结局 1；'
      + '议程因毁灭阈值推进 → 结局 2。',
    'playAgain：首次以结局 2/3 结束时，可选择「再玩一次」重置本关（参考 scenarioTimesPlayed 语义），否则进入结局结算。',
  ]),
  rules: Object.freeze({}),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '没有达成任何结局：若有人撤退，调查员逃离了犯罪现场，酒店把罪名扣在你们头上；'
      + '否则，艾肖希尔酒店又多了一名受害者。',
    resolution1: '结局 1：艾肖希尔酒店暂时恢复了平静。你们解开了谜团，洗清了自己的嫌疑。（→R1）',
    resolution2: '结局 2：哀嚎般的声浪像死亡之潮般掠过你们。真凶于毁灭阈值推进时得逞，酒店再次被阴影笼罩。（→R2）',
    resolution3: '结局 3：你们没能破案、也没能洗清嫌疑。谋杀仍未解决。（→R3）',
  }),
  resolutionBranches: Object.freeze({
    noResolution: '若有人撤退：记录「调查员逃离了犯罪现场」→ 结局 3；否则记录「艾肖希尔酒店又添一名受害者」→ 结局 2。',
    resolution1: '记录「艾肖希尔酒店暂时平静」；每名调查员获得胜利区经验；队长强制加入「你都做了什么？」弱点；'
      + '可与「血迹斑斑的匕首」；若警察站在你这边，还可与门罗警司。',
    resolution2: '记录「谋杀仍未解决」；获得经验；队长强制加入「你都做了什么？」弱点；可与血迹斑斑的匕首。',
    resolution3: '记录「谋杀仍未解决」；获得经验；队长强制加入「你都做了什么？」弱点；可与血迹斑斑的匕首；'
      + '队长随机获得一个基础弱点（侦探/疯狂）。',
  }),
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, ...SET_ASIDE_CODES,
])
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, AGENDA1_CODE, AGENDA2_CODE, ...CULPRIT_CODES,
  ...LOCATION_TABLE.map(([, code]) => code),
  ...ENCOUNTER_DECK_CODES, ...SET_ASIDE_CODES,
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '精益酒店谋杀案 · Murder at the Excelsior Hotel',
  nameEn: 'Murder at the Excelsior Hotel',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: "依照剧本参考卡 84001 与参考侧支线的设置页布置：10 张真凶议程随机 1 张作第 3 议程、迹象牌库按幕 1 抽取；独立开局每人 3 XP。",
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: Object.freeze([...SCENARIO_TEXT.specialRules]),
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  connectByIcons: true,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  setAsideAliases: [...SET_ASIDE_ALIASES],
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario
