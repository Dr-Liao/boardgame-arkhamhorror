// 10094 精华汲取（Drain Essence）· 潜修者 · 事件 · 2 资源 · 法术
// 卡面：
//   谈判。选择你所在地点的一个敌人并检定[willpower](X)，其中 X 为所选敌人的攻击值。
//   如果你检定成功，将 1 点伤害从你的调查员身上移动到所选敌人上
//   （如果所选敌人非[[精英]]，改为最多 2 点伤害）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「谈判。」→ played 描述子 countsAs: 'parley'（不引发借机攻击的行动指示读点）。
//   · 「选择你所在地点的一个敌人」+「有攻击值」：playCondition 与 resolve 共用同一份候选
//     （state.enemies 只读筛选；与参考实现的 EnemyAt YourLocation <> EnemyWithFight 同口径）。
//   · 检定：api.test(seat, skill, difficulty, { source, resolve })（performTest 的标准入口）；
//     X 走 api.enemyFight(enemy, seat)（enemies.js#enemyFightValue 的只读投影，含修正）。
// 伤害由统一搬运原语移动，目的敌人须能承受伤害。
const CODE = '10094'

// 同地点、有攻击值的敌人（参考实现：EnemyAt YourLocation <> EnemyWithFight）。
const drainTargets = (state, inv) => (state.enemies || []).filter(enemy =>
  enemy.location === inv.location && !enemy.defeated && enemy.removedFromGame !== true
  && Number.isFinite(Number(enemy.fight)))

export default {
  code: CODE,
  name: '精华汲取',
  playCondition: [
    {
      when: ({ state, inv }) => drainTargets(state, inv).length > 0,
      message: '你所在地点没有可选择（带攻击值）的敌人',
    },
  ],
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      label: '谈判：检定意志(X=敌人攻击值)，成功把 1 点（非精英最多 2 点）伤害移到该敌人',
      resolve: ({ state, inv, api }) => {
        const targets = drainTargets(state, inv)
        if (!targets.length) {
          api.info('「精华汲取」：你所在地点没有可选择（带攻击值）的敌人。')
          return
        }
        const enemyId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「精华汲取」：选择你所在地点的一个敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: `${enemy.name}（攻击值 ${api.enemyFight(enemy, inv.seat)}）` })),
        })
        const enemy = targets.find(item => item.id === enemyId) || targets[0]
        if (!enemy) return
        const difficulty = Math.max(0, api.enemyFight(enemy, inv.seat))
        api.test(inv.seat, 'willpower', difficulty, {
          actionKind: 'parley',
          source: { label: '精华汲取', enemyId: enemy.id, name: enemy.name, code: CODE },
          resolve: result => {
            if (!result?.success || !api.canDamageEnemy(enemy, inv.seat, CODE)) return
            const max = enemy.elite ? 1 : 2
            const available = Math.min(max, Math.max(0, inv.damage || 0))
            if (!available) {
              api.info(`「精华汲取」：${inv.name} 身上没有可移动的伤害。`)
              return
            }
            const moved = available === 1 ? 1 : Number(api.choice({
              kind: 'effect', source: CODE, seat: inv.seat,
              prompt: `「精华汲取」：「${enemy.name}」非精英，最多移动 ${available} 点伤害——移动几点？`,
              options: Array.from({ length: available }, (_, index) => ({
                id: String(index + 1),
                label: `移动 ${index + 1} 点伤害到「${enemy.name}」`,
              })),
            })) || 1
            const amount = Math.max(1, Math.min(available, Number.isFinite(moved) ? moved : 1))
            api.moveHarm({ seat: inv.seat }, { enemyId: enemy.id }, { damage: amount }, { source: CODE })
          },
        })
      },
    },
  ],
  modifiers: [],
}
