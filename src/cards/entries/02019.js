// 02019 嘲讽（升级版）
// 卡面：快速。只能在你回合期间打出。
// 卡面：与你所在地点任意数量的敌人交战。你每以此方式与一个敌人交战，抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '02019',
  playCondition: [
    { when: ownTurn(), message: '只能在自己的回合打出' },
  ],
  abilities: [
    {
      kind: 'played',
      label: '嘲讽',
      fast: true,
      resolve: ({ state, inv, api }) => {
        const remaining = state.enemies.filter(enemy => enemy.location === inv.location && enemy.engagedSeat !== inv.seat)
        let engaged = 0
        while (remaining.length) {
          const answer = api.choice({
            kind: 'target', source: '02019', seat: inv.seat,
            prompt: '选择要与哪个敌人交战（可选择任意数量）。',
            options: [...remaining.map(enemy => ({ id: enemy.id, label: enemy.name })),
              { id: 'stop', label: '完成选择' }],
          })
          if (answer === 'stop' || !answer) break
          const enemy = remaining.find(item => item.id === answer)
          if (!enemy) break
          api.engage(enemy, inv.seat)
          remaining.splice(remaining.indexOf(enemy), 1)
          engaged += 1
        }
        if (engaged) api.drawCardsLogged(inv.seat, engaged)
      },
    },
  ],
  modifiers: [

  ],
}

