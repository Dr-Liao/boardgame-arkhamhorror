import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CHAOS_BAGS, chapters, recordTypes } from './shared.js'

// M0 baseline: the whole campaign is catalogue-only. The flow mirrors
// Arkham/Campaigns/TheForgottenAge.hs nextStep, but every chapter stays a
// reference-only placeholder until M3. Provisional resolution ids are replaced
// when the campaign endings are migrated.
export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'theForgottenAge',
  name: '失落的时代',
  nameEn: 'The Forgotten Age',
  contentVersion: '0.1.0',
  minRulesVersion: 'n4.2',
  status: 'catalog-only',
  requiredPackIds: ['core', 'tfaCampaign'],
  scenarioIds: chapters.map(chapter => chapter.id),
  unlock: Object.fromEntries(chapters.map((chapter, index) =>
    [chapter.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS,
  recordSchema: recordTypes,
  interludeHandlerId: 'tfaInterlude',
  resolutionIds: ['defeat', 'victory'],
  flow: {
    start: 'prologue',
    nodes: {
      prologue: { type: 'story', title: '序章：地球不属于我们', next: 'theUntamedWilds' },
      theUntamedWilds: { type: 'scenario', scenarioId: 'theUntamedWilds', next: 'interludeOne' },
      interludeOne: { type: 'interlude', title: '幕间一', next: 'theDoomOfEztli' },
      theDoomOfEztli: { type: 'scenario', scenarioId: 'theDoomOfEztli', next: 'interludeTwo' },
      interludeTwo: { type: 'interlude', title: '幕间二', next: 'threadsOfFate' },
      threadsOfFate: { type: 'scenario', scenarioId: 'threadsOfFate', next: 'resupplyPoint' },
      resupplyPoint: { type: 'interlude', title: '补给点', next: 'theBoundaryBeyond' },
      theBoundaryBeyond: { type: 'scenario', scenarioId: 'theBoundaryBeyond', next: 'interludeThree' },
      interludeThree: { type: 'interlude', title: '幕间三', next: 'heartOfTheEldersPart1' },
      heartOfTheEldersPart1: { type: 'scenario', scenarioId: 'heartOfTheEldersPart1', next: 'heartOfTheEldersPart2' },
      heartOfTheEldersPart2: { type: 'scenario', scenarioId: 'heartOfTheEldersPart2', next: 'theCityOfArchives' },
      theCityOfArchives: { type: 'scenario', scenarioId: 'theCityOfArchives', next: 'interludeFour' },
      interludeFour: { type: 'interlude', title: '幕间四', next: 'theDepthsOfYoth' },
      theDepthsOfYoth: { type: 'scenario', scenarioId: 'theDepthsOfYoth', next: 'interludeFive' },
      interludeFive: { type: 'interlude', title: '幕间五', next: 'shatteredAeons' },
      shatteredAeons: { type: 'scenario', scenarioId: 'shatteredAeons', next: 'epilogue' },
      epilogue: { type: 'story', title: '尾声', next: 'turnBackTime' },
      turnBackTime: { type: 'scenario', scenarioId: 'turnBackTime', next: 'end' },
      end: { type: 'end' },
    },
  },
}
