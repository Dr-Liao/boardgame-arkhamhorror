// 八循环《绯红密钥》（The Scarlet Keys）战役共用身份与目录数据（纯数据模块）。
//
// P0（M0）只登记目录身份：卡号归属、章节身份、双面绯红密钥、混乱袋、世界地图与遭遇组。
// 卡牌行为、战役流程和关卡数据分别由 P1–P8 交付；本文件不提供任何可执行规则，
// 也不让内容离开 catalog-only。
//
// 口径见 docs/campaign/theScarletKeys/README.md §2/§4/§5：
//   · 本循环内容 = 参考卡包 `tskp`（09001–09128，调查员与玩家卡）与 `tskc`（09501–09770b，战役）；
//     连续编号只是首轮候选，最终范围以 cards-data 的 pack 归属为准（audit/tsk-scope.json 逐条核对）；
//   · 十章来自参考 frontend/src/arkham/data/theScarletKeys.json 与 CampaignSteps.hs（09501/09520/…/09694）；
//   · 26 个遭遇组：10 个只被单章使用（章节专用目录），16 个跨章/战役级共享（战役 _shared 目录）；
//   · 10 把双面绯红密钥（`[[Stable]]`／`[[Unstable]]`）：卡表以 a/b 两条记录表示两面，
//     P1 再确认渲染与双面卡数据口径；本文件只锁定物理卡号与两面卡号；
//   · 混乱袋四档来自参考 Campaigns/TheScarletKeys/Helpers.hs#campaignChaosBag
//     （skull×2 + tablet + elderthing + autofail + eldersign，没有 cultist——cultist 由状况报告 α/β/γ/ω 追加）；
//   · 世界地图 36 节点来自参考 Campaigns/TheScarletKeys/Meta.hs#worldMap，连接双向对称；
//     `side`（绿地）节点移动不耗时间，`locked` 节点需要剧情解锁。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CAMPAIGN_ID = 'theScarletKeys'
export const CAMPAIGN_NAME = 'The Scarlet Keys'
export const CAMPAIGN_NAME_ZH = '绯红密钥'
// 参考实现 campaigId（TheScarletKeys.hs: `campaign TheScarletKeys (CampaignId "09")`）。
export const CAMPAIGN_SOURCE_CODE = '09'

export const CYCLE_PACKS = Object.freeze(['tskp', 'tskc'])
// 首轮扫描候选范围（只用于 P0 scope 账本对账；归属以 ALL_CARDS[code].pack 为准）。
export const CANDIDATE_RANGES = Object.freeze([
  Object.freeze({ pack: 'tskp', from: '09001', to: '09128' }),
  Object.freeze({ pack: 'tskc', from: '09501', to: '09770' }),
])

// 十章：id 是内容层关卡 id；code 是印刷提示卡（referenceCode，也是参考 CampaignSteps.hs 的 ScenarioStep 值）；
// mapLocationId 是世界地图节点；archiveLabel 是剧情/指南里的档案编号（P0 从参考指南核对，P7 逐章复核）。
export const chapters = Object.freeze([
  ['riddlesAndRain', '09501', '谜雨', 'Riddles and Rain', 'London', 'File #5-A'],
  ['deadHeat', '09520', '死亡酷暑', 'Dead Heat', 'Marrakesh', 'File #11-B'],
  ['sanguineShadows', '09545', '血色阴影', 'Sanguine Shadows', 'BuenosAires', 'File #16-D'],
  ['dealingsInTheDark', '09566', '暗中交易', 'Dealings in the Dark', 'Constantinople', 'File #21-F'],
  ['dancingMad', '09591', '疯星乱舞', 'Dancing Mad', 'Havana', 'File #28-I'],
  ['onThinIce', '09609', '如履薄冰', 'On Thin Ice', 'Anchorage', 'File #33-K'],
  ['dogsOfWar', '09635', '战争疮痍', 'Dogs of War', 'Alexandria', 'File #38-N'],
  ['shadesOfSuffering', '09660', '苦痛之影', 'Shades of Suffering', 'KualaLumpur', 'File #46-Q'],
  ['withoutATrace', '09681', '不留痕迹', 'Without a Trace', 'BermudaTriangle', 'File #56-Y'],
  ['congressOfTheKeys', '09694', '钥匙议会', 'Congress of the Keys', 'Tunguska', 'File #59-Z'],
].map(([id, code, name, nameEn, mapLocationId, archiveLabel]) => Object.freeze({
  id, code, name, nameEn, mapLocationId, archiveLabel,
  referenceCode: code,
  guideId: id,
  encounterCode: ALL_CARDS[code].encounterCode,
  packCode: ALL_CARDS[code].pack,
})))

