// 12086 破瓶子（Broken Bottle）
// 卡面：[action]：攻击([combat])。你本次攻击得到 +1[combat]。
//       如果你检定成功，你可以弃掉破瓶子以使本次攻击造成伤害 +1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · [action] 临时武器攻击 = kind:'action' + countsAs:'fight' + target { kind:'enemy' }；
//   · 攻击主流程 = api.fight（opts.combatBonus/opts.damageBonus）；
//   · 「成功后弃掉破瓶子换 +1 伤害」= opts.onSuccess 里 api.discardSelf（combat.js 在伤害结算前
//     调用 onSuccess，弃置本身走 leaveAsset 的唯一离场入口）；失败则不弃置、也没有额外伤害；
//   · 近似：印刷是「检定成功后选择」，引擎的伤害加值必须在攻击结算前确定，因此改为攻击前询问、
//     只在检定成功时才真正弃置（失败保留破瓶子）——见文件头 note。

const CODE = '12086'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      label: '攻击：+1[战斗]；成功后可以弃掉破瓶子使伤害 +1',
      cost: { action: true },
      resolve: ({ target, inv, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const answer = api.choice({
          kind: 'reaction', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '破瓶子：若本次攻击成功，是否弃掉破瓶子以使伤害 +1？',
          options: [{ id: 'skip', label: '保留破瓶子' }, { id: 'discard', label: '成功后弃置，伤害 +1' }],
        })
        const sacrifice = answer === 'discard'
        api.fight(inv.seat, enemy.id, {
          combatBonus: 1,
          damageBonus: sacrifice ? 1 : 0,
          ...(sacrifice ? { onSuccess: () => api.discardSelf(CODE) } : {}),
        })
      },
    },
  ],
  modifiers: [],
  note: 'approximation: 「成功后选择弃置换 +1 伤害」在攻击前询问、仅成功时弃置（引擎伤害加值须在结算前确定）。',
}
