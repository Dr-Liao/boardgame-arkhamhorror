// 09078 全身而退（Clean Sneak）· 游荡者事件 · 4 经验。
// 卡面：快速。只能在你回合期间打出。
//       你所在地点每有一个横置的非蜂拥敌人，选择一个不同的选项：
//       - 获得 2 资源。- 对该敌人造成 2 点伤害。- 发现你所在地点的 1 个线索。- 抽取 1 张卡牌。
//
// 读点：快速/只能在你回合 = played.fast + 条目 playCondition（ownTurn）；
//       非蜂拥 = 没有 hostId / swarmCards；选项通过 api.choice 逐敌人询问且全卡去重。
import { ownTurn } from '../../engine/matcher.js'

const OPTIONS = Object.freeze([
  { id: 'resource', label: '获得 2 资源' },
  { id: 'damage', label: '对该敌人造成 2 点伤害' },
  { id: 'clue', label: '发现你所在地点的 1 个线索' },
  { id: 'draw', label: '抽取 1 张卡牌' },
])

export default {
  code: '09078',
  playCondition: [{ when: ownTurn(), message: '「全身而退」只能在你回合期间打出' }],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '每个横置的非蜂拥敌人：选择一个不同的选项（资源 / 伤害 / 线索 / 抽牌）',
      resolve: ({ state, inv, api }) => {
        const enemies = state.enemies.filter(enemy => enemy.location === inv.location
          && enemy.exhausted === true && !enemy.hostId && !(enemy.swarmCards || []).length)
        if (!enemies.length) {
          api.info('「全身而退」：你所在地点没有横置的非蜂拥敌人。')
          return
        }
        const used = new Set()
        for (const enemy of enemies) {
          if (!state.enemies.includes(enemy)) continue
          const remaining = OPTIONS.filter(option => !used.has(option.id))
          if (!remaining.length) break
          const picked = remaining.length === 1 ? remaining[0].id : api.choice({
            kind: 'effect', source: '09078', seat: inv.seat,
            prompt: `为「${enemy.name || enemy.code}」选择一个尚未使用的选项。`,
            options: remaining,
          })
          used.add(picked)
          if (picked === 'resource') {
            api.gainResources(inv.seat, 2)
            api.info('💰 「全身而退」：获得 2 资源。')
          } else if (picked === 'damage') {
            api.damageEnemy(enemy, 2, inv.seat, { code: '09078' })
            api.info(`💥 「全身而退」：对「${enemy.name || enemy.code}」造成 2 点伤害。`)
          } else if (picked === 'clue') {
            api.discoverClue(inv.seat, 1)
            api.info('🔎 「全身而退」：发现你所在地点的 1 个线索。')
          } else if (picked === 'draw') {
            api.drawCards(inv.seat, 1)
            api.info('🃏 「全身而退」：抽取 1 张卡牌。')
          }
        }
      },
    },
  ],
  modifiers: [],
}