// 印刷提示卡（混乱符号参考卡）共 10 张，一章一张；供 P3 规则书与 P7 章节反查。
export const SCENARIO_REFERENCE_CODES = Object.freeze(chapters.map(chapter => chapter.referenceCode))

// 六位调查员（09001 卡森 / 09004 文森特 / 09008 基玛尼 / 09011 阿米娜 / 09015 达雷尔 / 09018 查理）。
export const INVESTIGATOR_CODES = Object.freeze(['09001', '09004', '09008', '09011', '09015', '09018'])

// 专属依赖 = deckRequirements.signatureCards（14 张：09002–09003、09005–09007、09009–09010、
// 09012–09014、09016–09017、09019–09020）。与调查员本身一起占满 09001–09020 这 20 个主卡号。
export const SIGNATURE_CODES = Object.freeze(INVESTIGATOR_CODES
  .flatMap(code => ALL_CARDS[code].deckRequirements?.signatureCards || [])
  .sort())
const investigatorDependents = new Set([...INVESTIGATOR_CODES, ...SIGNATURE_CODES])

// 全循环印刷记录（主卡 + a/b/c/d 关联面）。范围以卡包归属为准，不用连续编号猜。
export const CYCLE_CODES = Object.freeze(Object.keys(ALL_CARDS)
  .filter(code => CYCLE_PACKS.includes(ALL_CARDS[code].pack))
  .sort())
// 主卡号 = 5 位数字；关联面 = 5 位数字 + 小写字母。
export const isMainCardCode = code => /^\d{5}$/.test(code)
export const isLinkedFaceCode = code => /^\d{5}[a-z]$/.test(code)

// 三包无交集分区：战役 311 / 调查员及专属依赖 20 / 一般玩家卡 108（P0 scope 账本门禁逐条复算）。
export const CARD_PARTITIONS = Object.freeze({
  tskCampaign: Object.freeze(CYCLE_CODES.filter(code => ALL_CARDS[code].pack === 'tskc')),
  tskInvestigators: Object.freeze(CYCLE_CODES.filter(code => ALL_CARDS[code].pack === 'tskp'
    && investigatorDependents.has(code))),
  tskPlayer: Object.freeze(CYCLE_CODES.filter(code => ALL_CARDS[code].pack === 'tskp'
    && !investigatorDependents.has(code))),
})

// 十把双面绯红密钥：物理卡号 + Stable（稳定面，a）/ Unstable（动荡面，b）两面卡号。
// 卡表 a 面 traits 含 Stable、b 面含 Unstable；P1 核对双面渲染与 Shift 翻转的数据通道。
export const KEY_CARDS = Object.freeze([
  ['09519', '09519a', '09519b', 'riddlesAndRain'],
  ['09544', '09544a', '09544b', 'deadHeat'],
  ['09565', '09565a', '09565b', 'sanguineShadows'],
  ['09590', '09590a', '09590b', 'dealingsInTheDark'],
  ['09634', '09634a', '09634b', 'onThinIce'],
  ['09659', '09659a', '09659b', 'dogsOfWar'],
  ['09680', '09680a', '09680b', 'shadesOfSuffering'],
  ['09768', '09768a', '09768b', null],
  ['09769', '09769a', '09769b', null],
  ['09770', '09770a', '09770b', null],
].map(([id, stableCode, unstableCode, chapterId]) => {
  const card = ALL_CARDS[stableCode]
  return Object.freeze({
    id, stableCode, unstableCode, chapterId,
    name: card.name, nameZh: card.nameZh || '',
    subname: card.subname || '', subnameZh: card.subnameZh || '',
    encounterCode: card.encounterCode,
  })
}))
export const KEY_IDS = Object.freeze(KEY_CARDS.map(key => key.id))
// 参考实现 Key/Cards.hs 里还有一把 88045（The Wellspring of Fortune，fof 独立冒险包）；
// 它由《财富与愚行》使用，不属于本循环卡包，P0 只登记为范围外依赖。
export const EXTERNAL_KEY_CARD_CODE = '88045'

