// 梦境门外（Beyond the Gates of Sleep · 06039）· 剧本数据（纯 JSON，不含函数）。
//
// 参考：Scenario/Scenarios/TheDreamEaters/BeyondTheGatesOfSleep.hs + Act/Agenda/Enemy/Location/
// Story/Treachery/Cards/TheDreamEaters/BeyondTheGatesOfSleep/*。
// 文本来源：参考资源 frontend/src/locales/en/theDreamEaters/scenarios/beyondTheGatesOfSleep.json
// （逐字照抄英文原文、去掉 HTML 标签；textLanguage/textStatus 标 pending-self-translation）。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, storyCards, linkSymbolLocations, identitiesFor,
} from '../../card-data.js'
import { BEYOND_THE_GATES_TOKEN_MEANINGS } from './chaos.js'

// 本章收齐的 6 个遭遇组（卡面 setup 逐句）。
export const GATHER_GROUPS = [
  'beyondTheGatesOfSleep', 'agentsOfNyarlathotep', 'zoogs', 'dreamersCurse', 'dreamlands', 'chillingCold',
]

export const SEVENTY_STEPS = '06045'
export const CAVERN_OF_FLAME = '06046'
export const SEVEN_HUNDRED_STEPS = '06047'
export const BASE_OF_THE_STEPS = '06048'
export const ENCHANTED_PATH = '06049'
export const KAMAN_THAH = '06057'
export const NASHT = '06058'
export const RANDOLPH_CARTER = '06059'
export const LABORING_GUG = '06060'
export const ANCIENT_ZOOG = '06061'
export const LOST_IN_THE_WOODS = '06062'

export const ACT_CODES = ['06041', '06042', '06043', '06044']
export const AGENDA_CODES = ['06040']

// 7 张「魔幻森林」：印刷正面同名，背面（揭示面）给出具体副标题。
export const WOODS = Object.freeze([
  { id: 'mysticalForest', code: '06050', symbol: 'circle', links: ['squiggle', 'star', 'plus'] },
  { id: 'villageOfZoogs', code: '06051', symbol: 'diamond', links: ['squiggle', 'square', 'star'] },
  { id: 'greatStoneCircle', code: '06052', symbol: 'triangle', links: ['squiggle', 'plus', 'square'] },
  { id: 'stoneTrapdoor', code: '06053', symbol: 'square', links: ['squiggle', 'triangle', 'diamond'] },
  { id: 'theMoonTree', code: '06054', symbol: 'star', links: ['squiggle', 'diamond', 'circle'] },
  { id: 'fungalForest', code: '06055', symbol: 'moon', links: ['squiggle'] },
  { id: 'lostWoods', code: '06056', symbol: 'droplet', links: ['squiggle'] },
])
export const WOOD_IDS = Object.freeze(WOODS.map(entry => entry.id))
export const WOOD_CODES = Object.freeze(WOODS.map(entry => entry.code))

// 开局放一边：伦道夫·卡特、辛劳的古革巨人、两张双面敌人（纳什特/卡曼塔），以及其余地点。
export const SET_ASIDE_ENEMY_CODES = Object.freeze([KAMAN_THAH, NASHT, LABORING_GUG])
export const SET_ASIDE_LOCATIONS = Object.freeze([
  'sevenHundredSteps', 'baseOfTheSteps', 'theEnchantedPath', ...WOOD_IDS,
])
export const IN_PLAY_LOCATIONS = Object.freeze(['seventySteps', 'cavernOfFlame'])

// 遭遇牌：6 个组的全部敌人/诡计。开局没有遭遇牌库——除 3 张 set-aside 敌人外，
// 其余全部「放在一边」，由幕 3 背面洗成遭遇牌库（见 behavior.resolveTheFinalDescent）。
const allEncounterCards = encounterCards(GATHER_GROUPS)
const SET_ASIDE_ENEMY_SET = new Set(SET_ASIDE_ENEMY_CODES)
export const ENCOUNTER_PILE = Object.freeze(allEncounterCards
  .filter(card => !SET_ASIDE_ENEMY_SET.has(card.code))
  .flatMap(card => Array(card.quantity || 1).fill(card.code)))
export const ENCOUNTER_DECK = Object.freeze([])
const definitions = encounterDefinitions(allEncounterCards)

export const SET_ASIDE_ALIASES = Object.freeze([
  RANDOLPH_CARTER, ...SET_ASIDE_ENEMY_CODES, ...ENCOUNTER_PILE,
])

