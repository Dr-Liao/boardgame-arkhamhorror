// 探针3：其它章节 encounter deck 中的共享敌人是否在 ALL_ENEMIES 中（08695/08696 等）
import 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/engine.js'
import { ALL_ENEMIES, ALL_TREACHERIES } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/card-lookup.js'
import { contentRegistry } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/registered.js'
import * as peaks from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/index.js'
import * as city from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js'
import * as ice3 from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/index.js'
import * as fatal from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js'

const SHARED = ['08687', '08688', '08689', '08690', '08691', '08692', '08693', '08694', '08695', '08696', '08697', '08698', '08699', '08700', '08701', '08702', '08703', '08704', '08705', '08706', '08707', '08708', '08709', '08710', '08711', '08712', '08713', '08723', '08724', '08725', '08726', '08727', '08728', '08729']
const chapters = { toTheForbiddenPeaks: peaks.scenario, cityOfTheElderThings: city.scenario, iceAndDeathPart3: ice3.scenario, fatalMirage: fatal.scenario }
for (const [name, sc] of Object.entries(chapters)) {
  const deck = sc.encounterDeck || []
  const sharedInDeck = [...new Set(deck.filter(c => SHARED.includes(c)))]
  const missing = sharedInDeck.filter(c => !ALL_ENEMIES[c] && !ALL_TREACHERIES[c])
  console.log(name, '| deck size', deck.length, '| shared in deck', sharedInDeck.length, '| missing defs:', missing.join(',') || '(none)')
}
console.log('ALL_ENEMIES has 08695?', Boolean(ALL_ENEMIES['08695']), '08696?', Boolean(ALL_ENEMIES['08696']), '08697(treachery)?', Boolean(ALL_TREACHERIES['08697']))
// 共享组各章节归属（来自 gather 数据）
import * as shared from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/shared-encounters.js'
for (const [chapterId, cfg] of Object.entries(shared.CHAPTER_GATHER_SETS)) {
  const groups = cfg.versions ? Object.values(cfg.versions).flatMap(v => v.gather) : cfg.gather
  console.log('GATHER', chapterId, '=>', [...new Set(groups)].filter(g => shared.SHARED_GROUP_BY_ID[g]).join(','))
}