// 16 张定制升级卡（Customizable）：卡表 customizationText 非空，勾选项列表即 P6 的逐项迁移输入。
export const CUSTOMIZABLE_CODES = Object.freeze(Object.keys(ALL_CARDS)
  .filter(code => code >= '09001' && code <= '09128' && String(ALL_CARDS[code].customizationText || '').trim())
  .sort())

// 包清单使用的 camelCase 遭遇组 id（与 content/schema.js 的 `id` 约束一致）。
export const toCamelCase = value => String(value).replace(/_([a-z])/g, (_, lower) => lower.toUpperCase())

// 26 个遭遇组：卡池 encounterCode 的 camelCase 形式（按字母序稳定排列）。
const groupIds = [...new Set(CARD_PARTITIONS.tskCampaign.map(code => ALL_CARDS[code].encounterCode))].sort()
export const ENCOUNTER_GROUPS = Object.freeze(groupIds.map(toCamelCase))
// 内容侧 camelCase id → 卡池 encounterCode（snake_case）反查表。
export const ENCOUNTER_GROUP_CODES = Object.freeze(Object.fromEntries(
  groupIds.map(code => [toCamelCase(code), code]),
))
// 印刷遭遇组英文名（来自卡表 encounterName；中文名属 P7 剧情/规则书文案，这里不自造译名）。
export const ENCOUNTER_GROUP_NAMES = Object.freeze(Object.fromEntries(groupIds.map(code => {
  const card = CARD_PARTITIONS.tskCampaign.map(value => ALL_CARDS[value]).find(entry => entry.encounterCode === code)
  return [toCamelCase(code), card?.encounterName || toCamelCase(code)]
})))

// 只被单一章节单元使用的遭遇组 → 单卡文件落在该章节目录。
export const CHAPTER_ENCOUNTER_GROUPS = Object.freeze(Object.fromEntries(
  chapters.map(chapter => [chapter.id, toCamelCase(chapter.encounterCode)]),
))
// 其余 16 组：跨章复用或战役级共享（红色同志会、环球漫游、异界、清理小队、深红密谋等）→ 战役 _shared 目录。
export const SHARED_ENCOUNTER_GROUPS = Object.freeze(ENCOUNTER_GROUPS.filter(group =>
  !Object.values(CHAPTER_ENCOUNTER_GROUPS).includes(group)))

// 混乱袋四档：参考 Campaigns/TheScarletKeys/Helpers.hs#campaignChaosBag。
// 与 TIC/TDE/EotE 不同：没有 cultist；cultist 由状况报告 α/β/γ/ω 逐步追加（P2 时间轴原语）。
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze(['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'skull', 'tablet', 'elderthing', 'autofail', 'eldersign']),
  standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
    'skull', 'skull', 'tablet', 'elderthing', 'autofail', 'eldersign']),
  hard: Object.freeze(['0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5',
    'skull', 'skull', 'tablet', 'elderthing', 'autofail', 'eldersign']),
  expert: Object.freeze(['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8',
    'skull', 'skull', 'tablet', 'elderthing', 'autofail', 'eldersign']),
})

