// 如履薄冰（On Thin Ice · 09609 · 安克雷奇 / 档案 #33-K）· 剧本数据。
//
// 参考实现（只读来源）：
//   · `Scenarios/TheScarletKeys/OnThinIce.hs`（四行地图、隐匿结界、五个结局、R4 回滚创伤/经验）；
//   · `Act/Cards/.../OnThinIce/*`（幕 1 幕后交易、幕 2 引出虚空奇美拉、幕 3 域外来客之巢、幕 4 绝杀一击）；
//   · `Agenda/Cards/.../OnThinIce/*`（密谋 1/2 空洞化[[盟友]]/[[道具]]、密谋 3 存在抹除 → R4）；
//   · `Location/CardDefs|Cards/.../OnThinIce/*`（九张地点的符号面、背面白身、地点能力）；
//   · `Enemy/CardDefs|Cards/.../OnThinIce/*`（索恩、虚空奇美拉真实形态 + 四个分裂形态、饥饿的灰熊）；
//   · `Treachery/.../OnThinIce/*`（冰层破裂、积雪崩坍）；
//   · locale `scenarios/onThinIce.json`（tokens / setup / rawDeal / resolutions）。
//
// 本文件只从 `../../card-data.js`（= `src/cards/cards-data.js`）取印刷数据，不抄第二份事实源；
// 卡牌行为在 `src/cards/encounter-entries/theScarletKeys/onThinIce/<code>.js` 单卡文件里。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterDefinitions, encounterGroupDeck, identitiesFor, location, stage } from '../../card-data.js'
import { chapterSection, flattenResolution, flattenStory } from '../../story-access.js'
import { ON_THIN_ICE_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'onThinIce'
export const REFERENCE_CODE = '09609'

export const RAW_CODES = Object.freeze({
  scenario: '09609',
  agenda1: '09610', agenda2: '09611', agenda3: '09612',
  act1: '09613', act2: '09614', act3: '09615a', act4: '09616',
  anchorage: '09617', fairbanks: '09618', mountainStream: '09619', frozenLake: '09620', isolatedRoad: '09621',
  forgottenOutpost: '09622', huntersLodge: '09623', condemnedGoldMine: '09624',
  outsidersLair: '09615b',
  thorneEnemy: '09625a', thorneAsset: '09625b',
  voidChimeraTrueForm: '09626', voidChimeraFellbeak: '09627', voidChimeraEarsplitter: '09628',
  voidChimeraGorefeaster: '09629', voidChimeraFellhound: '09630', ravenousGrizzly: '09631',
  crackingIce: '09632', snowslide: '09633',
  sableGlassStable: '09634a', sableGlassUnstable: '09634b',
})

// 遭遇组：指南 gatherSets 点名的八组（专属组 + 七个共享组）。
// 共享组的卡表与行为属于共享组 worker，本章只声明依赖（requiredEncounterGroupIds）。
// 口径（与主进程合并时的最终清单一致）：`Chilling Cold` 是核心复用组（卡表 encounterCode
// `chilling_cold`，不属于 TSK 的 26 组，因此不写进 manifest.requiredEncounterGroupIds，但仍要进牌库）；
// `Globetrotting`（环球漫游）与 `Red Coterie`（红色同志会）是**setup 需要**的战役级共享组
// （密钥登记/审判），不是 gatherSets 的牌库组，单独放 SETUP_GROUPS。
export const GATHER_GROUPS = Object.freeze([
  'onThinIce', 'agentsOfTheOutside', 'agentsOfYuggoth', 'crimsonConspiracy',
  'darkVeiling', 'outsiders', 'spatialAnomaly', 'chillingCold',
])
export const SETUP_GROUPS = Object.freeze(['globetrotting', 'redCoterie'])
export const SHARED_GROUPS = Object.freeze(GATHER_GROUPS.slice(1))

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
// 印刷连接符号（卡面左下角）：地点之间「我的符号出现在对方符号列表里」即相连。
// 九张地点都是双面卡（09617/09618 是单面城市地点）：未揭示面朝上时用背面符号（Triangle / T），
// 揭示后换成正面符号（Square / Circle / Moon / Spade / Heart / Hourglass）。
// 读点：引擎 `locations.js#linkLocationBySymbols` → `location-symbols.js#syncDynamicLocationSymbols`
// （`symbols.dynamic` 的地点按当前面的符号重算 `symbolLinks`，印刷连接不受影响）。
export const SYMBOL_LABELS = Object.freeze({
  squiggle: '波浪', diamond: '菱形', triangle: '三角', square: '方形', circle: '圆形', moon: '月牙',
  t: 'T 字', spade: '黑桃', heart: '心形', hourglass: '沙漏', nosymbol: '无符号',
})

export const START_LOCATION = 'anchorage'
export const CITY_LOCATION_IDS = Object.freeze(['anchorage', 'fairbanks'])
// 三张「阿拉斯加荒地」：布置时背面朝上洗混后与费尔班克斯相邻；
// 三张「界外荒地」：放在一边，山间溪流最后一个线索被发现后入场。
export const WILDERNESS_LOCATION_IDS = Object.freeze(['mountainStream', 'frozenLake', 'isolatedRoad'])
export const OUTER_WILDERNESS_LOCATION_IDS = Object.freeze(['forgottenOutpost', 'huntersLodge', 'condemnedGoldMine'])
export const OUTSIDERS_LAIR = 'outsidersLair'

// 每张地点的两面符号：front = 揭示面（印刷正面），back = 未揭示面（背面）。
const LOCATION_SPECS = Object.freeze([
  ['anchorage', RAW_CODES.anchorage, {
    clues: 1, cluesFixed: false, resignHere: true,
    front: { symbol: 'squiggle', links: ['diamond'] }, back: { symbol: 'squiggle', links: ['diamond'] },
  }],
  ['fairbanks', RAW_CODES.fairbanks, {
    clues: 0, cluesFixed: true,
    front: { symbol: 'diamond', links: ['squiggle', 'triangle', 'square', 'circle', 'moon'] },
    back: { symbol: 'diamond', links: ['squiggle', 'triangle', 'square', 'circle', 'moon'] },
  }],
  ['mountainStream', RAW_CODES.mountainStream, {
    clues: 1, cluesFixed: false, wilderness: true,
    front: { symbol: 'square', links: ['diamond', 't', 'spade', 'heart', 'hourglass'] },
    back: { symbol: 'triangle', links: ['diamond'] },
  }],
  ['frozenLake', RAW_CODES.frozenLake, {
    clues: 2, cluesFixed: false, wilderness: true,
    front: { symbol: 'circle', links: ['diamond'] }, back: { symbol: 'triangle', links: ['diamond'] },
  }],
  ['isolatedRoad', RAW_CODES.isolatedRoad, {
    clues: 2, cluesFixed: false, wilderness: true, hasVictory: true, victory: 1,
    front: { symbol: 'moon', links: ['diamond', 'spade'] }, back: { symbol: 'triangle', links: ['diamond'] },
  }],
  ['forgottenOutpost', RAW_CODES.forgottenOutpost, {
    clues: 1, cluesFixed: false, wilderness: true,
    front: { symbol: 'spade', links: ['square', 'moon'] }, back: { symbol: 't', links: ['square'] },
  }],
  ['huntersLodge', RAW_CODES.huntersLodge, {
    clues: 1, cluesFixed: false, wilderness: true, hasVictory: true, victory: 1, damageEnteringMonsters: true,
    front: { symbol: 'heart', links: ['square'] }, back: { symbol: 't', links: ['square'] },
  }],
  ['condemnedGoldMine', RAW_CODES.condemnedGoldMine, {
    clues: 0, cluesFixed: true,
    front: { symbol: 'hourglass', links: ['square'] }, back: { symbol: 't', links: ['square'] },
  }],
  ['outsidersLair', RAW_CODES.outsidersLair, {
    clues: 2, cluesFixed: false, hasVictory: true, victory: 1, otherworld: true,
    front: { symbol: 'nosymbol', links: [] }, back: { symbol: 'nosymbol', links: [] },
  }],
])

function symbolFace(face) {
  return {
    symbol: face.symbol, links: [...face.links],
    label: SYMBOL_LABELS[face.symbol] || face.symbol,
  }
}

// 未揭示面的「骨架」连接：三张阿拉斯加荒地背面是 Triangle（只连费尔班克斯），三张界外荒地背面是 T
// （只连山间溪流）。山间溪流揭示后的正面符号（Square）连 T/Spade/Heart/Hourglass，因此它与三张界外
// 荒地的边在揭示前后都成立（界外荒地只会在它揭示之后才入场）。运行时仍由 `symbols.dynamic` 重算；
// 这里声明这些边是为了让 manifest/layout 能表达印刷连接（展示连线必须是已声明的规则连接）。
const SPINE_CONNECTIONS = Object.freeze({
  anchorage: ['fairbanks'],
  fairbanks: ['anchorage', ...WILDERNESS_LOCATION_IDS],
  mountainStream: ['fairbanks', ...OUTER_WILDERNESS_LOCATION_IDS],
  frozenLake: ['fairbanks'],
  isolatedRoad: ['fairbanks'],
  forgottenOutpost: ['mountainStream'],
  huntersLodge: ['mountainStream'],
  condemnedGoldMine: ['mountainStream'],
  outsidersLair: [],
})

const locationData = ([id, code, spec]) => {
  const card = ALL_CARDS[code]
  return location({
    id, code, clues: spec.clues, cluesFixed: spec.cluesFixed,
    hasVictory: spec.hasVictory, victory: spec.victory,
    connections: [...SPINE_CONNECTIONS[id]],
    wilderness: spec.wilderness === true,
    ...(spec.otherworld ? { otherworld: true } : {}),
    ...(spec.resignHere ? { resign: true } : {}),
    ...(spec.damageEnteringMonsters ? { damageEnteringMonsters: true } : {}),
    // 未揭示面数据：名称/符号/特性（引擎 placeLocation 会合并 `state.locationVariants`，
    // 未揭示时显示背面白身，揭示时由 `unrevealedActualName` 换回正面名）。
    unrevealed: {
      name: card.backNameZh || card.backName,
      nameEn: card.backName,
      traits: [...(card.traits || [])],
      symbol: spec.back.symbol,
      links: [...spec.back.links],
    },
    // 引擎 `symbolFace()` 读法：已揭示读 front、未揭示读 back（缺失回退另一面）。
    symbols: { dynamic: true, front: symbolFace(spec.front), back: symbolFace(spec.back) },
  })
}

export const LOCATIONS = Object.freeze(Object.fromEntries(
  LOCATION_SPECS.map(spec => [spec[0], Object.freeze(locationData(spec))])))

export const SET_ASIDE_LOCATION_IDS = Object.freeze([...OUTER_WILDERNESS_LOCATION_IDS])

/** 印刷线索值：固定值用印刷固定值，否则印刷值 × 调查员人数。 */
export function clueValueOf(state, locationId) {
  const definition = LOCATIONS[locationId]
  if (!definition) return 0
  const count = Number(state?.numInvestigators) || (state?.investigators || []).length || 1
  if (definition.cluesFixed) return Number(definition.cluesPerInvestigator) || 0
  return (Number(definition.cluesPerInvestigator) || 0) * count
}

/** 已在场的[[荒地]]地点 id（按入场顺序）。 */
export function wildernessInPlay(state) {
  return (state?.locations || [])
    .filter(item => (item.traits || []).some(trait => String(trait).toLowerCase() === 'wilderness'))
    .map(item => item.id)
}

// ---------------------------------------------------------------------------
// 遭遇牌（专属组）
// ---------------------------------------------------------------------------
// 遭遇牌库（印刷份数）：饥饿的灰熊 ×2、冰层破裂 ×4、积雪崩坍 ×2。
// 索恩（敌人/剧情支援两面）、五张虚空奇美拉、玄丧之镜都放在一边，不进遭遇牌库。
export const ENEMY_CODES = Object.freeze([RAW_CODES.thorneEnemy, RAW_CODES.voidChimeraTrueForm,
  RAW_CODES.voidChimeraFellbeak, RAW_CODES.voidChimeraEarsplitter, RAW_CODES.voidChimeraGorefeaster,
  RAW_CODES.voidChimeraFellhound, RAW_CODES.ravenousGrizzly])
export const VOID_CHIMERA_FORM_CODES = Object.freeze([RAW_CODES.voidChimeraFellbeak,
  RAW_CODES.voidChimeraEarsplitter, RAW_CODES.voidChimeraGorefeaster, RAW_CODES.voidChimeraFellhound])
export const TREACHERY_CODES = Object.freeze([RAW_CODES.crackingIce, RAW_CODES.snowslide])
export const STORY_ASSET_CODES = Object.freeze([RAW_CODES.thorneAsset])
export const KEY_CODES = Object.freeze([RAW_CODES.sableGlassStable, RAW_CODES.sableGlassUnstable])
// 遭遇牌库见下方 SET_ASIDE_CODES / IN_PLAY_CODES 之后的 ENCOUNTER_DECK（专属组 + 七个共享组）。

// 放一边（不进遭遇牌库、开局不在场）：索恩两面（09625a 敌人 / 09625b 剧情支援）、
// 五张虚空奇美拉、玄丧之镜（稳定面），以及三张界外荒地地点（由 setAsideLocations 记）。
export const SET_ASIDE_CODES = Object.freeze([
  ...ENEMY_CODES.filter(code => code !== RAW_CODES.ravenousGrizzly),
  ...STORY_ASSET_CODES, RAW_CODES.sableGlassStable,
])
// 开局在场（zone 记账用卡号）：安克雷奇、费尔班克斯与三张背面朝上的阿拉斯加荒地。
export const IN_PLAY_CODES = Object.freeze([
  RAW_CODES.anchorage, RAW_CODES.fairbanks, RAW_CODES.mountainStream, RAW_CODES.frozenLake, RAW_CODES.isolatedRoad,
])

// 隐匿（Concealed 4）：真实形态 4 张诱饵 —— 但四张诱饵是**具名**分裂形态
// （凶残巨喙/震耳欲聋/尤嗜鲜血/凶狠猎犬），揭露时按副标题生成对应敌人。
export const CONCEALED_AMOUNT = 4
export const TRUE_FORM_MINI = 'VoidChimeraTrueForm'
export const DECOY_KINDS = Object.freeze({
  DecoyVoidChimeraFellbeak: RAW_CODES.voidChimeraFellbeak,
  DecoyVoidChimeraEarsplitter: RAW_CODES.voidChimeraEarsplitter,
  DecoyVoidChimeraGorefeaster: RAW_CODES.voidChimeraGorefeaster,
  DecoyVoidChimeraFellhound: RAW_CODES.voidChimeraFellhound,
})

// 2026-11-13 P0：遭遇牌库=专属组 + 七个共享组（旧实现只放本章 8 张，其它 gatherSets 组全缺 →
// 真实抽取 4 次即空。共享组卡表由 card-data.js#encounterGroupDeck 统一展开）。
export const ENCOUNTER_DECK = Object.freeze(encounterGroupDeck(GATHER_GROUPS, {
  exclude: [...SET_ASIDE_CODES, ...IN_PLAY_CODES],
}))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

const printed = encounterDefinitions([...new Set([
  ...ENEMY_CODES, ...TREACHERY_CODES, ...STORY_ASSET_CODES, ...ENCOUNTER_DECK_CODES,
])])
// 「得到 +N[per_investigator]生命值」：印刷值 + 每调查员加值（引擎 spawnEnemy 的 healthPerPlayerBonus）。
const HEALTH_PER_PLAYER = Object.freeze({
  [RAW_CODES.thorneEnemy]: 2,
  [RAW_CODES.voidChimeraFellbeak]: 1,
  [RAW_CODES.voidChimeraEarsplitter]: 1,
  [RAW_CODES.voidChimeraGorefeaster]: 1,
  [RAW_CODES.voidChimeraFellhound]: 1,
})
const enemyDefinition = code => ({
  ...printed.enemies[code],
  code, originalCode: code,
  ...(HEALTH_PER_PLAYER[code] ? { healthPerPlayerBonus: HEALTH_PER_PLAYER[code] } : {}),
  ...(code === RAW_CODES.voidChimeraTrueForm ? { concealed: CONCEALED_AMOUNT, massive: true } : {}),
  traits: [...(ALL_CARDS[code].traits || [])],
})
const treacheryDefinition = code => ({
  ...printed.treacheries[code],
  code, originalCode: code,
  // 引擎 `treachery-tokens.js#resolveTreacheryBody` 只对 `effect.kind === 'campaignRule'` 走内容结算：
  // 本章两张专属诡计由条目 `encounterResolve` 分派（behavior.resolveEncounter）。
  effect: { kind: 'campaignRule' },
  traits: [...(ALL_CARDS[code].traits || [])],
})
// 共享组卡（域外使徒/犹格斯星使徒/猩红阴谋/黑暗笼罩/域外来客/空间异常/寒冷刺骨）也要进
// scenario.enemies/treacheries：生产组合根按章 Object.assign 到全局遭遇表，漏掉就会「未知遭遇卡」。
const OWN_ENEMY_CODES = new Set(ENEMY_CODES)
const sharedEnemies = Object.fromEntries(Object.entries(printed.enemies)
  .filter(([code]) => !OWN_ENEMY_CODES.has(code))
  .map(([code, definition]) => [code, Object.freeze({ ...definition, code, originalCode: code })]))
const sharedTreacheries = Object.fromEntries(Object.entries(printed.treacheries)
  .filter(([code]) => !TREACHERY_CODES.includes(code))
  .map(([code, definition]) => [code, Object.freeze({ ...definition, code, originalCode: code })]))
export const enemies = Object.freeze({
  ...sharedEnemies,
  ...Object.fromEntries(ENEMY_CODES.map(code => [code, enemyDefinition(code)])),
})
export const treacheries = Object.freeze({
  ...sharedTreacheries,
  ...Object.fromEntries(TREACHERY_CODES.map(code => [code, treacheryDefinition(code)])),
})
export const storyAssets = Object.freeze(Object.fromEntries(STORY_ASSET_CODES.map(code => [code,
  { ...printed.storyAssets[code], code, originalCode: code }])))

// ---------------------------------------------------------------------------
// 幕 / 密谋
// ---------------------------------------------------------------------------
const actDefinition = (code, number, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number }), id: `act${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    backName: card.backNameZh || card.backName || '',
    chapterFlow: CHAPTER_ID, reveal: { type: 'campaignRule' }, ...extra,
  }
}
const agendaDefinition = (code, number, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number, doom: card.doom }), id: `agenda${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    backName: card.backNameZh || card.backName || '',
    chapterFlow: CHAPTER_ID, reveal: { type: 'campaignRule' }, ...extra,
  }
}
// 幕 1：只有废弃金矿的调查员可以共同花费 3×人数线索推进（引擎 objective.type='clues' 通用读点）。
export const ACT1 = Object.freeze(actDefinition(RAW_CODES.act1, 1, {
  objective: { type: 'clues', perInvestigator: 3, atLocation: 'condemnedGoldMine' },
}))
// 幕 2：荒野地点放「勘察报告」的行动 + 任意轮末可以推进。
export const ACT2 = Object.freeze(actDefinition(RAW_CODES.act2, 2, { objective: { type: 'campaignRule' } }))
// 幕 3：真实形态被揭露后推进；背面就是「域外来客之巢」地点（同一张物理卡 09615a/b）。
export const ACT3 = Object.freeze(actDefinition(RAW_CODES.act3, 3, {
  objective: { type: 'campaignRule' }, linkedLocation: OUTSIDERS_LAIR,
}))
// 幕 4：真实形态被击败后推进（背面按场上索恩的版本分流 R1/R2/R3）。
export const ACT4 = Object.freeze(actDefinition(RAW_CODES.act4, 4, { objective: { type: 'campaignRule' } }))

