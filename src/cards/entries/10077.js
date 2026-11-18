// 10077 不列颠斗牛犬左轮手枪（British Bull Dog）· 潜袭者（Rogue）资产 · 3 费 · 2 经验 · 手部槽位。
// 卡面：使用(3 子弹)。
//       [action] 花费 1 子弹：攻击。你本次攻击可以不使用[战斗]，改为使用[敏捷]，且你得到技能值 +2。
//       本次攻击造成 +1 伤害。本次攻击忽略冷漠关键词。
//       [reaction] 你与敌人谈判时技能检定失败后：将不列颠斗牛犬左轮手枪从你的手牌放置入场。
//
// 一卡一个文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 使用(3 子弹) → 条目 uses/usesType（newPlayerAssetInstance 初始化；花费由 cost.uses 统一扣）。
//   · 攻击能力 → action + countsAs:'fight' + target:'enemy'；api.fight({assetId, skill, combatBonus:2,
//     damageBonus:1, ignoreAloof:true})。skill 由 api.choice 决定是否改用[敏捷]。
//   · 「谈判检定失败后从手牌放置入场」→ reaction + fromHand + noPlayCost + trigger:'testEnds'
//     （source 带 actionKind:'parley' 的检定才会被接受）；resolve 用 api.putIntoPlay（不支付费用，
//     走正常入场实例初始化与使用次数）。
const CODE = '10077'

const inHand = inv => (inv.hand || []).includes(CODE)

// 谈判检定的统一识别：api.test 写入的 actionKind、旧来源的 action/actionKind 字段都算。
const duringParley = state => {
  const test = state.skillTest
  if (!test) return false
  return test.actionKind === 'parley' || test.source?.actionKind === 'parley'
    || test.source?.action === 'parley' || test.target?.actionKind === 'parley'
}

export default {
  code: CODE,
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { action: true, uses: 1 },
      label: '花费 1 子弹：攻击（可改用[敏捷]，技能值 +2，伤害 +1，忽略冷漠）',
      resolve: ({ state, inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy || !state.enemies.includes(enemy)) {
          api.info('「不列颠斗牛犬左轮手枪」：没有可攻击的敌人。')
          return
        }
        const useAgility = api.choice({
          kind: 'skill', source: CODE, seat: inv.seat,
          prompt: '「不列颠斗牛犬左轮手枪」：本次攻击使用哪个技能？',
          options: [{ id: 'agility', label: '[敏捷]（卡面允许）' }, { id: 'combat', label: '[战斗]' }],
        })
        api.fight(inv.seat, enemy.id, {
          assetId: source?.id,
          skill: useAgility === 'combat' ? 'combat' : 'agility',
          combatBonus: 2,
          damageBonus: 1,
          ignoreAloof: true,
        })
      },
    },
    {
      kind: 'reaction',
      fromHand: true,
      noPlayCost: true,
      trigger: 'testEnds',
      label: '你与敌人谈判时技能检定失败后：将本卡从手牌放置入场',
      criteria: [({ state, inv, context }) => {
        if (context?.result?.success !== false) return false
        if (!inHand(inv)) return false
        return state.skillTest?.seat === inv.seat && duringParley(state)
      }],
      resolve: ({ inv, api }) => {
        const placed = api.putIntoPlay(inv.seat, CODE)
        if (!placed) {
          api.info('「不列颠斗牛犬左轮手枪」：当前不能从手牌放置入场。')
          return
        }
        api.info(`🔫 「不列颠斗牛犬左轮手枪」：谈判检定失败，${inv.name} 将它从手牌放置入场。`)
      },
    },
  ],
  modifiers: [],
}
