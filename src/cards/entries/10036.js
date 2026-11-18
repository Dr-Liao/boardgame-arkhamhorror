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
// approximation（缺读点见 artifacts/migration/fhv/primitive-requests/10036.json）：
//   ① 「花费 1-3 充能」：费用表达式不能在询问后再付，因此声明 cost.uses:1（至少 1 点），
//      结算内用 api.choice 追加花费 0-2 点（受剩余充能限制），总计 1-3 点。
//   ② 交换缺「绑定卡就地交换」原语：这里要求瓦卢西亚之瞳在手牌（由 10035 的快速交换放入），
//      交换后幽嘶之刃返回手牌、瓦卢西亚之瞳放置入场、幽嘶之刃的充能全部弃掉。
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
  if (!(inv.hand || []).includes(EYES)) {
    api.info('幽嘶之刃：瓦卢西亚之瞳不在手牌，无法交换（缺绑定卡就地交换原语）。')
    return
  }
  const charges = Math.max(0, Number(source?.uses) || 0)
  if (!api.putAssetIntoPlay(inv.seat, EYES)) {
    api.info('幽嘶之刃：瓦卢西亚之瞳无法放置入场（槽位不满足）。')
    return
  }
  if (charges) api.spendUses(source, charges)
  if (source) api.returnAssetToHand(inv.seat, source)
  api.info(`🗡 幽嘶之刃：与瓦卢西亚之瞳交换，弃掉 ${charges} 点充能；幽嘶之刃返回手牌。`)
}

export default {
  code: CODE,
  name: 'Blade of Yoth',
  simplified: true,
  note: 'approximation: ① 花费 1-3 充能用 cost.uses:1 + 结算内追加花费近似（费用表达式不能先问再付）；② 缺「绑定卡就地交换」原语，交换以「瓦卢西亚之瞳从手牌入场 + 幽嘶之刃返回手牌」近似。',
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
      kind: 'action',
      cost: { action: false },
      label: '快速：与瓦卢西亚之瞳交换，弃掉所有充能',
      resolve: swapToEyes,
    },
  ],
  modifiers: [],
}