// —— 英文原文（去 HTML；逐字照抄 en locale）——
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: 'pending-self-translation',
  intro:
    'Scenario I–A: Beyond the Gates of Sleep\n\n'
    + 'In player order, each investigator chooses and reads aloud one of the dream entries below that applies to that investigator. “Neutral” dreams may be chosen by any investigator. Each investigator must choose a different dream, if able. Then, proceed to _Setup_.',
  setup:
    'Gather all cards from the following encounter sets: *Beyond the Gates of Sleep*, *Agents of Nyarlathotep*, *Zoogs*, *Dreamer’s Curse*, *Dreamlands*, and *Chilling Cold*.\n\n'
    + 'Put the Seventy Steps *(Of Lighter Slumber)* and The Cavern of Flame into play. Each investigator begins at the Seventy Steps *(Of Lighter Slumber)*.\n\n'
    + 'Set the following cards aside, out of play: Randolph Carter *(Expert Dreamer)*, the Laboring Gug enemy, the two double-sided enemy cards *(Nasht and Kaman-Thah)*, and each of the remaining locations.\n\n'
    + '*Note: Nasht and Kaman-Thah are double-sided and have story cards on their other side. For the best experience, do not look at the other side unless an effect instructs you to do so.*\n\n'
    + 'This scenario does not begin with an encounter deck in play. Set all of the remaining encounter cards aside, in a single pile. They will be shuffled together at a later time to form the encounter deck. (See “Steps of Slumber,” below.)',
  stepsOfSlumber:
    'Steps of Slumber\n\n'
    + 'At the start of this scenario, there is no encounter deck. This means that the investigators cannot use abilities that interact with the encounter deck in any way. (*For example, effects such as those that search the encounter deck, draw cards from the encounter deck, or look at cards in the encounter deck all fail.*)\n\n'
    + 'Additionally, act 1a has the text: “Do not draw cards from the encounter deck during the mythos phase.”\n\n'
    + 'At a certain point in the scenario, the investigators will be instructed to form the encounter deck, and this text will no longer be active. From that point onward, the investigators can interact with the encounter deck as normal.',
  resolutions: Object.freeze({
    noResolution: 'No resolution\n_If no resolution was reached because each investigator was defeated:_\nYou are nudged into consciousness by an old, scarred cat. “Hey. You all right, human?”\n\n'
      + 'I’m dreaming, you remember, and suddenly the talking cat doesn’t seem quite as weird. Exhausted, you manage to rise to your feet, brushing off the dirt caked on your clothing. “You’re lucky you weren’t harmed before we arrived,” a human voice calls out to you. It belongs to a blond-haired man in a brown traveling coat, who leans against a nearby tree. “These woods are not forgiving to the faint of heart.” The scarred cat walks to the man’s side, and the man leans over to pet its back.\n\n'
      + 'You ask the man where you are and how he came to this place, but he cuts you off. “I will explain in due time. For now, we must follow the path to the town of Ulthar. It is a safe place, relatively speaking. There you may recover from your ordeals.” He turns to the cat and utters a word in an odd language—a password of sorts, you suspect—but the cat simply wanders off toward a hedge, where you see several other cats banded together. “Do it yerself,” it replies.\n\n'
      + '“Don’t mind the cats,” the man says to you quietly as the cats depart. “They are useful allies, but also independent creatures with no need for you or me. When we reach Ulthar, you may get the chance to meet others of their kind. But first things first.” Together, you leave the eaves of the enchanted forest behind.\n\n'
      + 'In your Campaign Log, record *the investigators were saved by Randolph Carter*.\n'
      + 'Any one investigator may choose to add Randolph Carter *(Expert Dreamer)* (The Dream-Eaters card #59) to their deck. This card does not count toward that investigator’s deck size.\n'
      + 'Each investigator earns experience equal to the Victory X value of each card in the victory display.',
    resolution1: 'Resolution 1\n'
      + 'The creatures chitter among themselves, and after a moment, a dozen of them retreat in the direction of the great tree beyond the beaten path. They return shortly afterward carrying a variety of grouse, quail, and pheasants in their mouths. You’re almost certain now that you are going crazy. And yet, the spectacle continues. The creatures timidly drop their “tribute” of birds in front of the cats and quietly depart. “My apologies on behalf of the Zoogs,” the man says as he approaches. “They are curious creatures, and not usually so...agitated. It is good that we showed up when we did.” The leader of the cats jumps on a tree stump and adds, “Yes, yes. Them vile Zoogs have done their part, now let’s do ours and leave this forsaken place. What say yeh?”\n\n'
      + 'You cannot contain your excitement. Zoogs, talking cats— everything you have read about is real. You begin to ask the man more about this world, but he cuts you off. “I will explain in due time. For now, we must follow the path to the town of Ulthar. It is a safe place, relatively speaking. There you may recover from your travels.” He turns to the old, scarred cat and utters a word in an odd language—a password of sorts, you suspect—and the cat replies with a quick nod. The rest of the cats, tribute in mouth, take a protective circular formation around you, and together you escape from the eaves of the enchanted forest.\n\n'
      + 'In your Campaign Log, record *the cats collected their tribute from the Zoogs*.\n'
      + 'Any one investigator may choose to add Randolph Carter *(Expert Dreamer)* (The Dream-Eaters card #59) to their deck. This card does not count toward that investigator’s deck size.\n'
      + 'Each investigator earns experience equal to the Victory X value of each card in the victory display.',
    resolution2: 'Resolution 2\n'
      + 'You hold a hand up to the new visitors, believing that you can defuse this situation on your own. Had you known these rodent-like creatures were intelligent all along, you might have tried to communicate with them much earlier. You inform them that you are just travelers in this faraway land and that you simply wish to pass through peacefully. The creatures chitter among themselves for a moment: “They are kind!” “They are not with the black cat after all!” “Summon the Council of Sages!” After a short while, several more of them appear, each with withering grey fur and a frail, thin body. The eldest one peeks behind you and states that they will aid you if you get the cats to leave.\n\n'
      + 'Somehow, you contain your disbelief and politely ask the cats to come back another time. “All right,” the scarred cat replies, “but you ain’t seen the last of us.” The cats retreat to the edge of the woods, though their human companion stays behind with you. Once the cats are out of earshot, one of the elders offers you a gourd of what appears to be fermented tree sap, which you accept graciously.\n\n'
      + '“It is the wine of the moon-tree,” the man behind you explains quietly, stepping forward. “The Zoogs do not give such gifts lightly. They are curious creatures, but not without wisdom. Now that you may speak freely with their elders, try asking them a question. They know more of the dealings of this land than you might think.”\n\n'
      + 'You describe the author Virgil Gray and ask the Zoogs if they have seen a man fitting that description pass through these woods. You add that he would have walked this path many times. A hush falls over the Zoogs, and some of them immediately depart into the deep foliage. “We have met this human,” one of the elders replies with a flutter just louder than a whisper. “He often comes this way. He is kind but foolish. Take the road to Ulthar. You may meet him.” Then it adds with a low growl: “...but beware the cat that follows him. All cats are liars, but the black cat especially.” You thank the ancient Zoog for its wisdom and depart, led by the blond man and his feline escort. The cats eye you suspiciously after your discussion with the Zoogs. The man breaks the tension. “If you are heading to Ulthar to find this friend of yours, allow me to guide you there. It is a safe place, relatively speaking. There you may recover from your travels.”\n\n'
      + 'Zoogs. Talking cats. This can’t all be a figment of your imagination. Somehow, you can see a layer of truth beneath all of this absurdity. For better or for worse, the Zoog council has confirmed the reality of your situation: the Dreamlands are real, and Virgil Gray is here.\n\n'
      + 'In your Campaign Log, record *the investigators parleyed with the Zoogs*.\n'
      + 'Any one investigator may choose to add Randolph Carter *(Expert Dreamer)* (The Dream-Eaters card #59) to their deck. This card does not count toward that investigator’s deck size.\n'
      + 'Each investigator earns experience equal to the Victory X value of each card in the victory display.',
  }),
})

