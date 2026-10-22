// 03003 赛菲娜·卢梭
// 卡面：强制 - 在你将要抽取起始手牌时：改为抽取13张卡牌。选择最多5张事件放在本卡牌底下，并保留8张卡牌作为你的起始手牌。弃掉其余卡牌。(你不能重调。)
// 卡面：[action]：选择并抽取本卡牌底下的一张事件。不会触发趁乱攻击。
// 卡面：[elder_sign]效果：+3。你可以选择并抽取本卡牌底下的一张事件。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 塞菲娜·卢梭：旧印 +3；成功后的额外结算交给战役效果。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('03003')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess, onSuccessAlways: true })
  }

export default {
  code: '03003',
  investigator:   {
    "openingHandSize": 13,
    "elderSign": {
      "kind": "static",
      "bonus": 3,
      "onSuccess": {
        "type": "carcosaInvestigator",
        "action": "sefinaElderSign"
      }
    },
    "freeAction": {
      "id": "sefinaBeneath",
      "label": "抽取赛菲娜下方的一张事件",
      "cost": {},
      "actionCost": 1,
      "noOpportunityAttack": true,
      "repeatable": true,
      "effect": {
        "type": "carcosaInvestigator",
        "action": "sefinaDrawBeneath"
      }
    }
  },
  kind: 'investigator',
  elderSign: { id: '03003-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
