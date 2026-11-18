// 10071 诱骗（Grift）· 潜袭者（Rogue）事件 · 0 费 · [[诡计]]/[[违法]]。
// 卡面：谈判。选择你所在地点的一个敌人并检定[敏捷](0)。你检定成功且每超过难度 1 点，
//       获得 1 资源（最多 6）。如果你检定失败，该敌人攻击你。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「谈判。」→ countsAs:'parley'，不引发借机攻击。
//   · 可谈判敌人 → engine/parley.js#parleyForbidden（与实体谈判能力同一读点）。
//   · 检定 → api.test（source 带 actionKind:'parley' 与 enemyId，供 British Bull Dog / Snitch
//     等“谈判检定后”的窗口读点使用）。
//   · 失败 → api.scenario.attack（enemyAttack 的统一入口，警戒/反击等关键词照常结算）。

// 「该敌人不能被谈判」的窄判据：条目声明的禁止标记（完整读点见 engine/parley.js#parleyForbidden；
// 卡文件不 import 引擎，P7 若需要统一改由共享原语暴露）。
const parleyForbidden = (state, inv, entity) => Boolean(entity?.cannotParley || entity?.parleyForbidden)


const CODE = '10071'

const parleyEnemies = (state, inv) => (state.enemies || []).filter(enemy =>
  enemy.location === inv.location && !parleyForbidden(state, inv, enemy))

export default {
  code: CODE,
  playCondition: [{
    when: ({ state, inv }) => parleyEnemies(state, inv).length > 0,
    message: '所在地点没有可谈判的敌人',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      noOpportunityAttack: true,
      label: '谈判：检定[敏捷](0)，每超过 1 点获得 1 资源（最多 6）；失败则该敌人攻击你',
      resolve: ({ state, inv, api }) => {
        const enemies = parleyEnemies(state, inv)
        if (!enemies.length) {
          api.info('「诱骗」：你所在地点没有可谈判的敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「诱骗」：选择要谈判的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        api.info(`💸 「诱骗」：${inv.name} 与「${enemy.name}」谈判。`)
        api.test(inv.seat, 'agility', 0, {
          source: { code: CODE, label: '谈判', actionKind: 'parley', enemyId: enemy.id, name: enemy.name },
          resolve: result => {
            if (result.success) {
              const successBy = Math.max(0, Number(result.summary?.successBy
                ?? (Number(result.value) || 0) - (Number(result.difficulty) || 0)) || 0)
              const gain = Math.min(6, successBy)
              if (gain > 0) {
                api.gainResources(inv.seat, gain)
                api.info(`💸 「诱骗」：检定超过难度 ${successBy} 点，获得 ${gain} 资源。`)
              } else {
                api.info('💸 「诱骗」：检定恰好成功，没有超过难度，不获得资源。')
              }
              return
            }
            if (api.isEnemyInPlay(enemy)) {
              api.scenario.attack(enemy, state.investigators[inv.seat])
              api.info(`💸 「诱骗」：检定失败，「${enemy.name}」攻击 ${inv.name}。`)
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
