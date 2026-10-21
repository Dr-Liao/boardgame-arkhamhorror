// 04003 芬恩·爱德华兹
// 卡面：你可以在自己回合期间进行额外一个行动，该行动只能用于躲避。
// 卡面：[elder_sign]效果：场上每有一个处于横置状态的敌人，+1。如果你检定成功且超过难度至少2点，你可以发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 芬恩·爱德华兹：旧印 +1×横置敌人数；成功超过 2 点可以发现 1 个线索。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('04003')
    return ({ state }) => ({ delta: state.enemies.filter(enemy => enemy.exhausted).length,
      clueOnSuccessBy: es.clueOnSuccessBy || 2 })
  }

export default {
  code: '04003',
  kind: 'investigator',
  elderSign: { id: '04003-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
