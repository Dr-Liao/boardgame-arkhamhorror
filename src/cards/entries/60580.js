// 60580 长弓 · 支援（双手槽，3 费，3 经验，敏捷/战斗/万用图标，远程武器）
// 卡面：使用（1 箭矢）。
//       [action]花费 1 箭矢：攻击([agility])。你本次攻击得到 +2[agility] 并造成伤害 +2。本次攻击忽略冷漠。
//       [action]：补充长弓的 1 箭矢。
const CODE = '60580'

export default {
  code: CODE,
  uses: 1,
  usesType: 'arrow',
  abilities: [
    {
      kind: 'action',
      actionKind: 'fight',
      label: '花费 1 箭矢：以敏捷攻击，+2 敏捷、伤害 +2、忽略冷漠',
      cost: { action: true, uses: 1 },
      target: { kind: 'enemy', query: () => true },
      resolve: ({ inv, api, targetId }) => {
        api.fight(inv.seat, targetId, { skill: 'agility', combatBonus: 2, damageBonus: 2, ignoreAloof: true })
      },
    },
    {
      kind: 'action',
      actionKind: 'activate',
      label: '补充长弓的 1 箭矢',
      cost: { action: true },
      resolve: ({ source, api }) => api.addUses(source, 'arrow', 1),
    },
  ],
  modifiers: [],
}
