// 破釜沉舟（All or Nothing · 90011）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/AllOrNothing.hs（setup / 混乱袋 / 结局）；
//   Act|Agenda|Enemy/CardDefs/AllOrNothing.hs + The House Always Wins / Midnight Masks 复用卡；
//   frontend/src/locales/en/standalone/allOrNothing.json（intro / setup / tokens / resolutions）。
//
// 归属：本关专属卡 90011–90016（90011 为剧本提示卡本身），遭遇组 all_or_nothing；
// 复用 The House Always Wins 的 5 个地点 02070–02074（另 02075–02077 放一边）、
// 赌场管理员 02078（放在俱乐部大厅）、Peter Clover 02079 / Dr. Francis Morgan 02080（移出游戏）；
// 遭遇牌库来自 the_house_always_wins（除 02078）、bad_luck、naomis_crew、rats，以及
// 午夜假面只取 2 种诡计 01135×3 / 01136×2。
//
// 本关口径：
//   1. 「Skids」奥图尔（平行正面 90008）必须在场；1P 独立开局。
//   2. 幕 1：不能撤退、赌场管理员获得冷漠；每个[[罪犯]]敌人被击败 → 议程 +1 毁灭；
//      回合结束时任一调查员 ≥15 资源 → 推进幕。
//   3. 幕 2：每个[[罪犯]]敌人获得猎手、+1 生命；调查员撤退时把其资源放到幕上；
//      所有未被击败的调查员都撤退后 → 推进幕（结局 1）。
//   4. 档案卡的可选 Return to 变体本批不接（rtdwl 未迁移，记入 dossier）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'allOrNothing'
export const REFERENCE_CODE = '90011'
export const ENCOUNTER_CODE = 'all_or_nothing'
export const KEY_INVESTIGATOR = '90008' // 平行「Skids」奥图尔

export const ACT1_CODE = '90013' // Playing Cards / 来玩牌吧
export const ACT2_CODE = '90014' // Hot on Your Tail / 紧追不放
export const AGENDA_CODE = '90012' // Eyes All Around You / 众目睽睽
export const SIOBHAN_CODE = '90015'
export const BOUNCER_CODE = '90016'
export const PIT_BOSS_CODE = '02078'
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

// ---------------------------------------------------------------------------
// gather 组与遭遇牌库
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze([
  'the_house_always_wins', 'bad_luck', 'naomis_crew', 'rats',
])
// 午夜假面只取 5 张诡计（不入组，直接列卡号）；赌场管理员放在大厅，不进遭遇牌库。
export const EXTRA_DECK_CODES = Object.freeze(['01135', '01135', '01135', '01136', '01136'])
export const EXCLUDED_DECK_CODES = Object.freeze([PIT_BOSS_CODE])
export const REMOVED_CODES = Object.freeze(['02079', '02080'])
export const SET_ASIDE_CODES = Object.freeze(['02075', '02076', '02077', SIOBHAN_CODE])

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

export const ENCOUNTER_DECK = Object.freeze(groupDeck(ENCOUNTER_GROUPS, {
  extra: EXTRA_DECK_CODES, exclude: EXCLUDED_DECK_CODES,
}))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 地点（The House Always Wins 印刷连接；本关不入场的地点不写连接）
// ---------------------------------------------------------------------------
export const START_LOCATION = 'laBellaLuna'
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['laBellaLuna', '02070', Object.freeze(['cloverClubLounge'])]),
  Object.freeze(['cloverClubLounge', '02071', Object.freeze(['laBellaLuna', 'cloverClubBar', 'cloverClubCardroom'])]),
  Object.freeze(['cloverClubBar', '02072', Object.freeze(['cloverClubLounge', 'cloverClubCardroom'])]),
  Object.freeze(['cloverClubCardroom', '02073', Object.freeze(['cloverClubLounge', 'cloverClubBar', 'darkenedHall'])]),
  Object.freeze(['darkenedHall', '02074', Object.freeze(['cloverClubCardroom'])]),
])
export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const LOCATION_CODES = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code]) => [id, code])))
export const LOCATION_COORDINATES = Object.freeze({
  laBellaLuna: { x: 0, y: 1 },
  cloverClubLounge: { x: 1, y: 1 },
  cloverClubBar: { x: 2, y: 0 },
  cloverClubCardroom: { x: 2, y: 1 },
  darkenedHall: { x: 3, y: 1 },
})

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown All or Nothing card: ${code}`)
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
  if (!card) throw new RangeError(`Unknown All or Nothing location: ${code}`)
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
  if (!card) throw new RangeError(`Unknown All or Nothing stage card: ${code}`)
  const { number, doom, ...rest } = extra
  return {
    ...printed(code),
    id: `${card.type}${code}`,
    type: card.type,
    stage: `${number ?? card.stage ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...rest,
    ...(card.type === 'agenda' ? { doomThreshold: doom ?? card.doom } : {}),
  }
}

