// 七循环《地球边缘》战役级共享遭遇组接线数据（P7 · 战役内共享遭遇 16 组 / 80 张卡）。
//
// 职责（纯数据 + 只读查询，不写状态、不改注册表）：
//   1. 共享遭遇组 id（camelCase）↔ 卡表 encounterCode（snake_case）↔ 卡号清单；
//   2. 八个章节单元的 gather / setAside 组合（来自参考实现各 Scenario 的 gather 调用；
//      含本战役以外的通用遭遇组名，供章节 manifest 直接展开）；
//   3. 伙伴/纪念逝者/忒咳哩-哩/物资等战役级共享卡号清单，供章节 setup 与 P2 原语接线。
//
// 归属口径（docs/edgeOfTheEarth/README.md §2）：24 个遭遇组里 8 个只被单章使用（落章节目录），
// 其余 16 个跨章/战役级共用（落 src/cards/encounter-entries/edgeOfTheEarth/_shared/）。
// 逐卡行为在单卡文件；本模块只做数据表，不做规则分派。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

export const CAMPAIGN_ID = 'edgeOfTheEarth'

// 16 个战役级共享遭遇组：id 为内容层 camelCase，encounterCode 为卡表 snake_case。
export const SHARED_ENCOUNTER_GROUPS = Object.freeze([
  Object.freeze({ id: 'agentsOfTheUnknown', encounterCode: 'agents_of_the_unknown' }),
  Object.freeze({ id: 'creaturesInTheIce', encounterCode: 'creatures_in_the_ice' }),
  Object.freeze({ id: 'deadlyWeather', encounterCode: 'deadly_weather' }),
  Object.freeze({ id: 'elderThings', encounterCode: 'elder_things' }),
  Object.freeze({ id: 'expeditionTeam', encounterCode: 'expedition_team' }),
  Object.freeze({ id: 'hazardsOfAntarctica', encounterCode: 'hazards_of_antarctica' }),
  Object.freeze({ id: 'iceAndDeath', encounterCode: 'ice_and_death' }),
  Object.freeze({ id: 'leftBehind', encounterCode: 'left_behind' }),
  Object.freeze({ id: 'memorialsOfTheLost', encounterCode: 'memorials_of_the_lost' }),
  Object.freeze({ id: 'miasma', encounterCode: 'miasma' }),
  Object.freeze({ id: 'namelessHorrors', encounterCode: 'nameless_horrors' }),
  Object.freeze({ id: 'penguins', encounterCode: 'penguins' }),
  Object.freeze({ id: 'shoggoths', encounterCode: 'shoggoths' }),
  Object.freeze({ id: 'silenceAndMystery', encounterCode: 'silence_and_mystery' }),
  Object.freeze({ id: 'tekelili', encounterCode: 'tekelili' }),
  Object.freeze({ id: 'theHeartOfMadness', encounterCode: 'the_heart_of_madness' }),
])

// 只被单章使用的 8 组（P0 README §2；落章节目录，不在本模块的共享卡号清单里）。
export const CHAPTER_ENCOUNTER_GROUPS = Object.freeze({
  iceAndDeathPart1: 'theCrash',
  iceAndDeathPart2: 'lostInTheNight',
  iceAndDeathPart3: 'seepingNightmares',
  fatalMirage: 'fatalMirage',
  toTheForbiddenPeaks: 'toTheForbiddenPeaks',
  cityOfTheElderThings: 'cityOfTheElderThings',
  theHeartOfMadnessPart1: 'theGreatSeal',
  theHeartOfMadnessPart2: 'stirringInTheDeep',
})

const snakeOf = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

// 卡号清单直接由卡表 encounterCode 归属复算（不手抄第二份事实源）。
const codesByEncounterCode = new Map()
for (const [code, card] of Object.entries(ALL_CARDS)) {
  if (card.pack !== 'eoec' || !card.encounterCode) continue
  if (!codesByEncounterCode.has(card.encounterCode)) codesByEncounterCode.set(card.encounterCode, [])
  codesByEncounterCode.get(card.encounterCode).push(code)
}
for (const codes of codesByEncounterCode.values()) codes.sort()

