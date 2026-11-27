// 10036 幽嘶之刃（Blade of Yoth · 万蛇之父的愤怒）· 守护者支援 · 0 经验 · 手部/法术 · 道具/遗物/武器/近战
// 卡面：绑定（瓦卢西亚之瞳）。
//       [action]花费 1-3 充能：攻击。你本次攻击可以不使用[combat]，改为使用[willpower]。
//       你每花费 1 充能作为本行动的费用，得到技能值 +2 并造成 +1 伤害。
//       [fast]：查找你的绑定卡牌，找出瓦卢西亚之瞳，与幽嘶之刃交换，弃掉所有充能。
//
// 读点（卡面 → 引擎）：
//   · 主动攻击 = kind:'action' + countsAs:'fight' + target:{kind:'enemy'}；
//     攻击加值/伤害 = api.fight(seat, enemyId, { skill:'willpower', combatBonus: 2×充能,
//     damageBonus: 充能 })（skill 参数是 combat.js 的行动检定技能替代读点，04266 同写法）。
//   · 充能只经 api.spendUses / api.addUses 写（支援 uses 实例字段）。
//   · [fast] 交换：见 approximation。
//
// 绑定卡交换直接在原支援槽位完成。
const CODE = '10036'
const EYES = '10035'

function fightWithCharges({ inv, source, target, api }) {
  const enemy = target?.entity
  if (!enemy) return
  const remaining = Math.min(2, Math.max(0, Number(source?.uses) || 0))
  let extra = 0
  if (remaining > 0) {
    const pick = api.choice({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: `幽嘶之刃：还可以额外花费至多 ${remaining} 点充能（每点 +2 技能值、+1 伤害）。`,
      options: [{ id: '0', label: '不再花费' },
        ...Array.from({ length: remaining }, (_, index) => ({ id: String(index + 1), label: `再花费 ${index + 1} 点` }))],
    })
    extra = Math.max(0, Number(pick) || 0)
    if (extra) api.spendUses(source, extra)
  }
  const spent = 1 + extra
  const useWillpower = api.choice({
    kind: 'effect', source: CODE, seat: inv.seat,
    prompt: '幽嘶之刃：本次攻击使用哪项技能？',
    options: [{ id: 'combat', label: '战斗' }, { id: 'willpower', label: '意志' }],
  }) === 'willpower'
  api.fight(inv.seat, enemy.id, {
    ...(useWillpower ? { skill: 'willpower' } : {}),
    combatBonus: spent * 2,
    damageBonus: spent,
  })
  api.info(`🗡 幽嘶之刃：花费 ${spent} 点充能攻击「${api.cardName(enemy.code)}」（+${spent * 2} 技能值、+${spent} 伤害${useWillpower ? '，使用意志' : ''}）。`)
}

function swapToEyes({ inv, source, api }) {
  if (!api.bonded.swapAsset(inv.seat, source, EYES, { transferUses: false })) return
  api.info('幽嘶之刃与瓦卢西亚之瞳交换，弃掉幽嘶之刃上的充能。')
}

export default {
  code: CODE,
  name: 'Blade of Yoth',
  uses: 0,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { action: true, uses: 1 },
      label: '攻击：花费 1-3 充能，每点 +2 技能值、+1 伤害；可用[willpower]代替[combat]',
      resolve: fightWithCharges,
    },
    {
      kind: 'free',
      cost: { action: false },
      label: '快速：与瓦卢西亚之瞳交换，弃掉所有充能',
      resolve: swapToEyes,
    },
  ],
  modifiers: [],
}
