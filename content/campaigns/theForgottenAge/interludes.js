// 《失落的时代》五个幕间与补给点的结算脚本。
// 数据全部来自原卡中文正文（TFA_STORY_TEXT）与 supplies.js；引擎侧只提供通用效果，
// 所以这里只描述「先做什么检查、读到哪一段、写哪条记录」，不写规则分支。
import { TFA_STORY_TEXT } from './story-text.js'
import { PROLOGUE_SUPPLIES, RESUPPLY_SUPPLIES, SUPPLY_COSTS, SUPPLY_LABELS } from './supplies.js'

const sections = name => TFA_STORY_TEXT.interludes[name]?.sections || {}
const text = (name, key) => (sections(name)[key] || []).join('\n\n')
const lines = (name, keys) => keys.map(key => text(name, key)).filter(Boolean).join('\n\n')

// 幕间正文开头的「检查清单」：只放卡面要求逐项核对的那几句，具体分支由效果在到达时写日志。
export const interludeIntro = Object.freeze({
  interludeOne: lines('interludeOne', ['lookout', 'provisions', 'medicine']),
  interludeTwo: lines('interludeTwo', ['pickExpeditionsEnd1', 'pickExpeditionsEnd2']),
  interludeThree: lines('interludeThree', ['body', 'gas', 'map', 'provisions', 'medicine', 'ichtaca']),
  interludeFour: lines('interludeFour', ['checkProcess.body', 'checkAMindRecovered.body', 'provisions', 'medicine']),
  interludeFive: lines('interludeFive', ['fellIntoTheDepths', 'theNexusIsNear', 'theMissingRelic', 'map']),
  resupplyPoint: '补给点：先在圣玛丽医院处理中毒与创伤，再为每位调查员购买补给品。',
})

const rations = interlude => ({
  type: 'crossOffSupply', supply: 'provisions', perInvestigator: true, labels: SUPPLY_LABELS,
  shortageText: text(interlude, 'lowOnRations'), shortageChoice: { resources: -3 },
})

const medicine = interlude => ({
  type: 'curePoisonedWithMedicine', medicine: 'medicine', poisonCode: '04102', poisonLabel: '中毒',
  labels: SUPPLY_LABELS, toxicityText: text(interlude, 'thePoisonSpreads'), toxicityTrauma: 'physical',
})

const sleep = interlude => ({
  type: 'sleepCheck', supply: 'blanket', supplyLabel: '毛毯',
  withText: text(interlude, 'restfulSleep'), withoutText: text(interlude, 'tossingAndTurning'),
})

export const interludeEffects = Object.freeze({
  prologue: [{
    type: 'pickSupplies', context: 'prologue', options: [...PROLOGUE_SUPPLIES],
    costs: SUPPLY_COSTS, labels: SUPPLY_LABELS, points: { 1: 10, 2: 7, 3: 5, 4: 4 },
    prompt: '选择补给品(剩余{pointsRemaining}点补给品点数)',
  }],
  interludeOne: [
    sleep('interludeOne'),
    rations('interludeOne'),
    {
      type: 'lookoutCheck', supply: 'binoculars', prompt: text('interludeOne', 'lookout'),
      withText: text('interludeOne', 'shapesInTheTrees'), withoutText: text('interludeOne', 'eyesInTheDark'),
      withXp: 2, withoutTrauma: 'mental',
    },
    medicine('interludeOne'),
  ],
  interludeTwo: [{
    type: 'relicCustody', guardRecord: 'theInvestigatorsRecoveredTheRelicOfAges',
    introText: text('interludeTwo', 'pickExpeditionsEnd1'),
    otherwiseText: text('interludeTwo', 'expeditionsEnd5'),
    afterText: text('interludeTwo', 'expeditionsEnd4'),
    prompt: '调查员队长必须决定古代遗物由谁保管。',
    options: [
      {
        id: 'alejandro', label: '交给亚历山卓保管', text: text('interludeTwo', 'expeditionsEnd2'),
        records: {
          theInvestigatorsGaveCustodyOfTheRelicToAlejandro: true,
          theInvestigatorsHaveEarnedAlejandrosTrust: true,
        },
        storyCard: '04051', token: 'tablet',
      },
      {
        id: 'harlan', label: '交给哈伦·恩斯通秘密保管', text: text('interludeTwo', 'expeditionsEnd3'),
        records: {
          theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone: true,
          alejandroIsContinuingHisResearchOnHisOwn: true,
        },
      },
    ],
  }],
  resupplyPoint: [
    { type: 'resupplyServices', poisonCode: '04102', poisonCost: 3, traumaCost: 5 },
    {
      type: 'pickSupplies', context: 'resupplyPoint', options: [...RESUPPLY_SUPPLIES],
      costs: SUPPLY_COSTS, labels: SUPPLY_LABELS, points: { 1: 8, 2: 5, 3: 4, 4: 3 },
      prompt: '选择补给品(剩余{pointsRemaining}点补给品点数)',
    },
  ],
  interludeThree: [
    {
      type: 'crossOffSupply', supply: 'gasoline', count: 1, labels: SUPPLY_LABELS,
      shortageText: text('interludeThree', 'outOfGas'), shortageMulliganBlock: true,
    },
    {
      type: 'supplyCheck', supply: 'map', labels: SUPPLY_LABELS,
      presentText: text('interludeThree', 'aPathDiscovered'),
      recordsWhenPresent: { theInvestigatorsMappedOutTheWayForward: true },
    },
    rations('interludeThree'),
    medicine('interludeThree'),
    {
      type: 'supplyCheck', supply: 'canteen', labels: SUPPLY_LABELS,
      promptText: text('interludeThree', 'canteen'),
      presentText: text('interludeThree', 'patternsInTheStone'),
      absentText: text('interludeThree', 'secretsInTheStone'),
      startingClues: 1,
    },
    {
      type: 'ichtacaFaith', token: 'cultist', tokenCount: 2,
      records: ['theInvestigatorsForgedABondWithIchtaca', 'ichtacaHasConfidenceInYou'],
      recordLabels: [text('interludeThree', 'forgedBond'), text('interludeThree', 'hasConfidence')],
      checklist: { cultistCount: text('interludeThree', 'cultistCount') },
      passText: text('interludeThree', 'faithRestored'),
      record: 'ichtacasFaithIsRestored', addToken: 'cultist',
      failText: '（条件未满足：伊塔卡的信念仍未恢复，跳过「重振信念」。）',
    },
  ],
  interludeFour: [
    {
      type: 'outOfBodyProcess', backfiredRecord: 'theProcessBackfired',
      spectacularRecord: 'theProcessBackfiredSpectacularly',
      introText: text('interludeFour', 'checkProcess.body'),
      lines: {
        none: text('interludeFour', 'checkProcess.noIllEffects'),
        outOfBody: text('interludeFour', 'checkProcess.outOfBodyExperience'),
        yithian: text('interludeFour', 'checkProcess.bodyOfAYithian'),
      },
      weakness: '04264', yithianBody: '04244',
    },
    {
      type: 'alejandroMind', token: 'tablet', tokenCount: 2,
      records: ['theInvestigatorsRescuedAlejandro'], flag: 'custodianWasUnderControl',
      checklist: {
        tabletCount: text('interludeFour', 'checkAMindRecovered.tabletCount'),
        rescuedAlejandro: text('interludeFour', 'checkAMindRecovered.rescuedAlejandro'),
        theCustodianWasUnderControl: text('interludeFour', 'checkAMindRecovered.theCustodianWasUnderControl'),
      },
      passText: text('interludeFour', 'aMindRecovered'), passRecord: 'alejandroRemembersEverything',
      passToken: 'tablet',
      failText: text('interludeFour', 'foreverLost'), failRecord: 'alejandroIsSetAgainstYou',
      removeCard: '04051',
    },
    {
      type: 'supplyCheck', supply: 'chalk', labels: SUPPLY_LABELS,
      promptText: text('interludeFour', 'chalk'),
      presentText: text('interludeFour', 'theWayIsOpen'),
      absentText: text('interludeFour', 'theWayIsShut'),
      absentMulliganBlock: true,
    },
    rations('interludeFour'),
    medicine('interludeFour'),
    sleep('interludeFour'),
  ],
  interludeFive: [
    {
      type: 'storyBranch',
      when: [{ record: 'theInvestigatorsFellIntoTheDepths', text: text('interludeFive', 'theDarkness1') }],
      fallbackText: text('interludeFive', 'theNexusIsNear'),
      afterText: text('interludeFive', 'theDarkness2'),
    },
    {
      type: 'relicReadings', introText: text('interludeFive', 'theMissingRelic'),
      foundRecord: 'theInvestigatorsFoundTheRelicOfAges',
      recoveredRecord: 'theInvestigatorsRecoveredTheRelicOfAges',
      forgingRecord: 'youAreForgingYourOwnWay',
      foundText: text('interludeFive', 'arcaneThrumming'),
      missingText: text('interludeFive', 'growingConcern'),
      finalDawningText: text('interludeFive', 'finalDawning'),
      tokens: { easy: '-3', standard: '-4', hard: '-5', expert: '-6' },
      finalDawningCard: '04303', previousRelicCodes: ['04061', '04191'],
    },
    {
      type: 'supplyCheck', supply: 'torches', labels: SUPPLY_LABELS,
      promptText: text('interludeFive', 'torches'),
      presentText: text('interludeFive', 'torchlight'),
      absentText: text('interludeFive', 'theAbyss'),
      recordsWhenPresent: { theBraziersAreLit: true },
      recordsWhenAbsent: { theBraziersRemainUnlit: true },
    },
    {
      type: 'supplyCheck', supply: 'map', labels: SUPPLY_LABELS, whenRecord: 'theBraziersAreLit',
      presentText: text('interludeFive', 'readingSigns'), presentXp: 2,
    },
    {
      type: 'discardSupplies', supplies: ['medicine', 'provisions'], labels: SUPPLY_LABELS,
      text: text('interludeFive', 'senseOfTime'),
    },
  ],
})
