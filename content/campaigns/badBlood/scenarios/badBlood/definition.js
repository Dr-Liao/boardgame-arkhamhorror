// 血海深仇（Bad Blood · 90020）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/BadBlood.hs + Scenarios/BadBlood/{Helpers,Meta}.hs（memory 计数）；
//   Act|Agenda|Enemy/CardDefs/BadBlood.hs + Threads of Fate / Midnight Masks 复用卡；
//   frontend/src/locales/en/standalone/badBlood.json（intro / setup / tokens / resolutions）。
//
// 归属：本关专属卡 90020–90023b（90020 为剧本提示卡本身），遭遇组 bad_blood；
// 复用 Threads of Fate 地点 Velma's Diner 04141 / Curiositie Shoppe 04142 / Town Hall 04143
// 与四张随机地点（Eztli Exhibit 04117b / Black Cave 04133b / Train Tracks 04128b /
// Arkham Police Station 04126b，随机取 1 张）、午夜假面的 5 个地点与 2 种诡计；
// 移出游戏：Ichtaca (The Forgotten Guardian) 04147 与 Expedition Journal 04148。
//
// 本关口径：
//   1. 艾格尼丝·贝克（平行正面 90017）必须在场；1P 独立开局。
//   2. 每个地点放 1 个「记忆」；艾格尼丝可以用幕 1 的 [fast] 行动收集她所在地点的记忆；
//      艾尔佩斯在敌方阶段结束时若处于重整状态且所在地点有记忆，则收集该记忆。
//   3. 9 个记忆全部被收集后幕 1 推进（结局 1）；议程（doom 8）推进或艾格尼丝被击败 → 结局 2。
//   4. 艾尔佩斯「被击败」时改为治愈全部伤害、翻面结算 90023b（简化：艾格尼丝选择取 1 记忆或 2 线索）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'badBlood'
export const REFERENCE_CODE = '90020'
export const ENCOUNTER_CODE = 'bad_blood'
export const KEY_INVESTIGATOR = '90017' // 平行艾格尼丝·贝克
export const AGNES_TITLE = 'Agnes Baker'

export const ACT_CODE = '90022' // A Walk Down Memory Lane / 搜集回忆之路
export const AGENDA_CODE = '90021' // Hyperborean Blood / 希波利尔之血
export const ELSPETH_CODE = '90023' // Elspeth Baudin
export const ELSPETH_BACK_CODE = '90023b' // Triumph and Subjugation
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

// ---------------------------------------------------------------------------
// gather 组与遭遇牌库
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze([
  'threads_of_fate', 'pnakotic_brotherhood', 'locked_doors', 'nightgaunts', 'dark_cult',
])
export const EXTRA_DECK_CODES = Object.freeze(['01135', '01135', '01135', '01136', '01136'])
export const REMOVED_CODES = Object.freeze(['04147', '04148'])

const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const deckTypes = ['enemy', 'treachery']

export function groupDeck(groups, { extra = [], exclude = [] } = {}) {
  const wanted = new Set(groups.map(snake))
  const excluded = new Set(exclude)
  const codes = []
  for (const [code, card] of Object.entries(ALL_CARDS)) {
    if (excluded.has(code) || !wanted.has(card.encounterCode) || !deckTypes.includes(card.type)) continue
    codes.push(...Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
  }
  for (const code of extra) if (!excluded.has(code)) codes.push(code)
  return codes.sort()
}
export const ENCOUNTER_DECK = Object.freeze(groupDeck(ENCOUNTER_GROUPS, { extra: EXTRA_DECK_CODES }))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
export const START_LOCATION = 'velmasDiner'
const MIDNIGHT = Object.freeze({
  northside: { connections: ['rivertown', 'miskatonicUniversity', 'downtown', 'easttown'] },
  downtown: { connections: ['rivertown', 'miskatonicUniversity', 'northside', 'easttown'], downtown: true },
  easttown: { connections: ['miskatonicUniversity', 'downtown', 'northside', 'rivertown'] },
  miskatonicUniversity: { connections: ['rivertown', 'easttown', 'downtown', 'northside'] },
  rivertown: { connections: ['downtown', 'northside', 'miskatonicUniversity'] },
})
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['velmasDiner', '04141', Object.freeze(['easttown']), null]),
  Object.freeze(['curiositieShoppe', '04142', Object.freeze(['northside']), null]),
  Object.freeze(['townHall', '04143', Object.freeze(['downtown']), null]),
  Object.freeze(['northside', '01134', MIDNIGHT.northside.connections, Object.freeze({
    ability: { id: 'northsideBribe', label: '花费 5 资源获得 2 个线索', limit: 'team-game', cost: { resources: 5 }, effect: { type: 'gainClues', amount: 2 } },
  })]),
  Object.freeze(['downtown', '01130', MIDNIGHT.downtown.connections, Object.freeze({
    ability: { id: 'downtownLoan', label: '获得 3 资源', limit: 'game', effect: { type: 'gainResource', amount: 3 } },
  })]),
  Object.freeze(['easttown', '01132', MIDNIGHT.easttown.connections, null]),
  Object.freeze(['miskatonicUniversity', '01129', MIDNIGHT.miskatonicUniversity.connections, Object.freeze({
    ability: {
      id: 'miskatonicSearch', label: '检索牌库顶 6 张中的书籍或法术',
      effect: { type: 'searchTop', amount: 6, traits: ['Tome', 'Spell'], choose: 1 },
    },
  })]),
  Object.freeze(['rivertown', '01125', MIDNIGHT.rivertown.connections, null]),
])

