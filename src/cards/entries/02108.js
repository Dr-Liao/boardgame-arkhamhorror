// 02108 探路者
// 卡面：[free]在你回合期间，如果你未与任何敌人交战，横置探路者：移动到一个连接地点。
//
// 「在你回合期间」是描述子 criteria（matcher.ownTurn）：玩家窗口会向所有调查员询问
// 免费能力（encounter.js#playerWindow），只看 cost.action === false；漏掉 criteria 时
// 这张卡在别人的回合里也会被列出来（实测：佐伊的回合里给卢克弹「探路者」）。
// 「未与任何敌人交战」仍写在效果体的 requiresNoEnemies 上（legalMoves 与执行共用读点）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '02108',
  abilities: [
    {
      kind: 'action',
      label: '探路者移动',
      cost: { action: false, exhaust: true },
      criteria: [ownTurn()],
      effect: { type: 'moveTo', requiresNoEnemies: true },
    },
  ],
  modifiers: [

  ],
}
