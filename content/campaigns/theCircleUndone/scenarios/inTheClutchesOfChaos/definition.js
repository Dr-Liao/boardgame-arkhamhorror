// 《混沌魔掌》（In the Clutches of Chaos，05284）· 关卡定义
//
// 参考实现：Scenario/Scenarios/TheCircleUndone/InTheClutchesOfChaos.hs +
// Location/CardDefs/TheCircleUndone/InTheClutchesOfChaos.hs +
// {Act,Agenda,Enemy,Treachery}/Cards/TheCircleUndone/{InTheClutchesOfChaos,AgentsOfAzathoth}/。
// 中文文案：frontend/src/locales/zh/theCircleUndone/scenarios/inTheClutchesOfChaos.json
// 印刷数据只从 card-data.js 取；本文件只写「这一章怎么用这些卡」。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck,
  identitiesFor, linkSymbolLocations, camelToSnake,
} from '../../card-data.js'

// ---------------------------------------------------------------------------
// 地点（16 个 id = 章组 12 个 + 受诅咒的歌声 2 个 + 宇宙之秘 2 个）
//
// 六对同名地点在开局各随机放一个版本、另一个移出游戏（Haskell placeOneOf_）。
// 两个变体子剧本各带一对「终焉之地 / 神秘笼罩」地点，由剧本日志二选一。
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze({
  frenchHillA: '05290',
  frenchHillB: '05291',
  rivertownA: '05292',
  rivertownB: '05293',
  southsideA: '05294',
  southsideB: '05295',
  uptownA: '05296',
  uptownB: '05297',
  southChurchA: '05298',
  southChurchB: '05299',
  merchantDistrictA: '05300',
  merchantDistrictB: '05301',
  hangmansHillMusic: '05302',
  silverTwilightMusic: '05303',
  hangmansHillSecrets: '05304',
  silverTwilightSecrets: '05305',
})

export const LOCATION_CODES = Object.freeze(Object.fromEntries(
  Object.entries(LOCATIONS).map(([id, code]) => [code, id])))

// 六对随机地点：[id 数组, 印刷符号, 相连符号] —— 符号/连线取 Haskell Location/CardDefs。
export const LOCATION_PAIRS = Object.freeze([
  { ids: ['frenchHillA', 'frenchHillB'], symbol: 't', links: ['circle', 'square', 'star'] },
  { ids: ['rivertownA', 'rivertownB'], symbol: 'circle', links: ['square', 'triangle', 't'] },
  { ids: ['southsideA', 'southsideB'], symbol: 'square', links: ['circle', 'triangle', 'plus', 't', 'diamond'] },
  { ids: ['uptownA', 'uptownB'], symbol: 'plus', links: ['square', 'triangle', 'moon'] },
  { ids: ['southChurchA', 'southChurchB'], symbol: 'diamond', links: ['square'] },
  { ids: ['merchantDistrictA', 'merchantDistrictB'], symbol: 'triangle', links: ['circle', 'square', 'plus'] },
])

const locations = {
  frenchHillA: location('frenchHillA', '05290', { symbol: 't', links: ['circle', 'square', 'star'] }),
  frenchHillB: location('frenchHillB', '05291', { symbol: 't', links: ['circle', 'square', 'star'] }),
  rivertownA: location('rivertownA', '05292', { symbol: 'circle', links: ['square', 'triangle', 't'] }),
  rivertownB: location('rivertownB', '05293', { symbol: 'circle', links: ['square', 'triangle', 't'] }),
  southsideA: location('southsideA', '05294', { symbol: 'square', links: ['circle', 'triangle', 'plus', 't', 'diamond'] }),
  southsideB: location('southsideB', '05295', { symbol: 'square', links: ['circle', 'triangle', 'plus', 't', 'diamond'] }),
  uptownA: location('uptownA', '05296', { symbol: 'plus', links: ['square', 'triangle', 'moon'] }),
  uptownB: location('uptownB', '05297', { symbol: 'plus', links: ['square', 'triangle', 'moon'] }),
  southChurchA: location('southChurchA', '05298', { symbol: 'diamond', links: ['square'] }),
  southChurchB: location('southChurchB', '05299', { symbol: 'diamond', links: ['square'] }),
  merchantDistrictA: location('merchantDistrictA', '05300', { symbol: 'triangle', links: ['circle', 'square', 'plus'] }),
  merchantDistrictB: location('merchantDistrictB', '05301', { symbol: 'triangle', links: ['circle', 'square', 'plus'] }),
  // 受诅咒的歌声（Anette 线）：绞刑者山丘 · 终焉之地 / 银暮秘社 · 神秘笼罩（胜利 1）
  hangmansHillMusic: location('hangmansHillMusic', '05302', { symbol: 'moon', links: ['plus'] }),
  silverTwilightMusic: location('silverTwilightMusic', '05303', { symbol: 'star', links: ['t'], victory: 1 }),
  // 宇宙之秘（Carl 线）：绞刑者山丘 · 神秘笼罩（胜利 1）/ 银暮秘社 · 终焉之地
  hangmansHillSecrets: location('hangmansHillSecrets', '05304', { symbol: 'moon', links: ['plus'], victory: 1 }),
  silverTwilightSecrets: location('silverTwilightSecrets', '05305', { symbol: 'star', links: ['t'] }),
}
linkSymbolLocations(locations)