// 12 种梦境（效应数据；梦境正文属 P8-T 剧情正文，本章只放可结算的效果声明）。
// 依据 BeyondTheGatesOfSleep.hs:2150-2236（classDreams / traitsDreams / dreamEffect）。
export const DREAMS = Object.freeze([
  { key: 'guardian', klass: 'guardian', effect: { kind: 'searchPlay', trait: 'guardian' } },
  { key: 'seeker', klass: 'seeker', effect: { kind: 'searchPlay', trait: 'seeker' } },
  { key: 'rogue', klass: 'rogue', effect: { kind: 'searchPlay', trait: 'rogue' } },
  { key: 'mystic', klass: 'mystic', effect: { kind: 'searchPlay', trait: 'mystic' } },
  { key: 'survivor', klass: 'survivor', effect: { kind: 'searchPlay', trait: 'survivor' } },
  { key: 'criminal', trait: 'criminal', effect: { kind: 'searchPlay', traitAny: ['criminal', 'illicit'] } },
  { key: 'drifter', trait: 'drifter', effect: { kind: 'replaceBasicWeakness' } },
  { key: 'hunter', trait: 'hunter', effect: { kind: 'searchPlay', trait: 'weapon' } },
  { key: 'medicOrAssistant', traitAny: ['medic', 'assistant'], effect: { kind: 'giftOther' } },
  { key: 'miskatonicOrScholar', traitAny: ['miskatonic', 'scholar'], effect: { kind: 'searchPlay', trait: 'tome' } },
  { key: 'veteran', trait: 'veteran', effect: { kind: 'startingCards', traitAny: ['tactic', 'supply'], count: 2 } },
  { key: 'wayfarer', trait: 'wayfarer', effect: { kind: 'searchPlay', traitAny: ['wayfarer', 'relic'] } },
  { key: 'neutral1', effect: { kind: 'resources', amount: 2 } },
  { key: 'neutral2', effect: { kind: 'openingHand', amount: 1 } },
])

