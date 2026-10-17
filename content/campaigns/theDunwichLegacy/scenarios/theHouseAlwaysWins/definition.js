import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { printed, location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor } from '../../card-data.js'

const encounters = encounterCards(['the_house_always_wins', 'bad_luck', 'naomis_crew', 'rats'])
const aside = encounterCards(['hideous_abominations', 'striking_fear'])
const definitions = encounterDefinitions([...encounters, ...aside])
Object.assign(definitions.enemies['02078'], { hunter: true, prey: 'highestIntellect' })

export const scenario = {
  id: 'theHouseAlwaysWins', originalCode: '02062', name: '敦威治遗产 · 百赌百胜',
  intro: '摩尔根博士最后被人看见走进了四叶草俱乐部。你们从月下美人餐厅进入，试图查明他的去向。',
  setup: '从月下美人开始。布置俱乐部大厅、酒吧和卡牌室，将赌场管理员放在大厅。把骇人异形、恐惧打击遭遇组及其余地点、剧情资产放在一边。',
  startLocation: 'laBellaLuna', setAsideLocations: ['darkenedHall', 'artGallery', 'vipArea', 'backAlley'],
  locations: {
    laBellaLuna: location('laBellaLuna', '02070', ['cloverClubLounge'], { resign: true }),
    cloverClubLounge: location('cloverClubLounge', '02071', ['laBellaLuna', 'cloverClubBar', 'cloverClubCardroom']),
    cloverClubBar: location('cloverClubBar', '02072', ['cloverClubCardroom', 'cloverClubLounge']),
    cloverClubCardroom: location('cloverClubCardroom', '02073', ['cloverClubLounge', 'cloverClubBar', 'darkenedHall']),
    darkenedHall: location('darkenedHall', '02074', ['cloverClubCardroom', 'artGallery', 'vipArea', 'backAlley']),
    artGallery: location('artGallery', '02075', ['darkenedHall']),
    vipArea: location('vipArea', '02076', ['darkenedHall']),
    backAlley: location('backAlley', '02077', ['darkenedHall'], { resign: true }),
  },
  acts: stages(['02066', '02067', '02068', '02069'], 'act').map((act, index) => ({ ...act,
    ...(index < 2 ? { objective: { type: 'clues', perInvestigator: index === 0 ? 4 : 2,
      ...(index === 1 ? { atLocation: 'vipArea' } : {}) } } : {}),
    reveal: { type: 'campaignRule' },
  })),
  agendas: stages(['02063', '02064', '02065'], 'agenda').map(agenda => ({ ...agenda,
    reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  storyAssets: Object.fromEntries(['02079', '02080'].map(code => [code, printed(code)])),
  // Pit Boss begins in play; it must not also be in the encounter deck.
  encounterDeck: encounterDeck(encounters.filter(card => card.code !== '02078')),
  setAsideEncounterCards: encounterDeck(aside),
  resolutions: {
    noResolution: '按结局1结算：摩尔根博士被绑架，欧巴尼恩帮怀恨在心；获得胜利点经验及额外1点经验。',
    r1: '摩尔根博士被绑架，欧巴尼恩帮怀恨在心。获得胜利点经验及额外1点经验。若有人作弊，永久加入一枚古神标记。',
    r2: '救出摩尔根博士，但欧巴尼恩帮怀恨在心。可将博士加入一位调查员的牌组。获得胜利点经验；若有人作弊，加入一枚古神标记。',
    r3: '娜奥米支持调查员，但摩尔根博士被绑架。获得胜利点经验；若有人作弊，加入一枚古神标记。',
    r4: '调查员昏迷数小时，摩尔根被绑架，欧巴尼恩帮怀恨在心。每人受到1点肉体创伤，并获得胜利点经验及额外1点经验。若有人作弊，加入一枚古神标记。',
  },
}
export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