// ---------------------------------------------------------------------------
// 幕：两套变体子剧本（05286a/05287 受诅咒的歌声，05288a/05289 宇宙之秘）。
// 开局按剧本日志换掉 state.acts；manifest 默认登记 Anette 线两幕。
// ---------------------------------------------------------------------------
export const ACT_CODES = Object.freeze(['05286a', '05287', '05288a', '05289'])
export const BOSS_BY_ACT = Object.freeze({ '05286a': '05286b', '05288a': '05288b' })
export const BOSS_CODES = Object.freeze(['05286b', '05288b'])
export const PIPER = '05088'

export const VARIANT = Object.freeze({
  // anetteMasonIsPossessedByEvil：受诅咒的歌声（绞刑者山丘 · 终焉之地）
  music: {
    id: 'music',
    record: 'anetteMasonIsPossessedByEvil',
    actCodes: ['05286a', '05287'],
    boss: '05286b',
    bossLocationCodes: ['05302'],
    placeLocations: ['hangmansHillMusic', 'silverTwilightMusic'],
    removeLocations: ['hangmansHillSecrets', 'silverTwilightSecrets'],
    groups: ['musicOfTheDamned', 'anettesCoven', 'cityOfSins', 'witchcraft'],
    resolution: 'r1',
  },
  // 否则：宇宙之秘（银暮秘社 · 终焉之地）
  secrets: {
    id: 'secrets',
    record: 'carlSanfordPossessesTheSecretsOfTheUniverse',
    actCodes: ['05288a', '05289'],
    boss: '05288b',
    bossLocationCodes: ['05305'],
    placeLocations: ['hangmansHillSecrets', 'silverTwilightSecrets'],
    removeLocations: ['hangmansHillMusic', 'silverTwilightMusic'],
    groups: ['secretsOfTheUniverse', 'silverTwilightLodge', 'strikingFear'],
    resolution: 'r2',
  },
})

function variantActs(variant) {
  return stages(variant.actCodes, 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    // 05286a/05288a：全队 3×人数线索并立即花费推进；05287/05289：首领被击败推进。
    ...(index === 0
      ? { objective: { type: 'clues', perInvestigator: 3 } }
      : { objective: { type: 'defeatEnemy', enemy: variant.boss } }),
    // 背面推进效果写在 behavior.actReveal（按卡号分派）。
  }))
}

export const VARIANT_ACTS = Object.freeze({
  music: variantActs(VARIANT.music),
  secrets: variantActs(VARIANT.secrets),
})

// ---------------------------------------------------------------------------
// 遭遇牌库
//
// 参考实现按剧本日志收两套变体组；manifest 的 zones 是静态数据，所以这里声明
// 「基线 + 两变体并集」；开局 behavior.modifyDeck 按实际分支裁剪（gap 1 / spec §3）。
// 05088 吹笛手放一边；05286b/05288b 是幕背面的首领，不进遭遇牌库（由 actReveal 生成）。
// 午夜假面（01135/01136）是核心/夜之狂热组的单卡引用，只进 Carl 线牌库。
// ---------------------------------------------------------------------------
export const BASE_GROUPS = Object.freeze(['inTheClutchesOfChaos', 'agentsOfAzathoth', 'nightgaunts'])
export const VARIANT_GROUPS = Object.freeze({
  music: ['musicOfTheDamned', 'anettesCoven', 'cityOfSins', 'witchcraft'],
  secrets: ['secretsOfTheUniverse', 'silverTwilightLodge', 'strikingFear'],
})
export const MIDNIGHT_MASKS = Object.freeze(['01135', '01136'])