// 世界地图 36 节点：参考 Campaigns/TheScarletKeys/Meta.hs#worldMap（连接双向对称）。
// type：standard（普通，移动耗 1 时间）/ locked（需剧情解锁）/ side（side story 绿地，移动不耗时）。
export const WORLD_MAP = Object.freeze([
  Object.freeze({ id: 'Alexandria', type: 'standard', connections: Object.freeze(['Cairo', 'Constantinople', 'Rome']) }),
  Object.freeze({ id: 'Anchorage', type: 'standard', connections: Object.freeze(['SanFrancisco', 'Arkham']) }),
  Object.freeze({ id: 'Arkham', type: 'side', connections: Object.freeze(['Anchorage', 'Bermuda', 'YborCity', 'Reykjavik']) }),
  Object.freeze({ id: 'Bermuda', type: 'standard', connections: Object.freeze(['Arkham', 'YborCity', 'SanJuan', 'London', 'BermudaTriangle']) }),
  Object.freeze({ id: 'BermudaTriangle', type: 'locked', connections: Object.freeze(['YborCity', 'Bermuda', 'SanJuan']) }),
  Object.freeze({ id: 'Bombay', type: 'standard', connections: Object.freeze(['Kabul', 'Cairo', 'Kathmandu', 'KualaLumpur']) }),
  Object.freeze({ id: 'BuenosAires', type: 'standard', connections: Object.freeze(['Quito', 'Sydney', 'RioDeJaneiro']) }),
  Object.freeze({ id: 'Cairo', type: 'side', connections: Object.freeze(['Alexandria', 'Lagos', 'Nairobi', 'Kabul', 'Bombay']) }),
  Object.freeze({ id: 'Constantinople', type: 'standard', connections: Object.freeze(['Venice', 'Rome', 'Alexandria', 'Moscow', 'Kabul']) }),
  Object.freeze({ id: 'Havana', type: 'standard', connections: Object.freeze(['SanFrancisco', 'YborCity', 'Quito', 'SanJuan']) }),
  Object.freeze({ id: 'HongKong', type: 'locked', connections: Object.freeze(['Shanghai', 'KualaLumpur']) }),
  Object.freeze({ id: 'Kabul', type: 'locked', connections: Object.freeze(['Constantinople', 'Moscow', 'Tunguska', 'Kathmandu', 'Bombay', 'Cairo']) }),
  Object.freeze({ id: 'Kathmandu', type: 'standard', connections: Object.freeze(['Kabul', 'Tunguska', 'Shanghai', 'KualaLumpur', 'Bombay']) }),
  Object.freeze({ id: 'KualaLumpur', type: 'locked', connections: Object.freeze(['Bombay', 'Kathmandu', 'HongKong', 'Manokwari', 'Perth']) }),
  Object.freeze({ id: 'Lagos', type: 'standard', connections: Object.freeze(['Marrakesh', 'Cairo', 'Nairobi', 'RioDeJaneiro']) }),
  Object.freeze({ id: 'London', type: 'locked', connections: Object.freeze(['SanJuan', 'Bermuda', 'Stockholm', 'Venice', 'MonteCarlo']) }),
  Object.freeze({ id: 'Manokwari', type: 'locked', connections: Object.freeze(['KualaLumpur', 'Sydney', 'Shanghai', 'Quito']) }),
  Object.freeze({ id: 'Marrakesh', type: 'standard', connections: Object.freeze(['SanJuan', 'MonteCarlo', 'Rome', 'Lagos']) }),
  Object.freeze({ id: 'MonteCarlo', type: 'side', connections: Object.freeze(['London', 'Marrakesh', 'Rome']) }),
  Object.freeze({ id: 'Moscow', type: 'standard', connections: Object.freeze(['Constantinople', 'Tunguska', 'Kabul', 'Stockholm', 'Venice']) }),
  Object.freeze({ id: 'Nairobi', type: 'standard', connections: Object.freeze(['Cairo', 'Lagos', 'Perth']) }),
  Object.freeze({ id: 'NewOrleans', type: 'side', connections: Object.freeze(['SanFrancisco', 'YborCity']) }),
  Object.freeze({ id: 'Perth', type: 'standard', connections: Object.freeze(['KualaLumpur', 'Sydney', 'Nairobi']) }),
  Object.freeze({ id: 'Quito', type: 'locked', connections: Object.freeze(['Havana', 'Manokwari', 'BuenosAires', 'SanJuan']) }),
  Object.freeze({ id: 'Reykjavik', type: 'locked', connections: Object.freeze(['Arkham', 'Stockholm']) }),
  Object.freeze({ id: 'RioDeJaneiro', type: 'standard', connections: Object.freeze(['BuenosAires', 'Lagos', 'SanJuan']) }),
  Object.freeze({ id: 'Rome', type: 'standard', connections: Object.freeze(['Alexandria', 'Constantinople', 'Venice', 'MonteCarlo', 'Marrakesh']) }),
  Object.freeze({ id: 'SanFrancisco', type: 'standard', connections: Object.freeze(['Anchorage', 'Havana', 'NewOrleans', 'Tokyo']) }),
  Object.freeze({ id: 'SanJuan', type: 'locked', connections: Object.freeze(['Bermuda', 'BermudaTriangle', 'YborCity', 'Havana', 'Quito', 'RioDeJaneiro', 'London', 'Marrakesh']) }),
  Object.freeze({ id: 'Shanghai', type: 'standard', connections: Object.freeze(['Kathmandu', 'Tunguska', 'Tokyo', 'HongKong', 'Manokwari']) }),
  Object.freeze({ id: 'Stockholm', type: 'standard', connections: Object.freeze(['London', 'Reykjavik', 'Moscow']) }),
  Object.freeze({ id: 'Sydney', type: 'standard', connections: Object.freeze(['BuenosAires', 'Manokwari', 'Perth']) }),
  Object.freeze({ id: 'Tokyo', type: 'standard', connections: Object.freeze(['SanFrancisco', 'Shanghai']) }),
  Object.freeze({ id: 'Tunguska', type: 'locked', connections: Object.freeze(['Moscow', 'Kabul', 'Kathmandu', 'Shanghai']) }),
  Object.freeze({ id: 'Venice', type: 'side', connections: Object.freeze(['London', 'Constantinople', 'Moscow', 'Rome']) }),
  Object.freeze({ id: 'YborCity', type: 'standard', connections: Object.freeze(['NewOrleans', 'Arkham', 'Bermuda', 'SanJuan', 'BermudaTriangle', 'Havana']) }),
])
export const WORLD_MAP_IDS = Object.freeze(WORLD_MAP.map(node => node.id))
export const GREEN_LOCATIONS = Object.freeze(['Arkham', 'Cairo', 'Venice', 'NewOrleans', 'MonteCarlo'])
export const START_LOCATION = 'London'
// 参考 Meta.hs#initUnlockedLocations：21 个初始解锁普通/锁定节点 + 5 个绿地，共 26 个。
export const INITIAL_UNLOCKED = Object.freeze([
  'Anchorage', 'SanFrancisco', 'YborCity', 'Havana', 'BuenosAires', 'RioDeJaneiro', 'Bermuda',
  'Stockholm', 'Moscow', 'Rome', 'Constantinople', 'Marrakesh', 'Lagos', 'Nairobi', 'Alexandria',
  'Bombay', 'Kathmandu', 'Shanghai', 'Tokyo', 'Perth', 'Sydney',
  ...GREEN_LOCATIONS,
])

