// 万象无终（The Circle Undone）· 战役共享常量。
//
// 本文件是战役层级的单一事实源：9 章清单、21 个遭遇组、混乱袋、64 个战役记录键、
// 10 个遗留记忆 id。剧情文本（story-text.js）属 P9，章节规则属 P8 的各章目录。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CAMPAIGN_ID = 'theCircleUndone'

// 9 章：id 用 camelCase（与既有三循环一致），code 是该章封面/参考卡的原卡号，
// 商品包 code 是章节所在的神话包（遭遇组按包归位）。
export const chapters = Object.freeze([
  { id: 'disappearanceAtTheTwilightEstate', code: '05043', name: '暮色庄园失踪事件', nameEn: 'Disappearance at the Twilight Estate', packCode: 'tcu' },
  { id: 'theWitchingHour', code: '05050', name: '巫异时刻', nameEn: 'The Witching Hour', packCode: 'tcu' },
  { id: 'atDeathsDoorstep', code: '05065', name: '死亡门前', nameEn: "At Death's Doorstep", packCode: 'tcu' },
  { id: 'theSecretName', code: '05120', name: '隐秘之名', nameEn: 'The Secret Name', packCode: 'tsn' },
  { id: 'theWagesOfSin', code: '05161', name: '恶罪报应', nameEn: 'The Wages of Sin', packCode: 'wos' },
  { id: 'forTheGreaterGood', code: '05197', name: '崇高利益', nameEn: 'For the Greater Good', packCode: 'fgg' },
  { id: 'unionAndDisillusion', code: '05238', name: '聚合幻灭', nameEn: 'Union and Disillusion', packCode: 'uad' },
  { id: 'inTheClutchesOfChaos', code: '05284', name: '混沌魔掌', nameEn: 'In the Clutches of Chaos', packCode: 'icc' },
  { id: 'beforeTheBlackThrone', code: '05325', name: '黑色王座', nameEn: 'Before the Black Throne', packCode: 'bbt' },
])

// 21 个遭遇组：9 个章节组 + 12 个循环共享组（卡包 manifest 登记同一份清单）。
export const SHARED_ENCOUNTER_GROUP_IDS = Object.freeze([
  'agentsOfAzathoth', 'anettesCoven', 'cityOfSins', 'inexorableFate', 'musicOfTheDamned',
  'realmOfDeath', 'secretsOfTheUniverse', 'silverTwilightLodge', 'spectralPredators',
  'theWatcher', 'trappedSpirits', 'witchcraft',
])

export const ENCOUNTER_GROUP_IDS = Object.freeze([
  ...chapters.map(chapter => chapter.id),
  ...SHARED_ENCOUNTER_GROUP_IDS,
])

// 正式调查员与序章故事调查员（P6/M1 已逐人验收）。
export const INVESTIGATOR_CODES = Object.freeze(['05001', '05002', '05003', '05004', '05005', '05006'])
export const STORY_INVESTIGATOR_CODES = Object.freeze(['05046', '05047', '05048', '05049'])

// 基础混乱袋：参考实现 Campaigns/TheCircleUndone/ChaosBag.hs（13 枚 × 4 难度，skull×2）。
// 逐章临时符号（cultist/tablet/elderthing 增删）属 P8 的 tcu-chaos.js / 各章 behavior。
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze(['+1', '+1', '0', '0', '0', '-1', '-1', '-2', '-3', 'skull', 'skull', 'autofail', 'eldersign']),
  standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'autofail', 'eldersign']),
  hard: Object.freeze(['0', '0', '-1', '-1', '-2', '-2', '-3', '-4', '-5', 'skull', 'skull', 'autofail', 'eldersign']),
  expert: Object.freeze(['0', '-1', '-1', '-2', '-2', '-3', '-4', '-6', '-8', 'skull', 'skull', 'autofail', 'eldersign']),
})

// 64 个战役记录键：参考实现 Campaigns/TheCircleUndone/Key.hs 逐键对齐。
// 类型口径（路线图 §7.6）：以下 8 个用 string[]，2 个用 number，其余 boolean。
export const recordTypes = Object.freeze({
  missingPersons: 'string[]',
  wasTakenByTheWatcher: 'string[]',
  wasClaimedBySpecters: 'string[]',
  disappearedIntoTheMist: 'string[]',
  wasPulledIntoTheSpectralRealm: 'string[]',
  piecesOfEvidenceWereLeftBehind: 'number',
  youAreBeingHunted: 'string[]',
  youHaveAcceptedYourFate: 'boolean',
  youHaveRejectedYourFate: 'boolean',
  theWitchesSpellWasBroken: 'boolean',
  theWitchesSpellWasCast: 'boolean',
  erynnWantsToMeet: 'boolean',
  mementosDiscovered: 'string[]',
  theInvestigatorsAreOnGavriellasTrail: 'boolean',
  theInvestigatorsAreOnJeromesTrail: 'boolean',
  theInvestigatorsAreOnPennysTrail: 'boolean',
  theInvestigatorsAreOnValentinosTrail: 'boolean',
  theInvestigatorsEscapedTheSpectralRealm: 'boolean',
  theInvestigatorsLearnedNothingOfTheLodgesSchemes: 'boolean',
  theInvestigatorsAreNeverSeenOrHeardFromAgain: 'boolean',
  josefDisappearedIntoTheMist: 'boolean',
  theInvestigatorsAreEnemiesOfTheLodge: 'boolean',
  theInvestigatorsRescuedJosef: 'boolean',
  josefIsAliveAndWell: 'boolean',
  theInvestigatorsAreMembersOfTheLodge: 'boolean',
  theInvestigatorsAreDeceivingTheLodge: 'boolean',
  theInvestigatorsToldTheLodgeAboutTheCoven: 'boolean',
  theInvestigatorsHidTheirKnowledgeOfTheCoven: 'boolean',
  theInvestigatorsSurvivedTheWatchersEmbrace: 'boolean',
  hereticsWereUnleashedUntoArkham: 'number',
  theGuardianOfTheTrapEmerged: 'boolean',
  theInvestigatorsDiscoveredHowToOpenThePuzzleBox: 'boolean',
  theGuardianOfTheTrapEmergedAndWasDefeated: 'boolean',
  theInvestigatorsKeptsTheirMementosHidden: 'boolean',
  theInvestigatorsWereInductedIntoTheInnerCircle: 'boolean',
  theInvestigatorsSidedWithTheLodge: 'boolean',
  theInvestigatorsSidedWithTheCoven: 'boolean',
  gavriellaIsAlive: 'boolean',
  jeromeIsAlive: 'boolean',
  pennyIsAlive: 'boolean',
  valentinoIsAlive: 'boolean',
  theTrueWorkOfTheSilverTwilightLodgeHasBegun: 'boolean',
  carlSanfordPossessesTheSecretsOfTheUniverse: 'boolean',
  anetteMasonIsPossessedByEvil: 'boolean',
  gavriellaIsDead: 'boolean',
  jeromeIsDead: 'boolean',
  pennyIsDead: 'boolean',
  valentinoIsDead: 'boolean',
  theInvestigatorsContinuedAlone: 'boolean',
  theInvestigatorsAskedAnetteForAssistance: 'boolean',
  theInvestigatorsArrestedAnette: 'boolean',
  anetteTaughtYouTheSpellsOfOld: 'boolean',
  theInvestigatorsAskedSanfordForAssistance: 'boolean',
  theInvestigatorsArrestedSanford: 'boolean',
  theInvestigatorsAssumedControlOfTheSilverTwilightLodge: 'boolean',
  doomDrawsEverCloser: 'boolean',
  thePathWindsBeforeYou: 'number',
  azathothDevouredTheUniverse: 'boolean',
  theLeadInvestigatorHasJoinedThePipersOfAzathoth: 'boolean',
  azathothSlumbersForNow: 'boolean',
  theInvestigatorsSignedTheBlackBookOfAzathoth: 'boolean',
  theInvestigatorsReversedTheIncantation: 'boolean',
  erynnJoinedTheInvestigators: 'boolean',
  theCovenOfKeziahHoldsTheWorldInItsGrasp: 'boolean',
})

export const recordDefaults = Object.freeze(Object.fromEntries(
  Object.entries(recordTypes).map(([key, type]) => [key,
    type === 'string[]' ? [] : type === 'number' ? 0 : type === 'boolean' ? false : ''])))

// 10 个遗留记忆（参考实现 Campaigns/TheCircleUndone/Memento.hs）。它们不是印刷关键词，
// 是 `mementosDiscovered` 记录集合的稳定 id；中文名在 record-labels.js。
export const MEMENTO_IDS = Object.freeze([
  'mesmerizingFlute', 'strangeIncantation', 'ritualComponents', 'scrapOfTornShadow',
  'gilmensJournal', 'keziahsFormulae', 'wornCrucifix', 'wispOfSpectralMist',
  'cornHuskDoll', 'bloodyTreeCarvings',
])

export const CONTENT_VERSION = '0.1.0'
export const MIN_RULES_VERSION = 'n6.0'
export { CONTENT_SCHEMA_VERSION }