export function encounterDefinitions(codes) {
  const enemies = {}
  const treacheries = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown All or Nothing encounter definition: ${code}`)
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
        ...(preyOf(text) ? { prey: preyOf(text) } : {}),
        elite: (card.traits || []).includes('Elite'),
      }
    } else if (card.type === 'treachery') {
      treacheries[code] = { ...base, entryRevelation: true, surge: /^Surge\./m.test(card.text || '') }
    }
  }
  return { enemies, treacheries, storyAssets: {} }
}

const PREY = Object.freeze({
  'Most clues': 'mostClues', 'Fewest clues': 'fewestClues', 'Highest [agility]': 'highestAgility',
  'Lowest [agility]': 'lowestAgility', 'Highest [intellect]': 'highestIntellect', 'Lowest [intellect]': 'lowestIntellect',
})
const preyOf = text => PREY[/Prey - ([^.]+)\./.exec(String(text || ''))?.[1]?.trim()] || null

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
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(ACT1_CODE, { number: 1 }), objective: { type: 'manual' } }),
  2: Object.freeze({ ...stage(ACT2_CODE, { number: 2 }), objective: { type: 'manual' } }),
})
export const AGENDA_STAGE = Object.freeze(stage(AGENDA_CODE, { number: 1 }))
export const ACTS = Object.freeze([structuredClone(ACT_STAGES[1]), structuredClone(ACT_STAGES[2])])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGE)])
export const STAGE_CARDS = Object.freeze({
  [ACT1_CODE]: structuredClone(ACT_STAGES[1]),
  [ACT2_CODE]: structuredClone(ACT_STAGES[2]),
  [AGENDA_CODE]: structuredClone(AGENDA_STAGE),
})

// ---------------------------------------------------------------------------
// 混乱标记（90011 正面 = 简单/普通，背面 = 困难/专家）
// ---------------------------------------------------------------------------
export const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: Object.freeze({ text: '-1。你每有 1 个线索，再 -1。', delta: 0, count: 'clues' }),
    cultist: Object.freeze({ text: '-2（若你有 10 个或更多资源，改为 -4）。', delta: -2 }),
    tablet: Object.freeze({ text: '-2。如果你失败，失去 3 个资源。', delta: -2 }),
    elderthing: Object.freeze({ text: '-3。如果你失败，「Skids」奥图尔受到 1 点恐惧。', delta: -3 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-2。你每有 1 个线索，再 -2。', delta: 0, count: 'clues' }),
    cultist: Object.freeze({ text: '-4（若你有 10 个或更多资源，改为 -8）。', delta: -4 }),
    tablet: Object.freeze({ text: '-3。失去 3 个资源。', delta: -3 }),
    elderthing: Object.freeze({ text: '-5。如果你失败，「Skids」奥图尔受到 1 点恐惧。', delta: -5 }),
  }),
})

export const tokenTier = state => (['hard', 'expert'].includes(String(state?.difficulty || 'standard')) ? 'hard' : 'standard')

// ---------------------------------------------------------------------------
// 剧情 / 规则 / 结局正文
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale)',
  heading: '破釜沉舟',
  intro: '你愿意不惜一切代价把一切扳正。你母亲沉重的医院债务不会自己还清，于是你想出了一个计划：赌博。'
    + '孤注一掷、把所有东西押在牌运上的肾上腺素飙升，也是不错的附加享受。最近生活似乎总给你发烂牌，'
    + '但你往往能把糟糕的牌打成赢局。当幸运女神站在你这边时，谁还需要技巧？'
    + '你最爱的是二十一点。不知怎的，正确的牌总在正确的时候出现；当庄家再次爆点时，你努力掩饰自己的得意。'
    + '你似乎每晚都手气火热，面前的筹码越堆越高。这样的连胜足以偿还债务，但你的好运常常同时招来庄家和其他赌客的怒火。'
    + '你知道何时收手。这些年来，你赢得了一个名声，有人称之为「出千」。因此你被迫保持低调，在轮换的赌场名单上赌博。'
    + '在所有赢过的地方里，你最爱的还是四叶草俱乐部。这家地下酒吧每晚都有巨额金钱流转，但它由欧巴尼恩帮控制——'
    + '令人生畏、不择手段、冷酷无情。没人想引起帮派的注意，而你的名声显然已经引起了。但四叶草俱乐部有一条高于一切的底线：'
    + '庄家永远赢。今晚一定会不同。你竖起衣领，走进月下美人餐厅。餐厅几乎空无一人，隐约的喧闹音乐从后厅传来。'
    + '显然所有客人都聚在那里了。你满脑子只想着喝一杯，然后大赢一场……',
  introBranches: Object.freeze({}),
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集以下遭遇组的全部卡牌：破釜沉舟、百赌百胜、坏运气、娜奥米的船员、午夜假面、鼠群。除「破釜沉舟」外均可从核心包与《敦威治遗产》豪华扩展找到。收集午夜假面遭遇组时只取 5 张诡计卡（2 张「假线索」与 3 张「追猎之影」），不要取该组的地点、幕、议程与剧本提示卡。' },
    { key: 'scenarioReference', text: '将「百赌百胜」遭遇组原有的剧本提示卡移出游戏，改用「破釜沉舟」扩展提供的新提示卡。' },
    { key: 'newActAgenda', text: '将「百赌百胜」遭遇组原有的剧本提示卡、幕牌库与议程牌库移出游戏；只使用「破釜沉舟」扩展提供的新剧本提示卡、幕与议程卡构成幕牌库与议程牌库。' },
    { key: 'removeFromGame', text: '将 Peter Clover 支援与 Francis Morgan 医生故事资产移出游戏。' },
    { key: 'setAside', text: '将以下卡牌放到一边（场外）：每张「后厅门廊」地点、每张「俱乐部保安」敌人，以及「西尔班·莱利」敌人。' },
    { key: 'placeLocations', text: '将其余地点放入场：黑暗走廊、俱乐部大厅、俱乐部酒吧、俱乐部卡牌室、月下美人。每位调查员从月下美人开始。' },
    { key: 'placePitBoss', text: '将「赌场管理员」敌人放入俱乐部大厅。' },
    { key: 'readyToBegin', text: '现在可以开始游戏了。' },
  ]),
  specialRules: Object.freeze([
    {
      title: '挑战剧本',
      text: '挑战剧本围绕调查员「Skids」奥图尔展开。本 Mod 本批只交付 1P 单开路径：「Skids」奥图尔（平行正面 90008）必须作为唯一调查员入场。',
    },
    {
      title: '筹码与资源',
      text: '本关的胜负围绕资源展开：幕 1 在回合结束时检查是否有调查员 ≥15 资源；幕 2 要求尽可能带着资源撤退，撤退者的资源会放在幕卡上，并按幕上资源总额结算额外奖励经验与下关额外资源。',
    },
  ]),
  rules: Object.freeze({
    resign: '幕 1 期间调查员不能撤退（幕 2 起才能撤退）。',
    returnTo: '参考中「重返百赌百胜」的可选变体本批未接入（rtdwl 内容未迁移）。',
  }),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '若全员被击败：按结局 2 结算。你被欧巴尼恩帮的打手拖进暗室，'
      + '最后被丢在俱乐部后巷的垃圾堆里。每位调查员获得经验等于胜利区所有卡牌的胜利点数总和。'
      + '「Skids」奥图尔必须把「医院债务」升级为进阶版，或把「在逃中」进阶版降级为原本版本。',
    resolution1: '结局 1：心跳如鼓，兴奋在血管里奔流，你分不清是从欧巴尼恩帮手里赢钱，还是从他们手里逃出来更刺激。'
      + '今晚证明了「Skids」奥图尔永远会赢……每位调查员获得经验等于胜利区所有卡牌的胜利点数总和。'
      + '按幕 2 上资源的数量（每 10 资源一档），「Skids」奥图尔在下一场冒险开始时获得额外资源，40/50/60 档还额外获得 1/2/3 点奖励经验。'
      + '若「在逃中」在牌组中，「Skids」奥图尔可以把「在逃中」升级为进阶版。',
    resolution2: '结局 2：你终究没能悄无声息地离开。几分钟内，你被欧巴尼恩帮无情的手下围住，拖进一间暗室。'
      + '等他们教训够了，你被丢在俱乐部后巷的垃圾堆里。总的来说还算走运。你把四叶草俱乐部从赌博名单上划掉。'
      + '每位调查员获得经验等于胜利区所有卡牌的胜利点数总和。'
      + '「Skids」奥图尔必须把「医院债务」升级为进阶版，或把「在逃中」进阶版降级为原本版本。',
  }),
  extraRewards: '幕 2 上资源 ≥10 时「Skids」每场冒险开始 +1 资源；≥20 +2；≥30 +3；≥40 +4 且 +1 经验；≥50 +5 且 +2 经验；≥60 +6 且 +3 经验。',
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT1_CODE]: '调查员不能撤退。赌场管理员获得冷漠。强制 - 一个[[罪犯]]敌人被击败后：在议程上放置 1 个毁灭。'
    + '目标 - 回合结束时：若任一调查员有 15 个或更多资源，推进。',
  [ACT2_CODE]: '每个[[罪犯]]敌人获得猎手，且 +1 生命。强制 - 调查员撤退时：把那位的所有资源放在本幕上。'
    + '目标 - 尽可能多地收集资源并逃出去。当每个未被击败的调查员都撤退后，推进。',
})
export const SCENARIO_AGENDA_TEXT = Object.freeze({
  [AGENDA_CODE]: '[action] 若你在四叶草俱乐部卡牌室，花费任意数量线索：兑现筹码，每花费 1 个线索获得 5 个资源。'
    + '强制 - 若「Skids」奥图尔被击败：(→R2)。',
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, connections]) => {
  const card = ALL_CARDS[code]
  return [id, location({ id, code, connections, ...(card.victory != null ? { hasVictory: true } : {}) })]
})))
// 月下美人印刷带 [action] 撤退；幕 1 期间由 behavior 关闭，幕 2 起启用。
LOCATIONS.laBellaLuna.resign = true

const definitions = encounterDefinitions(ENCOUNTER_DECK_CODES)
// 本关专属精英/小兵定义（遭遇牌库外）。
Object.assign(definitions.enemies, encounterDefinitions([SIOBHAN_CODE, BOUNCER_CODE]).enemies)
// 赌场管理员使用 The House Always Wins 的全局定义；这里只补一份本地兜底数值。
export const PIT_BOSS_FALLBACK = Object.freeze({
  code: PIT_BOSS_CODE, originalCode: PIT_BOSS_CODE, name: '赌场管理员', nameEn: 'Clover Club Pit Boss',
  fight: 3, evade: 2, health: 3, damage: 1, horror: 1, hunter: true, prey: 'highestIntellect',
  traits: ['Humanoid', 'Criminal', 'Elite'], elite: true, victory: 1,
  text: '猎手。猎物 - 智力最高。',
})

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ACT1_CODE, ACT2_CODE, AGENDA_CODE, SIOBHAN_CODE, BOUNCER_CODE, PIT_BOSS_CODE,
  ...LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...ENCOUNTER_DECK_CODES,
].map(code => [code, ALL_CARDS[code]]).filter(([, card]) => Boolean(card))))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '破釜沉舟 · All or Nothing',
  nameEn: 'All or Nothing',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '挑战剧本：』Skids』奥图尔必须在场且牌组为合法构筑；本批为 1 人独立开局。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  removedCodes: [...REMOVED_CODES],
  setAsideCodes: [...SET_ASIDE_CODES],
  actText: SCENARIO_ACT_TEXT,
  agendaText: SCENARIO_AGENDA_TEXT,
  extraRewards: SCENARIO_TEXT.extraRewards,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario
