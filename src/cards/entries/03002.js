// 03002 潘明
// 卡面：[reaction]你所在地点的调查员在技能检定中投入一张卡牌后：直到本次技能检定结束，该卡牌获得一个[wild]图标。(每位调查员每轮仅限一次。)
// 卡面：[elder_sign]效果：+1。本次技能检定结束后，你可以选择投入本次技能检定的一张技能卡牌返回其所有者的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 明蒂·潘：旧印 +1；可以把投入的牌返回手牌。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('03002')
    return () => ({ delta: es.bonus || 1, returnCommittedSkill: true })
  }

export default {
  code: '03002',
  investigator:   {
    "elderSign": {
      "kind": "minh",
      "bonus": 1
    },
    "commitWildPerInvestigator": true,
    "wildCommitCompanionBonus": 1
  },
  kind: 'investigator',
  elderSign: { id: '03002-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