export const SHARED_GROUP_CODES = Object.freeze(Object.fromEntries(SHARED_ENCOUNTER_GROUPS.map(group => [
  group.id, Object.freeze([...(codesByEncounterCode.get(group.encounterCode) || [])]),
])))

export const SHARED_GROUP_BY_ID = Object.freeze(Object.fromEntries(SHARED_ENCOUNTER_GROUPS.map(group => [
  group.id, Object.freeze({ ...group, codes: SHARED_GROUP_CODES[group.id] }),
])))

export const SHARED_GROUP_BY_ENCOUNTER_CODE = Object.freeze(Object.fromEntries(
  SHARED_ENCOUNTER_GROUPS.map(group => [group.encounterCode, group.id])))

// 全 80 张共享卡（按卡号排序）与「卡号 → 共享组 id」反查。
export const SHARED_CARD_CODES = Object.freeze(Object.values(SHARED_GROUP_CODES).flat().sort())
export const SHARED_GROUP_OF_CARD = Object.freeze(Object.fromEntries(
  SHARED_ENCOUNTER_GROUPS.flatMap(group => SHARED_GROUP_CODES[group.id].map(code => [code, group.id]))))

export function encounterCodeOf(groupId) {
  return SHARED_GROUP_BY_ID[groupId]?.encounterCode || null
}
export function sharedGroupCodes(groupId) {
  return [...(SHARED_GROUP_CODES[groupId] || [])]
}
export function sharedGroupOfCard(code) {
  return SHARED_GROUP_OF_CARD[String(code)] || null
}
export function isSharedGroup(groupId) {
  return Boolean(SHARED_GROUP_BY_ID[groupId])
}

// 八个章节单元的 gather / setAside（参考实现 Scenario/Scenarios/EdgeOfTheEarth/*.hs 的 gather 调用）。
// `gather` 里既可能是本战役的 24 组之一，也可能是本战役以外的通用组（ancientEvils / chillingCold /
// lockedDoors / strikingFear）——章节 manifest 交给基础遭遇组解析，不在本模块展开。
export const CHAPTER_GATHER_SETS = Object.freeze({
  iceAndDeathPart1: Object.freeze({
    gather: Object.freeze(['iceAndDeath', 'theCrash', 'deadlyWeather', 'hazardsOfAntarctica',
      'silenceAndMystery', 'tekelili', 'ancientEvils']),
    setAside: Object.freeze(['creaturesInTheIce']),
  }),
  iceAndDeathPart2: Object.freeze({
    gather: Object.freeze(['iceAndDeath', 'lostInTheNight', 'leftBehind', 'deadlyWeather',
      'hazardsOfAntarctica', 'silenceAndMystery', 'tekelili', 'ancientEvils']),
    setAside: Object.freeze([]),
  }),
  iceAndDeathPart3: Object.freeze({
    gather: Object.freeze(['iceAndDeath', 'seepingNightmares', 'creaturesInTheIce', 'deadlyWeather',
      'hazardsOfAntarctica', 'silenceAndMystery', 'tekelili', 'ancientEvils']),
    setAside: Object.freeze(['seepingNightmares']),
  }),
  fatalMirage: Object.freeze({
    gather: Object.freeze(['fatalMirage', 'agentsOfTheUnknown', 'leftBehind', 'miasma',
      'namelessHorrors', 'silenceAndMystery', 'tekelili', 'chillingCold']),
    setAside: Object.freeze([]),
  }),
  toTheForbiddenPeaks: Object.freeze({
    gather: Object.freeze(['toTheForbiddenPeaks', 'deadlyWeather', 'elderThings',
      'hazardsOfAntarctica', 'namelessHorrors', 'tekelili']),
    setAside: Object.freeze([]),
  }),
  cityOfTheElderThings: Object.freeze({
    // 参考实现按城市版本（v.I/II/III）三套 gather；这里全部列出，章节按版本选用。
    versions: Object.freeze({
      v1: Object.freeze({
        gather: Object.freeze(['cityOfTheElderThings', 'elderThings', 'miasma', 'namelessHorrors',
          'penguins', 'tekelili', 'lockedDoors']),
        setAside: Object.freeze(['shoggoths']),
      }),
      v2: Object.freeze({
        gather: Object.freeze(['cityOfTheElderThings', 'elderThings', 'namelessHorrors', 'penguins',
          'silenceAndMystery', 'tekelili', 'chillingCold']),
        setAside: Object.freeze(['creaturesInTheIce']),
      }),
      v3: Object.freeze({
        gather: Object.freeze(['cityOfTheElderThings', 'creaturesInTheIce', 'miasma', 'penguins',
          'tekelili', 'chillingCold', 'lockedDoors']),
        setAside: Object.freeze(['shoggoths']),
      }),
    }),
  }),
  theHeartOfMadnessPart1: Object.freeze({
    gather: Object.freeze(['theHeartOfMadness', 'theGreatSeal', 'miasma', 'namelessHorrors',
      'penguins', 'shoggoths', 'tekelili', 'ancientEvils', 'lockedDoors']),
    setAside: Object.freeze([]),
  }),
  theHeartOfMadnessPart2: Object.freeze({
    gather: Object.freeze(['theHeartOfMadness', 'agentsOfTheUnknown', 'miasma', 'namelessHorrors',
      'penguins', 'stirringInTheDeep', 'tekelili', 'ancientEvils', 'chillingCold']),
    setAside: Object.freeze([]),
    gatherJust: Object.freeze({ strikingFear: Object.freeze(['dissonantVoices', 'frozenInFear']) }),
  }),
})

