// 03006 萝拉·海耶斯
// 卡面：强制 - 你抽取起始手牌后：选择一个角色([survivor]、[guardian]、[seeker]、[rogue]、[mystic]或中立)。
// 卡面：你能打出、投入或触发能力的卡牌只限于中立卡牌和你所选角色的卡牌。
// 卡面：[free]：切换你的角色。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+2。你可以切换角色。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 罗拉·海耶斯：旧印 +2；成功后可以切换角色。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('03006')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess, onSuccessAlways: true })
  }

export default {
  code: '03006',
  flags: { backstageStart: true },
  investigator:   {
    "deckbuildingRoles": true,
    "elderSign": {
      "kind": "static",
      "bonus": 2,
      "onSuccess": {
        "type": "carcosaInvestigator",
        "action": "lolaSwitchRole"
      }
    },
    "freeAction": {
      "id": "lolaRole",
      "label": "⚡ 切换罗拉的角色",
      "cost": {},
      "effect": {
        "type": "carcosaInvestigator",
        "action": "lolaSwitchRole"
      },
      "limit": "round"
    }
  },
  kind: 'investigator',
  elderSign: { id: '03006-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
