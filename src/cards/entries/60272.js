// 60272 打字机（Typewriter）
// 卡面：使用(3秘密)。如果打字机上没有秘密，将其弃掉。打字机上的秘密可以花费，如同是你控制的[[书籍]]支援上的秘密。
// 读点：uses/usesType secrets + discardWhenEmpty（assetEffect 的用完弃置读点）；
// 「可如同书籍支援秘密般花费」需要跨支援秘密花费原语（见 note 与 primitive-requests/w4-carolyn.json），本实现仅声明次数与用尽弃置。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60272',
  uses: 3,
  usesType: 'secrets',
  discardWhenEmpty: true,
  // 读点：use-transfer.js#useCostSources 的 secret 分支（本卡秘密可作为同地点 Tome 的秘密支付）。
  assetRule: { lendUsesAs: 'secrets' },
  note: '',
  modifiers: [],
}
