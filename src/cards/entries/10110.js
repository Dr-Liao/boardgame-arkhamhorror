// 10110 草叉（Pitchfork）· 潜袭者支援 · 0 经验 · 3 资源 · 双手 · 道具/工具/武器/近战
// 卡面：[action]：攻击。本次攻击你得到 +1[combat] 并造成 +2 伤害。如果本次攻击成功，
//       失去对草叉的控制并将它附属到你所在地点。附属地点获得：
//       「[action]：控制草叉。草叉所在地点的任意调查员均可以触发此能力。」
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 攻击加值/加伤害 = api.fight(seat, enemyId, { combatBonus: 1, damageBonus: 2 })
//     （加值只在成功时并入伤害，与印刷「如果本次攻击成功」同口径）。
// 草叉保持原实体和所有者，成为地点托管支援；任意在场调查员可花一次行动接手。
const CODE = '10110'

export default {
  code: CODE,
  name: 'Pitchfork',
  // 地点附属上的「取回」行动读点（moves.js / movement.js#doDetachLocationAttachment）。
  detachAction: true,
  assetRule: { sharedLocationDetach: true },
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { action: true },
      label: '攻击：战斗 +1、伤害 +2；成功后草叉失去控制并附属到所在地点（任意调查员可花 1 行动取回）',
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const result = api.fight(inv.seat, enemy.id, { combatBonus: 1, damageBonus: 2 })
        if (!result?.success || !source) return
        const covered = api.attachControlledAsset(inv.seat, source.id, 'location', inv.location)
        if (!covered) {
          api.info('🍴 草叉：无法附属到所在地点，草叉留在你的控制下。')
          return
        }
        api.info(`🍴 草叉：攻击成功，失去控制并附属到「${api.locationName(inv.location)}」；该地点的任意调查员可以花 1 行动控制草叉。`)
      },
    },
  ],
  modifiers: [],
}
