// 60232 密斯卡托尼克考古基金
// 卡面：永久。每副牌库限制1张。
// 卡面：你拥有额外2个盟友槽位，只能用来放置[[密斯卡托尼克]]支援。
// 卡面：强制 - 你每次受到伤害或恐惧时：至多将其中1点伤害或恐惧分配给一张[[密斯卡托尼克]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60232',
  restrictedSlots: [{ slot: 'ally', traitsAny: ['Miskatonic'], count: 2 }],
  assetRule: { harmAssignmentTraitLimit: { trait: 'Miskatonic', maximum: 1 } },
}
