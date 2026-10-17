import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { printed, location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor } from '../../card-data.js'

const encounters = encounterCards(['sorcery', 'the_beyond', 'bishops_thralls', 'whippoorwills', 'ancient_evils', 'locked_doors', 'agents_of_yog'])
const definitions = encounterDefinitions([...encounters, ALL_CARDS['02058']])
Object.assign(definitions.enemies['02058'], { massive: true, healthPerPlayerBonus: 3 })
export const scenario = {
  id: 'extracurricularActivity', originalCode: '02041', name: '敦威治遗产 · 课外活动',
  intro: '莱斯教授最后出现在米斯卡塔尼克大学。你们来到寂静的校园，开始寻找他的踪迹。',
  setup: '从大学广场开始。布置人文学大楼、奥恩图书馆、学生会、科学大楼和管理大楼。按开场顺序选择教师办公室，将其与宿舍、炼金实验室、实验体及剧情资产放在一边。',
  startLocation: 'miskatonicQuad',
  setAsideLocations: ['facultyOffices', 'dormitories', 'alchemyLabs'],
  locations: {
    miskatonicQuad: location('miskatonicQuad', '02048', ['orneLibrary', 'scienceBuilding', 'humanitiesBuilding', 'studentUnion', 'administrationBuilding'], { resign: true }),
    humanitiesBuilding: location('humanitiesBuilding', '02049', ['miskatonicQuad', 'orneLibrary']),
    orneLibrary: location('orneLibrary', '02050', ['miskatonicQuad', 'humanitiesBuilding']),
    studentUnion: location('studentUnion', '02051', ['miskatonicQuad', 'dormitories']),
    dormitories: location('dormitories', '02052', ['studentUnion']),
    administrationBuilding: location('administrationBuilding', '02053', ['miskatonicQuad', 'facultyOffices']),
    facultyOffices: location('facultyOffices', '02054', ['administrationBuilding']),
    scienceBuilding: location('scienceBuilding', '02056', ['miskatonicQuad', 'alchemyLabs']),
    alchemyLabs: location('alchemyLabs', '02057', ['scienceBuilding']),
  },
  locationVariants: { facultyOffices: [
    location('facultyOffices', '02054', ['administrationBuilding']),
    location('facultyOffices', '02055', ['administrationBuilding']),
  ] },
  acts: stages(['02045', '02046', '02047'], 'act').map((act, index) => ({
    ...act, reveal: { type: 'campaignRule' },
    ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 3 } } : {}),
  })),
  agendas: stages(['02042', '02043', '02044'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  storyAssets: Object.fromEntries(['02059', '02060', '02061'].map(code => [code, printed(code)])),
  encounterDeck: encounterDeck(encounters),
  resolutions: {
    noResolution: '未能找到莱斯或救出学生。记录莱斯被绑架、未能救出学生；混乱袋加入一枚石板标记，每位调查员获得胜利点经验及额外1点经验。',
    r1: '救出莱斯教授。可将他加入一位调查员的牌组；混乱袋加入一枚石板标记。获得胜利点经验。',
    r2: '学生们获救，但莱斯教授被绑架。获得胜利点经验。',
    r3: '实验体被击败，但莱斯教授被绑架。获得胜利点经验。',
    r4: '调查员昏迷数小时，莱斯被绑架，学生未能获救。混乱袋加入一枚石板标记，获得胜利点经验及额外1点经验。',
  },
}
export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
