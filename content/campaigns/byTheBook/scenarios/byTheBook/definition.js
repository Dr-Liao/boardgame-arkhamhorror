// 循规蹈矩（By the Book · 90032）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/ByTheBook.hs + Scenarios/ByTheBook/Helpers.hs；
//   Act|Agenda|Enemy|Location/CardDefs/ByTheBook.hs + Midnight Masks / Cult of Umordhoth / Dark Cult 复用卡；
//   frontend/src/locales/en/standalone/byTheBook.json（intro / setup / tokens / resolutions）。
//
// 归属：本关专属卡 90032–90036（含 90033a 议程 / 90033b Mr. Grey 双面），遭遇组 by_the_book；
// 复用午夜假面地点（01125–01134，移除 Your House 01124；Downtown/Southside 各随机留 1）、
// 遭遇组 arkham / agents_of_shub / chilling_cold / nightgaunts / striking_fear；
// 「同谋」来自 Cult of Umordhoth（cultists 组 01137–01141，5 名）与 Dark Cult（pentagram 组
// 01169×3 / 01170×1，共 4 名）= 9 名 Cultist；Mysterious Chanting 01171 两张移出游戏。
//
// 本关口径：
//   1. 罗兰·班克斯（平行正面 90024，含 3 张 Directive）必须在场；1P 独立开局。
//   2. Setup：9 个地点各暗置 1 名同谋；罗兰获得 1 个线索。Downtown/Southside 各随机留 1 版。
//   3. 幕 1 [fast]（团队 1[per_inv] 线索）：翻开本地点的同谋并以与你交战的方式入场；
//      阿卡姆警察局 [fast]：花费等于敌人剩余生命的线索进行谈判，把该敌人加入胜利区。
//   4. 非弱点[[异教徒]]敌人「将被击败」时改为治疗至剩 1 点生命（由 behavior.enemyCanBeDefeated 实现）。
//   5. 幕 1 目标：胜利区有 10 名[[异教徒]]敌人 → 推进（结局 1）。
//      议程 90033a（doom 6）推进 → 生成 Mr. Grey 并与罗兰交战；议程 90034（doom 8）推进 → 结局 2。
//      罗兰被击败 → 结局 2；noResolution：罗兰撤退 → 结局 1，否则结局 2。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'byTheBook'
export const REFERENCE_CODE = '90032'
export const ENCOUNTER_CODE = 'by_the_book'
export const KEY_INVESTIGATOR = '90024' // 平行罗兰·班克斯
export const ROLAND_TITLE = 'Roland Banks'

export const ACT_CODE = '90035' // Capture the Conspirators / 逮捕同谋
export const AGENDA1_CODE = '90033a' // A Covert Conspiracy / 隐秘阴谋
export const AGENDA2_CODE = '90034' // Your Deadline Nears / 最后期限
export const MR_GREY_CODE = '90033b' // Mr. Grey
export const POLICE_STATION_CODE = '90036' // Arkham Police Station
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

// ---------------------------------------------------------------------------
// gather 组与遭遇牌库
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze([
  'arkham', 'agents_of_shub', 'chilling_cold', 'nightgaunts', 'striking_fear',
])
export const EXCLUDED_DECK_CODES = Object.freeze([
  '01121a', '01121b', '01122', '01123', '01124', '01171',
])
export const REMOVED_CODES = Object.freeze(['01124', '01171'])

