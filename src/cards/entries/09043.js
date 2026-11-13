// 09043 解剖工具（Dissection Tools）· 探求者资产 · 手槽 · 费用 2。
// 卡面：[reaction] 在你所在地点的敌人被击败后：从供应堆拿 1 个资源放在本卡上，作为证据。
//       解剖工具具有 —— 1 个或更多证据：你得到 +1[agility]；2 个或更多证据：你得到 +1[combat]；
//       3 个或更多证据：你得到 +1 神智值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：证据 = 卡实例具名计数器 evidence（api.addCardCounter / card.markers.evidence）；
// 「1+ 证据 +1[agility]、2+ 证据 +1[combat]」用带 condition.when 的修正（读点 modifiers.js，
// source 是这张卡实例）。
// approximation：maxSanity 的读点（stats.js#getMaxSanity）只读 passive.sanityBonus 与实例
// sanityModifier，不读 modifiers 管线，所以「3+ 证据 +1 神智」无法按证据数条件生效，未实现
// （见 note 与 primitive-requests/09043.json）。
const SOURCE = '09043'
const evidenceOf = source => Number(source?.markers?.evidence || 0)

export default {
  code: '09043',
  note: 'approximation: 「3+ 证据 +1 神智」缺条件化 maxSanity 修正读点（getMaxSanity 不读 modifiers 管线），未实现',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'enemyDefeated',
      label: '同地点敌人被击败后：在本卡上放 1 个资源作为证据',
      criteria: [({ state, inv, context }) => Boolean(context?.enemy)
        && context.enemy.location === inv.location],
      resolve: ({ source, api }) => {
        api.addCardCounter(source, 'evidence', 1)
        api.info(`解剖工具：获得 1 个证据（${api.cardCounterOf(source, 'evidence')}）。`)
      },
    },
  ],
  modifiers: [
    { target: 'skill:agility', amount: 1, condition: { when: ({ source }) => evidenceOf(source) >= 1 } },
    { target: 'skill:combat', amount: 1, condition: { when: ({ source }) => evidenceOf(source) >= 2 } },
  ],
}
