import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  printed, location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor,
} from '../../card-data.js'

const groups = ['a_phantom_of_truth', 'evil_portents', 'byakhee', 'the_stranger', 'agents_of_hastur']
const gathered = encounterCards(groups)
const extra = ['01135', '01136', '03066b'].map(code => ALL_CARDS[code])
const definitions = encounterDefinitions([...gathered, ...extra])

const paris = {
  montparnasse: location('montparnasse', '03208', ['gareDOrsay', 'gardensOfLuxembourg', 'notreDame']),
  montmartre: location('montmartre', '03209', ['operaGarnier', 'grandGuignol', 'canalSaintMartin', 'leMarais']),
  grandGuignol: location('grandGuignol', '03211', ['operaGarnier', 'montmartre']),
  operaGarnier: location('operaGarnier', '03212', ['grandGuignol', 'montmartre', 'gareDOrsay']),
  gareDOrsay: location('gareDOrsay', '03214', ['operaGarnier', 'montparnasse', 'gardensOfLuxembourg']),
  pereLachaiseCemetery: location('pereLachaiseCemetery', '03215', ['canalSaintMartin', 'leMarais']),
  canalSaintMartin: location('canalSaintMartin', '03216', ['montmartre', 'pereLachaiseCemetery', 'leMarais']),
  leMarais: location('leMarais', '03217', ['montmartre', 'canalSaintMartin', 'pereLachaiseCemetery', 'notreDame']),
  notreDame: location('notreDame', '03219', ['montparnasse', 'leMarais', 'gardensOfLuxembourg']),
  gardensOfLuxembourg: location('gardensOfLuxembourg', '03220', ['montparnasse', 'gareDOrsay', 'notreDame']),
}

const allActs = stages(['03204', '03205', '03206', '03207'], 'act').map(act => ({
  ...act,
  reveal: { type: 'campaignRule' },
  ...(['03204', '03205'].includes(act.originalCode)
    ? { objective: { type: 'clues', perInvestigator: 2 } } : {}),
}))

export const scenario = {
  id: 'aPhantomOfTruth',
  originalCode: '03200',
  name: '卡尔克萨之路 · 真相幻影',
  intro: '梦境将你一次次拖向卡尔克萨。醒来后，你前往巴黎追查《黄衣之王》的导演奈杰尔·英格兰姆。',
  setup: '先结算前导梦境。按确信与疑惑选择巴黎阴谋版本，随机选择三个巴黎地点版本，并将风琴手放在一边。',
  setupSequence: ['preScenarioSetup', 'setupLocations', 'modifyDeck'],
  startLocation: 'gareDOrsay',
  locations: paris,
  locationVariants: {
    montmartre: [
      location('montmartre', '03209', paris.montmartre.connections),
      location('montmartre', '03210', paris.montmartre.connections),
    ],
    operaGarnier: [
      location('operaGarnier', '03212', paris.operaGarnier.connections),
      location('operaGarnier', '03213', paris.operaGarnier.connections),
    ],
    leMarais: [
      location('leMarais', '03217', paris.leMarais.connections),
      location('leMarais', '03218', paris.leMarais.connections),
    ],
  },
  acts: allActs,
  agendas: stages(['03201', '03202', '03203'], 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  encounterDeck: encounterDeck(gathered)
    .filter(code => !['03221', '03221b'].includes(code))
    .concat(Array(3).fill('01135'), Array(2).fill('01136')),
  resolutions: {
    noResolution: '你没能逃脱幻影的凝视。加入2枚古神标记，并获得胜利点经验。',
    r1: '你找到了奈杰尔的住宅。加入2枚异教徒标记，并获得胜利点经验。',
    r2: '你找到了奈杰尔·英格兰姆。每位调查员承受1点精神创伤并额外获得2点经验；加入2枚石板标记。',
    r3: '你没能找到奈杰尔。加入2枚古神标记，并获得胜利点经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
