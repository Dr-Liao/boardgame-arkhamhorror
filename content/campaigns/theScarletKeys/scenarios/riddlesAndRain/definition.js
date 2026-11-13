// 谜雨（riddlesAndRain · 印刷参考卡 09501）· 章节数据（scenario 只含数据与印刷数值）。
//
// 来源：
//   · 指南 setup / intro / resolutions / trackingTime：参考
//     `参考资源/ArkhamHorror-main/frontend/src/locales/{en,zh}/theScarletKeys/scenarios/riddlesAndRain.json`；
//   · 印刷卡名/卡文/帷幕/线索/胜利点/毁灭阈值/份数：`src/cards/cards-data.js`（经 `card-data.js` 读取，
//     不复制卡文；幕/议程的「所需线索数」也直接读印刷字段）；
//   · 剧情正文：`story-access.js#chapterStory / resolutionText`（生成物 `story-text.js`）。
//
// 卡号归属：本章条目目录只放 riddlesAndRain 组的敌人与两把密钥面（09518 / 09519a / 09519b）。
// 地点 09510–09517、幕 09506–09509、议程 09502–09505 只在本文件声明（按 P7 分片约定，地点能力写在
// behavior.js 的章节钩子里，与 EotE 的「地点不建条目」口径一致）。
//
// ⚠️ 已披露的口径（审计摘要 simplified）：
//   1. 连接数据：TSK 地点卡的连接符号只印在图面，cards-data 与指南 JSON 都没有连接表。下列连接按指南
//      布置顺序（伦敦雨街 → 大本钟/威斯敏斯特修道院/肯辛顿花园；塔桥 → 叛徒之门 → 伦敦塔 → 塔楼牢房）
//      与卡文语义（塔桥进入伦敦塔的额外费用、叛徒之门「揭示伦敦塔」）重建。若 P8 拿到印刷符号表，
//      只改 LOCATION_CONNECTIONS 一处即可。
//   2. 幕的线索需求：印刷幕卡只给「Clues: 2 / 3」数值、未标 per_investigator 图标位；按本战役其余
//      数值（地点线索、敌人生命、资源）一律按调查员人数缩放的惯例，读作「每调查员 N 个」。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { location, stage, encounterDefinitions, identitiesFor, printed } from '../../card-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { chapterStory, flattenResolution, resolutionText } from '../../story-access.js'
import { RIDDLES_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'riddlesAndRain'
export const REFERENCE_CODE = '09501'
// 幕：1 纵横之谜 / 2 游戏开始！/ 3 塔上黑眼 / 4 当场抓获
export const ACT_CODES = Object.freeze(['09506', '09507', '09508', '09509'])
// 议程：1 偏逢大雨…… / 2 雾中身影 / 3 其中关联 / 4 阴谋阴郁
export const AGENDA_CODES = Object.freeze(['09502', '09503', '09504', '09505'])

// 指南 setup 的 gather 列表（9 组）：Riddles and Rain、Crimson Conspiracy、Dark Veiling、Outsiders、
// Shadow of a Doubt、Strange Happenings、Chilling Cold、Locked Doors、The Midnight Masks。
// 其中 The Midnight Masks（卡表 encounterCode = arkham）只取 5 张诡计（3× 追猎鬼影 / 2× 错误指示）。
export const GATHER_GROUPS = Object.freeze([
  'riddlesAndRain', 'crimsonConspiracy', 'darkVeiling', 'outsiders', 'shadowOfADoubt',
  'strangeHappenings', 'chillingCold', 'lockedDoors', 'arkham',
])
// 「Set the Crimson Conspiracy and Outsiders encounter sets aside, out of play.」
export const GATHER_SET_ASIDE_GROUPS = Object.freeze(['crimsonConspiracy', 'outsiders'])

// ---------------------------------------------------------------------------
// 地点（09510–09517）
// ---------------------------------------------------------------------------
// [id, code]，顺序 = 剧本手册地图顺序；线索数与帷幕来自印刷字段。
export const LOCATION_TABLE = Object.freeze([
  ['rainyLondonStreets', '09510'],
  ['bigBen', '09511'],
  ['westminsterAbbey', '09512'],
  ['kensingtonGardens', '09513'],
  ['towerBridge', '09514'],
  ['traitorsGate', '09515'],
  ['towerOfLondon', '09516'],
  ['towerPrison', '09517'],
])

// 重建的伦敦街道连接（见文件头 ⚠️ 1）。对称表，双向声明。
export const LOCATION_CONNECTIONS = Object.freeze({
  rainyLondonStreets: Object.freeze(['bigBen', 'westminsterAbbey', 'kensingtonGardens', 'towerBridge']),
  bigBen: Object.freeze(['rainyLondonStreets', 'westminsterAbbey']),
  westminsterAbbey: Object.freeze(['rainyLondonStreets', 'bigBen', 'kensingtonGardens']),
  kensingtonGardens: Object.freeze(['rainyLondonStreets', 'westminsterAbbey']),
  towerBridge: Object.freeze(['rainyLondonStreets', 'traitorsGate', 'towerOfLondon']),
  traitorsGate: Object.freeze(['towerBridge', 'towerOfLondon']),
  towerOfLondon: Object.freeze(['towerBridge', 'traitorsGate', 'towerPrison']),
  towerPrison: Object.freeze(['towerOfLondon']),
})

// 桌面坐标（伦敦示意：西 → 东、北 → 南）。只影响布局展示，不产生规则连接。
export const LOCATION_COORDINATES = Object.freeze({
  kensingtonGardens: { x: 4, y: 12 },
  westminsterAbbey: { x: 12, y: 14 },
  bigBen: { x: 20, y: 12 },
  rainyLondonStreets: { x: 14, y: 6 },
  towerBridge: { x: 26, y: 6 },
  traitorsGate: { x: 32, y: 8 },
  towerOfLondon: { x: 30, y: 14 },
  towerPrison: { x: 34, y: 20 },
})

export const START_LOCATION = 'rainyLondonStreets'
// setup：只放伦敦雨街；「Set each other location aside, out of play.」
export const SET_ASIDE_LOCATION_IDS = Object.freeze([
  'bigBen', 'westminsterAbbey', 'kensingtonGardens', 'towerBridge', 'traitorsGate', 'towerOfLondon', 'towerPrison',
])
// 幕/议程背面依次放置的地点（同一份事实，behavior 只读这里）。
export const LOCATIONS_BY_BACK = Object.freeze({
  act1: Object.freeze(['kensingtonGardens', 'westminsterAbbey', 'bigBen']),
  act2: Object.freeze(['towerBridge', 'towerOfLondon']),
  act3: Object.freeze(['towerPrison']),
  agenda1: Object.freeze(['kensingtonGardens', 'westminsterAbbey', 'bigBen']),
  agenda2: Object.freeze(['towerBridge', 'towerOfLondon']),
})

// 印刷胜利点（cards-data 的 victory 字段）：大本钟 / 肯辛顿花园 / 塔楼牢房各 1。
const VICTORY_LOCATIONS = new Set(['bigBen', 'kensingtonGardens', 'towerPrison'])

export const LOCATIONS = Object.fromEntries(LOCATION_TABLE.map(([id, code]) => {
  const built = location({ id, code, clues: ALL_CARDS[code]?.clues ?? 0 })
  built.connections = [...LOCATION_CONNECTIONS[id]]
  if (VICTORY_LOCATIONS.has(id)) built.victory = Number(ALL_CARDS[code]?.victory ?? 1)
  return [id, built]
}))

// ---------------------------------------------------------------------------
// 遭遇牌库（gather 后进入牌库的部分）与放一边
// ---------------------------------------------------------------------------
// 初始牌库：Chilling Cold / Locked Doors / Strange Happenings / Shadow of a Doubt / Dark Veiling
// + The Midnight Masks 的 5 张诡计（01135 ×3、01136 ×2）。Crimson Conspiracy 与 Outsiders 放一边
// （幕 2 / 议程 2 背面洗入）。
export const ENCOUNTER_DECK = Object.freeze([
  '01135', '01135', '01135', '01136', '01136',
  '01167', '01167', '01168', '01168',
  '01174', '01174',
  '09718', '09718', '09719', '09719',
  '09722', '09722', '09723', '09723',
  '09724', '09724', '09725', '09725',
])
// 放一边的共享组卡（按印刷份数展开）：Crimson Conspiracy（09716a/b/c、09717 ×2）与
// Outsiders（09731 ×3、09732、09733 ×2）。
export const SET_ASIDE_GROUP_CODES = Object.freeze([
  '09716a', '09716b', '09716c', '09717', '09717',
  '09731', '09731', '09731', '09732', '09733', '09733',
])
// 本章放一边的实体：「Set The Red-Gloved Man enemy and The Eye of Ravens key aside, out of play.」
// 渡鸦之眼的物理卡在卡表里只有 a/b 两面（没有 5 位主卡号），放一边时用稳定面卡号登记。
export const SET_ASIDE_ENTITY_CODES = Object.freeze(['09518', '09519a'])
export const SET_ASIDE_ALIASES = Object.freeze([...SET_ASIDE_GROUP_CODES, ...SET_ASIDE_ENTITY_CODES])

// ---------------------------------------------------------------------------
// 隐匿迷你卡池（Concealed）
// ---------------------------------------------------------------------------
// 「Gather each decoy mini-card and each of the following mini-cards: The Red-Gloved Man and
//  Coterie Agents (A, B and C).」——迷你卡不是卡表卡号；引擎 kind 的首字符必须是字母，
//  因此真实迷你卡的 kind 统一写成 `enemy<卡号>`。
export const CONCEALED_ENEMY_CODES = Object.freeze(['09518', '09716a', '09716b', '09716c'])
export const CONCEALED_DECOY_KIND = 'decoy'
export const concealedKindOf = code => `enemy${code}`
export const concealedCodeOf = kind => /^enemy(\d{5}[a-z]?)$/.exec(String(kind || ''))?.[1] || null
// Concealed X 的权威规格（2026-11-13 P1-3）：`value` 是印刷 X，`perInvestigator` 只在卡面带
// `[per_investigator]` 图标时为真。戴红手套的男子（09518）是 1[per_investigator]；结社特工 A/B/C
// 印刷为 Concealed 2（无图标）→ 总诱饵数恒为 2，不随人数放大。
export const CONCEALED_DECOY_SPECS = Object.freeze({
  '09518': Object.freeze({ value: 1, perInvestigator: true }),
  '09716a': Object.freeze({ value: 2, perInvestigator: false }),
  '09716b': Object.freeze({ value: 2, perInvestigator: false }),
  '09716c': Object.freeze({ value: 2, perInvestigator: false }),
})
// 兼容旧名：数值改为「印刷 X」；是否需要乘人数看 CONCEALED_DECOY_SPECS.perInvestigator。
export const CONCEALED_DECOYS_PER_INVESTIGATOR = Object.freeze(Object.fromEntries(
  Object.entries(CONCEALED_DECOY_SPECS).map(([code, spec]) => [code, spec.value])))

// ---------------------------------------------------------------------------
// 绯红密钥（渡鸦之眼 · 稳定面 09519a / 动荡面 09519b）
// ---------------------------------------------------------------------------
export const KEY_ID = '09519'
export const KEY_CODES = Object.freeze({ stable: '09519a', unstable: '09519b' })
export const KEY_FACES = Object.freeze({
  stable: printed(KEY_CODES.stable),
  unstable: printed(KEY_CODES.unstable),
})

// ---------------------------------------------------------------------------
// 剧情正文
// ---------------------------------------------------------------------------
const safeChapterStory = id => {
  try { return chapterStory(id) } catch { return { sections: { resolutions: {} } } }
}
const STORY = safeChapterStory(CHAPTER_ID)
const SECTIONS = STORY.sections || {}
const STORY_RESOLUTIONS = STORY.resolutions || SECTIONS.resolutions || {}

const resolutionOf = key => resolutionText(CHAPTER_ID, key)
  || flattenResolution(STORY_RESOLUTIONS[key])
  || flattenResolution(SECTIONS.resolutions?.[key])
  || ''

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (source zh locale)',
  intro: [SECTIONS.intro, SECTIONS.intro1].filter(Boolean).join('\n\n'),
  setup: String(SECTIONS.setup || ''),
  trackingTime: String(SECTIONS.trackingTime || ''),
  resolutions: Object.freeze({
    noResolution: resolutionOf('noResolution'),
    resolution1: resolutionOf('resolution1'),
    resolution2: resolutionOf('resolution2'),
    resolution3: resolutionOf('resolution3'),
    resolution4: resolutionOf('resolution4'),
  }),
})

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
// 幕目标（引擎读 act.objective；自定义目标由 behavior.checkObjectives 判定）：
//   act1 = 共同花费印刷「Clues: 2」× 调查员数个线索（见 ⚠️ 2）；
//   act2 = 与戴红手套的男子交战；
//   act3 = 仅伦敦塔的调查员可共同花费印刷「Clues: 3」× 调查员数个线索；
//   act4 = 他被击败或其上有 1/调查员 资源。
const actObjective = code => {
  const printedClues = Number(ALL_CARDS[code]?.clues ?? 0)
  if (code === '09506') return { type: 'clues', perInvestigator: printedClues, atLocation: null }
  if (code === '09508') return { type: 'clues', perInvestigator: printedClues, atLocation: 'towerOfLondon' }
  if (code === '09507') return { type: 'chapterRule', chapterFlow: 'engageRedGlovedMan' }
  return { type: 'chapterRule', chapterFlow: 'stopRedGlovedMan' }
}

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '谜雨 · Riddles and Rain',
  nameEn: 'Riddles and Rain',
  archiveLabel: 'File #5-A',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  acts: ACT_CODES.map((code, index) => ({
    ...stage(code, { number: index + 1 }),
    id: `act${index + 1}`,
    reveal: { type: 'campaignRule' },
    objective: actObjective(code),
  })),
  agendas: AGENDA_CODES.map((code, index) => ({
    ...stage(code, { number: index + 1 }),
    id: `agenda${index + 1}`,
    reveal: { type: 'campaignRule' },
  })),
  // 遭遇定义：初始牌库与「放一边后洗入」的每组敌人都要有定义（engine 的 ALL_ENEMIES /
  // ALL_TREACHERIES 由 registerCampaignScenarios 从本文件的 enemies / treacheries 合并；
  // 缺一条就会在抽到该卡时抛「未知遭遇卡」）。Crimson Conspiracy / Outsiders 的敌人也在这里。
  ...encounterDefinitions([...new Set([...ENCOUNTER_DECK, ...SET_ASIDE_GROUP_CODES, ...CONCEALED_ENEMY_CODES, '09518'])]),
  storyAssets: {},
  storyFaces: Object.fromEntries([REFERENCE_CODE].map(code => [code, { ...printed(code), type: 'scenario' }])),
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: {
    noResolution: SCENARIO_TEXT.resolutions.noResolution,
    resolution1: SCENARIO_TEXT.resolutions.resolution1,
    resolution2: SCENARIO_TEXT.resolutions.resolution2,
    resolution3: SCENARIO_TEXT.resolutions.resolution3,
    resolution4: SCENARIO_TEXT.resolutions.resolution4,
  },
  tokenMeanings: {
    easy: { ...RIDDLES_TOKEN_MEANINGS.easy },
    standard: { ...RIDDLES_TOKEN_MEANINGS.standard },
    hard: { ...RIDDLES_TOKEN_MEANINGS.hard },
    expert: { ...RIDDLES_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

// behavior.js 引用的印刷卡号集中放这里（内容流程不写卡号字面量的第二份来源）。
export const RAW_CODES = Object.freeze({
  actCluesAndCapers: '09506',
  actTheGameIsAfoot: '09507',
  actEyesInTheTower: '09508',
  actCaughtRedHanded: '09509',
  agendaWhenItRains: '09502',
  agendaFiguresInTheFog: '09503',
  agendaTheConnection: '09504',
  agendaPlotsAndPanic: '09505',
  rainyLondonStreets: '09510',
  bigBen: '09511',
  westminsterAbbey: '09512',
  kensingtonGardens: '09513',
  towerBridge: '09514',
  traitorsGate: '09515',
  towerOfLondon: '09516',
  towerPrison: '09517',
  redGlovedMan: '09518',
  eyeOfRavensStable: '09519a',
  eyeOfRavensUnstable: '09519b',
  coterieAgents: Object.freeze(['09716a', '09716b', '09716c']),
})