// Setup 随机选取 1 张（反向幕卡对应地点），其余移出游戏。
export const RANDOM_LOCATION_TABLE = Object.freeze([
  Object.freeze(['eztliExhibit', '04117b', Object.freeze(['miskatonicUniversity'])]),
  Object.freeze(['blackCave', '04133b', Object.freeze(['rivertown'])]),
  Object.freeze(['trainTracks', '04128b', Object.freeze(['northside'])]),
  Object.freeze(['arkhamPoliceStation', '04126b', Object.freeze(['easttown'])]),
])
export const RANDOM_LOCATION_IDS = Object.freeze(RANDOM_LOCATION_TABLE.map(([id]) => id))
export const MONSTROUS_MEMORY_LOCATIONS = Object.freeze([...LOCATION_TABLE.map(([id]) => id), ...RANDOM_LOCATION_IDS])

export const LOCATION_COORDINATES = Object.freeze({
  curiositieShoppe: { x: 0, y: 0 },
  northside: { x: 1, y: 0 },
  townHall: { x: 2, y: 0 },
  trainTracks: { x: 3, y: 0 },
  velmasDiner: { x: 0, y: 1 },
  downtown: { x: 1, y: 1 },
  easttown: { x: 2, y: 1 },
  miskatonicUniversity: { x: 1, y: 2 },
  rivertown: { x: 2, y: 2 },
  eztliExhibit: { x: 0, y: 2 },
  blackCave: { x: 3, y: 2 },
  arkhamPoliceStation: { x: 3, y: 1 },
})

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Bad Blood card: ${code}`)
  return {
    code, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '', subnameEn: card.subname || '',
    text: card.textZh || card.text || '', textEn: card.text || '',
    backText: card.backTextZh || card.backText || '', backTextEn: card.backText || '',
    type: card.type, traits: [...(card.traits || [])],
    ...(card.victory != null ? { victory: card.victory } : {}),
  }
}

export function location(data) {
  const { id, code, connections, ...rest } = data
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Bad Blood location: ${code}`)
  return {
    ...printed(code), id, shroud: card.shroud,
    connections: [...(connections || [])],
    ...rest,
    cluesPerInvestigator: Number(card.clues) || 0,
    unrevealedName: card.backNameZh || card.backName || card.nameZh || card.name,
    unrevealedNameEn: card.backName || card.name,
  }
}

export function stage(code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Bad Blood stage card: ${code}`)
  const { number, doom, ...rest } = extra
  return {
    ...printed(code),
    id: `${card.type}${code}`,
    type: card.type,
    stage: `${number ?? card.stage ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...rest,
    ...(card.type === 'agenda' ? { doomThreshold: doom ?? card.doom } : {}),
    ...(card.type === 'act' ? { objective: { type: 'manual' } } : {}),
  }
}

const PREY = Object.freeze({
  'Most clues': 'mostClues', 'Fewest clues': 'fewestClues', 'Highest [agility]': 'highestAgility',
  'Lowest [agility]': 'lowestAgility', 'Highest [intellect]': 'highestIntellect', 'Lowest [intellect]': 'lowestIntellect',
})
const preyOf = text => PREY[/Prey - ([^.]+)\./.exec(String(text || ''))?.[1]?.trim()] || null

