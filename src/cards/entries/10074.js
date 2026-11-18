// 10074 自由表演（Vamp）· 潜袭者（Rogue）事件 · 1 费 · [[诡计]]。
// 卡面：谈判。选择你所在地点的一个敌人并检定任意技能(3)。如果你检定成功且你检定了……
//       - [意志]，移除该敌人上的 1 个毁灭标记。
//       - [智力]，发现你所在地点的 1 个线索。
//       - [敏捷]，自动躲避该敌人。如果该敌人非[[精英]]，将其移动到一个连接地点。
//       - [战斗]，对该敌人造成 2 点伤害。
//
// 一卡一个文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「谈判。」→ countsAs:'parley'，不引发借机攻击。
//   · 「检定任意技能(3)」→ api.choice 选技能 + api.test（source.actionKind='parley'）。
//   · 结果分支 → api.removeDoomFromCard / api.discoverClue / api.autoEvadeEnemy + api.moveEnemy /
//     api.damageEnemy（各自唯一写点）。
//   · 「移动该敌人」候选 = 其当前地点的连接地点；用本文件的窄判据先排除明显不可进入的地点
//     （完整校验仍在 relocateEnemy；卡文件不 import engine/enemy-entry.js 以避免注册循环）。

// 「该敌人不能被谈判」的窄判据：条目声明的禁止标记（完整读点见 engine/parley.js#parleyForbidden；
// 卡文件不 import 引擎，P7 若需要统一改由共享原语暴露）。
const parleyForbidden = (state, inv, entity) => Boolean(entity?.cannotParley || entity?.parleyForbidden)

// 敌人能否进入该地点的窄判据（完整读点见 engine/enemy-entry.js#enemyCanEnterLocation）。
const enemyCanEnterLocation = (state, enemy, destination) => Boolean(destination)
  && destination !== enemy?.id
  && state?.locations?.find(location => location.id === destination)?.dreamGate !== true


const CODE = '10074'
const SKILLS = ['willpower', 'intellect', 'agility', 'combat']
const SKILL_LABELS = { willpower: '意志', intellect: '智力', agility: '敏捷', combat: '战斗' }

const parleyEnemies = (state, inv) => (state.enemies || []).filter(enemy =>
  enemy.location === inv.location && !parleyForbidden(state, inv, enemy))

const connectionsOf = (state, locationId) => {
  const here = (state.locations || []).find(location => location.id === locationId)
  return (here?.connections || [])
    .map(id => (state.locations || []).find(location => location.id === id))
    .filter(Boolean)
}

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
      label: '谈判：检定任意技能(3)，成功按所选技能移除毁灭/发现线索/自动躲避并移动/造成 2 伤害',
      resolve: ({ state, inv, api }) => {
        const enemies = parleyEnemies(state, inv)
        if (!enemies.length) {
          api.info('「自由表演」：你所在地点没有可谈判的敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「自由表演」：选择要谈判的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        const skill = api.choice({
          kind: 'skill', source: CODE, seat: inv.seat,
          prompt: '「自由表演」：选择本次谈判使用的技能（难度 3）。',
          options: SKILLS.map(id => ({ id, label: SKILL_LABELS[id] })),
        })
        const usedSkill = SKILLS.includes(skill) ? skill : 'agility'
        api.info(`🎭 「自由表演」：${inv.name} 与「${enemy.name}」谈判，检定${SKILL_LABELS[usedSkill]}(3)。`)
        api.test(inv.seat, usedSkill, 3, {
          source: { code: CODE, label: '谈判', actionKind: 'parley', enemyId: enemy.id, name: enemy.name },
          resolve: result => {
            if (!result.success) return
            if (usedSkill === 'willpower') {
              const removed = api.removeDoomFromCard(enemy, 1)
              if (removed > 0) api.info(`🎭 「自由表演」：从「${enemy.name}」上移除 ${removed} 个毁灭标记。`)
              return
            }
            if (usedSkill === 'intellect') {
              const got = api.discoverClue(inv.seat, 1, inv.location)
              if (got > 0) api.info(`🎭 「自由表演」：在「${api.locationName(inv.location)}」发现 ${got} 个线索。`)
              return
            }
            if (usedSkill === 'agility') {
              if (!state.enemies.includes(enemy)) return
              api.autoEvadeEnemy(enemy)
              api.info(`🎭 「自由表演」：自动躲避「${enemy.name}」。`)
              if (enemy.elite) return
              const destinations = connectionsOf(state, enemy.location)
                .filter(location => enemyCanEnterLocation(state, enemy, location.id))
              if (!destinations.length) return
              const destinationId = destinations.length === 1 ? destinations[0].id : api.choice({
                kind: 'location', source: CODE, seat: inv.seat,
                prompt: `「自由表演」：选择把「${enemy.name}」移动到的连接地点。`,
                options: destinations.map(location => ({ id: location.id, label: api.locationName(location.id) })),
              })
              if (!state.locations.some(location => location.id === destinationId)) return
              if (!state.enemies.includes(enemy)) return
              api.moveEnemy(enemy, destinationId)
              api.info(`🎭 「自由表演」：「${enemy.name}」被移动到「${api.locationName(destinationId)}」。`)
              return
            }
            if (usedSkill === 'combat') {
              if (!state.enemies.includes(enemy)) return
              api.damageEnemy(enemy, 2, inv.seat, CODE)
              api.info(`🎭 「自由表演」：对「${enemy.name}」造成 2 点伤害。`)
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
