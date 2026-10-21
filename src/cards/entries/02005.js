// 02005 “灰堆”皮特
// 卡面：你以杜克在场上开始游戏。
// 卡面：[free]弃掉你一张手牌：重整你控制的一个支援。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+2。重整杜克。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 皮特·西尔维斯特：旧印 +2；重整你的专属支援。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('02005')
    return ({ inv, api }) => {
      const asset = inv.assets.find(item => item.code === es.code)
      if (asset && !api.assetsCannotReady(inv)) asset.exhausted = false
      return { delta: es.bonus || 2 }
    }
  }

export default {
  code: '02005',
  investigator:   {
    "elderSign": {
      "kind": "readySignature",
      "bonus": 2,
      "code": "02014"
    },
    "startsWith": "02014",
    "freeAction": {
      "id": "peteReady",
      "label": "弃掉 1 张手牌，重整一张支援（每轮一次）",
      "cost": {
        "discardHand": 1
      },
      "effect": {
        "type": "readyAsset"
      },
      "limit": "round"
    }
  },
  kind: 'investigator',
  elderSign: { id: '02005-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