const deckPool = Object.freeze([
  ...encounterCards([...BASE_GROUPS, ...VARIANT_GROUPS.music, ...VARIANT_GROUPS.secrets]),
  ...MIDNIGHT_MASKS.map(code => ALL_CARDS[code]),
])
const sideCodes = new Set([...BOSS_CODES, PIPER])
const gathered = Object.freeze(deckPool.filter(card => !sideCodes.has(card.code)))
const definitions = encounterDefinitions([
  ...deckPool,
  ...BOSS_CODES.map(code => ALL_CARDS[code]),
  ALL_CARDS[PIPER],
])

// 单局实际牌库：基线 + 某个变体组（+ Carl 线的午夜假面）。
// 注意 encounterCards 返回的卡用 snake_case encounterCode，组 id 要先归一化。
export function deckCodesForVariant(id) {
  const variant = VARIANT[id] || VARIANT.music
  const groups = new Set([...BASE_GROUPS, ...variant.groups].map(camelToSnake))
  return encounterDeck(deckPool.filter(card => {
    if (sideCodes.has(card.code)) return false
    if (MIDNIGHT_MASKS.includes(card.code)) return id === 'secrets'
    return groups.has(card.encounterCode)
  }))
}

export const scenario = {
  id: 'inTheClutchesOfChaos',
  originalCode: '05284',
  name: '万象无终 · 混沌魔掌',
  intro: '亲眼见过未访之岛的景象之后，你们对人类的信任已经所剩无几。暴雨中，阿卡姆的街巷被撕开一道道裂缝，'
    + '某种比天空更大的东西正在裂缝另一端呼吸——末日渐近，而你们必须在它彻底醒来之前找到源头。',
  setup: '收齐混沌魔掌、阿撒托斯的使徒与夜魇遭遇组；按剧本日志追加受诅咒的歌声或宇宙之秘一侧的遭遇组。'
    + '六对地点各随机放一个版本入场，另一个移出游戏；按剧本日志放对应变体地点；阿撒托斯的吹笛手放一边。'
    + '每位调查员从南区开始；按人数在随机地点放置初始裂口。',
  startLocation: 'southsideA',
  locations,
  setAsideLocations: [],
  acts: VARIANT_ACTS.music,
  agendas: stages(['05285'], 'agenda').map(agenda => ({ ...agenda, reveal: { type: 'campaignRule' } })),
  // 幕上 [fast]：移除本幕 3 个裂口 → 随机地点放 1 线索。
  scriptCards: { rules: { removeActBreaches: { card: 'act', codes: [...ACT_CODES] } } },
  ...definitions,
  storyAssets: {},
  encounterDeck: encounterDeck(gathered),
  resolutions: {
    noResolution: '你们没能阻止裂口继续扩大：每一位调查员都撤退或被击败。检查剧本日志——'
      + '如果安妮特·梅森被魔鬼附身，转至结局 3；如果卡尔·桑福德知晓了宇宙之秘，转至结局 4。',
    r1: '你们击败了安妮特·梅森，女巫集会的仪式被中断。安妮特在消失前留下挑战：可以继续单打独斗，'
      + '也可以向她求助；若队中有侦探、警察或机构人员，还能将她逮捕；若队中有秘术师、密斯卡托尼克大学成员或学者，'
      + '她愿意教导旧日的法术。四位调查员获得经验值，进入幕间故事 IV。',
    r2: '你们击败了卡尔·桑福德，银暮秘社的阴谋被挫败。卡尔提出交易：可以独自继续，也可以向桑福德求助；'
      + '若队中有侦探、警察或机构人员，还能将他逮捕；若队中有秘术师、银暮秘社或异教徒，可接管秘社控制权。'
      + '四位调查员获得经验值，进入幕间故事 IV。',
    r3: '安妮特站在女巫围成的圆圈中央，幽灵般的身影被天空中的裂口带走。凯夏借安妮特之口宣告：原初混沌即将收割生者的世界。'
      + '在世界的各个角落，响起一道如鸟鸣般尖细的不谐笛声。记录「末日渐近」，调查员获得经验值，进入幕间故事 IV。',
    r4: '卡尔·桑福德在银暮秘社的圣堂里完成了仪式，裂口在所有人头顶张开。真正的永生只有与之相配的人才能得到——'
      + '而秘社只是加速了自己的灭亡。记录「末日渐近」，调查员获得经验值，进入幕间故事 IV。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
