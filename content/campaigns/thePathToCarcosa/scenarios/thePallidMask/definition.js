import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor,
} from '../../card-data.js'

export const CATACOMB_CODES = [
  '03247', '03248', '03248', '03249', '03250', '03251', '03252',
  '03252', '03253', '03253', '03254', '03255', '03256', '03257',
]

const gathered = encounterCards(['the_pallid_mask', 'ghouls', 'hauntings', 'chilling_cold'])
const definitions = encounterDefinitions([...gathered, ALL_CARDS['03059'], ALL_CARDS['03067b']])
Object.assign(definitions.enemies['03241b'], { healthPerInvestigator: 5, victory: 2 })

const locations = Object.fromEntries(CATACOMB_CODES.map((code, index) => [
  `catacomb${index}`,
  location(`catacomb${index}`, code, [], { catacomb: true }),
]))

export const scenario = {
  id: 'thePallidMask',
  originalCode: '03240',
  name: '卡尔克萨之路 · 苍白面具',
  intro: '巴黎地下墓穴的白骨迷宫吞没了你。陌生人就在前方，而每一条新通道都可能通往死亡。',
  setup: '建立事务化随机地下墓穴牌堆；暗影坟墓与堵塞通道混入底部五张。按前一幕结局选择起始地点。',
  startLocation: 'catacomb0',
  locations,
  acts: stages(['03243', '03244', '03245', '03246'], 'act').map(act => ({
    ...act,
    reveal: { type: 'campaignRule' },
  })),
  agendas: stages(['03241', '03242'], 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  encounterDeck: encounterDeck(gathered).filter(code => code !== '03241b'),
  resolutions: {
    noResolution: '你已知晓大门所在。至少一位调查员阅读第二幕；加入2枚古神标记并获得胜利点经验。',
    r1: '你已知晓大门所在。加入2枚异教徒标记并获得胜利点经验。',
    r2: '你已知晓大门所在；追踪陌生人增加2次。加入2枚石板标记并获得胜利点经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
