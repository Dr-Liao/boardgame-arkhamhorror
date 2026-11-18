// 10081 自由表演（Vamp）· 潜袭（Rogue）事件 · 1 资源 · 3 经验 · [[技巧]]
//
// 卡面：谈判。选择你所在地点的一个敌人和任意数量的技能。以任意顺序依次检定每项所选技能（难度 2）。
//   你每成功一次检定，按所检定的技能结算：
//   - …[willpower]：从该敌人上移除 1 个毁灭标记。
//   - …[intellect]：在该敌人所在地点发现 1 个线索。
//   - …[agility]：自动躲避该敌人；如果它非[[精英]]，把它移动到一个连接地点。
//   - …[combat]：对该敌人造成 2 点伤害。
//
// 一条行为的读点（卡面 → 引擎）：
//   · 「谈判。」：played 描述子 `countsAs: 'parley'`（actionKind 读点：不引发借机攻击）。
//   · 「选择你所在地点的一个敌人」：api.choice(kind:'target') + 同地点敌人枚举（与 10026 同一写法）。
//   · 「任意数量的技能，依次检定」：resolve 里的循环，每轮用 api.choice 让玩家挑一个尚未检定过的技能
//     （或结束）；难度固定 2 的 api.test(seat, skill, 2) 是唯一检定入口（performTest），
//     结果读 result.summary.success（docs/card-model.md §6.1 检定结果契约）。
//   · 四个分支：
//     - willpower → api.removeDoomFromCard(enemy, 1)（卡上毁灭的唯一移除写点）；
//     - intellect → api.discoverClue(seat, 1, enemy.location)（发现线索的唯一写点，可指定地点）；
//     - agility → api.autoEvade(enemy)（自动躲避原语）+ api.moveEnemy(enemy, destination)
//       （movement.js#relocateEnemy 唯一移动写点，非精英才移动）；
//     - combat → api.damageEnemy(enemy, 2, seat, CODE)（伤害唯一写点，走 canDamageEnemy 判定）。
const CODE = '10081'
const SKILLS = ['willpower', 'intellect', 'agility', 'combat']
const SKILL_LABELS = {
  willpower: '意志：从该敌人移除 1 个毁灭标记',
  intellect: '智力：在该敌人所在地点发现 1 个线索',
  agility: '敏捷：自动躲避该敌人（非精英则移动它）',
  combat: '战斗：对该敌人造成 2 点伤害',
}

export default {
  code: CODE,
  name: 'Vamp',
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      label: '谈判：选择敌人与任意数量技能，依次检定（2），按成功的技能结算',
      resolve: ({ state, inv, api }) => {
        const enemies = api.enemiesAt(inv.location).filter(enemy => !enemy.defeated && !enemy.removedFromGame)
        if (!enemies.length) {
          api.info('「自由表演」：你所在地点没有敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「自由表演」：选择要交涉的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        const remaining = [...SKILLS]
        for (let guard = 0; guard < SKILLS.length + 1 && remaining.length; guard++) {
          const answer = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
            prompt: `「自由表演」：选择要检定的技能（对「${enemy.name}」），或结束。`,
            options: [{ id: 'done', label: '结束检定' },
              ...remaining.map(skill => ({ id: skill, label: SKILL_LABELS[skill] }))],
          })
          if (answer === 'done' || answer == null) break
          const skill = remaining.includes(answer) ? answer : remaining[0]
          remaining.splice(remaining.indexOf(skill), 1)
          const result = api.test(inv.seat, skill, 2, { source: { type: 'effect', label: '自由表演' } })
          if (!result?.summary?.success) {
            api.info(`「自由表演」：${api.skillName(skill)}检定失败。`)
            continue
          }
          if (skill === 'willpower') {
            api.removeDoomFromCard(enemy, 1)
            api.info(`「自由表演」：从「${enemy.name}」上移除 1 个毁灭标记。`)
          } else if (skill === 'intellect') {
            const got = api.discoverClue(inv.seat, 1, enemy.location)
            api.info(got
              ? `「自由表演」：在「${api.scenario.locationName(enemy.location)}」发现 1 个线索。`
              : '「自由表演」：该地点没有可发现的线索。')
          } else if (skill === 'agility') {
            api.autoEvade(enemy)
            api.info(`「自由表演」：自动躲避「${enemy.name}」。`)
            if (!enemy.elite) {
              const here = (state.locations || []).find(location => location.id === enemy.location)
              const destinations = [...new Set(here?.connections || [])]
                .filter(id => (state.locations || []).some(location => location.id === id))
              if (destinations.length) {
                const destination = destinations.length === 1 ? destinations[0] : api.choice({
                  kind: 'location', source: CODE, seat: inv.seat,
                  prompt: `「自由表演」：把「${enemy.name}」移动到一个连接地点。`,
                  options: destinations.map(id => ({ id, label: api.scenario.locationName(id) })),
                })
                const to = destinations.includes(destination) ? destination : destinations[0]
                api.moveEnemy(enemy, to)
                api.info(`🚶 「自由表演」：「${enemy.name}」移动到「${api.scenario.locationName(to)}」。`)
              }
            }
          } else {
            api.damageEnemy(enemy, 2, inv.seat, CODE)
            api.info(`「自由表演」：对「${enemy.name}」造成 2 点伤害。`)
          }
        }
      },
    },
  ],
  modifiers: [],
}
