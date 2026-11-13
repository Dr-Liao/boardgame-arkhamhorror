// 09073 痛下黑手（Dirty Fighting）· 游荡者（Rogue）资产 · 2 经验 · 天赋 · 技巧 · 违法。
//
// 卡面：每位调查员仅限 1 张。
//       在攻击、谈判，或尝试躲避已横置的敌人时，你得到 +2 技能值。
//       [reaction] 在你躲避一个敌人后，横置痛下黑手：对该敌人进行一次攻击行动。
//       本次攻击忽略冷漠关键词。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「每位调查员仅限 1 张」→ 条目级 limitPerInvestigator（moves.js / play-condition 的既有读点）。
//   · 「+2 技能值」→ modifiers skill:* +2 + 声明式条件 when（读点：statPipeline；条件里读
//     state.skillTest 的行动种类与目标敌人的横置状态）。
//   · 「躲避后攻击」→ evadeSuccess 窗口（combat.js）+ api.fight(seat, enemyId, { ignoreAloof })
//     （combat.js#doFight 的 opts.ignoreAloof 是 04104 同一读点）。
const CODE = '09073'

const SKILL_LABEL = { fight: '攻击', evade: '躲避', parley: '谈判' }

const currentActionKind = state => {
  const test = state?.skillTest
  if (!test) return null
  const kind = test.actionKind || test.testTarget?.actionKind || null
  if (kind) return kind
  const label = String(test.source?.label || '')
  for (const [key, text] of Object.entries(SKILL_LABEL)) if (label.includes(text)) return key
  return null
}

const targetOfTest = state => {
  const test = state?.skillTest
  if (!test) return null
  const id = test.source?.enemyId || test.testTarget?.id || null
  return id ? (state.enemies || []).find(enemy => enemy.id === id) || null : null
}

export default {
  code: CODE,
  limitPerInvestigator: true,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'evadeSuccess',
      cost: { exhaust: true },
      label: '躲避一个敌人后：横置，对该敌人进行一次攻击行动（忽略冷漠）',
      criteria: [({ inv, source, context }) => Boolean(source)
        && !source.exhausted
        && context?.seat === inv.seat
        && Boolean(context?.enemy)],
      resolve: ({ inv, api, context }) => {
        const enemy = context.enemy
        if (!enemy) return
        api.info(`🥊 「痛下黑手」：对「${enemy.name}」进行一次攻击行动（忽略冷漠）。`)
        api.fight(inv.seat, enemy.id, { ignoreAloof: true })
      },
    },
  ],
  modifiers: [
    {
      target: 'skill:*',
      amount: 2,
      condition: {
        when: ({ state }) => {
          const kind = currentActionKind(state)
          if (kind === 'fight' || kind === 'parley') return true
          if (kind !== 'evade') return false
          const enemy = targetOfTest(state)
          return Boolean(enemy?.exhausted)
        },
      },
    },
  ],
}
