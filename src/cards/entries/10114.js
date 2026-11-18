// 10114 缓兵之计（Stall for Time）· 潜袭者事件 · 0 经验 · 1 资源 · 战术/诡计
// 卡面：谈判。选择你所在地点的一个敌人。检定[意志](X)，其中 X 为所选敌人的攻击值或躲避值中较低者。
//       如果你检定成功，横置所选敌人（但不与它解除交战）。如果该敌人非[[精英]]，它在下一个补给阶段
//       期间不重整。如果你检定失败，将缓兵之计返回你的手牌。
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「谈判。」= countsAs:'parley'（isParleyDescriptor 读点：不引发趁乱攻击、按谈判行动结算）。
//   · 目标「你所在地点的敌人」= resolve 内 api.choice（同地点、未击败）。
//   · X = min(api.enemyFight, api.enemyEvade)（敌人当前值，含修正；同一份读点用于显示与难度）。
//   · 检定 + 成功/失败分支 = api.test(seat, 'willpower', X, { resolve })（B3 结果契约，
//     summary/value/difficulty 与 lastTestResult 同源）。
//   · 成功「横置但不解除交战」= api.exhaustEnemy（只写 exhausted，不调 disengageEnemy）。
//   · 「非精英下一个补给阶段不重整」= api.preventEnemyReady(enemy, 1)（phases.js 的
//     enemy.preventReady = { from, rounds } 读点，同一轮补给阶段命中）。
//   · 失败返回手牌 = 条目 keepOnPlay + resolve 内 api.putInHand（与 10045/09074 同一去向写法）；
//     成功则 api.putIntoDiscard 走正常事件弃牌堆。
const CODE = '10114'

function enemiesHere(state, inv) {
  return (state.enemies || []).filter(enemy => enemy.location === inv.location
    && !enemy.defeated && !enemy.removedFromGame)
}

export default {
  code: CODE,
  name: 'Stall for Time',
  keepOnPlay: true,
  playCondition: [{
    when: ({ state, inv }) => enemiesHere(state, inv).length > 0,
    message: '你所在地点没有敌人',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      label: '谈判：检定[意志](较低的战斗/躲避值)；成功横置该敌人且非精英下次补给不重整，失败返回手牌',
      resolve: ({ state, inv, api }) => {
        const enemies = enemiesHere(state, inv)
        if (!enemies.length) {
          api.info('「缓兵之计」：你所在地点没有可谈判的敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「缓兵之计」：选择你所在地点的一个敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        const fight = Number(api.enemyFight(enemy, inv.seat))
        const evade = Number(api.enemyEvade(enemy, inv.seat))
        const difficulty = Math.max(0, Math.min(Number.isFinite(fight) ? fight : 0, Number.isFinite(evade) ? evade : 0))
        api.info(`🕰 「缓兵之计」：与「${enemy.name}」谈判，检定[意志](${difficulty})。`)
        api.test(inv.seat, 'willpower', difficulty, {
          source: { code: CODE, label: '谈判', actionKind: 'parley', enemyId: enemy.id, name: enemy.name },
          resolve: result => {
            const target = (state.enemies || []).find(item => item.id === enemy.id)
            if (!result?.success) {
              api.putInHand(inv.seat, CODE)
              api.info('🕰 「缓兵之计」：检定失败，返回你的手牌。')
              return
            }
            if (target) {
              api.exhaustEnemy(target)
              // 若在补给阶段打出（upkeep.end 玩家窗口），「下一个补给阶段」是下一轮：
              // phases.js 的判定是 from + rounds > state.round，因此跨轮时要多记 1 轮才命中。
              if (!target.elite) api.preventEnemyReady(target, state.phase === 'upkeep' ? 2 : 1)
              api.info(`🕰 「缓兵之计」：检定成功，横置「${target.name}」${target.elite ? '' : '，它下一个补给阶段不重整'}（不解除交战）。`)
            }
            api.putIntoDiscard(inv.seat, CODE)
          },
        })
      },
    },
  ],
  modifiers: [],
}