// 9 名同谋：Cult of Umordhoth（cultists）5 名 + Dark Cult（pentagram）4 名。
export const CONSPIRATOR_CODES = Object.freeze([
  '01137', '01138', '01139', '01140', '01141', '01169', '01169', '01169', '01170',
])

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
export const ENCOUNTER_DECK = Object.freeze(groupDeck(ENCOUNTER_GROUPS, { exclude: EXCLUDED_DECK_CODES }))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 地点（Midnight Masks 印刷连接；Your House 移出游戏）
// ---------------------------------------------------------------------------
export const START_LOCATION = 'arkhamPoliceStation'
const MIDNIGHT = Object.freeze({
  northside: ['rivertown', 'miskatonicUniversity', 'downtown', 'easttown'],
  downtown: ['rivertown', 'miskatonicUniversity', 'northside', 'easttown'],
  easttown: ['miskatonicUniversity', 'graveyard', 'downtown', 'northside', 'rivertown'],
  rivertown: ['downtown', 'northside', 'miskatonicUniversity', 'stMarysHospital'],
  miskatonicUniversity: ['rivertown', 'stMarysHospital', 'easttown', 'graveyard', 'downtown', 'northside'],
  graveyard: ['miskatonicUniversity', 'easttown'],
  stMarysHospital: ['rivertown', 'northside', 'miskatonicUniversity', 'southside'],
  southside: ['rivertown', 'stMarysHospital', 'northside', 'miskatonicUniversity', 'easttown', 'graveyard'],
})
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['arkhamPoliceStation', POLICE_STATION_CODE, Object.freeze(['rivertown', 'downtown', 'easttown'])]),
  Object.freeze(['northside', '01134', MIDNIGHT.northside]),
  Object.freeze(['easttown', '01132', MIDNIGHT.easttown]),
  Object.freeze(['rivertown', '01125', MIDNIGHT.rivertown]),
  Object.freeze(['miskatonicUniversity', '01129', MIDNIGHT.miskatonicUniversity]),
  Object.freeze(['graveyard', '01133', MIDNIGHT.graveyard]),
  Object.freeze(['stMarysHospital', '01128', MIDNIGHT.stMarysHospital]),
])
// 两组双版本地点：Setup 各随机选取 1 版，另一版移出游戏。
export const VARIANT_LOCATION_TABLE = Object.freeze([
  Object.freeze(['downtown', Object.freeze(['01130', '01131']), MIDNIGHT.downtown]),
  Object.freeze(['southside', Object.freeze(['01126', '01127']), MIDNIGHT.southside]),
])
export const PLACED_LOCATION_IDS = Object.freeze([
  ...LOCATION_TABLE.map(([id]) => id), ...VARIANT_LOCATION_TABLE.map(([id]) => id),
])
export const LOCATION_COORDINATES = Object.freeze({
  graveyard: { x: 3, y: 2 },
  northside: { x: 1, y: 0 },
  downtown: { x: 2, y: 0 },
  easttown: { x: 3, y: 1 },
  stMarysHospital: { x: 0, y: 2 },
  arkhamPoliceStation: { x: 2, y: 1 },
  miskatonicUniversity: { x: 1, y: 2 },
  rivertown: { x: 2, y: 2 },
  southside: { x: 1, y: 1 },
})

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown By the Book card: ${code}`)
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
  if (!card) throw new RangeError(`Unknown By the Book location: ${code}`)
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
  if (!card) throw new RangeError(`Unknown By the Book stage card: ${code}`)
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

export function encounterDefinitions(codes) {
  const enemies = {}
  const treacheries = {}
  const storyAssets = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown By the Book encounter definition: ${code}`)
    const base = printed(code)
    if (card.type === 'enemy') {
      const text = String(card.text || '')
      enemies[code] = {
        ...base, fight: card.fight ?? null, evade: card.evade ?? null,
        health: card.health ?? null,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: card.health } : {}),
        damage: card.damage || 0, horror: card.horror || 0,
        ...(card.victory != null ? { victory: card.victory } : {}),
        ...(/\bHunter\b/.test(text) ? { hunter: true } : {}),
        ...(/\bAloof\b/.test(text) ? { aloof: true } : {}),
        ...(/\bRetaliate\b/.test(text) ? { retaliate: true } : {}),
        ...(/\bAlert\b/.test(text) ? { alert: true } : {}),
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
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze(stage(AGENDA1_CODE, { number: 1 })),
  2: Object.freeze(stage(AGENDA2_CODE, { number: 2 })),
})
export const ACTS = Object.freeze([structuredClone(ACT_STAGE)])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGES[1]), structuredClone(AGENDA_STAGES[2])])
export const STAGE_CARDS = Object.freeze({
  [ACT_CODE]: structuredClone(ACT_STAGE),
  [AGENDA1_CODE]: structuredClone(AGENDAS[0]),
  [AGENDA2_CODE]: structuredClone(AGENDAS[1]),
})

// ---------------------------------------------------------------------------
// 混乱标记（90032 正面 = 简单/普通，背面 = 困难/专家）
// ---------------------------------------------------------------------------
export const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为胜利区中[[异教徒]]敌人的数量（最多 5）。', delta: 0 }),
    cultist: Object.freeze({ text: '-2。若有[[异教徒]]敌人与你交战，再揭示一个混乱标记。', delta: -2 }),
    tablet: Object.freeze({ text: '-3。重整每个与你交战的[[异教徒]]敌人。', delta: -3 }),
    elderthing: Object.freeze({ text: '-4。如果你失败，罗兰·班克斯受到 1 点伤害。', delta: -4 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 比胜利区中[[异教徒]]敌人的数量多 1。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。若有[[异教徒]]敌人与你交战，再揭示一个混乱标记。', delta: -3 }),
    tablet: Object.freeze({ text: '-4。重整每个与你交战的[[异教徒]]敌人。', delta: -4 }),
    elderthing: Object.freeze({ text: '-5。如果你失败，罗兰·班克斯受到 1 点伤害。', delta: -5 }),
  }),
})