// 状况报告：参考 Helpers.hs#markTime 的固定阈值 [(7, Alpha), (10, Epsilon), (15, Beta), (20, Zeta), (24, Gamma), (35, Omega)]；
// θ/ψ 由战役 meta 记录的时间点动态插入（Interlude 32 与 F4 线索各写入一次）。
export const STATUS_REPORTS = Object.freeze([
  Object.freeze({ report: 'alpha', threshold: 7 }),
  Object.freeze({ report: 'epsilon', threshold: 10 }),
  Object.freeze({ report: 'beta', threshold: 15 }),
  Object.freeze({ report: 'zeta', threshold: 20 }),
  Object.freeze({ report: 'gamma', threshold: 24 }),
  Object.freeze({ report: 'omega', threshold: 35 }),
])
export const DYNAMIC_STATUS_REPORTS = Object.freeze(['theta', 'psi'])
// 时间满 35 时强制前往通古斯卡（Helpers.hs/`travel` 的 `if t >= 35 then Tunguska`）。
export const FORCED_ENDGAME_TIME = 35

// 幕间：1 = 序幕后幕间 I；14–55 是海外密档幕间（参考 TheScarletKeys.hs#travel 的目的地分支）。
// triggerLocations 是触发该幕间的世界地图节点；scopeId 是参考实现里的 i18n scope（P7 剧情分组用）。
export const INTERLUDES = Object.freeze([
  Object.freeze({ number: 1, scopeId: 'interlude1', triggerLocations: Object.freeze([]), kind: 'campaign' }),
  Object.freeze({ number: 14, scopeId: 'rusesAndReclamation', triggerLocations: Object.freeze(['Kabul', 'Quito', 'SanJuan', 'Reykjavik']) }),
  Object.freeze({ number: 20, scopeId: 'theGreatWork', triggerLocations: Object.freeze(['Bermuda']) }),
  Object.freeze({ number: 26, scopeId: 'quidProQuo', triggerLocations: Object.freeze(['Moscow', 'SanFrancisco']) }),
  Object.freeze({ number: 27, scopeId: 'deadAndGone', triggerLocations: Object.freeze(['London']) }),
  Object.freeze({ number: 32, scopeId: 'theCoiledSerpent', triggerLocations: Object.freeze(['Shanghai']) }),
  Object.freeze({ number: 36, scopeId: 'strangeArchitecture', triggerLocations: Object.freeze(['Bombay', 'Stockholm']) }),
  Object.freeze({ number: 37, scopeId: 'specialDelivery', triggerLocations: Object.freeze(['Lagos', 'Tokyo']) }),
  Object.freeze({ number: 44, scopeId: 'theoryOfAnnihilation', triggerLocations: Object.freeze(['RioDeJaneiro']) }),
  Object.freeze({ number: 45, scopeId: 'metamorphosis', triggerLocations: Object.freeze(['Manokwari']) }),
  Object.freeze({ number: 49, scopeId: 'ringingHollow', triggerLocations: Object.freeze(['Sydney']) }),
  Object.freeze({ number: 50, scopeId: 'bloodSweatAndTea', triggerLocations: Object.freeze(['HongKong']) }),
  Object.freeze({ number: 51, scopeId: 'romulusAndRemus', triggerLocations: Object.freeze(['Rome']) }),
  Object.freeze({ number: 52, scopeId: 'theSafehouse', triggerLocations: Object.freeze(['YborCity']) }),
  Object.freeze({ number: 53, scopeId: 'whistleOnTheWind', triggerLocations: Object.freeze(['Kathmandu']) }),
  Object.freeze({ number: 54, scopeId: 'infernalMachinery', triggerLocations: Object.freeze(['Nairobi']) }),
  Object.freeze({ number: 55, scopeId: 'paranaturalSelection', triggerLocations: Object.freeze(['Perth']) }),
])
// 主线关卡由踏上对应地图节点触发；《谜雨》在序幕直接开始，《钥匙议会》在通古斯卡。
export const CHAPTER_MAP_TRIGGERS = Object.freeze(Object.fromEntries(
  chapters.filter(chapter => chapter.id !== 'riddlesAndRain').map(chapter => [chapter.mapLocationId, chapter.id])))
