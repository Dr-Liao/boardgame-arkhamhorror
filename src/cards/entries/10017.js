// 10017 一身是胆（Stouthearted）· 中立事件 · 2 资源 · 勇气 · 汉克·萨姆森牌库专用
// 卡面：快速。在你与非[[精英]]敌人进入交战状态时打出。
//       将汉克·萨姆森身上最多 2 点伤害和/或恐惧作为伤害移动到该敌人上。
//
// 读点（卡面 → 引擎）：
//   · 快速事件 → reaction + fromHand + quickEvent（P2-4 统一通道：reactionWindow 与
//     openAbilityWindow 共用 quickEventView 候选/执行口径）。这里不用旧写法
//     played+fast+trigger：enemyEngaged 只走 triggerReaction → openAbilityWindow，不经过
//     reactionWindow，旧写法的 played 描述子在该窗口不会被枚举（卡将永远打不出）。
//     新写法在 openAbilityWindow 的反应循环里可达，reactionWindow 里也不会被问两遍。
//   · 「在你与……交战」/「非精英」/「敌人还有生命」→ 描述子 criteria（enemyEngaged 的
//     context = { enemy, seat }，见 enemies.js#engageEnemy）；
//   · 「最多 2 点伤害和/或恐惧，作为伤害移动」→ 逐点询问伤害/恐惧（每次 1 点；也可停止），
//     每点对敌人造成 1 点伤害；总量受「最多 2」与敌人剩余生命限制。
//     先移除调查员的伤害/恐惧标记，再按其数量对敌人造成伤害。
const CODE = '10017'

// 敌人剩余生命：敌人入场时 health 已按人数/印刷加成算好；damageTaken 是已受伤害。
const remainingHealth = enemy => (Number.isFinite(Number(enemy?.health)) ? Number(enemy.health) : 0)
  - Math.max(0, Number(enemy?.damageTaken) || 0)

const movableHarm = inv => Math.max(0, inv?.damage || 0) + Math.max(0, inv?.horror || 0)

// 与引擎 enemiesEngagedWith 同口径：engagedSeat 是本人，或庞大敌人在同一地点（04011 注释同款）。
const engagedWithMe = (inv, enemy) => enemy?.engagedSeat === inv.seat
  || (enemy?.massive === true && enemy.location === inv.location)

export default {
  code: CODE,
  name: 'Stouthearted',
  playCondition: [
    {
      when: ({ inv }) => movableHarm(inv) > 0,
      message: '汉克·萨姆森身上没有可移动的伤害或恐惧',
    },
  ],
  abilities: [
    {
      kind: 'reaction',
      fromHand: true,
      quickEvent: true,
      trigger: 'enemyEngaged',
      label: '快速：你与非精英敌人交战时，移动汉克至多 2 点伤/恐作为伤害到该敌人',
      criteria: [({ inv, context }) => context?.seat === inv.seat
        && engagedWithMe(inv, context.enemy)
        && context.enemy?.elite !== true
        && remainingHealth(context.enemy) > 0
        && movableHarm(inv) > 0],
      resolve: ({ state, inv, context, api }) => {
        const enemy = (state.enemies || []).find(item => item.id === context?.enemy?.id)
        if (!enemy || !engagedWithMe(inv, enemy) || enemy.elite) return
        let remaining = Math.min(2, remainingHealth(enemy))
        let moved = 0
        while (remaining > 0 && movableHarm(inv) > 0) {
          const options = [{ id: 'done', label: '不再移动' }]
          if ((inv.damage || 0) > 0) options.push({ id: 'damage', label: '移动 1 点伤害（作为 1 点伤害放到该敌人）' })
          if ((inv.horror || 0) > 0) options.push({ id: 'horror', label: '移动 1 点恐惧（作为 1 点伤害放到该敌人）' })
          const pick = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat,
            prompt: `一身是胆：还可以移动 ${remaining} 点（敌人剩余生命 ${Math.max(0, remainingHealth(enemy))}）。`,
            options,
          })
          if (pick !== 'damage' && pick !== 'horror') break
          if (!api.scenario.removeInvestigatorHarm(inv.seat, pick, 1)) break
          api.damageEnemy(enemy, 1, inv.seat, CODE)
          remaining -= 1
          moved += 1
          if (!state.enemies.includes(enemy)) break
        }
        if (moved) api.info(`🫳 一身是胆：${inv.name} 将 ${moved} 点伤害/恐惧作为伤害移动到「${enemy.name}」。`)
      },
    },
  ],
  modifiers: [],
}