export function encounterDefinitions(codes) {
  const enemies = {}
  const treacheries = {}
  const storyAssets = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown Bad Blood encounter definition: ${code}`)
    const base = printed(code)
    if (card.type === 'enemy') {
      const text = String(card.text || '')
      enemies[code] = {
        ...base, fight: card.fight ?? null, evade: card.evade ?? null,
        health: card.health ?? null, damage: card.damage || 0, horror: card.horror || 0,
        ...(card.victory != null ? { victory: card.victory } : {}),
        ...(/\bHunter\b/.test(text) ? { hunter: true } : {}),
        ...(/\bAloof\b/.test(text) ? { aloof: true } : {}),
        ...(/\bRetaliate\b/.test(text) ? { retaliate: true } : {}),
        ...(/\bAlert\b/.test(text) ? { alert: true } : {}),
        ...(/\bPatrol\b/.test(text) ? { patrol: true } : {}),
        ...(preyOf(text) ? { prey: preyOf(text) } : {}),
        elite: (card.traits || []).includes('Elite'),
      }
    } else if (card.type === 'treachery') {
      treacheries[code] = { ...base, entryRevelation: true, surge: /^Surge\./m.test(card.text || '') }
    } else if (card.type === 'asset' || card.type === 'story') {
      storyAssets[code] = { ...base, global: false }
    }
  }
  return { enemies, treacheries, storyAssets }
}

export function identitiesFor(scenarioData) {
  const identity = value => ({
    originalCode: value.originalCode || value.code,
    artCode: value.originalCode || value.code,
  })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category, Object.fromEntries(Object.values(scenarioData[category] || {})
      .map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT_STAGE = Object.freeze({ ...stage(ACT_CODE, { number: 1 }), objective: { type: 'manual' } })
export const AGENDA_STAGE = Object.freeze(stage(AGENDA_CODE, { number: 1 }))
export const ACTS = Object.freeze([structuredClone(ACT_STAGE)])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGE)])
export const STAGE_CARDS = Object.freeze({
  [ACT_CODE]: structuredClone(ACT_STAGE),
  [AGENDA_CODE]: structuredClone(AGENDA_STAGE),
})

// ---------------------------------------------------------------------------
// 混乱标记（90020 正面 = 简单/普通，背面 = 困难/专家）
// ---------------------------------------------------------------------------
export const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为艾格尼丝·贝克已收集的记忆数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-2。重整艾尔佩斯·博丹并结算其巡逻关键字。', delta: -2 }),
    tablet: Object.freeze({ text: '-3。如果你失败且艾尔佩斯·博丹所在地点有记忆，把该标记放在那个地点上。', delta: -3 }),
    elderthing: Object.freeze({ text: '-6。艾格尼丝·贝克可以承受至多 3 点伤害，每承受 1 点伤害使本次检定额外 +2。', delta: -6 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 比艾格尼丝·贝克已收集的记忆数量多 1。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。重整艾尔佩斯·博丹并结算其巡逻关键字；若她与调查员交战，她发动攻击。', delta: -3 }),
    tablet: Object.freeze({ text: '-5。如果你失败且艾尔佩斯·博丹所在地点有记忆，把该标记放在那个地点上。', delta: -5 }),
    elderthing: Object.freeze({ text: '-8。艾格尼丝·贝克可以承受至多 3 点伤害，每承受 1 点伤害使本次检定额外 +2。', delta: -8 }),
  }),
})

export const tokenTier = state => (['hard', 'expert'].includes(String(state?.difficulty || 'standard')) ? 'hard' : 'standard')

// ---------------------------------------------------------------------------
// 剧情 / 规则 / 结局正文
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale)',
  heading: '血海深仇',
  intro: '你一直知道自己身上有些……不同。从小在梦里，你就看见另一个国度、另一种人生——充满魔法与威严、征服与迫害的人生。'
    + '当你发现那把奇怪而古老的钥匙的那一刻——当你认出把手上花纹与齿形的那一刻——你就知道那些梦根本不是梦，而是记忆。'
    + '另一段人生的记忆。一个叫「希波利尔」的地方的记忆。随着记忆回归，魔法也回来了。'
    + '几个月来你秘密练习，深入记忆、磨炼力量。但最近，你的梦变得黑暗而血腥。'
    + '前世的你并不像你这样仁慈宽容。她冷酷、渴望力量、令人恐惧。你选择只把这种奇怪的力量用于帮助他人，而不是伤害他们。'
    + '但你不是唯一一个记忆开始回归的人。几周前，艾尔佩斯·博丹第一次来餐厅。起初她只是个普通客人，'
    + '像其他客人一样点蛋、培根和黑咖啡。但她的眼神里有某种东西——某种认出你的火花，或好奇——让你警惕。'
    + '然后是问题。她先问起你挂在脖子上的钥匙。你带着最友善的微笑，说了惯常的谎话——那是家传之物，没有价值，只有纪念意义。'
    + '但她没有罢休。她开始刺探你的生活、你的家庭、你的梦。艾尔佩斯不是普通客人。她不是在闲聊，她在寻找答案，就像你一样。'
    + '于是你也去调查了。但阿卡姆没有艾尔佩斯居住的记录，少数知道她的人只用压低而惊恐的声音说话，给不了多少线索。'
    + '后来北区的古董商店打来电话：艾尔佩斯一直在寻找像你「传家宝」一样的古物，甚至说出了「希波利尔」这个名字。'
    + '她正在寻找能解锁更多记忆的东西，就像你一样——但她不是你这样。那种阴险的冷笑，人们提到她名字时颤抖的恐惧……'
    + '你不愿去想，一个心怀恶意、拥有你记忆中那种力量的人会做出什么……',
  introBranches: Object.freeze({}),
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集以下遭遇组的全部卡牌：血海深仇、命运之线、普纳科提克兄弟会、午夜假面、上锁的门、夜鹰、黑暗邪教。收集午夜假面遭遇组时只取 5 张诡计卡（2 张「假线索」与 3 张「追猎之影」）与以下地点：北区、商业区（阿卡姆第一银行）、东城区、米斯卡塔尼克大学、河岸城；不要取该组其余的卡。' },
    { key: 'scenarioReference', text: '将「命运之线」遭遇组原有的剧本提示卡移出游戏，改用「血海深仇」扩展提供的新提示卡。' },
    { key: 'placeLocations', text: '将北区、商业区、东城区、米斯卡塔尼克大学、河岸城、市政厅、薇尔玛餐厅、古董商店放入场。' },
    { key: 'startAt', text: '每位调查员从薇尔玛餐厅开始。' },
    { key: 'randomLocation', text: '从「命运之线」遭遇组原幕牌库的背面找出以下地点：埃兹特利展区、黑洞穴、铁轨、阿卡姆警察局。随机选择 1 张放入场（忽略其显现能力），其余移出游戏。' },
    { key: 'actAgendaDecks', text: '只使用「血海深仇」扩展提供的幕与议程卡构筑幕牌库与议程牌库。' },
    { key: 'removeStoryAssets', text: '将「伊奇塔卡（被遗忘的守护者）」故事资产与「探险日志」故事资产移出游戏。' },
    { key: 'placeElspeth', text: '将「艾尔佩斯·博丹」敌人放入古董商店。' },
    { key: 'placeMemories', text: '在场上每个地点放置 1 个资源，作为「记忆」。' },
    { key: 'readyToBegin', text: '现在可以开始游戏了。' },
  ]),
  specialRules: Object.freeze([
    {
      title: '巡逻',
      text: '某些敌人拥有巡逻关键字。在敌方阶段（框架步骤 3.2），每个重整且未交战的巡逻敌人沿最短路径向指定地点移动。'
        + '若有多个地点符合指定条件，由领队选择。若巡逻移动被卡牌能力阻挡，该敌人不移动。',
    },
    {
      title: '收集记忆',
      text: '本剧本中，艾格尼丝与艾尔佩斯竞速收集记忆。艾格尼丝可以用幕 1 正面的 [fast] 能力收集记忆；'
        + '艾尔佩斯在敌方阶段结束时若处于重整状态且所在地点有记忆，会自动收集该记忆（本 Mod 以「重整状态 + 有记忆」简化参考的混乱标记合计 6 点规则）。',
    },
    { title: '警报', text: '每次调查员在躲避拥有警报关键字的敌人时检定失败，结算完检定结果后，该敌人对躲避的调查员发动攻击。该敌人不会因警报攻击而横置。' },
  ]),
  rules: Object.freeze({
    memories: '记忆是地点上的资源；本 Mod 用地点实例的 memory 字段记录（0/1）。',
    elspeth: '艾尔佩斯不能被自动躲避；她每收集 1 个记忆，战斗值与闪避值 -1。',
  }),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '若全员被击败：按结局 2 结算。艾尔佩斯饶你一命，只留下你前世生活的碎片。'
      + '艾格尼丝获得经验等于胜利区卡牌胜利点总和，或她已收集记忆数，二者取高；其他调查员只获得胜利点。'
      + '艾格尼丝必须把「黑暗回忆」升级为进阶版，或把「希波利尔传家宝」进阶版降级为原本版本。',
    resolution1: '结局 1：本来可以很简单。你本可以现在就了结她，阻止她用力量威胁他人……但那样，你和她又有什么区别？'
      + '你放下手，魔法消散在冷空气中。「为什么？」她问，声音因痛苦而沙哑。你摇摇头，告诉她错了。'
      + '真正的力量是带来和平的能力，而不是发动战争的能力。「蠢货，」她咆哮着爬起来，「你终究是个弱者。你会后悔让我活着。」'
      + '你看着她带着前世的碎片蹒跚离开。她的力量大打折扣，但仍是个问题。你长舒一口气——你不想让这股力量改变你是谁。'
      + '艾格尼丝获得经验等于胜利区卡牌胜利点总和，或她已收集记忆数，二者取高；其他调查员只获得胜利点。'
      + '艾格尼丝可以把「希波利尔传家宝」升级为进阶版，或把「黑暗回忆」进阶版降级为原本版本。',
    resolution2: '结局 2：艾尔佩斯占了上风。她抬手，魔法威胁着把你撕碎，露出冷笑。你闭上眼准备迎接——却没有致命一击。'
      + '她把你拽起来，拍掉你围裙上的灰。「来吧，」她带着恶魔般的笑意低语，「你不是哀嚎的动物。你忘了你真正是什么了吗？我们真正是什么？」'
      + '然后，没有更多惩罚，她离开了，只留给你前世生活的碎片。'
      + '艾格尼丝获得经验等于胜利区卡牌胜利点总和，或她已收集记忆数，二者取高；其他调查员只获得胜利点。'
      + '艾格尼丝必须把「黑暗回忆」升级为进阶版，或把「希波利尔传家宝」进阶版降级为原本版本。',
  }),
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT_CODE]: '[fast] 在艾格尼丝·贝克所在地点的调查员们团队花费 2[per_investigator] 个线索：艾格尼丝·贝克收集她所在地点的记忆。'
    + '强制 - 若艾格尼丝·贝克被击败，进入 (→R2)。'
    + '目标 - 收集比艾尔佩斯更多的记忆。若所有 9 个记忆都已被收集（无论哪一方），推进。',
})
export const SCENARIO_AGENDA_TEXT = Object.freeze({
  [AGENDA_CODE]: '强制 - 在敌方阶段结束时，若艾尔佩斯·博丹处于重整状态且她所在地点有记忆：从混乱袋随机揭示一个标记并放在该地点上。'
    + '强制 - 若某个没有记忆的地点上有 1 个或更多混乱标记：把它们放回混乱袋。'
    + '强制 - 若某个有记忆的地点上的混乱标记合计值达到 6 或更多（忽略正负，[auto_fail] 与 [elder_sign] 各视为 -6）：把它们放回混乱袋，艾尔佩斯收集该记忆。',
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, connections, extra]) => {
  const card = ALL_CARDS[code]
  return [id, location({ id, code, connections, ...(extra || {}), ...(card.victory != null ? { hasVictory: true } : {}) })]
})))

// Setup 随机选 1 张的四张候选地点（其余移出游戏），全部声明进 scenario.locations 供放置。
export const RANDOM_LOCATIONS = Object.freeze(Object.fromEntries(RANDOM_LOCATION_TABLE.map(([id, code, connections]) => {
  const card = ALL_CARDS[code]
  return [id, location({ id, code, connections, ...(card.victory != null ? { hasVictory: true } : {}) })]
})))
export const ALL_LOCATIONS = Object.freeze({ ...LOCATIONS, ...RANDOM_LOCATIONS })
export const FIXED_LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))

const definitions = encounterDefinitions([...ENCOUNTER_DECK_CODES, ELSPETH_CODE])
Object.assign(definitions.storyAssets, encounterDefinitions([ELSPETH_BACK_CODE]).storyAssets)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ACT_CODE, AGENDA_CODE, ELSPETH_CODE, ELSPETH_BACK_CODE,
  ...MONSTROUS_MEMORY_LOCATIONS.map(id => LOCATIONS[id]?.code || RANDOM_LOCATION_TABLE.find(([rid]) => rid === id)?.[1]).filter(Boolean),
  ...ENCOUNTER_DECK_CODES,
].map(code => [code, ALL_CARDS[code]]).filter(([, card]) => Boolean(card))))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '血海深仇 · Bad Blood',
  nameEn: 'Bad Blood',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '挑战剧本：艾格尼丝·贝克必须在场；本批为 1 人独立开局，随机地点与记忆按参考布置。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: ALL_LOCATIONS,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  removedCodes: [...REMOVED_CODES],
  randomLocations: [...RANDOM_LOCATION_TABLE],
  fixedLocationIds: [...FIXED_LOCATION_IDS],
  actText: SCENARIO_ACT_TEXT,
  agendaText: SCENARIO_AGENDA_TEXT,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario
