// 02001 佐伊·萨马拉斯
// 卡面：[reaction]在你和一个敌人交战后：获得1资源。
// 卡面：[elder_sign]效果：+1。如果攻击期间本次技能检定成功，则本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 佐伊·萨马拉斯：旧印 +1；攻击伤害 +1 由引擎的成功分支读取，无需在旧印里表达。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('02001')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess })
  }

export default {
  code: '02001',
  kind: 'investigator',
  elderSign: { id: '02001-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
