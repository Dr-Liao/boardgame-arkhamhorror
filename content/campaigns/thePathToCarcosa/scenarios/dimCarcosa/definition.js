import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor,
} from '../../card-data.js'

const groups = [
  'dim_carcosa', 'delusions', 'cult_of_the_yellow_sign',
  'inhabitants_of_carcosa', 'agents_of_hastur', 'striking_fear',
]
const gathered = encounterCards(groups)
const setAsideCodes = new Set(['03088', '03332', '03333', '03334'])
const definitions = encounterDefinitions([...gathered, ALL_CARDS['03059']])

export const actTwoVariants = stages(['03321a', '03322a', '03323a'], 'act').map(act => ({
  ...act,
  id: 'act2',
  reveal: { type: 'campaignRule' },
}))

export const scenario = {
  id: 'dimCarcosa',
  originalCode: '03316',
  name: '卡尔克萨之路 · 卡城幽影',
  intro: '你穿过门扉，来到群星间的疯狂国度。只有直面陌生人与黄衣之王，才能终结这场噩梦。',
  setup: '根据疑惑与确信选择场景2版本，随机选择四组异界地点，并从上一关开启的路线对应地点开始。',
  startLocation: 'darkSpires',
  locations: {
    shoresOfHali: location('shoresOfHali', '03325', ['bleakPlains']),
    bleakPlains: location('bleakPlains', '03326a', ['shoresOfHali', 'ruinsOfCarcosa', 'palaceOfTheKing']),
    ruinsOfCarcosa: location('ruinsOfCarcosa', '03327a', ['bleakPlains', 'palaceOfTheKing', 'depthsOfDemhe']),
    dimStreets: location('dimStreets', '03328a', ['darkSpires', 'palaceOfTheKing', 'depthsOfDemhe']),
    depthsOfDemhe: location('depthsOfDemhe', '03329a', ['dimStreets', 'ruinsOfCarcosa', 'palaceOfTheKing']),
    darkSpires: location('darkSpires', '03330', ['dimStreets']),
    palaceOfTheKing: location('palaceOfTheKing', '03331',
      ['bleakPlains', 'ruinsOfCarcosa', 'dimStreets', 'depthsOfDemhe']),
  },
  locationVariants: {
    bleakPlains: ['03326a', '03326c'].map(code =>
      location('bleakPlains', code, ['shoresOfHali', 'ruinsOfCarcosa', 'palaceOfTheKing'])),
    ruinsOfCarcosa: ['03327a', '03327c', '03327e'].map(code =>
      location('ruinsOfCarcosa', code, ['bleakPlains', 'palaceOfTheKing', 'depthsOfDemhe'])),
    dimStreets: ['03328a', '03328c', '03328e'].map(code =>
      location('dimStreets', code, ['darkSpires', 'palaceOfTheKing', 'depthsOfDemhe'])),
    depthsOfDemhe: ['03329a', '03329c'].map(code =>
      location('depthsOfDemhe', code, ['dimStreets', 'ruinsOfCarcosa', 'palaceOfTheKing'])),
  },
  acts: [
    { ...stages(['03320'], 'act')[0], id: 'act1', stage: '1a',
      objective: { type: 'clues', perInvestigator: 2 },
      reveal: { type: 'campaignRule' } },
    actTwoVariants[0],
    { ...stages(['03324'], 'act')[0], id: 'act3', stage: '3a',
      reveal: { type: 'campaignRule' } },
  ],
  agendas: stages(['03317', '03318', '03319'], 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
  })),
  // 03321a 的「花费 3 行动直面男子」与 03324 的 [free] 翻面能力都印在当前幕卡上。
  scriptCards: { rules: {
    confrontStranger: { card: 'act', codes: ['03321a'] },
    flipCarcosaLocation: { card: 'act', codes: ['03324'] },
  } },
  ...definitions,
  encounterDeck: encounterDeck(gathered.filter(card => !setAsideCodes.has(card.code))),
  resolutions: {
    noResolution: '未达成任何结局。确信不低于疑惑时进入结局4，否则进入结局5。',
    r1: '褴褛之王被击败。调查员阻止哈斯塔逃出牢狱。',
    r2: '黄衣之王被击败。调查员阻止哈斯塔逃出牢狱。',
    r3: '卡尔克萨领主被击败。调查员阻止哈斯塔逃出牢狱。',
    r4: '现实与卡尔克萨融为一体，所有调查员发疯。',
    r5: '哈斯塔已将调查员抓住，所有调查员发疯。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
