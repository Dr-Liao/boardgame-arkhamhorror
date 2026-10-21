// 04001 里奥·安德森
// 卡面：[reaction]在你的回合开始后：打出一张[[盟友]]支援卡牌，其费用减1。
// 卡面：[elder_sign]效果：+2。查找你牌库顶3张卡牌，找出一张[[盟友]]支援卡牌并将其抽取。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 里奥·安德森：旧印 +2；查看牌库顶 3 张，取其中一张盟友支援。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('04001')
    return ({ inv, api }) => {
      api.searchTop(inv.seat, { amount: es.amount || 3, trait: 'Ally', traitZh: '盟友', source: '04001', mandatory: true })
      return { delta: es.bonus || 2 }
    }
  }

export default {
  code: '04001',
  kind: 'investigator',
  elderSign: { id: '04001-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
