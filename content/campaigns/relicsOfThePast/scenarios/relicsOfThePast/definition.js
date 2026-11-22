// 往昔遗物（Relics of the Past · 90065）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/RelicsOfThePast.hs（setup / 探索牌库 / token / 结局）；
//   Act|Agenda|Enemy|Location|Asset|Treachery/CardDefs|Cards/RelicsOfThePast.hs；
//   The Doom of Eztli（04054）的地图与单面地点（Grand Chamber/Burial Pit/Underground Ruins）；
//   frontend/src/locales/en/standalone/relicsOfThePast.json（intro / setup / tokens / resolutions）；
//   The Forgotten Age 的 Explore 行动与补给品（chalk / compass / journal / satchel / torches）。
//
// 本关是「独立单章挑战战役」：蒙特雷·杰克（90062）必须在场（1P 单开）。
// 核心机制：探索牌库（引擎 state.explorationDeck + 符号连接）、古代遗物剧情支援（撤退时强制入胜利区）、
// 复仇点数（每点把一张伊格之子/古代遗物洗回探索牌库）、中毒状态与补给品检查。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'relicsOfThePast'
export const REFERENCE_CODE = '90065'
export const ENCOUNTER_CODE = 'relics_of_the_past'
export const KEY_INVESTIGATOR = '90062' // 蒙特雷·杰克
export const MONTEREY_TITLE = 'Monterey Jack'

export const ACT1_CODE = '90068' // Crumbling Ruin
export const ACT2_CODE = '90069' // Find the Way Out!
export const AGENDA1_CODE = '90066a'
export const AGENDA2_CODE = '90067'
export const DWELLER_CODE = '90066b'
export const VENGEANT_PAST_CODE = '90077'
export const RELIC_CODES = Object.freeze(['90073', '90074', '90075', '90076'])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

export const ENTRY_WAY_ID = 'entryway'
export const INNER_CHAMBER_ID = 'innerChamber'
export const SECRET_PASSAGE_ID = 'secretPassage'
export const START_LOCATION = ENTRY_WAY_ID

// 复用的 The Doom of Eztli 单面地点（印刷符号/连接见 TFA 定义）。
export const EXPLORATION_LOCATION_IDS = Object.freeze([
  'grandChamber', 'burialPit', 'undergroundRuins', 'secretPassage', 'ancientHall',
])
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['entryway', '04060', Object.freeze(['grandChamber', 'ancientHall'])]),
  Object.freeze(['grandChamber', '04064', Object.freeze(['entryway', 'burialPit', 'undergroundRuins'])]),
  Object.freeze(['burialPit', '04065', Object.freeze(['grandChamber', 'undergroundRuins'])]),
  Object.freeze(['undergroundRuins', '04066', Object.freeze(['grandChamber', 'burialPit'])]),
  Object.freeze(['secretPassage', '90070', Object.freeze(['burialPit', 'undergroundRuins', 'innerChamber'])]),
  Object.freeze(['ancientHall', '90072', Object.freeze(['entryway', 'grandChamber', 'innerChamber'])]),
  Object.freeze(['innerChamber', '90071', Object.freeze(['secretPassage', 'ancientHall'])]),
])
export const LOCATION_SYMBOLS = Object.freeze({
  entryway: { symbol: 'circle', links: ['square', 'star'] },
  grandChamber: { symbol: 'star', links: ['circle', 'square', 'triangle'] },
  burialPit: { symbol: 'triangle', links: ['star', 'diamond', 'squiggle'] },
  undergroundRuins: { symbol: 'diamond', links: ['square', 'triangle', 'squiggle'] },
  secretPassage: { symbol: 'squiggle', links: ['diamond', 'triangle', 'hourglass'] },
  ancientHall: { symbol: 'square', links: ['circle', 'star', 'diamond'] },
  innerChamber: { symbol: 'hourglass', links: ['squiggle'] },
})
export const LOCATION_COORDINATES = Object.freeze({
  entryway: { x: 1, y: 1 },
  grandChamber: { x: 1, y: 2 },
  burialPit: { x: 1, y: 3 },
  undergroundRuins: { x: 2, y: 2 },
  secretPassage: { x: 3, y: 3 },
  ancientHall: { x: 3, y: 1 },
  innerChamber: { x: 4, y: 2 },
})

