// 10065 不列颠斗牛犬左轮手枪（British Bull Dog）· 潜袭者资产 · 3 资源 · 手部槽
// 卡面：
//   使用(3 子弹)。
//   [action] 花费 1 子弹：攻击。你本次攻击可以不使用[combat]，改为使用[agility]。
//   本次攻击造成 +1 伤害。
//   [reaction] 你与敌人谈判时技能检定失败后：将不列颠斗牛犬左轮手枪从你的手牌放置入场。
//
// 读点（卡面 → 引擎）：
//   · 使用(3 子弹) = 条目 uses / usesType 'ammo'；花费子弹 = 描述子 cost.uses（payUseCost）。
//   · 「攻击，可用[agility]代替[combat]」= kind 'action' + countsAs 'fight' + target enemy；
//     技能选择交给 api.fight 的 opts.skill（actionTestSkill 的替换读点），伤害 +1 = opts.damageBonus。
//   · 「与敌人谈判时技能检定失败后」= skillTestFail 窗口（tests.js 在失败的 ST.6 开窗）。
//     目前在条件里读 state.skillTest.actionKind === 'parley'（api.test 的 options.actionKind 写点）。
//   · 「从手牌放置入场」= kind 'reaction' + fromHand + noPlayCost，resolve 用 api.putIntoPlay
//     （从手牌取出并创建资产实例，走入场窗口/槽位）。
//
// approximation（逐条披露，见 artifacts/migration/fhv/primitive-requests/10065.json）：
//   ① skillTestFail 的窗口 context 不带 actionKind，只有「本次检定由 api.test 显式传了
//      actionKind:'parley'」的谈判检定能判定；用 played 描述子 countsAs 'parley' 发起的谈判
//      （如 09052 存在之谜）不会写 state.skillTest.actionKind，反应不触发。
const CODE = '10065'

function chooseFightSkill(inv, api) {
  const answer = api.choice({
    kind: 'effect', source: CODE, seat: inv.seat,
    prompt: '不列颠斗牛犬左轮手枪：本次攻击使用哪项技能？',
    options: [{ id: 'combat', label: '使用[战斗]' }, { id: 'agility', label: '使用[敏捷]（代替战斗）' }],
  })
  return answer === 'agility' ? 'agility' : 'combat'
}

export default {
  code: CODE,
  name: 'British Bull Dog',
  simplified: true,
  note: 'approximation: skillTestFail 窗口 context 不带 actionKind；「与敌人谈判时」只能读 state.skillTest.actionKind（由 api.test 显式传 parley 的检定），countsAs:parley 的 played 描述子发起的检定不触发，见 primitive-requests/10065.json。',
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      cost: { action: true, uses: 1 },
      target: { kind: 'enemy' },
      label: '花费 1 子弹：攻击（可用[敏捷]代替[战斗]，本次攻击 +1 伤害）',
      resolve: ({ inv, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const skill = chooseFightSkill(inv, api)
        api.info(`🔫 ${inv.name} 用不列颠斗牛犬左轮手枪攻击「${api.cardName(enemy.code)}」（${skill === 'agility' ? '敏捷' : '战斗'}，+1 伤害）。`)
        api.fight(inv.seat, enemy.id, { skill, damageBonus: 1 })
      },
    },
    {
      kind: 'reaction',
      trigger: 'skillTestFail',
      fromHand: true,
      noPlayCost: true,
      label: '与敌人谈判的技能检定失败后：把手牌中的不列颠斗牛犬左轮手枪放置入场',
      criteria: [({ state, inv }) => state.skillTest?.seat === inv.seat && state.skillTest?.actionKind === 'parley'],
      resolve: ({ inv, api }) => {
        const placed = api.putIntoPlay(inv.seat, CODE)
        if (placed) api.info('🔫 谈判破裂：不列颠斗牛犬左轮手枪已从手牌放置入场。')
      },
    },
  ],
  modifiers: [],
}