// 《亡命冰原》13 个地点的印刷庇护值（参考 Location/CardDefs/EdgeOfTheEarth/IceAndDeath.hs 的 meta.shelter；
// 与卡面「庇护 N」文本一致）。章节 definition 建地点时照抄 `shelter` 字段，P2 location.shelter 读点即可用。
export const SHELTER_BY_LOCATION_CODE = Object.freeze({
  '08502': 0, '08503': 2, '08504': 1, '08505': 2, '08506': 4, '08507': 4, '08508': 3,
  '08509': 5, '08510': 5, '08511': 6, '08512': 7, '08513': 7, '08514': 8,
})

// 章节 gather 展开为卡号：本战役 24 组内的组展开成卡号；外部通用组原样保留组名。
const CYCLE_GROUP_IDS = new Set([...SHARED_ENCOUNTER_GROUPS.map(group => group.id),
  ...Object.values(CHAPTER_ENCOUNTER_GROUPS)])
export function chapterCardPool(chapterId, { version = null } = {}) {
  const config = CHAPTER_GATHER_SETS[chapterId]
  if (!config) return null
  const selected = version != null ? config.versions?.[version] : config
  if (!selected) return null
  const setup = {
    gather: selected.gather,
    setAside: selected.setAside,
    ...(selected.gatherJust ? { gatherJust: selected.gatherJust } : {}),
  }
  const toCodes = groups => groups.flatMap(group => {
    if (!isSharedGroup(group) && !CYCLE_GROUP_IDS.has(group)) return []
    const shared = SHARED_GROUP_CODES[group]
    if (shared) return [...shared]
    // 单章组：由卡表 encounterCode 现算，避免章节目录尚未落盘时手抄。
    return [...(codesByEncounterCode.get(snakeOf(group)) || [])]
  })
  return { ...setup, gatherCodes: toCodes(setup.gather), setAsideCodes: toCodes(setup.setAside) }
}

// 战役级共享清单（章节 setup 直接使用的卡号表；卡面行为在各单卡条目）。
export const EXPEDITION_TEAM_CODES = Object.freeze(['08714', '08715', '08716', '08717', '08718',
  '08719', '08720', '08721', '08722'])
