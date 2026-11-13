// 09081 号令真言（Power Word）· 秘术师事件 · 0 经验 · 定制。
// 卡面：定制。快速。只能在你回合期间打出。附属到你所在地点的非[[精英]]敌人。
//       [action] 如果所附属敌人在你的地点：谈判。对该敌人下命令（每个命令每轮仅限一次）——
//       - “去。”该敌人朝你选择的方向移动一次。- “蹲下。”该敌人横置。
//       定制命令：Betray / Mercy / Confess / Distract（见 customizationOptions）。
//
// 读点：快速 = played.fast；命令结算在 played resolve 中完成（api.moveEnemy / api.exhaust /
//       api.damageEnemy / api.healDamage / api.discoverClue / api.autoEvadeEnemy）。
//
// approximation（已写 primitive-request/09081.json）：
//   · 玩家事件附属到敌人后没有「持续 [action] 谈判」的能力枚举读点（ability-rules 只为
//     非玩家 scope 的敌人附属挂窗口）；本实现不附属，打出时对所选非精英敌人一次性下命令。
//   · Greater Control / Bonded / Thrice Spoken 需要持续能力、"相隔一地点"范围与跨副本共享命令，
//     逐项 note。Tonguetwister（连续口令）已实现为一次结算两个不同命令。
const CUSTOM_CHECKS = Object.freeze([
  { name: 'Betray', checks: 1, text: "Add the command: \"- 'Betray.' Deal 1 damage to any enemy at this enemy's location with an equal or lower fight value than this enemy.\"" },
  { name: 'Mercy', checks: 1, text: "Add the command: \"- 'Mercy.' An investigator at this enemy's location heals damage or horror equal to this enemy's respective damage/horror value.\"" },
  { name: 'Confess', checks: 1, text: "Add the command: \"- 'Confess.' Discover 1 clue at this enemy's location if its health is equal to or higher than its location's shroud.\"" },
  { name: 'Distract', checks: 1, text: "Add the command: \"- 'Distract.' Automatically evade any enemy at this enemy's location with an equal or lower evade value than this enemy.\"" },
  { name: 'Greater Control', checks: 2, text: 'Power Word gains "[fast]: Return Power Word to your hand."' },
  { name: 'Bonded', checks: 3, text: 'You may activate the parley ability on Power Word from up to one location away from the attached enemy.' },
  { name: 'Tonguetwister', checks: 3, text: 'When you parley with Power Word, you may give up to two different commands.' },
  { name: 'Thrice Spoken', checks: 3, text: 'You may include three copies of Power Word in your deck. When you give a command using one copy, also give that command to each other enemy with one of your copies of Power Word attached.' },
])

const checked = (state, inv, index) => {
  const list = state?.campaign?.tsk?.customizations?.bySeat?.[inv?.seat]?.['09081']
  return Array.isArray(list) && list.filter(value => value === index).length > 0
}