const locations = {
  seventySteps: location('seventySteps', SEVENTY_STEPS, { symbol: 'heart', links: ['hourglass'] }),
  cavernOfFlame: location('cavernOfFlame', CAVERN_OF_FLAME, { symbol: 'hourglass', links: ['heart', 'equals'] }),
  sevenHundredSteps: location('sevenHundredSteps', SEVEN_HUNDRED_STEPS, { symbol: 'equals', links: ['hourglass', 't'] }),
  baseOfTheSteps: location('baseOfTheSteps', BASE_OF_THE_STEPS, { symbol: 't', links: ['equals', 'squiggle'] }),
  theEnchantedPath: location('theEnchantedPath', ENCHANTED_PATH, { symbol: 'squiggle', links: ['t', 'moon'] }),
  ...Object.fromEntries(WOODS.map(entry => [entry.id, location(entry.id, entry.code, {
    symbol: entry.symbol, links: entry.links,
  })])),
}
linkSymbolLocations(locations)

const ACT_EXTRA = Object.freeze({
  '06041': { objective: { type: 'enterLocation', location: 'cavernOfFlame' } },
  '06042': {},
  '06043': { chapterFlow: 'theFinalDescent' },
  '06044': { objective: { type: 'clues', perInvestigator: 5, atLocation: 'theEnchantedPath' } },
})
const AGENDA_EXTRA = Object.freeze({ '06040': {} })

export const scenario = {
  id: 'beyondTheGatesOfSleep',
  originalCode: '06039',
  name: '梦境门外 · Beyond the Gates of Sleep',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: 'seventySteps',
  locations,
  setAsideLocations: SET_ASIDE_LOCATIONS,
  inPlayLocations: IN_PLAY_LOCATIONS,
  setAsideAliases: SET_ASIDE_ALIASES,
  acts: stages(ACT_CODES, 'act').map(act => ({
    ...act,
    reveal: { type: 'campaignRule' },
    ...(ACT_EXTRA[act.originalCode] || {}),
  })),
  agendas: stages(AGENDA_CODES, 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
    ...(AGENDA_EXTRA[agenda.originalCode] || {}),
  })),
  ...definitions,
  storyAssets: storyCards([RANDOLPH_CARTER]),
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  tokenMeanings: {
    standard: { ...BEYOND_THE_GATES_TOKEN_MEANINGS.standard },
    hard: { ...BEYOND_THE_GATES_TOKEN_MEANINGS.hard },
    expert: { ...BEYOND_THE_GATES_TOKEN_MEANINGS.hard },
    easy: { ...BEYOND_THE_GATES_TOKEN_MEANINGS.standard },
  },
  dreams: DREAMS,
  stepsOfSlumber: SCENARIO_TEXT.stepsOfSlumber,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c06040: '06040',
  c06041: '06041',
  c06042: '06042',
  c06043: '06043',
  c06044: '06044',
  c06045: '06045',
  c06046: '06046',
  c06047: '06047',
  c06048: '06048',
  c06049: '06049',
  c06057: '06057',
  c06058: '06058',
  c06059: '06059',
  c06060: '06060',
  c06061: '06061',
  c06062: '06062',
})
