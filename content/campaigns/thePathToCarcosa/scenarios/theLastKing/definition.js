import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  printed, location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor,
} from '../../card-data.js'

const BYSTANDERS = ['03076a', '03077', '03078', '03079', '03080']
const TRANSFORMED = ['03065b', '03066b', '03067b', '03068b', '03069b']
const encounterGroups = ['the_last_king', 'hasturs_gift', 'decay', 'stranger', 'ancient_evils']
const gathered = encounterCards(encounterGroups)
const deckCards = gathered.filter(card => ![...TRANSFORMED, '03081'].includes(card.code))
const definitions = encounterDefinitions([
  ...deckCards,
  ...TRANSFORMED.map(code => ALL_CARDS[code]),
  ALL_CARDS['03081'],
])
Object.assign(definitions.enemies['03065b'], { hunter: true })
Object.assign(definitions.enemies['03066b'], { hunter: true })
Object.assign(definitions.enemies['03067b'], { hunter: true })
Object.assign(definitions.enemies['03068b'], { hunter: true, retaliate: true })
Object.assign(definitions.enemies['03069b'], { hunter: true })
Object.assign(definitions.enemies['03081'], { aloof: true })

export const scenario = {
  id: 'theLastKing',
  originalCode: '03061',
  name: '卡尔克萨之路 · 最后的王者',
  intro: '为了寻找《黄衣之王》演职人员，你穿上最光鲜的衣装，前往大西洋街1452号参加庆功宴。',
  setup: '收齐“最后的王者、哈斯塔的馈赠、衰败与污秽、陌生人、远古恶魔”遭遇组。布置六个地点，调查员从门厅开始。将五名旁人随机放到其余地点，每人带有调查员数量加1个线索；将黛安娜·迪瓦恩放在一边，并把五张“令人作呕的现实”放在冒险参考卡下。',
  startLocation: 'foyer',
  locations: {
    foyer: location('foyer', '03070', ['courtyard', 'ballroom', 'livingRoom']),
    ballroom: location('ballroom', '03071', ['foyer', 'courtyard', 'diningRoom']),
    livingRoom: location('livingRoom', '03072', ['foyer', 'courtyard', 'gallery']),
    gallery: location('gallery', '03073', ['livingRoom', 'courtyard']),
    courtyard: location('courtyard', '03074', ['foyer', 'ballroom', 'livingRoom', 'gallery', 'diningRoom']),
    diningRoom: location('diningRoom', '03075', ['ballroom', 'courtyard']),
  },
  acts: stages(['03064'], 'act').map(act => ({ ...act, reveal: { type: 'campaignRule' } })),
  agendas: stages(['03062', '03063'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  storyAssets: Object.fromEntries(BYSTANDERS.map(code => [code, {
    ...printed(code), bystander: true,
  }])),
  sickeningRealityCards: ['03065', '03066', '03067', '03068', '03069'],
  encounterDeck: encounterDeck(deckCards),
  resolutions: {
    noResolution: '若至少一位调查员撤退，转至结局1；若所有调查员被击败，转至结局2。',
    r1: '记录会谈过与遇害的贵宾，获得胜利点经验和场景牌上每2个线索提供的额外经验，然后进入“现实之影”。',
    r2: '记录会谈过与遇害的贵宾并获得经验。重置异教徒、石板与古神标记各为1枚，跳过幕间故事。',
    r3: '宴会的真相从记忆中消失。记录贵宾并获得经验，重置异教徒、石板与古神标记各为1枚，跳过幕间故事。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
