// 01003 “倒霉蛋”奥图尔
// 卡面：[free]在你回合期间，花费2资源：你本回合可以进行额外1次行动。(每回合仅限一次)
// 卡面：[elder_sign]效果：+2。如果你成功，获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// “倒霉蛋”奥图尔：旧印 +2；成功后获得 2 资源。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('01003')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess })
  }

export default {
  code: '01003',
  kind: 'investigator',
  elderSign: { id: '01003-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