// 探索牌库：5 处遗迹入口（单面地点）+ 3 张遭遇（Deep Dark / Final Mistake / 3 Pit Viper），
// 困难/专家额外加入 Locked Door 与 Entombed（Haskell setup 的 hard/expert 分支）。
export const EXPLORATION_TREACHERY_CODES = Object.freeze({
  deepDark: '04094',
  finalMistake: '04088',
  entombed: '04089',
  lockedDoor: '01174',
})
export const EXPLORATION_ENEMY_CODES = Object.freeze({ pitViper: '04078' })
export const BROOD_OF_YIG_CODE = '04083'
export const POISONED_CODE = '04102'

export const initialExplorationDeck = difficulty => [
  ...EXPLORATION_LOCATION_IDS,
  EXPLORATION_TREACHERY_CODES.deepDark,
  EXPLORATION_TREACHERY_CODES.finalMistake,
  ...Array(3).fill(EXPLORATION_ENEMY_CODES.pitViper),
  ...(['hard', 'expert'].includes(String(difficulty))
    ? [EXPLORATION_TREACHERY_CODES.lockedDoor, EXPLORATION_TREACHERY_CODES.entombed] : []),
]

// 古代遗物（90073–90076）与 Vengeant Past 放一边，幕 1 背面时洗入探索牌库。
export const SET_ASIDE_CODES = Object.freeze([
  ...RELIC_CODES, VENGEANT_PAST_CODE, ...Array(3).fill(BROOD_OF_YIG_CODE),
])

// 补给品（The Forgotten Age Explore 规则）：每人选择 1 件，单人可选 2 件。
export const SUPPLY_NAMES = Object.freeze(['chalk', 'compass', 'journal', 'satchel', 'torches'])
export const SUPPLY_LABELS = Object.freeze({
  chalk: '粉笔', compass: '指南针', journal: '探险日志', satchel: '背包', torches: '火把',
})

// ---------------------------------------------------------------------------
// 遭遇牌库：The Doom of Eztli / 伊格的使徒 / 致命陷阱 / 被遗忘的遗迹 / 毒素 / 蛇群 /
// 伊格的毒液 / 地窖寒风 / 上锁的门 / 午夜假面（仅 2×虚假线索 + 3×猎影）。
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze([
  'eztli', 'agents_of_yig', 'traps', 'ruins', 'poison', 'serpents', 'venom',
  'chilling_cold', 'locked_doors',
])
export const MIDNIGHT_MASKS_EXTRAS = Object.freeze({ '01135': 3, '01136': 2 })

const deckTypes = ['enemy', 'treachery']
const EXTRA_EXCLUDED = new Set([
  ...RELIC_CODES, VENGEANT_PAST_CODE, BROOD_OF_YIG_CODE,
  EXPLORATION_TREACHERY_CODES.deepDark, EXPLORATION_TREACHERY_CODES.finalMistake,
  EXPLORATION_TREACHERY_CODES.entombed, EXPLORATION_TREACHERY_CODES.lockedDoor,
  EXPLORATION_ENEMY_CODES.pitViper, POISONED_CODE,
  // The Doom of Eztli 的剧本参考/幕/议程/故事资产/原始地点
  '04052', '04053', '04054', '04055', '04056', '04057', '04058', '04059', '04060', '04061',
  '04062', '04063', '04064', '04065', '04066', '04067', '04068',
])

function expand(cards) {
  return cards.sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
}

export const ENCOUNTER_DECK = Object.freeze([
  ...expand(Object.entries(ALL_CARDS)
    .filter(([code, card]) => !EXTRA_EXCLUDED.has(code)
      && ENCOUNTER_GROUPS.includes(card.encounterCode)
      && deckTypes.includes(card.type))),
  ...Object.entries(MIDNIGHT_MASKS_EXTRAS).flatMap(([code, count]) => Array(count).fill(code)),
])
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Relics of the Past card: ${code}`)
  return {
    code,
    originalCode: code,
    name: card.nameZh || card.name,
    nameEn: card.name,
    subname: card.subnameZh || card.subname || '',
    subnameEn: card.subname || '',
    text: card.textZh || card.text || '',
    textEn: card.text || '',
    backText: card.backTextZh || card.backText || '',
    backTextEn: card.backText || '',
    type: card.type,
    traits: [...(card.traits || [])],
    ...(card.victory != null ? { victory: card.victory } : {}),
  }
}

export function location(data) {
  const { id, code, connections, symbols, ...rest } = data
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Relics of the Past location: ${code}`)
  const symbol = symbols || LOCATION_SYMBOLS[id] || null
  return {
    ...printed(code),
    id,
    shroud: card.shroud,
    connections: [...(connections || [])],
    ...(symbol ? {
      symbols: {
        front: { symbol: symbol.symbol, links: [...symbol.links], label: symbol.symbol },
        back: { symbol: symbol.symbol, links: [...symbol.links] },
      },
    } : {}),
    ...rest,
    cluesPerInvestigator: Number(card.clues) || 0,
  }
}

