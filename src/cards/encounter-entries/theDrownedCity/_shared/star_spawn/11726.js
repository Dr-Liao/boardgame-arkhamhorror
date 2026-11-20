// 11726 感染星之眷族（Infected Star Spawn）· 敌人 · 共享遭遇组 star_spawn（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/star_spawn。
// 卡面（cards-data 11726）：
//   猎手。无情。猎物 - [agility]最高者。
//   强制 - 本敌人首次将要被击败时：治愈其所有伤害并重整它。
//   强制 - 你攻击或躲避感染星之眷族时揭示[elder_thing]标记：受到1点恐惧。
//
// 读点（声明即接线）：
//   · 「首次将要被击败时」= enemyWouldBeDefeated 中断窗口（enemy-outcomes.js 的 deps.interrupt，
//     context 带 enemy/phase:'would'/replaced），用 limit { perGame, instance } 记「首次」；
//     实现「治愈所有伤害 + 重整」= api.enemyOutcomes.replace(context, { healAllDamage: true, ready: true })；
//   · 「揭示 elder_thing 时受 1 恐惧」= chaosTokenRevealed 窗口 + api.horror；
//   · 猎手/无情/猎物来自章节 encounterDefinitions 解析印刷正文。
const CODE = '11726'
const TOKEN = 'elderthing'

const testingThisEnemy = (state, source) => {
  const test = state?.skillTest
  if (!test || test.target?.kind !== 'enemy' || test.target.id !== source?.id) return false
  return ['fight', 'evade'].includes(test.actionKind)
}

export default {
  code: CODE,
  name: '感染星之眷族',
  scope: 'enemy',
  implemented: true,
  flags: {
    traits: ['Monster', 'Star Spawn', 'Elite'],
    quantity: 1,
    fight: 2,
    evade: 4,
    health: 3,
    damage: 0,
    horror: 1,
    victory: 1,
    hunter: true,
    relentless: true,
    prey: 'highestAgility',
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyWouldBeDefeated',
    silent: true,
    limit: { scope: 'perGame', owner: 'instance' },
    label: '首次将要被击败时：治愈所有伤害并重整',
    criteria: ({ source, context }) => Boolean(source?.id) && context?.enemy?.id === source.id
      && context?.phase === 'would' && !context.replaced && !context.cancelled,
    resolve: ({ context, api }) => {
      if (!api.enemyOutcomes?.replace?.(context, { healAllDamage: true, ready: true })) return
      api.info?.('🦠 「感染星之眷族」首次将要被击败：治愈所有伤害并重整（其他攻击者仍可继续攻击）。')
    },
  }, {
    kind: 'forced',
    trigger: 'chaosTokenRevealed',
    silent: true,
    label: '攻击/躲避它时揭示 elder_thing：受到 1 点恐惧',
    criteria: ({ state, source, context }) => context?.token === TOKEN
      && context?.seat === state?.skillTest?.seat
      && Boolean(source?.id) && (state?.enemies || []).some(enemy => enemy.id === source.id)
      && testingThisEnemy(state, source),
    resolve: ({ state, context, api }) => {
      api.horror?.(context.seat, 1)
      const name = state?.investigators?.[context.seat]?.name || `座位 ${context.seat}`
      api.info?.(`🦠 「感染星之眷族」：揭示旧神标记，${name} 受到 1 点恐惧。`)
    },
  }],
  note: '「首次将要被击败」走 enemyWouldBeDefeated 中断 + api.enemyOutcomes.replace（healAllDamage/ready），'
    + 'limit perGame 保证一局只替换一次；标记强制效果走 chaosTokenRevealed + api.horror。'
    + '猎手/无情/猎物来自印刷正文解析。',
}