export const PARTNER_ASSET_RULES = Object.freeze({
  '08714': Object.freeze({ uses: 3, usesType: 'secrets', partner: true }),
  '08715': Object.freeze({ uses: 5, usesType: 'secrets', partner: true }),
  '08716': Object.freeze({ uses: 3, usesType: 'secrets', partner: true }),
  '08717': Object.freeze({ uses: 3, usesType: 'supplies', partner: true }),
  '08718': Object.freeze({ uses: 5, usesType: 'supplies', partner: true }),
  '08719': Object.freeze({ uses: 3, usesType: 'ammo', partner: true }),
  '08720': Object.freeze({ uses: 3, usesType: 'secrets', partner: true }),
  '08721': Object.freeze({ uses: 5, usesType: 'supplies', partner: true }),
  '08722': Object.freeze({ uses: 9, usesType: 'resources', partner: true }),
})
// 坚毅（Resolute）替换面在致命幻景组（08587–08595），由该章条目维护；这里只登记配对关系。
export const RESOLUTE_PARTNER_FORMS = Object.freeze({
  '08714': '08587', '08715': '08588', '08716': '08589', '08717': '08590', '08718': '08591',
  '08719': '08592', '08720': '08593', '08721': '08594', '08722': '08595',
})
// 纪念逝者（08730–08738，共 9 件遗物）与伙伴划去状态的配对（P2 eote-memorials 的初始化数据）。
export const MEMORIAL_CODES = Object.freeze(['08730', '08731', '08732', '08733', '08734',
  '08735', '08736', '08737', '08738'])
export const MEMORIAL_FOR_PARTNER = Object.freeze({
  '08718': '08730', // 艾弗里·克莱普尔 → 克莱普尔的皮草
  '08715': '08731', // 丹佛斯 → 爱伦·坡作品集
  '08719': '08732', // 詹姆斯·「曲奇」·弗雷德里克斯 → 曲奇的特制 .32 手枪
  '08714': '08733', // 威廉·戴尔教授 → 戴尔的素描
  '08721': '08734', // 罗尔德·埃尔斯沃思 → 埃尔斯沃思的靴子
  '08720': '08735', // 艾米·肯斯勒博士 → 肯斯勒的日志
  '08717': '08736', // 玛拉·辛哈医生 → 辛哈的医药箱
  '08722': '08737', // 高田弘子 → 高田的物品
  '08716': '08738', // 伊里亚·阿什瓦克 → 安雨
})
// 忒咳哩-哩牌库：7 个卡面 × 印刷份数 3+3+2+2+2+2+2 = 16 张（P2 eote-tekeli 的 cards 参数）。
export const TEKELI_FACE_CODES = Object.freeze(['08723', '08724', '08725', '08726', '08727', '08728', '08729'])
// 探险物资（7 件）：印刷份数与卡号见卡表；Ice and Death 地点的「回收补给品」只记录其卡号。
export const EXPEDITION_SUPPLY_CODES = Object.freeze(['08614', '08615', '08616', '08617',
  '08618', '08619', '08620'])
export const SUPPLY_LABELS = Object.freeze({
  '08614': '绿皂石', '08615': '木制雪撬', '08616': '炸药', '08617': '瘴气水晶',
  '08618': '矿物标本', '08619': '小型收音机', '08620': '备用零件',
})

// 开场/检查点初始化数据（Partner / Memorials 原语的 spec 形状）。
export function partnerRosterSpec() {
  return EXPEDITION_TEAM_CODES.map(code => ({ code, damage: 0, horror: 0 }))
}
export function memorialsSpec() {
  return { entries: Object.entries(MEMORIAL_FOR_PARTNER).map(([partnerCode, relicCode]) => ({ partnerCode, relicCode })) }
}
export function tekeliDeckSpec() {
  return { cards: [...TEKELI_FACE_CODES] }
}
export function suppliesSpec(recoveredKey = 'suppliesRecovered') {
  return {
    items: EXPEDITION_SUPPLY_CODES.map(code => ({ code, label: SUPPLY_LABELS[code] || code })),
    recoveredKey,
  }
}