export const tokenTier = state => (['hard', 'expert'].includes(String(state?.difficulty || 'standard')) ? 'hard' : 'standard')

// ---------------------------------------------------------------------------
// 剧情 / 规则 / 结局正文
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale)',
  heading: '循规蹈矩',
  intro: '繁琐的程序令人窒息。自从你来到阿卡姆，案子越来越难推进。你以为自己会追踪走私犯和黑帮，而不是「想象出来的怪物」。'
    + '但你这桩荒唐案子悬而未决越久，你越觉得也许它并不荒唐。也许那些怪物也不是想象出来的。'
    + '局里对各类案件有无数规章，但对「活人献祭」却出奇地沉默。所以当你听说黑洞穴里发现的尸体时，你不知道从何查起。'
    + '询问当地人和死者家属一无所获；洞穴里留下的证据也毫无帮助——祭品和宣称这些献祭是「礼物」的文字，以及一棵狰狞巨树的描绘。'
    + '于是你做了最擅长的事：埋头调查，找到了串起所有死亡的线索。所有死者都围绕一个人：达米安·格雷先生。'
    + '这位国会议员不是阿卡姆人，在本地没有亲友，也没有任何需要他驻留的委员会。可他在过去几个月一直待在阿卡姆，目的不明。'
    + '他与每位死者之间最多只隔两层关系，这让你觉得可疑。更可疑的是，尽管没人威胁过格雷先生的人身安全，却二十四小时有警察护送他。'
    + '你必须弄清真相，而且要快。现在你到处都能看见那棵该死的树。每天都有更多人失踪，甚至有人声称看见羊头怪物在巷子里游荡。'
    + '但如果格雷先生真是幕后黑手，你必须小心。诬告政客，你的职业生涯无疑会完蛋。是时候做你该做的事了：找出证据、查明真相、把罪魁带来问话。'
    + '每个「i」都点上，每个「t」都划好。',
  introBranches: Object.freeze({}),
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集以下遭遇组的全部卡牌：循规蹈矩、午夜假面、莎布·尼古拉丝之仆、乌默尔多斯教团、刺骨严寒、黑暗邪教、夜鹰、惊惧。' },
    { key: 'removeCards', text: '将午夜假面遭遇组原有的剧本提示卡、幕牌库与议程牌库移出游戏，连同「你的房子」地点与两张「神秘咏唱」诡计；改用「循规蹈矩」扩展提供的新提示卡、幕与议程。' },
    { key: 'chooseLocations', text: '随机选择两个「商业区」地点之一与两个「南区」地点之一放入场；把另一版的商业区与南区移出游戏。' },
    { key: 'placeLocations', text: '将北区、东城区、河岸城、圣玛丽医院、墓地、米斯卡塔尼克大学与阿卡姆警察局放入场。' },
    { key: 'startAt', text: '每位调查员从阿卡姆警察局开始。' },
    { key: 'conspirators', text: '把乌默尔多斯教团与黑暗邪教遭遇组里的 9 名[[异教徒]]敌人洗混，然后作为「同谋」在每个地点下方暗置 1 名。' },
    { key: 'rolandClue', text: '罗兰·班克斯开局时获得 1 个线索（从供应堆）。' },
    { key: 'readyToBegin', text: '现在可以开始游戏了。' },
  ]),
  specialRules: Object.freeze([
    {
      title: '同谋',
      text: '场上每个地点下方都暗置 1 名[[异教徒]]敌人作为同谋。幕 1 允许调查员团队花费线索，把所在地点的同谋翻开放入场并与其交战（或以警察局的能力花费线索、谈判并将其加入胜利区）。',
    },
    {
      title: '以规办事',
      text: '本关的目标是把 10 名[[异教徒]]敌人加入胜利区：9 名同谋 + 被揭示的 Mr. Grey。非弱点[[异教徒]]敌人「将被击败」时会改为治疗至剩 1 点生命，因此必须用「谈判」把它们捕获（阿卡姆警察局能力）。',
    },
    {
      title: '挑战剧本',
      text: '「循规蹈矩」挑战剧本围绕平行调查员罗兰·班克斯（90024，含 3 张 Directive）展开，本批只交付 1P 单开路径。',
    },
  ]),
  rules: Object.freeze({
    resign: '议程卡提供 [action]：撤退。',
    returnTo: '参考中的可选「重返乌默尔多斯教团」变体本批未接入（rtnotz 内容未迁移）。',
  }),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '若没有任何调查员达成结局：罗兰·班克斯撤退则按结局 1 结算，否则按结局 2 结算。',
    resolution1: '结局 1：证据已呈上，案子结了；你回到调查走私犯和普通罪犯的日常。那些对谋杀负责的人——至少你抓住的那些——都被关进了牢里。'
      + '但回到平常的案子并不容易，不安的疑虑牵扯着你的思绪：是什么驱使格雷先生和其他人犯下这些骇人罪行？'
      + '罗兰·班克斯获得经验等于胜利区中每名敌人的胜利点数总和；其他调查员获得经验等于胜利区中每个地点的胜利点数总和。'
      + '若胜利区有 4–5 名[[异教徒]]敌人，罗兰下一场冒险初始手牌 +1；6–7 名 +2；8–9 名 +3；10 名 +3 且可从混乱袋移除一枚非符号标记。'
      + '若 Mr. Grey 在胜利区，罗兰可以把「罗兰的 .38 特制手枪」升级为进阶版，或把「掩盖罪证」进阶版降级为原本版本。',
    resolution2: '结局 2：任何程序或训练都无法让你准备好面对调查中出现的怪物——无论人性的还是字面意义的。'
      + '尽管你竭尽全力，你还是被迫结案并低调行事。再查下去，可能就是你的末日。格雷先生和他的手下也许永远不会为他们的罪行承担后果，'
      + '但至少你现在知道了这座城表面下的真正腐败。下次你会准备得更好。有没有规矩都一样。'
      + '罗兰·班克斯获得经验等于胜利区中每名敌人的胜利点数总和；其他调查员获得经验等于胜利区中每个地点的胜利点数总和。'
      + '罗兰·班克斯必须把「掩盖罪证」升级为进阶版，或把「罗兰的 .38 特制手枪」进阶版降级为原本版本。',
  }),
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT_CODE]: '[fast] 调查员团队花费 1[per_investigator] 个线索：翻开你所在地点下方 1 名暗置的同谋，并使其与你交战入场。'
    + '[fast] 花费 1 个资源：横置与你交战的一名[[异教徒]]敌人（它保持交战）。只有罗兰·班克斯能触发此能力。'
    + '目标 - 尽可能多地谈判同谋。若胜利区有 10 名[[异教徒]]敌人，推进。',
})
export const SCENARIO_AGENDA_TEXT = Object.freeze({
  [AGENDA1_CODE]: '强制 - 当一个非弱点[[异教徒]]敌人将被击败时：改为治疗该敌人直到它剩 1 点生命。'
    + '强制 - 若罗兰·班克斯被击败：(→R2)。[action]：撤退。',
  [AGENDA2_CODE]: '强制 - 当一个非弱点[[异教徒]]敌人将被击败时：改为治疗该敌人直到它剩 1 点生命。'
    + '强制 - 若罗兰·班克斯被击败：(→R2)。[action]：撤退。',
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
export const LOCATION_VARIANTS = Object.freeze(VARIANT_LOCATION_TABLE.map(([id, codes, connections]) => ({
  id, codes, connections, chosen: codes[0],
})))

export const LOCATIONS = Object.freeze(Object.fromEntries([
  ...LOCATION_TABLE.map(([id, code, connections]) => [id, location({ id, code, connections })]),
  ...VARIANT_LOCATION_TABLE.map(([id, codes, connections]) => [id, location({ id, code: codes[0], connections })]),
]))

const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, ...CONSPIRATOR_CODES, MR_GREY_CODE,
])

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ACT_CODE, AGENDA1_CODE, AGENDA2_CODE, MR_GREY_CODE, POLICE_STATION_CODE,
  ...LOCATIONS_USED_CODES(), ...ENCOUNTER_DECK_CODES, ...CONSPIRATOR_CODES,
].map(code => [code, ALL_CARDS[code]]).filter(([, card]) => Boolean(card))))

function LOCATIONS_USED_CODES() {
  return [
    ...LOCATION_TABLE.map(([, code]) => code),
    ...VARIANT_LOCATION_TABLE.flatMap(([, codes]) => codes),
  ]
}

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '循规蹈矩 · By the Book',
  nameEn: 'By the Book',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '挑战剧本：平行罗兰·班克斯（90024，含 3 张 Directive）必须在场；本批为 1 人独立开局，9 名同谋随机暗置。',
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
  locationVariants: [...LOCATION_VARIANTS],
  conspiratorCodes: [...CONSPIRATOR_CODES],
  actText: SCENARIO_ACT_TEXT,
  agendaText: SCENARIO_AGENDA_TEXT,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario
