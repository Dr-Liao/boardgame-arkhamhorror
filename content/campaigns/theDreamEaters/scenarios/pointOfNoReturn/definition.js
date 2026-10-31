// 《无归之地》（Point of No Return，06247）· 卡面数据装配。
//
// 规则事实源：
//   · 参考实现 `参考资源/ArkhamHorror-main/backend/.../Scenario/Scenarios/TheDreamEaters/PointOfNoReturn.hs`
//     与 `{Act,Agenda,Enemy,Location,Story,Treachery,Asset}/Cards/TheDreamEaters/PointOfNoReturn/*.hs`；
//   · 英文 locale `frontend/src/locales/en/theDreamEaters/scenarios/pointOfNoReturn.json`（锁定哈希；
//     intro/setup/resolutions 逐字照抄，去 HTML，textLanguage='en' + pending 自译）。
//
// 本文件只做「本章怎么用这些卡」：印刷数值/卡文全部来自 `../card-data.js`（cards-data 唯一事实源）。
// 逐卡规则键放这里（行为层读；单卡条目 flags 携带同一份键，索引重建后优先读条目）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  location, veiledLocation, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  storyFace, veiledStoryFaces, identitiesFor, linkSymbolLocations,
} from '../../card-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

// ---- 卡号常量（章节行为/测试共用；行为层不写卡号分支，只按数据表分派） ----
export const CODES = Object.freeze({
  scenario: '06247',
  aSinisterRealm: '06248',
  besetByMonsters: '06249',
  actOneV1: '06250',
  actOneV2: '06251',
  theDescent: '06252',
  theBlackExpanse: '06253',
  gugSentinel: '06267',
  richardUptonPickman: '06266',
  falseAwakening: '06275',
  enchantedWoods: '06053',
})

export const LOCATION_IDS = Object.freeze({
  vaultsOfZin: 'vaultsOfZin',
  cityOfGugs: 'cityOfGugs',
  towerOfKoth: 'towerOfKoth',
  plainOfTheGhouls: 'plainOfTheGhouls',
  cragOfTheGhouls: 'cragOfTheGhouls',
  seaOfBones: 'seaOfBones',
  peaksOfThok: 'peaksOfThok',
  valeOfPnath: 'valeOfPnath',
  seaOfPitch262: 'seaOfPitch262',
  seaOfPitch263: 'seaOfPitch263',
  seaOfPitch264: 'seaOfPitch264',
  seaOfPitch265: 'seaOfPitch265',
  enchantedWoods: 'enchantedWoods',
})

export const SEA_OF_PITCH_IDS = Object.freeze([
  LOCATION_IDS.seaOfPitch262, LOCATION_IDS.seaOfPitch263,
  LOCATION_IDS.seaOfPitch264, LOCATION_IDS.seaOfPitch265,
])
// 初始入场 4 地点；其余 8 张放一边（act 推进时入场）。
export const START_LOCATION = LOCATION_IDS.vaultsOfZin
export const INITIAL_LOCATIONS = Object.freeze([
  LOCATION_IDS.vaultsOfZin, LOCATION_IDS.cityOfGugs, LOCATION_IDS.towerOfKoth, LOCATION_IDS.plainOfTheGhouls,
])
export const SET_ASIDE_LOCATIONS = Object.freeze([
  LOCATION_IDS.cragOfTheGhouls, LOCATION_IDS.seaOfBones, LOCATION_IDS.peaksOfThok,
  LOCATION_IDS.valeOfPnath, ...SEA_OF_PITCH_IDS, LOCATION_IDS.enchantedWoods,
])

// ---- 地点 ----
// 符号/连线来自 Location/CardDefs/TheDreamEaters/PointOfNoReturn.hs（location code name traits symbol links set）。
// 4 张漆黑之海同为 plus 符号并互相连接（links 含 plus）；Vale of Pnath 的 equals 把它们接到山谷。
const locations = {
  vaultsOfZin: veiledLocation(LOCATION_IDS.vaultsOfZin, '06254', {
    symbol: 'heart', links: ['t', 'moon'],
  }),
  cityOfGugs: location(LOCATION_IDS.cityOfGugs, '06255', {
    symbol: 't', links: ['heart', 'squiggle', 'moon'],
  }),
  towerOfKoth: location(LOCATION_IDS.towerOfKoth, '06256', {
    symbol: 'squiggle', links: ['t', 'square'],
  }),
  plainOfTheGhouls: veiledLocation(LOCATION_IDS.plainOfTheGhouls, '06257', {
    symbol: 'moon', links: ['heart', 't', 'hourglass'],
  }),
  cragOfTheGhouls: veiledLocation(LOCATION_IDS.cragOfTheGhouls, '06258', {
    symbol: 'hourglass', links: ['equals', 'circle', 'moon'],
  }),
  seaOfBones: location(LOCATION_IDS.seaOfBones, '06259', {
    symbol: 'circle', links: ['hourglass', 'star', 'equals'],
  }),
  peaksOfThok: location(LOCATION_IDS.peaksOfThok, '06260', {
    symbol: 'star', links: ['equals', 'circle'],
  }),
  valeOfPnath: veiledLocation(LOCATION_IDS.valeOfPnath, '06261', {
    symbol: 'equals', links: ['hourglass', 'star', 'circle', 'plus'],
  }),
  seaOfPitch262: veiledLocation(LOCATION_IDS.seaOfPitch262, '06262', {
    symbol: 'plus', links: ['equals', 'plus'],
  }),
  seaOfPitch263: veiledLocation(LOCATION_IDS.seaOfPitch263, '06263', {
    symbol: 'plus', links: ['equals', 'plus'],
  }),
  seaOfPitch264: veiledLocation(LOCATION_IDS.seaOfPitch264, '06264', {
    symbol: 'plus', links: ['equals', 'plus'],
  }),
  seaOfPitch265: veiledLocation(LOCATION_IDS.seaOfPitch265, '06265', {
    symbol: 'plus', links: ['equals', 'plus'],
  }),
  // 放一边的魔幻森林（石板暗门）：由背面故事「另一条路」以已揭示状态放入场。
  enchantedWoods: location(LOCATION_IDS.enchantedWoods, '06053', {
    symbol: 'square', links: ['squiggle', 'triangle', 'diamond'],
  }),
}
// 漆黑之海的印表帷幕是「X」的 -2 占位；实例归零，X 由 behavior.locationShroudModifier 给出。
for (const id of SEA_OF_PITCH_IDS) {
  locations[id].shroud = 0
  locations[id].shroudEqualsReferenceDamage = true
}
linkSymbolLocations(locations)

// 地点规则键（行为层按 data 分派，不写卡号分支）。条目 flags 携带同一份键，索引重建后优先。
export const LOCATION_RULES = Object.freeze({
  '06254': { flipStory: '06254b' },
  '06255': { flipStory: '06255b', flipOnEnter: true },
  '06256': { flipStory: '06256b', flipAction: { skill: 'combat', difficulty: 5 } },
  '06257': { flipStory: '06257b', gugCannotEnter: true, gugSpawnRedirectTo: LOCATION_IDS.cityOfGugs },
  '06258': { flipStory: '06258b', firstMythosTreacherySurge: true },
  '06259': { flipStory: '06259b', flipOnCluesDiscovered: true },
  '06260': { flipStory: '06260b' },
  '06261': { flipStory: '06261b', blocksPlayAndCommitWhileClues: true },
  '06262': { flipStory: '06262b' },
  '06263': { flipStory: '06263b' },
  '06264': { flipStory: '06264b' },
  '06265': { flipStory: '06265b' },
})

// ---- 幕 / 议程 ----
// 幕 1 有两个版本：进入地下世界 v.I（Randolph 未生还）/ v.II（Randolph 生还）。
// v.I 的 hero 卡装备进「印刷阶段」但在 definition 里 v.II 作为备选数据放 ACT_ONE_VARIANTS。
const actOneV1 = {
  ...stages(['06250'], 'act')[0],
  id: 'act1',
  stage: '1a',
  reveal: { type: 'campaignRule' },
  advanceRule: 'enteringTheUnderworldV1',
  takeCluesOnEnemyDefeat: true,
  placeSetAsideLocations: { trait: 'Vale' },
  removeFromGameGroups: ['ghouls', 'strikingFear'],
  shuffleIntoDeckGroups: ['terrorOfTheVale', 'nightgaunts'],
  shuffleDiscardIntoDeck: true,
}
const actOneV2 = {
  ...stages(['06251'], 'act')[0],
  id: 'act1',
  stage: '1a',
  reveal: { type: 'campaignRule' },
  advanceRule: 'enteringTheUnderworldV2',
  takeCluesOnEnemyDefeat: true,
  giveStoryAsset: CODES.richardUptonPickman,
  removeStoryAssetOnLeave: CODES.richardUptonPickman,
  placeSetAsideLocations: { trait: 'Vale' },
  removeFromGameGroups: ['strikingFear'],
  shuffleIntoDeckGroups: ['terrorOfTheVale', 'nightgaunts'],
  shuffleDiscardIntoDeck: true,
}
export const ACT_ONE_VARIANTS = Object.freeze({ v1: actOneV1, v2: actOneV2 })

const actTwo = {
  ...stages(['06252'], 'act')[0],
  id: 'act2',
  stage: '2a',
  reveal: { type: 'campaignRule' },
  advanceRule: 'theDescent',
  takeCluesOnEnemyDefeat: true,
  placeSetAsideLocations: { trait: 'Depths' },
  shuffleIntoDeckGroups: ['descentIntoThePitch', 'agentsOfAtlachNacha'],
  shuffleDiscardIntoDeck: true,
}
const actThree = {
  ...stages(['06253'], 'act')[0],
  id: 'act3',
  stage: '3a',
  reveal: { type: 'campaignRule' },
  advanceRule: 'theBlackExpanse',
  takeCluesOnEnemyDefeat: true,
  finishOnAdvance: 'resolution1',
}

const agendas = [
  {
    ...stages(['06248'], 'agenda')[0],
    id: 'agenda1',
    stage: '1a',
    reveal: { type: 'campaignRule' },
    advanceRule: 'aSinisterRealm',
    shuffleDiscardOnAdvance: true,
    distortionOnAdvance: 1,
  },
  {
    ...stages(['06249'], 'agenda')[0],
    id: 'agenda2',
    stage: '2a',
    reveal: { type: 'campaignRule' },
    advanceRule: 'besetByMonsters',
    advanceChoice: { discardRandom: 1, loseResources: 2 },
    shuffleDiscardOnAdvance: true,
    distortionOnAdvance: 1,
    finishAtDistortion: 5,
    revertOnAdvance: true,
  },
]

// ---- 遭遇组 ----
const GATHER_GROUPS = ['pointOfNoReturn', 'creaturesOfTheUnderworld', 'whispersOfHypnos',
  'ancientEvils', 'ghouls', 'strikingFear']
const SET_ASIDE_GROUPS = ['descentIntoThePitch', 'terrorOfTheVale', 'agentsOfAtlachNacha', 'nightgaunts']
// 放一边的「组」：整组不洗进初始遭遇牌库，由幕推进/故事效果洗入。
const SET_ASIDE_GROUP_CARD_CODES = [...encounterDeck(encounterCards(SET_ASIDE_GROUPS))]
// 单张放一边：Gug Sentinel、Richard Upton Pickman、False Awakening。
const SET_ASIDE_SINGLE_CODES = [CODES.gugSentinel, CODES.richardUptonPickman, CODES.falseAwakening]

// False Awakening 是调查员牌组里的弱点（不进遭遇牌库，也不参与遭遇定义结算）；
// Gug Sentinel 是「放一边」的单张敌人（见 SET_ASIDE_SINGLE_CODES）。
const deckBuildingWeaknesses = new Set([CODES.falseAwakening, CODES.gugSentinel])
const gatheredCards = encounterCards(GATHER_GROUPS).filter(card => !deckBuildingWeaknesses.has(card.code))
const setAsideGroupCards = encounterCards(SET_ASIDE_GROUPS)
// 定义表要包含「放在一边」的单张敌人/弱点（生成/结算时引擎按 definition 取印刷数值）。
const definitions = encounterDefinitions([
  ...gatheredCards,
  ...setAsideGroupCards,
  ALL_CARDS[CODES.gugSentinel],
  ALL_CARDS[CODES.falseAwakening],
])
export const ENCOUNTER_DECK_CODES = Object.freeze(encounterDeck(gatheredCards))
// 幕推进/故事效果要洗入的组（code 常量，行为层读这份数据）。
export const SET_ASIDE_GROUP_DECKS = Object.freeze({
  terrorOfTheVale: Object.freeze(encounterDeck(encounterCards(['terrorOfTheVale']))),
  nightgaunts: Object.freeze(encounterDeck(encounterCards(['nightgaunts']))),
  descentIntoThePitch: Object.freeze(encounterDeck(encounterCards(['descentIntoThePitch']))),
  agentsOfAtlachNacha: Object.freeze(encounterDeck(encounterCards(['agentsOfAtlachNacha']))),
})
// 从游戏中移除的组（act 1b）：Ghouls（v.I）/ Striking Fear（两版）。
export const REMOVE_FROM_GAME_DECKS = Object.freeze({
  ghouls: Object.freeze(encounterDeck(encounterCards(['ghouls']))),
  strikingFear: Object.freeze(encounterDeck(encounterCards(['strikingFear']))),
})

// ---- 故事面（12 张背面故事卡）与故事规则键 ----
const storyFaces = {
  ...veiledStoryFaces(locations),
  '06255b': storyFace('06255b'),
  '06256b': storyFace('06256b'),
  '06259b': storyFace('06259b'),
  '06260b': storyFace('06260b'),
}
export const STORY_RULES = Object.freeze({
  '06254b': { storyRule: 'ghastlyTunnels', storyOf: '06254' },
  '06255b': { storyRule: 'theSentry', storyOf: '06255' },
  '06256b': {
    storyRule: 'anotherPath', storyOf: '06256',
    placeLocationId: LOCATION_IDS.enchantedWoods,
    campaignRecord: 'theInvestigatorsFoundAWayOutOfTheUnderworld',
  },
  '06257b': { storyRule: 'aStrangeGhoul', clueThresholdPerInvestigator: 3, spendClues: true, advanceAct: true },
  '06258b': { storyRule: 'scoutingTheVale', lookCountPerInvestigator: 2, discardUpToHalf: true,
    ignoreLocationCode: '06258' },
  '06259b': { storyRule: 'somethingBelow', attachTreachery: '06272', enemy: '06271', enemyClues: 2 },
  '06260b': { storyRule: 'inhabitantsOfTheVale', enemy: '01172',
    spawnLocationId: LOCATION_IDS.valeOfPnath, drawCards: 2, enemyClues: 2 },
  '06261b': { storyRule: 'theWayOut', clueThresholdPerInvestigator: 3, spendClues: true, advanceAct: true },
  '06262b': { storyRule: 'spiderInfestedWaters', enemyCluesPerInvestigator: 1 },
  '06263b': { storyRule: 'stillSurface' },
  '06264b': { storyRule: 'rollingPits', redistributeCluesEvenly: true, resetVeiledFlippable: true },
  '06265b': { storyRule: 'centerOfTheSea', clueThresholdPerInvestigator: 3, spendClues: true, advanceAct: true },
})

// ---- 英文原文（锁定 locale；P8 只允许照抄，不翻译） ----
// 每段都是 en locale 的逐字正文（仅去 HTML 标签）。
export const INTRO_VARIANTS = Object.freeze({
  intro: {
    title: 'Scenario III–B: Point of No Return',
    paragraphs: [
      'Check Campaign Log.',
      'If Randolph did not survive the descent, proceed to Intro 1.',
      'If Randolph survived the descent, skip to Intro 2.',
    ],
  },
  intro1: {
    title: 'Scenario III–B: Point of No Return',
    paragraphs: [
      'Intro 1: You have finally reached the Dreamlands, but it is not as you expected. This cyclopean cavern is far from the wondrous lands and fabulous cities described in Virgil Gray’s writings. Perhaps the author never ventured this far underground, never found the horrors that lurk beneath the surface of the Dreamlands. You suspect he wouldn’t have left out tales of such a spine-chilling nature. As you venture into the dark and barren realm, you are filled with hollow despair—an emptiness that gnaws at your heart and mirrors the bleak landscape all around you. You came here to help your friends, and now your only guide through this realm is gone. What if this was all a horrible mistake?',
      'You shake these dark thoughts from your mind and focus on the path that lies ahead of you. It’s too late to dwell on what you could have done differently. This is your way forward now. Even if you cannot help your friends, even if you are too late to help Randolph, you have another mission now. Clearly this region of the Dreamlands has something to do with the creatures invading your reality. The answers must lie here. Besides, it’s not like you have much choice anymore.',
      'You walk to the edge of a jagged cliff overlooking the cavernous realm below. This realm is staggeringly vast. In the distance, along the cliffs, you see a walled city, of all things. Among its many towers, a black spire rises so high it must pierce the surface of the Dreamlands. To the south is a stretch of plains that looks over the vale below, and you can see shapes moving throughout the grey, phosphorescent light. You hope the beings who inhabit this realm are ones you might be able to reason with. You have your doubts...but at least now you have a plan. Whether or not it is a good plan remains to be seen.',
      'Proceed to Setup.',
    ],
  },
  intro2: {
    title: 'Scenario III–B: Point of No Return',
    paragraphs: [
      'Intro 2: You have finally reached the Dreamlands, but it is not as you expected. This cyclopean Underworld is far from the wondrous lands and fabulous cities described in Virgil Gray’s writings. Perhaps the author never ventured this far underground, never found the horrors that lurk beneath the surface of the Dreamlands. You suspect he would not have left out tales of such a spine-chilling nature. As you venture into the dark, barren realm, you raise your concerns with Randolph. “It is true that we are farther from your companions than we intended, he affirms. “However, if I may offer another sentiment—perhaps this is a blessing in disguise. Clearly the Underworld has something to do with the creatures invading our reality. I suggest we investigate further while we have the chance. We can return to the surface of the Dreamlands once we have discovered the truth.”',
      'You ask Randolph if he has any leads, and he steps to the edge of a jagged cliff overlooking the cavernous realm below. “I have been here before,” he says quietly, getting his bearings. “Those walls in the distance belong to the City of Gugs. To the south is a stretch of plains that looks over the vale below. That plain is where the ghouls live. Perhaps there we can learn more.” You raise your doubts aloud, wondering if such creatures are even capable of peaceful conversation. “They are more intelligent than you think, and could be quite helpful if we convince them to aid us. In fact, there is one I count among my friends, an artist by the name of Richard Pickman. If we are fortunate enough to find him, that might be our best chance.” You still have your doubts...but at least now you have a plan. Whether or not it is a good plan remains to be seen.',
      'Proceed to Setup.',
    ],
  },
})

export const SPECIAL_RULES = Object.freeze([
  {
    title: 'Locations in Point of No Return',
    body: 'Each of the locations in this scenario have no unrevealed side, and therefore they enter play with their revealed side faceup. Instead of an unrevealed side, these locations have story cards on their reverse sides. Whenever a location in this scenario enters play (including during setup), place clues on that location equal to its clue value, as normal.\nLocations can be flipped over in one of two ways. Most are flipped over by the veiled keyword, as described below. Some locations are instead flipped over by an ability printed on that location.\nOnce a location has been flipped over and its story text has been read, it cannot be flipped over again for the remainder of the game unless otherwise noted.',
  },
  {
    title: 'Veiled',
    body: 'Many of the locations in this scenario have the veiled keyword. This keyword represents that a location contains unknown lore or assistance that must be sought out by the investigators before it can be of use to them.\nAs a {fast} ability, an investigator at a veiled location with no clues on it may flip that location over, resolving the text on its other side.',
  },
])

const RESOLUTION_2_PARAGRAPHS = [
  'Resolution 2: You brace yourself as another wave of distorted reality crashes into you. This feeling, whatever it is, is growing stronger as time marches on. Someone or something is causing it, but how? Just as you are pondering its meaning, you realize something curious: you aren’t the only one affected. Far from it, in fact; the entirety of the Underworld seems to be changing with each wave of warped energy that flows through the realm. Walls shift, the floor skews, and the dim, phosphorescent light scintillates with a cosmic, otherworldly glow. The ground rumbles as another wave of force rushes through the foundations of the dream world. The rocky surface upon which you stand gives way. You flail in the air, attempting to grab hold of something, anything that you can use to pull yourself up. Your hands wrap around a painted plank of wood. You have no time to question its appearance—survival comes first.',
  'When you pull yourself up, you realize you are curled up on a park bench, surrounded by a thick fog and the grim, gambrel rooftops of Arkham. There is no ground in front of you. Just an open, endless pit into fathomless depths. The Underworld, perhaps? But how is that possible? Virgil’s cat watches you casually from a tree branch that hangs over the park bench. “It won’t stop,” the black cat tells you. “Not until there is nothing left of your world.” You wonder what you could possibly do in the face of such horror. The cat gazes down into the pit below. “It’s waiting for you.”',
  'Another rumble. In the distance, you watch with horror as an entire building is sucked into the ground. You think you spot a pedestrian in the distance, but it is no human. If this goes on any longer, your companions won’t have a world to awaken to. You steel yourself, look down into the empty pit, and gulp. “Down you go,” the cat says.',
  'You fall. The roar of the wind is deafening as it whips by your head. You can’t possibly survive a fall like this, you think. But instead of splattering against a hard, rocky ground, you are caught by a glowing, sinewy web. Panicking, you scramble to a nearby platform made of solid rock. Your refuge is one of many, each suspended in the air and connected by thick webbing. Beyond that is a vast, cosmic space, an infinite darkness that stretches as far as the eye can see.',
]

export const RESOLUTION_TEXT = Object.freeze({
  noResolution: [
    'No Resolution: If no resolution was reached (each investigator was defeated): Skip to Resolution 2.',
  ],
  resolution1: [
    'Resolution 1: The black, tarry liquid rises around you, consuming you, and you fear that you’ve made a grave mistake. The pressure of the dense liquid surrounds your body, crushing you from all sides. But then you emerge on the other side. You fall for a brief, silent moment before being caught by a glowing, sinewy web. Panicking, you scramble to a nearby platform made of solid rock. Your refuge is one of many, each suspended in the air and connected by thick webbing. Beyond that is a vast, cosmic space, an infinite darkness that stretches as far as the eye can see.',
    'For each damage on the scenario reference card, record 1 tally mark next to “Steps of the Bridge” in your Campaign Log.',
    'Each investigator earns experience equal to the Victory X value of each card in the victory display.',
    'If you are playing The Web of Dreams as a four-part campaign, proceed to Scenario 4–B: Weaver of the Cosmos.',
    'If you are playing The Dream-Quest and The Web of Dreams as an interconnected eight-part campaign and you have not yet played Scenario 3–A: Dark Side of the Moon, proceed to that scenario.',
    'If you are playing The Dream-Quest and The Web of Dreams as an interconnected eight-part campaign and you have already played Scenario 3–A: Dark Side of the Moon, proceed instead to Interlude III: The Great Ones.',
  ],
  resolution2: [
    ...RESOLUTION_2_PARAGRAPHS,
    'The lead investigator has earned the False Awakening weakness (The Dream-Eaters #275) (does not count toward deck size). Add this card to the lead investigator’s deck.',
    'For each damage on the scenario reference card, record 1 tally mark next to “Steps of the Bridge” in your Campaign Log.',
    'Each investigator earns experience equal to the Victory X value of each card in the victory display.',
    'If you are playing The Web of Dreams as a four-part campaign, proceed to Scenario 4–B: Weaver of the Cosmos.',
    'If you are playing The Dream-Quest and The Web of Dreams as an interconnected eight-part campaign and you have not yet played Scenario 3–A: Dark Side of the Moon, proceed to that scenario.',
    'If you are playing The Dream-Quest and The Web of Dreams as an interconnected eight-part campaign and you have already played Scenario 3–A: Dark Side of the Moon, proceed instead to Interlude III: The Great Ones.',
  ],
})

export const scenario = {
  id: 'pointOfNoReturn',
  originalCode: CODES.scenario,
  name: '无归之地',
  nameEn: 'Point of No Return',
  part: 'B',
  pair: 3,
  // P8-T 边界：英文是锁定原文，中文自译未开始。
  textLanguage: 'en',
  textStatus: 'pending-self-translation',
  intro: INTRO_VARIANTS.intro.paragraphs.join('\n'),
  setup: [
    'Gather all cards from the following encounter sets: Point of No Return, Creatures of the Underworld, Whispers of Hypnos, Ancient Evils, Ghouls, and Striking Fear.',
    'Set each of the following encounter sets aside, out of play: Descent into the Pitch, Terror of the Vale, Agents of Atlach-Nacha, and Nightgaunts.',
    'Put the following locations into play: Vaults of Zin, City of Gugs, Tower of Koth, and Plain of the Ghouls. Each investigator begins play at the Vaults of Zin. Set each other location aside, out of play.',
    'Search the collection for Enchanted Woods (Stone Trapdoor) (The Dream-Eaters #53) and set it aside, out of play.',
    'Set the Gug Sentinel enemy, the Richard Upton Pickman story asset, and the False Awakening weakness aside, out of play.',
    'Check Campaign Log. Depending on the following circumstances, a different version of act 1 should be used in this scenario. Remove the other version of act 1 from the game. If Randolph did not survive the descent, use Act 1a—“Entering the Underworld (v. I).” If Randolph survived the descent, use Act 1a—“Entering the Underworld (v. II).”',
    'A wave of pain and nausea washes over you. Check the number of tally marks recorded next to “Steps of the Bridge” in the Campaign Log. If there are no tally marks recorded, nothing happens. If there are 1–4 tally marks, place 1 damage on the scenario reference card. This represents the distortion within the Dreamlands. If there are 5 or more tally marks, place 2 damage on the scenario reference card. This represents the distortion within the Dreamlands.',
    'Shuffle the remainder of the encounter cards to build the encounter deck.',
  ].join('\n'),
  startLocation: START_LOCATION,
  locations,
  setAsideLocations: [...SET_ASIDE_LOCATIONS],
  acts: [ACT_ONE_VARIANTS.v1, actTwo, actThree],
  agendas,
  resolutions: {
    noResolution: RESOLUTION_TEXT.noResolution,
    resolution1: RESOLUTION_TEXT.resolution1,
    resolution2: RESOLUTION_TEXT.resolution2,
  },
  storyFaces,
  ...definitions,
  storyAssets: storyCards([CODES.richardUptonPickman]),
  encounterDeck: [...ENCOUNTER_DECK_CODES],
  // 混乱标记数值/后果（引擎按 `tokenMeanings[state.difficulty]` 读；四难度各一份）。
  // skull 的 X = 参考卡上的伤害数，动态值由 behavior.resolveChaosToken 结算（这里只放展示文本）。
  tokenMeanings: {
    easy: {
      skull: { text: '-X. X is the amount of damage on this card.', delta: 0 },
      cultist: { text: 'Reveal another token. If you fail, after this skill test ends, draw the top card of the encounter deck.', delta: 0, drawAnother: true },
      tablet: { text: '+1. If this token is revealed during an investigation and you succeed, draw 1 card.', delta: 1 },
      elderthing: { text: '-3. If you fail by 2 or more, choose a ready enemy at your location or a connecting location. That enemy moves to your location, engages you, and makes an immediate attack.', delta: -3 },
    },
    standard: {
      skull: { text: '-X. X is the amount of damage on this card.', delta: 0 },
      cultist: { text: 'Reveal another token. If you fail, after this skill test ends, draw the top card of the encounter deck.', delta: 0, drawAnother: true },
      tablet: { text: '+1. If this token is revealed during an investigation and you succeed, draw 1 card.', delta: 1 },
      elderthing: { text: '-3. If you fail by 2 or more, choose a ready enemy at your location or a connecting location. That enemy moves to your location, engages you, and makes an immediate attack.', delta: -3 },
    },
    hard: {
      skull: { text: '-X. X is 1 more than the amount of damage on this card.', delta: 0 },
      cultist: { text: 'Reveal another token. If you fail, after this skill test ends, draw the top card of the encounter deck.', delta: 0, drawAnother: true },
      tablet: { text: '0. If this token is revealed during an investigation and you succeed, draw 1 card.', delta: 0 },
      elderthing: { text: '-4. If you fail by 2 or more, choose a ready enemy at your location or a connecting location. That enemy moves to your location, engages you, and makes an immediate attack.', delta: -4 },
    },
    expert: {
      skull: { text: '-X. X is 1 more than the amount of damage on this card.', delta: 0 },
      cultist: { text: 'Reveal another token. If you fail, after this skill test ends, draw the top card of the encounter deck.', delta: 0, drawAnother: true },
      tablet: { text: '0. If this token is revealed during an investigation and you succeed, draw 1 card.', delta: 0 },
      elderthing: { text: '-4. If you fail by 2 or more, choose a ready enemy at your location or a connecting location. That enemy moves to your location, engages you, and makes an immediate attack.', delta: -4 },
    },
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c01172: '01172',
  c06249: '06249',
  c06256b: '06256b',
  c06258: '06258',
  c06258b: '06258b',
  c06259b: '06259b',
  c06260b: '06260b',
  c06262b: '06262b',
  c06264b: '06264b',
  c06267: '06267',
  c06268: '06268',
  c06269: '06269',
  c06270: '06270',
  c06271: '06271',
  c06272: '06272',
  c06275: '06275',
})
