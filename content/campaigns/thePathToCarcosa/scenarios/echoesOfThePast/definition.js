import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  printed, location, stages, encounterCards, encounterDefinitions, encounterDeck,
  storyCards, identitiesFor,
} from '../../card-data.js'

const groups = ['echoes_of_the_past', 'cult_of_the_yellow_sign', 'delusions', 'locked_doors', 'pentagram']
const gathered = encounterCards(groups)
const midnightMasks = [ALL_CARDS['01136'], ALL_CARDS['01135']]
const allEncounterCards = [...gathered, ...midnightMasks]
const definitions = encounterDefinitions([...allEncounterCards, ALL_CARDS['03068b']])

Object.assign(definitions.enemies['03140'], {
  healthPerInvestigator: 5, hunter: true, retaliate: true, elite: true, victory: 2,
})
Object.assign(definitions.enemies['03068b'], {
  originalCode: '03068b', hunter: true, retaliate: true, elite: true, victory: 0,
})

const floor = {
  ground: ['meetingRoom', 'groundRecordOffice', 'groundMuseum'],
  second: ['secondMuseum', 'secondLibrary', 'readingRoom'],
  third: ['thirdLibrary', 'peabodysOffice', 'thirdRecordOffice'],
}
const passageways = ['meetingRoom', 'secondLibrary', 'thirdLibrary', 'peabodysOffice', 'hiddenLibrary']

export const scenario = {
  id: 'echoesOfThePast',
  originalCode: '03120',
  name: '卡尔克萨之路 · 往事回声',
  intro: '你们来到阿卡姆历史协会，寻找早年《黄衣之王》演出留下的记录。',
  setup: '每层随机移出一个历史协会地点，布置入口大厅、两张宁静的走廊和其余六个地点。将隐藏的图书馆、附身宣誓者、皮博迪先生、褴褛披风和黑玛瑙扣环放在一边。',
  startLocation: 'entryHall',
  setAsideLocations: ['hiddenLibrary'],
  floorPools: floor,
  passagewayLocations: passageways,
  locations: {
    entryHall: location('entryHall', '03127', floor.ground, { resign: true }),
    meetingRoom: location('meetingRoom', '03128', ['entryHall', 'quietHallsSecond']),
    groundRecordOffice: location('groundRecordOffice', '03129', ['entryHall', 'quietHallsSecond']),
    groundMuseum: location('groundMuseum', '03130', ['entryHall', 'quietHallsSecond']),
    quietHallsSecond: location('quietHallsSecond', '03131', [...floor.ground, ...floor.second]),
    secondMuseum: location('secondMuseum', '03132', ['quietHallsSecond', 'quietHallsThird']),
    secondLibrary: location('secondLibrary', '03133', ['quietHallsSecond', 'quietHallsThird']),
    readingRoom: location('readingRoom', '03134', ['quietHallsSecond', 'quietHallsThird']),
    quietHallsThird: location('quietHallsThird', '03135', [...floor.second, ...floor.third]),
    thirdLibrary: location('thirdLibrary', '03136', ['quietHallsThird']),
    peabodysOffice: location('peabodysOffice', '03137', ['quietHallsThird']),
    thirdRecordOffice: location('thirdRecordOffice', '03138', ['quietHallsThird']),
    hiddenLibrary: location('hiddenLibrary', '03139', passageways.filter(id => id !== 'hiddenLibrary')),
  },
  acts: stages(['03124', '03125', '03126'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    objective: {
      type: 'clues',
      perInvestigator: index === 2 ? 3 : 2,
      ...(index === 2 ? { atLocation: 'hiddenLibrary' } : {}),
    },
  })),
  agendas: stages(['03121', '03122', '03123'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  storyAssets: storyCards(['03141', '03142', '03143']),
  encounterDeck: [
    ...encounterDeck(gathered.filter(card => card.code !== '03140')),
    ...Array(2).fill('01136'),
    ...Array(3).fill('01135'),
  ],
  resolutions: {
    noResolution: '未达成结局：转至结局 4。',
    r1: '拿走黑玛瑙扣环，记录 1 点确信，并将符号标记替换为 2 枚异教徒。',
    r2: '将黑玛瑙扣环留在原处，记录 1 点疑惑，并将符号标记替换为 2 枚石板。',
    r3: '摧毁附身宣誓者；可以将褴褛披风加入一位调查员的牌组，并将符号标记替换为 2 枚石板。',
    r4: '印记的追随者获得进展；获得 1 点奖励经验，并将符号标记替换为 2 枚古神。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
