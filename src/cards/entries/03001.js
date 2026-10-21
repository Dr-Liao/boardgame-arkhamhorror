// 03001 马克·哈里根
// 卡面：你开始游戏时把索菲(深切的思念)放置入场。
// 卡面：[reaction]有伤害放置到你控制的卡牌上后：抽取1张卡牌。(每阶段仅限一次)。
// 卡面：[elder_sign]效果：马克·哈里根身上每有一点伤害，+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 马克·哈里根：旧印 +0+伤害值。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('03001')
    return ({ inv }) => ({ delta: (es.base || 0) + (inv.damage || 0) * (es.bonus || 1) })
  }

export default {
  code: '03001',
  investigator:   {
    "startsWith": [
      "03009"
    ],
    "elderSign": {
      "kind": "perDamage",
      "base": 0
    },
    "homeFrontMoveDamage": true,
    "reactions": [
      {
        "id": "markDraw",
        "when": "damagePlaced",
        "limit": "phase",
        "effect": {
          "type": "draw",
          "amount": 1
        }
      }
    ]
  },
  kind: 'investigator',
  elderSign: { id: '03001-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