// 密谋 1/2：毁灭阈值 7/6，背面空洞化每位调查员的一个[[盟友]]/[[道具]]。
// 密谋 3：毁灭阈值 5，背面「存在抹除」→ 结局 4。
export const AGENDAS = Object.freeze([
  agendaDefinition(RAW_CODES.agenda1, 1),
  agendaDefinition(RAW_CODES.agenda2, 2),
  agendaDefinition(RAW_CODES.agenda3, 3),
])
export const acts = Object.freeze([ACT1, ACT2, ACT3, ACT4])
export const agendas = AGENDAS

// ---------------------------------------------------------------------------
// 绯红密钥：玄丧之镜（09634a 稳定面 / 09634b 动荡面）
// ---------------------------------------------------------------------------
export const SABLE_GLASS_KEY = Object.freeze({
  id: '09634',
  stableFace: RAW_CODES.sableGlassStable,
  unstableFace: RAW_CODES.sableGlassUnstable,
  name: ALL_CARDS[RAW_CODES.sableGlassStable].nameZh || ALL_CARDS[RAW_CODES.sableGlassStable].name,
})

// ---------------------------------------------------------------------------
// 正文 / 结局 / 特别规则
// ---------------------------------------------------------------------------
const resolutionSection = key => chapterSection(CHAPTER_ID, `resolutions.${key}`, null)
const resolutionOf = key => {
  const section = resolutionSection(key)
  const text = section == null ? '' : flattenResolution(section)
  return text || key
}
export const resolutions = Object.freeze({
  noResolution: resolutionOf('noResolution'),
  resolution1: resolutionOf('resolution1'),
  resolution2: resolutionOf('resolution2'),
  resolution3: resolutionOf('resolution3'),
  resolution4: resolutionOf('resolution4'),
})

