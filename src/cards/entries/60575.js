// 60575 温彻斯特 52 式步枪 · 支援（双手槽，3 费，2 经验，敏捷/战斗图标，枪械）
// 卡面：使用（2 子弹）。
//       [action]花费 1 子弹：攻击([combat])。你本次攻击得到 +3[combat] 并造成伤害 +1。
//       [action]弃掉本卡：攻击([combat])。你本次攻击得到 +3[combat]。如果检定成功，自动躲避对象敌人。
//
// 读点：第二项攻击的「成功后自动躲避」走 api.fight 的 `autoEvadeOnSuccessBy`（combat.js 内
// 成功后横置+解除交战+afterEvade；08008 同一先例），不再手工近似。
const CODE = '60575'

export default {
  code: CODE,
  uses: 2,
  usesType: 'ammo',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      actionKind: 'fight',
      label: '花费 1 子弹攻击：+3 战斗，伤害 +1',
      cost: { action: true, uses: 1 },
      target: { kind: 'enemy' },
      resolve: ({ inv, api, targetId }) => {
        api.fight(inv.seat, targetId, { combatBonus: 3, damageBonus: 1 })
      },
    },
    {
      kind: 'action',
      actionKind: 'fight',
      label: '弃掉温彻斯特：攻击 +3 战斗；检定成功后自动躲避目标敌人',
      cost: { action: true, discardSelf: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, api, targetId }) => {
        api.fight(inv.seat, targetId, { combatBonus: 3, autoEvadeOnSuccessBy: 0 })
      },
    },
  ],
  modifiers: [],
}
