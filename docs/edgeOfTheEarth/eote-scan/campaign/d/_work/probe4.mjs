// 探针4：Part1/Part2 遭遇牌库中的共享卡覆盖
import 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/engine.js'
import * as p1 from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/index.js'
import * as p2 from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/index.js'
const SHARED = ['08687', '08688', '08689', '08690', '08691', '08692', '08693', '08694', '08695', '08696', '08697', '08698', '08699', '08700', '08701', '08702', '08703', '08704', '08705', '08706', '08707', '08708', '08709', '08710', '08711', '08712', '08713', '08723', '08724', '08725', '08726', '08727', '08728', '08729']
for (const [name, sc] of [['Part1', p1.scenario], ['Part2', p2.scenario]]) {
  const deck = sc.encounterDeck || []
  const shared = [...new Set(deck.filter(c => SHARED.includes(c)))]
  console.log(name, 'deck', deck.length, '| shared unique', shared.length, '=>', shared.join(','))
}
