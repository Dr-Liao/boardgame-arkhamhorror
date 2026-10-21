// 03005 威廉·约里克
// 卡面：[reaction]在你击败敌人后：从你的弃牌堆(支付其费用)打出一张支援。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+2。如果本次检定成功，将你弃牌堆中的1张卡牌返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 威廉·约里克：旧印 +2；成功后的额外结算交给战役效果。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('03005')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess })
  }

export default {
  code: '03005',
  kind: 'investigator',
  elderSign: { id: '03005-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
