// 02002 雷克斯·墨菲
// 卡面：[reaction]你调查时技能检定成功且超过难度2点或更多后：发现你所在地点的1个线索。
// 卡面：[elder_sign]效果：+2。你可以改为选择本次技能检定自动失败，以抽取3张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 雷克斯·墨菲：旧印 +2；可以改为自动失败并抽 3 张牌。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('02002')
    return ({ inv, api }) => {
      const answer = api.choice({ kind: 'reaction', source: 'rexElderSign', seat: inv.seat,
        prompt: '旧印：是否改为自动失败并抽 3 张牌？',
        options: [{ id: 'skip', label: '保留 +2' }, { id: 'draw', label: '自动失败并抽 3 张牌' }] })
      return { delta: es.bonus || 2, autoFail: answer === 'draw', draw: answer === 'draw' ? 3 : 0 }
    }
  }

export default {
  code: '02002',
  investigator:   {
    "elderSign": {
      "kind": "rex",
      "bonus": 2
    },
    "reactions": [
      {
        "id": "rexClue",
        "when": "investigateSuccess",
        "successByAtLeast": 2,
        "effect": {
          "type": "discoverClue",
          "amount": 1
        }
      }
    ]
  },
  kind: 'investigator',
  elderSign: { id: '02002-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