export default {
  code: '09081',
  simplified: true,
  note: 'approximation: 见 primitive-request/09081.json（不真正附属到敌人：打出时对所选非精英敌人一次性下命令；持续谈判与 Greater Control/Bonded/Thrice Spoken 未实现）',
  customizationOptions: CUSTOM_CHECKS,
  playCondition: [
    { when: ({ state, inv }) => state.currentSeat === inv.seat, message: '「号令真言」只能在你回合期间打出' },
    { when: ({ state, inv }) => state.enemies.some(enemy => enemy.location === inv.location && !enemy.elite), message: '你所在地点没有非精英敌人' },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '选择同地点非精英敌人，并对它下命令（去 / 蹲下 / 定制命令）',
      resolve: ({ state, inv, api }) => {
        const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
        if (!candidates.length) {
          api.info('「号令真言」：你所在地点没有非精英敌人。')
          return
        }
        const chosenId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '09081', seat: inv.seat, prompt: '选择要下命令的非精英敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
        })
        const enemy = candidates.find(item => item.id === chosenId) || candidates[0]
        const loc = state.locations.find(location => location.id === enemy.location)
        const commands = [
          { id: 'go', label: '“去。”该敌人朝你选择的方向移动一次。' },
          { id: 'cower', label: '“蹲下。”该敌人横置。' },
        ]
        if (checked(state, inv, 0)) commands.push({ id: 'betray', label: '“叛变。”对同地点攻击值不高于该敌人的另一个敌人造成 1 点伤害。' })
        if (checked(state, inv, 1)) commands.push({ id: 'mercy', label: '“开恩。”同地点一位调查员按该敌人的伤害/恐惧值治疗。' })
        if (checked(state, inv, 2)) commands.push({ id: 'confess', label: '“坦白。”该敌人生命值不小于地点隐藏值时发现 1 个线索。' })
        if (checked(state, inv, 3)) commands.push({ id: 'distract', label: '“引开。”自动躲避同地点躲避值不高于该敌人的另一个敌人。' })
        const limit = checked(state, inv, 6) ? 2 : 1
        const used = new Set()
        for (let index = 0; index < limit; index++) {
          const remaining = commands.filter(command => !used.has(command.id))
          if (!remaining.length) break
          const picked = remaining.length === 1 ? remaining[0].id : api.choice({
            kind: 'effect', source: '09081', seat: inv.seat,
            prompt: `对「${enemy.name || enemy.code}」下命令${limit > 1 ? `（第 ${index + 1} 个，需不同）` : ''}。`,
            options: remaining,
          })
          if (!picked) break
          used.add(picked)
          if (picked === 'go') {
            const destinations = (loc?.connections || []).map(id => ({ id, label: api.locName(id) }))
            if (!destinations.length) {
              api.info('「号令真言」：该敌人没有可移动的连接地点。')
              continue
            }
            const destination = destinations.length === 1 ? destinations[0].id : api.choice({
              kind: 'move', source: '09081', seat: inv.seat, prompt: '选择该敌人移动的方向。', options: destinations,
            })
            api.moveEnemy(enemy, destination)
            api.info(`🗣️ “去。”「${enemy.name || enemy.code}」移动到「${api.locName(destination)}」。`)
          } else if (picked === 'cower') {
            api.exhaust(enemy)
            api.info(`🗣️ “蹲下。”「${enemy.name || enemy.code}」横置。`)
          } else if (picked === 'betray') {
            const targets = state.enemies.filter(other => other.id !== enemy.id && other.location === enemy.location
              && (api.enemyFight(other, inv.seat) <= api.enemyFight(enemy, inv.seat)))
            if (!targets.length) { api.info('「号令真言」：没有符合叛变条件的敌人。'); continue }
            const target = targets.length === 1 ? targets[0] : targets.find(other => other.id === api.choice({
              kind: 'target', source: '09081', seat: inv.seat, prompt: '选择叛变伤害的目标。',
              options: targets.map(other => ({ id: other.id, label: other.name || other.code })),
            })) || targets[0]
            api.damageEnemy(target, 1, inv.seat, { code: '09081' })
            api.info(`🗣️ “叛变。”对「${target.name || target.code}」造成 1 点伤害。`)
          } else if (picked === 'mercy') {
            const investigators = api.investigatorsAt(enemy.location)
            if (!investigators.length) { api.info('「号令真言」：该敌人所在地点没有调查员。'); continue }
            const target = investigators.length === 1 ? investigators[0] : investigators.find(other => other.seat === Number(api.choice({
              kind: 'investigator', source: '09081', seat: inv.seat, prompt: '选择接受开恩治疗的调查员。',
              options: investigators.map(other => ({ id: String(other.seat), label: other.name })),
            }))) || investigators[0]
            const amount = Number(enemy.damage || 0) + Number(enemy.horror || 0)
            if (!amount) { api.info('「号令真言」：该敌人没有伤害/恐惧值。'); continue }
            api.healDamage(target.seat, Number(enemy.damage || 0))
            api.healHorror(target.seat, Number(enemy.horror || 0))
            api.info(`🗣️ “开恩。”${target.name} 治疗了 ${amount} 点伤害/恐惧。`)
          } else if (picked === 'confess') {
            const location = state.locations.find(item => item.id === enemy.location)
            const health = Number(enemy.health ?? 0)
            const shroud = Number(location?.shroud ?? 0)
            if (health < shroud) { api.info('「号令真言」：该敌人生命值低于地点隐藏值，无法坦白。'); continue }
            if ((location?.clues || 0) <= 0) { api.info('「号令真言」：该敌人所在地点没有线索。'); continue }
            api.discoverClue(inv.seat, 1, enemy.location)
            api.info(`🗣️ “坦白。”在「${location.name || enemy.location}」发现 1 个线索。`)
          } else if (picked === 'distract') {
            const targets = state.enemies.filter(other => other.id !== enemy.id && other.location === enemy.location
              && (api.enemyEvade(other, inv.seat) <= api.enemyEvade(enemy, inv.seat)))
            if (!targets.length) { api.info('「号令真言」：没有符合引开条件的敌人。'); continue }
            const target = targets.length === 1 ? targets[0] : targets.find(other => other.id === api.choice({
              kind: 'target', source: '09081', seat: inv.seat, prompt: '选择要自动躲避的敌人。',
              options: targets.map(other => ({ id: other.id, label: other.name || other.code })),
            })) || targets[0]
            api.autoEvadeEnemy(target)
            api.info(`🗣️ “引开。”自动躲避了「${target.name || target.code}」。`)
          }
        }
      },
    },
  ],
  modifiers: [],
}
