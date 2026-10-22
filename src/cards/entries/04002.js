// 04002 厄休拉·唐斯
// 卡面：[reaction]在你移动到一个地点后：进行一次调查行动。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+1。在本次检定结束后，你可以移动到一个连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 厄休拉·唐斯：旧印 +1；检定结束后可以移动到连接地点。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('04002')
    return () => ({ delta: es.bonus || 1, mayMoveAfterTest: true, mayMoveAfterTestAlways: true })
  }

export default {
  code: '04002',
  investigator:   {
    "reactions": [
      {
        "id": "ursulaInvestigate",
        "when": "move",
        "selfOnly": true,
        "limit": "round",
        "prompt": "是否立刻进行一次调查行动？",
        "effect": {
          "type": "tfaInvestigator",
          "action": "investigateAction"
        }
      }
    ],
    "elderSign": {
      "kind": "tfaMoveAfterTest",
      "bonus": 1
    }
  },
  kind: 'investigator',
  elderSign: { id: '04002-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
