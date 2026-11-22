// 10060 饥饿霉菌（Ravenous Myconid · 食肉菌株 Carnivorous Strain）· 探寻者资产 · 4 经验 · 2 资源
// 卡面：
//   研究完成。每套牌库仅限 1 张。
//   [fast]：查找你的绑定卡牌，找出诡异疯长，并将其加入你的手牌。（每轮仅限一次。）
//   [fast] 选择你所在地点的一个非[[精英]]敌人，该敌人的剩余生命值不能大于饥饿霉菌上的生长数：
//   击败该敌人。移除饥饿霉菌上所有的生长。
//
// 读点（卡面 → 引擎）：
//   · 生长标记 = 资产实例的 uses（usesType 'growth'）；读写只经 api.addUses。
//   · 「查找绑定卡牌」= api.bonded.retrieve（场外集合唯一读点）；每轮一次 = limit 'oncePerRound'。
//   · 「[fast] 选择敌人」= kind 'free' + target { kind: 'enemy', query }：legalMoves 为每个候选
//     展开一条带 targetId 的行动，结算时注入 ctx.target；query 收窄到「非精英 + 剩余生命值
//     ≤ 生长数」（剩余值 = 当前生命上限（enemyHealth hook）− damageTaken）。
//   · 「击败」= api.defeatEnemy（api-clue.js；与战斗击败同一 defeatEnemy 管线，会开
//     enemyDefeated / defeatEnemy 窗口并结算胜利区）。
//   · 研究完成 = 条目级 researchRequirement（campaign.js#researchRequirementFor 的唯一读点）；
//     记录键 'classifiedNewSpecies' 与基础卡 10044 的 api.recordResearch 写点同源（FHV P7 战役日志）。
const CODE = '10060'
const GROWTH = 'growth'
const UNCANNY_GROWTH = '10045'

const growthOf = source => Math.max(0, Number(source?.uses) || 0)

function remainingHealth(entity, enemyHealth) {
  const maximum = enemyHealth(entity)
  if (!Number.isFinite(maximum)) return null
  return Math.max(0, maximum - (Number(entity?.damageTaken) || 0))
}

function searchUncannyGrowth({ inv, api }) {
  const taken = api.bonded.retrieve(inv.seat, CODE, { handCount: 1 })
  if (taken.length) api.info(`🍄 饥饿霉菌：查找绑定卡牌，把「${api.cardName(UNCANNY_GROWTH)}」加入手牌。`)
  else api.info('🍄 饥饿霉菌：绑定卡牌「诡异疯长」不在场外集合里。')
}

export default {
  code: CODE,
  name: 'Ravenous Myconid (Carnivorous Strain)',
  researchRequirement: 'classifiedNewSpecies',
  researchUpgradeFrom: '10044',
  uses: 0,
  usesType: GROWTH,
  abilities: [
    {
      kind: 'free',
      fast: true,
      label: '查找绑定卡牌，找出诡异疯长加入手牌（每轮一次）',
      limit: 'oncePerRound',
      cost: { action: false },
      criteria: [({ inv, helpers }) => helpers.bondedAvailable(inv.seat, CODE, UNCANNY_GROWTH) > 0],
      resolve: searchUncannyGrowth,
    },
    {
      kind: 'free',
      fast: true,
      label: '选择同地点非精英敌人（剩余生命值 ≤ 生长数）：击败它并移除全部生长',
      cost: { action: false },
      criteria: [({ source }) => growthOf(source) > 0],
      target: {
        kind: 'enemy',
        query: ({ source, entity, enemyHealth }) => {
          if (!entity || entity.elite) return false
          const remaining = remainingHealth(entity, enemyHealth)
          return remaining != null && remaining <= growthOf(source)
        },
      },
      resolve: ({ state, inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy || !(state.enemies || []).includes(enemy)) return
        const growth = growthOf(source)
        if (!api.canDefeatEnemy(enemy, inv.seat)) {
          api.info(`🍄 饥饿霉菌：「${api.cardName(enemy.code)}」现在不能被击败。`)
          return
        }
        api.defeatEnemy(enemy, inv.seat)
        api.addUses(source, -growth)
        api.info(`🍄 饥饿霉菌：吞噬「${api.cardName(enemy.code)}」并将其击败；移除 ${growth} 个生长标记。`)
      },
    },
  ],
  modifiers: [],
}