// 触发 side story 的绿地节点（参考 pickSideStory 分支；side story 内容不在本循环卡包，P0 只登记依赖）。
export const SIDE_STORY_LOCATIONS = Object.freeze([...GREEN_LOCATIONS])

// 范围外遭遇组依赖：TSK 关卡 gather 的核心遭遇组（只登记依赖，不重复归入本轮分片）。
// group/encounterCode 是本仓库已实现的复用目录（shared/<repoDir>），subsetCodes 是参考实现只取的子集。
export const EXTERNAL_ENCOUNTER_DEPENDENCIES = Object.freeze([
  Object.freeze({ set: 'AncientEvils', group: 'ancientEvils', encounterCode: 'ancient_evils', repoDir: 'shared/ancient_evils' }),
  Object.freeze({ set: 'ChillingCold', group: 'chillingCold', encounterCode: 'chilling_cold', repoDir: 'shared/chilling_cold' }),
  Object.freeze({ set: 'DarkCult', group: 'pentagram', encounterCode: 'pentagram', repoDir: 'shared/pentagram',
    note: '参考集合名 DarkCult，本仓库既有复用目录名 pentagram（01169–01171）' }),
  Object.freeze({ set: 'Ghouls', group: 'ghouls', encounterCode: 'ghouls', repoDir: 'shared/ghouls' }),
  Object.freeze({ set: 'LockedDoors', group: 'lockedDoors', encounterCode: 'locked_doors', repoDir: 'shared/locked_doors' }),
  Object.freeze({ set: 'Nightgaunts', group: 'nightgaunts', encounterCode: 'nightgaunts', repoDir: 'shared/nightgaunts' }),
  Object.freeze({ set: 'StrikingFear', group: 'strikingFear', encounterCode: 'striking_fear', repoDir: 'shared/striking_fear',
    subsetCodes: Object.freeze(['01164', '01165']) }),
  Object.freeze({ set: 'TheMidnightMasks', group: 'arkham', encounterCode: 'arkham', repoDir: 'shared/arkham',
    subsetCodes: Object.freeze(['01135', '01136']) }),
])

