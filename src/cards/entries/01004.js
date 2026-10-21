// 01004 艾格尼丝·贝克
// 卡面：[reaction]有恐惧放置到艾格尼丝·贝克后：对你所在地点的1个敌人造成1点伤害。(每阶段仅限一次)
// 卡面：[elder_sign]效果：艾格尼丝·贝克每有1点恐惧，+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 艾格尼丝·贝克：旧印 +1×恐惧值。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('01004')
    return ({ inv }) => ({ delta: (inv.horror || 0) * (es.bonus || 1) })
  }

export default {
  code: '01004',
  kind: 'investigator',
  elderSign: { id: '01004-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
