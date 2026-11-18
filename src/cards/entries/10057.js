// 10057 云山雾罩（Confound）· 探求者事件 · 3 经验 · 费用 2 · 洞察/技巧。
//
// 卡面：谈判。选择你所在地点的一个敌人。检定[智力](X)，其中 X 为所选敌人的躲避值。
//       如果你检定成功，发现你所在地点的 2 个线索。然后，如果所选敌人为非[[精英]]，自动躲避该敌人。
//       其在下一个补给阶段不重整。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 「谈判。」= played 描述子 `countsAs: 'parley'`（actionKind 先读 countsAs；dispatch 把 parley
//     视为不引发借机攻击，tests/card-entries.test.mjs 的粗体行动指示守卫也读同一字段）。
//   · 「选择你所在地点的一个敌人」→ resolve 里只读枚举 inv.location 的敌人，api.choice 选目标。
//   · 「检定[智力](X)，X = 敌人躲避值」→ api.enemyEvade（combat.js#enemyEvadeValue，含修正）+
//     api.test（B3 结果契约，返回 success/summary）。
//   · 「发现 2 个线索」→ api.discoverClue（locations.js#discoverClueAt 的唯一发现入口）。
//   · 「自动躲避该敌人」→ api.autoEvadeEnemy（enemies.js#autoEvadeEnemy：横置 + 解除交战）。
//   · 「下一个补给阶段不重整」→ api.scenario.preventEnemyReady(enemy, 1)
//     （scenario-runtime.js 写 enemy.preventReady = { from, rounds }，读点是 phases.js 的重整段）。
//   · 口径：谈判的目标只按「所在地点的敌人」过滤；「不能谈判」类限制
//     （capability:parley / cannot:parley）是引擎实体规则的读点，玩家事件没有实体可挂，故此处不判。
const CODE = '10057'

const enemiesHere = (state, inv) => (state?.enemies || [])
  .filter(enemy => enemy.location === inv?.location && !enemy.defeated)

export default {
  code: CODE,
  note: 'approximation: 目标只按「所在地点敌人」过滤；玩家事件没有实体，故不读 cannot:parley / capability:parley 的实体规则。',
  playCondition: [
    {
      when: ({ state, inv }) => enemiesHere(state, inv).length > 0,
      message: '你所在地点没有敌人',
    },
  ],
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      label: '谈判：智识(X=敌人躲避值)检定；成功发现 2 个线索，非精英敌人自动躲避且下个补给阶段不重整',
      resolve: ({ state, inv, api }) => {
        const enemies = enemiesHere(state, inv)
        if (!enemies.length) {
          api.info('「云山雾罩」：你所在地点没有敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择你所在地点的一个敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: `${enemy.name}（躲避值 ${api.enemyEvade(enemy)}）` })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        if (!enemy) return
        const difficulty = Math.max(0, Number(api.enemyEvade(enemy)) || 0)
        api.info(`🌫️ 「云山雾罩」：${inv.name} 与「${enemy.name}」谈判——智识(${difficulty})。`)
        const result = api.test(inv.seat, 'intellect', difficulty, {
          source: { label: '谈判', name: api.cardName(enemy.code), code: enemy.code },
        })
        if (!result?.success) return
        const got = api.discoverClue(inv.seat, 2)
        api.info(`🌫️ 「云山雾罩」：发现 ${got} 个线索。`)
        if (enemy.elite) {
          api.info(`「云山雾罩」：「${enemy.name}」是[[精英]]敌人，不能自动躲避。`)
          return
        }
        const survivor = state.enemies.find(item => item.id === enemy.id)
        if (!survivor) return
        if (api.autoEvadeEnemy(survivor)) {
          api.info(`💨 「云山雾罩」：自动躲避「${survivor.name}」。`)
          api.scenario.preventEnemyReady(survivor, 1)
        }
      },
    },
  ],
  modifiers: [],
}
