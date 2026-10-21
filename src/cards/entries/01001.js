// 01001 罗兰·班克斯
// 卡面：[reaction]你击败一个敌人后：发现你所在地点的1个线索。(每轮仅限一次。)
// 卡面：[elder_sign]效果：你所在地点每有一个线索，+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 罗兰·班克斯：旧印 +1×所在地点线索数。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('01001')
    return ({ state, inv }) => ({ delta: (state.locations.find(location => location.id === inv.location)?.clues || 0) * (es.bonus || 1) })
  }

export default {
  code: '01001',
  investigator:   {
    "elderSign": {
      "kind": "perClueAtLocation",
      "bonus": 1
    },
    "reactions": [
      {
        "id": "rolandClue",
        "when": "defeatEnemy",
        "limit": "round",
        "effect": {
          "type": "discoverClue",
          "amount": 1
        }
      }
    ]
  },
  kind: 'investigator',
  elderSign: { id: '01001-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