export function stage(code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Relics of the Past stage card: ${code}`)
  const { number, doom, ...rest } = extra
  return {
    ...printed(code),
    id: `${card.type}${code}`,
    type: card.type,
    stage: `${number ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...rest,
    ...(card.type === 'agenda' ? { doomThreshold: doom ?? card.doom } : {}),
    ...(card.type === 'act' ? { objective: { type: 'manual' } } : {}),
  }
}

export function encounterDefinitions(codes) {
  const enemies = {}
  const treacheries = {}
  const storyAssets = {}
  const locations = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown Relics of the Past encounter definition: ${code}`)
    const base = printed(code)
    if (card.type === 'enemy') {
      enemies[code] = {
        ...base,
        fight: card.fight ?? null,
        evade: card.evade ?? null,
        health: card.health ?? null,
        damage: card.damage || 0,
        horror: card.horror || 0,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: card.health } : {}),
        ...(card.victory != null ? { victory: card.victory } : {}),
        ...(/\bhunter\b/i.test(String(card.text || '')) ? { hunter: true } : {}),
        ...(/\bretaliate\b/i.test(String(card.text || '')) ? { retaliate: true } : {}),
        elite: (card.traits || []).includes('Elite'),
      }
    } else if (card.type === 'treachery') {
      treacheries[code] = {
        ...base,
        entryRevelation: true,
        surge: /^Surge\./m.test(card.text || ''),
        peril: /(?:^|\n|\. )Peril\./.test(card.text || ''),
      }
    } else if (card.type === 'asset' || card.type === 'story') {
      storyAssets[code] = { ...base, global: false }
    }
  }
  return { enemies, treacheries, storyAssets, locations }
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
export const ACTS = Object.freeze([
  structuredClone(stage(ACT1_CODE, { number: 1, objective: { type: 'manual' } })),
  structuredClone(stage(ACT2_CODE, { number: 2, objective: { type: 'allResigned' } })),
])
export const AGENDAS = Object.freeze([
  structuredClone(stage(AGENDA1_CODE, { number: 1, doom: 8 })),
  structuredClone(stage(AGENDA2_CODE, { number: 2, doom: 9 })),
])
export const STAGE_CARDS = Object.freeze({
  [ACT1_CODE]: structuredClone(ACTS[0]),
  [ACT2_CODE]: structuredClone(ACTS[1]),
  [AGENDA1_CODE]: structuredClone(AGENDAS[0]),
  [AGENDA2_CODE]: structuredClone(AGENDAS[1]),
})

// ---------------------------------------------------------------------------
// 混乱标记（90065 正面 = 简单/普通，背面 = 困难/专家）
// ---------------------------------------------------------------------------
export const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为所在地点上的毁灭标记数量（困难难度再 -1）。', delta: 0 }),
    cultist: Object.freeze({ text: '-1。如果你已中毒，改为 -2 并揭示额外一枚混乱标记。', delta: -1 }),
    tablet: Object.freeze({ text: '-3。如果你检定失败，在所在地点放置 1 个毁灭标记。', delta: -3 }),
    elderthing: Object.freeze({ text: '-3。如果你检定失败，最近的未交战[[蛇]]敌人向你移动一次。', delta: -3 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X-1。X 为所在地点上的毁灭标记数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-2。如果你已中毒，改为 -3 并揭示额外一枚混乱标记。', delta: -2 }),
    tablet: Object.freeze({ text: '-4。检定失败时在所在地点放置 1 个毁灭标记。', delta: -4 }),
    elderthing: Object.freeze({ text: '-5。检定失败时，最近的未交战[[蛇]]敌人向你移动一次（检定结束后）。', delta: -5 }),
  }),
})

export const tokenTier = state => (['hard', 'expert'].includes(String(state?.difficulty || 'standard')) ? 'hard' : 'standard')

// ---------------------------------------------------------------------------
// 剧情正文（中文；英文正文见指南源）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale)',
  heading: '往昔遗物',
  intro: '你一生都在追寻失落之物。这是你的天性，你的诅咒，也是你的天赋。'
    + '这一回，你的追寻把你带到了墨西哥的丛林深处：一位老朋友的来信提到一座尚未被现代文明触及的古代神庙，'
    + '以及一批「属于过去的遗物」。你雇了向导，沿着泥泞的河岸走了三天。'
    + '第四天清晨，你们找到了那道被藤蔓吞没的石门。向导在门口停住脚，脸色发白，怎么也不肯再往前走一步。'
    + '「那里面的东西，不该被挖出来。」他说。你付了他钱，独自走进黑暗。'
    + '火把的光在潮湿的石壁上跳动，空气里有一股陈年的尘土与蛇蜕的腥臭。台阶向下延伸到深处。'
    + '你听见水声，听见石头开裂的声音，然后——你听见了别的东西。某种庞大的、在泥土里翻动的东西。'
    + '你握紧了鞭子。你当然不是来打架的。但如果你必须打……'
    + '……那你最好先找到那些遗物。它们就在下面某个地方，在黑暗里等着你。',
  introBranches: Object.freeze({}),
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集以下遭遇组的全部卡牌：往昔遗物、埃兹特里的覆灭、蛇群、伊格的使徒、致命陷阱、被遗忘的遗迹、毒素、伊格的毒液、地窖寒风、上锁的门、午夜假面。' },
    { key: 'midnightMasks', text: '收集午夜假面遭遇组时，只收集五张诡计牌（2 张虚假线索与 3 张猎影）。不要收集该组的其它卡牌。' },
    { key: 'removePermanent', text: '将「埃兹特里的覆灭」遭遇组中的剧本参考、幕、议程、故事资产与地点移出游戏；本关使用自己的幕、议程与地点。' },
    { key: 'entryway', text: '将遗迹入口（Entryway）放入场。' },
    { key: 'explorationDeck', text: '准备探索牌库：将大石室、埋葬坑、地下遗迹、秘密通道（90070）与古代石厅（90072）五处单面地点，以及深渊黑暗（Deep Dark）、最后的错误（Final Mistake）与 3 张坑洞毒蛇（Pit Viper）洗入探索牌库。' },
    { key: 'hardExtras', text: '困难或专家难度：额外将 1 张上锁的门（Locked Door）与 1 张被埋葬（Entombed）洗入探索牌库。' },
    { key: 'innerChamber', text: '将内部密室（Inner Chamber）放在一边。' },
    { key: 'relics', text: '将 4 张古代遗物故事支援（玉石鳄鱼、黑曜石虎、黄水晶蛇、绿松石鹰）、复仇往昔与 3 张伊格之子放在一边。' },
    { key: 'poisoned', text: '将「中毒」弱点中不在任何调查员牌组里的部分放在一边。' },
    { key: 'supplies', text: '每位调查员选择 1 件补给品：粉笔、指南针、探险日志、背包或火把（单人游戏可选 2 件）。' },
    { key: 'start', text: '每位调查员从遗迹入口开始。' },
    { key: 'agendaDoom', text: '按照调查员人数在议程 1 上放置毁灭标记（1/2/3/4 人：0/1/2/3）。' },
    { key: 'shuffleRemainder', text: '将其余遭遇卡洗混，组成遭遇牌库。' },
    { key: 'readyToBegin', text: '准备开始。' },
  ]),
  specialRules: Object.freeze([
    {
      title: '探索（Explore）',
      text: '带有探索行动的地点/幕允许你探索：支付 1 个行动，抽取探索牌库顶的卡牌。'
        + '若它是与所在地点相连的地点（按印刷符号），将其放入场并移动过去；否则按遭遇卡结算。'
        + '若抽到的卡与所在地点不相连，将其洗回探索牌库并重复，直到抽到相连地点或遭遇卡。',
    },
    {
      title: '古代遗物与复仇（Vengeance）',
      text: '古代遗物是[[古代]]剧情支援：显现时置于你的控制下并结算其代价；当你撤退时，将其强制加入胜利区。'
        + '地下遗迹与古代石厅带有复仇：任何在场或进入胜利区的复仇点数都计入伊格之怒。',
    },
    {
      title: '补给品检查（Check your supplies）',
      text: '部分效果会要求你检查补给品：若你选择了该补给品，则获得对应增益（指南针发现线索、粉笔多抽一张、背包抵消伤害/恐惧、日志在撤退时提供经验、火把照亮黑暗）。本批 1P 开局把选择记录在场景标记里。',
    },
  ]),
  rules: Object.freeze({
    explorationDeck: '探索牌库使用引擎 state.explorationDeck（顶在末尾），与失落的时代相同的通用原语。',
    supplies: '补给品记录在 state.scenarioFlags.supplies（每人 1 件；1P 可 2 件）。',
  }),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '若没有任何调查员达成结局：每位未被击败的调查员被击败并承受 1 点肉体创伤（按结局 2 结算）。',
    resolution1: '结局 1：你带着尽可能多的遗物逃出神庙。身后的石壁轰然坍塌，把那个在黑暗中翻动的东西永远埋在了下面。'
      + '你清点战利品：这些遗物足以让你在博物馆界声名鹊起——但你也知道，有些东西最好不要展示给世人。'
      + '每位调查员按其加入胜利区的[[古代]]遗物获得经验；若你带有探险日志，额外获得 1 点经验。',
    resolution2: '结局 2：你没能及时逃出。神庙的黑暗吞没了你，而那个古老的东西终于从坑底爬了出来。'
      + '每位未被击败的调查员被击败并承受 1 点肉体创伤。',
  }),
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT1_CODE]: '如果你所在地点没有线索：探索。抽取探索牌库顶的卡牌；如果它是相连地点，将其放入场并移动过去。'
    + '目标 - 当每位存活调查员都位于内部密室时，他们可以共同花费所需的线索推进。',
  [ACT2_CODE]: '如果你所在地点没有线索：探索。抽取探索牌库顶的卡牌；如果它是相连地点，将其放入场并移动过去。'
    + '目标 - 带上尽可能多的[[古代]]遗物！如果每位存活调查员都撤退，推进。',
})

export const SCENARIO_AGENDA_TEXT = Object.freeze({
  [AGENDA1_CODE]: '本密谋得到 +1[per_investigator] 毁灭阈值。'
    + '强制 - 本密谋推进时：不要从场上的地点移除毁灭标记。'
    + '强制 - 一位调查员被击败时：该调查员将其控制的每个[[古代]]剧情支援洗入探索牌库。',
  [AGENDA2_CODE]: '本密谋得到 +1[per_investigator] 毁灭阈值。'
    + '强制 - 一位调查员被击败时：该调查员将其控制的每个[[古代]]剧情支援洗入探索牌库。'
    + '（背面）每位未离场的调查员被击败并承受 1 点肉体创伤。',
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, connections]) => [
  id, location({ id, code, connections }),
])))
export const LOCATION_CODES = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code]) => [id, code])))

// 本关专属敌人/剧情支援/诡计定义（复用卡由全局章节定义，不覆盖）。
const SCENARIO_SPECIFIC_CODES = [
  DWELLER_CODE, ...RELIC_CODES, VENGEANT_PAST_CODE,
  // 本关可能生成/洗回且需要定义的探索牌
  ...Object.values(EXPLORATION_TREACHERY_CODES), EXPLORATION_ENEMY_CODES.pitViper, BROOD_OF_YIG_CODE,
]
const definitions = encounterDefinitions(SCENARIO_SPECIFIC_CODES)
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ACT1_CODE, ACT2_CODE, AGENDA1_CODE, AGENDA2_CODE, DWELLER_CODE,
  ...RELIC_CODES, VENGEANT_PAST_CODE, ...Object.values(EXPLORATION_TREACHERY_CODES),
  EXPLORATION_ENEMY_CODES.pitViper, BROOD_OF_YIG_CODE, POISONED_CODE,
  ...LOCATION_CODES_VALUES(),
].map(code => [code, ALL_CARDS[code]]).filter(([, card]) => Boolean(card))))

function LOCATION_CODES_VALUES() {
  return Object.values(LOCATION_CODES)
}

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '往昔遗物 · Relics of the Past',
  nameEn: 'Relics of the Past',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '挑战剧本：蒙特雷·杰克必须在场（本批 1 人独立开局）；探索牌库与失落的时代同原语。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [INNER_CHAMBER_ID],
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  enemies: definitions.enemies,
  treacheries: {
    ...definitions.treacheries,
    // 复仇往昔的显现由本章 behavior.resolveEncounter 处理（需要选择/写探索牌库）。
    [VENGEANT_PAST_CODE]: { ...definitions.treacheries[VENGEANT_PAST_CODE], entryRevelation: false, effect: { kind: 'campaignRule' } },
  },
  storyAssets: definitions.storyAssets,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  removedCodes: ['04054', '04055', '04056', '04057', '04058', '04059', '04061', '04062', '04063', '04067', '04068'],
  actText: SCENARIO_ACT_TEXT,
  agendaText: SCENARIO_AGENDA_TEXT,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