// 战役规则常量（参考 TheScarletKeys.hs#invalidCards 与 travel）。
// 02310《戴红手套的男子》整场战役禁止进入牌组；ErasedFromExistence 记录里的卡也永久禁用（P7 接线）。
export const INVALID_CAMPAIGN_CARDS = Object.freeze(['02310'])
// 快捷旅票（Expedited Ticket）：放逐并记 1 时间直达任意目的地（参考 travelWithTicket）。
export const EXPEDITED_TICKET_CODE = '09765'

// P0 目录包：三包都只有身份与收录标记，规则未实现、不可构筑、战役不可启动。
// P5–P8 各包验收后改为 content/packs/<id>/manifest.js 的真实清单（与 TIC/TDE/EotE 同一迁移路径）。
export function catalogPack(id, name, cardRanges) {
  const codes = CARD_PARTITIONS[id]
  if (!codes) throw new RangeError(`未知目录包 ${id}`)
  if (!Array.isArray(cardRanges) || !cardRanges.length) throw new TypeError(`目录包 ${id} 缺少 cardRanges`)
  const encounterGroupIds = id === 'tskCampaign' ? [...ENCOUNTER_GROUPS] : []
  return Object.freeze({
    schemaVersion: CONTENT_SCHEMA_VERSION, id, name, contentVersion: '0.1.0', minRulesVersion: 'n6.0',
    status: 'catalog-only', dependencies: ['core'],
    cardRanges: cardRanges.map(range => Object.freeze({ ...range })),
    cards: codes.map(code => {
      const card = ALL_CARDS[code]
      const type = id === 'tskCampaign'
        ? (['enemy', 'treachery'].includes(card.type) ? 'encounter' : 'other')
        : 'player'
      return Object.freeze({
        code, name: card.nameZh || card.name, type,
        cataloged: true, imageAvailable: !!card.imagesrc, rulesImplemented: false, deckbuilding: false,
      })
    }),
    encounterGroupIds: Object.freeze(encounterGroupIds),
    behaviorIds: Object.freeze([]),
  })
}
