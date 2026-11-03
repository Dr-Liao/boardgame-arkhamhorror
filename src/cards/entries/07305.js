function attack({ inv, source, target, api }) {
  const enemy = target?.entity || api.chooseEnemy(inv.seat, { type: 'fight' })
  api.fight(inv.seat, enemy.id, { assetId: source.id,
    conditionalBonus: { targetExhausted: { skill: 2, damage: 1 } }, noSpend: true })
}
export default { code: '07305', fast: true, uses: 4, usesType: 'ammo', abilities: [
  { kind: 'action', label: '攻击；目标横置时战斗 +2、伤害 +1', countsAs: 'fight', cost: { action: true, uses: 1 }, target: { kind: 'enemy' }, resolve: attack },
  { kind: 'reaction', trigger: 'evadeSuccess', label: '花费 1 弹药：立即攻击', cost: { uses: 1 },
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, context }) => context.seat === inv.seat && context.enemy?.location === inv.location,
    resolve: attack },
] }