const introSection = chapterSection(CHAPTER_ID, 'intro', {}) || {}
const setupSection = chapterSection(CHAPTER_ID, 'setup', {}) || {}
const rawDealSection = chapterSection(CHAPTER_ID, 'rawDeal', {}) || {}
const tokenMeanings = ON_THIN_ICE_TOKEN_MEANINGS

export const RAW_DEAL = Object.freeze({
  checkAgenda: flattenStory(rawDealSection.checkAgenda),
  agenda1: flattenStory(rawDealSection.agenda1),
  notAgenda1: flattenStory(rawDealSection.notAgenda1),
  labels: Object.freeze({
    deal: rawDealSection.label?.option3 || '我们先暂时跟你们合作。',
    refuse: rawDealSection.label?.option4 || '不。我们赢得光明正大。',
    seize: rawDealSection.label?.option5 || '我们不能让钥匙落到结社手里！',
  }),
  stories: Object.freeze({
    deal1: flattenStory(rawDealSection.rawDeal1),
    deal2: flattenStory(rawDealSection.rawDeal2),
    deal3: flattenStory(rawDealSection.rawDeal3),
    deal4: flattenStory(rawDealSection.rawDeal4),
    deal5: flattenStory(rawDealSection.rawDeal5),
  }),
})

const specialRulesText = [
  '【特别规则：荒野与追踪】三张阿拉斯加荒地（山间溪流/冰封湖面/偏远小路）背面朝上洗混后与费尔班克斯相邻入场；'
    + '三张界外荒地（被遗忘的哨站/猎人小屋/废弃金矿）放在一边，山间溪流上最后一个线索被发现后与它相邻入场。'
    + '地点的连接由卡面左下角的符号决定：符号出现在对方符号列表里即相连（未揭示面用背面符号）。',
  '【特别规则：隐匿（Concealed 4）与揭露（Expose）】虚空奇美拉（真实形态）进入阴影时拿取 4 张具名诱饵'
    + '（凶残巨喙/震耳欲聋/尤嗜鲜血/凶狠猎犬）与它的真身迷你卡，正面朝下混洗后尽可能平均地分配到在场的[[荒地]]地点；'
    + '在有迷你卡的地点可以各花 1 行动揭露 1 张。揭露诱饵时翻面，并把「放在一边」里副标题对应的那个形态生成在你的地点；'
    + '揭露真身时把真实形态放置入场。其它形态在场时，任何调查员都不能揭露迷你卡。',
  '【特别规则：空洞（Hollow）】手牌、牌库顶的牌、场上的支援被「放在一边，位于场外」时记为空洞。'
    + '空洞区归全队所有（`scope` 按卡面给 investigator/team）；安克雷奇可以让它的所有者把空洞抽回手中，'
    + '而密谋 3 的背面会把本场冒险移出场外的全部空洞收齐，让每位调查员放逐自己经验值费用最高的一张。',
  '【特别规则：绯红密钥（玄丧之镜）】玄丧之镜是双面密钥（稳定/动荡）。持有它的调查员可以在任意玩家窗口'
    + '以⚡变换它：稳定面查看你所在地点每张迷你卡的已揭示面（不揭露），动荡面让每位调查员把手中印刷费用最高的'
    + '非弱点卡放在一边作为空洞；每次变换后翻到另一面（同一把钥匙每轮只能变换一次）。',
  `【特别规则：混乱标记】${Object.entries(tokenMeanings.standard).map(([token, entry]) => `[${token}] ${entry.text}`).join('；')}`,
  '【特别规则：时间】开场按战役日志里已经过去的 time，每满 5 点就在密谋 1 上放 1 个毁灭标记；'
    + '结局 1/2/3 各记 3 点时间，未达成记 1 点，结局 4「本场冒险从未发生」不记时间。',
].join('\n\n')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  introTitle: introSection.title || '档案#33-K: 如履薄冰',
  intro: flattenStory(introSection.introPart1 || ''),
  introWayfarer: flattenStory(introSection.wayfarer || ''),
  introOutro: flattenStory(introSection.introPart2 || ''),
  setup: flattenStory(setupSection),
  setupChecklist: Object.freeze(Object.fromEntries(Object.entries(setupSection)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => [key, flattenStory(value)]))),
  specialRules: specialRulesText,
})

export const scenario = Object.freeze({
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: ALL_CARDS[REFERENCE_CODE].nameZh || ALL_CARDS[REFERENCE_CODE].name,
  nameEn: ALL_CARDS[REFERENCE_CODE].name,
  migrationStatus: 'development',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: SET_ASIDE_LOCATION_IDS,
  enemies, treacheries, storyAssets,
  acts, agendas, resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings,
  ...SCENARIO_TEXT,
})

// 身份映射：地点/敌人/诡计/剧情资产/幕/密谋（09615b 的物理背面是幕 3 的 09615a）。
const identityTable = identitiesFor(scenario)
identityTable.locations[OUTSIDERS_LAIR] = {
  ...identityTable.locations[OUTSIDERS_LAIR], linkedOriginalCode: RAW_CODES.act3,
}
export const identities = Object.freeze(identityTable)

// 需要单卡条目的卡号（敌人/诡计/剧情支援/密钥）；地点/幕/密谋/参考卡不建条目。
export const CHAPTER_ENTRY_CODES = Object.freeze([
  ...ENEMY_CODES, ...TREACHERY_CODES, ...STORY_ASSET_CODES, ...KEY_CODES,
])

// 战役记录键（本地 zh/en 标签表里的真实键名）。
export const RECORD_KEYS = Object.freeze({
  time: 'time',
  dealWithThorne: 'theCellMadeADealWithThorne',
  thorneDisappeared: 'thorneDisappeared',
  youHaventSeenTheLastOfThorn: 'youHaventSeenTheLastOfThorn',
  theVoidChimeraEscaped: 'theVoidChimeraEscaped',
  nothingOfNoteInAnchorage: 'thereIsNothingOfNoteInAnchorage',
  erasedFromExistence: 'erasedFromExistence',
})
export const RECORD_READS = Object.freeze([RECORD_KEYS.time, RECORD_KEYS.dealWithThorne,
  RECORD_KEYS.thorneDisappeared, RECORD_KEYS.youHaventSeenTheLastOfThorn, RECORD_KEYS.theVoidChimeraEscaped,
  RECORD_KEYS.nothingOfNoteInAnchorage, RECORD_KEYS.erasedFromExistence])
export const RECORD_WRITES = Object.freeze([...RECORD_READS])
