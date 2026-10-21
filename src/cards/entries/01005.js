// 01005 温蒂·亚当斯
// 卡面：[reaction]在你揭示一个混乱标记时，选择并弃掉你1张手牌：取消该混乱标记并将其放回混乱袋。揭示一个新的混乱标记。(每次检定/能力仅限一次)
// 卡面：[elder_sign]效果：+0。如果温蒂的护身符在场，改为你自动成功。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 温蒂·亚当斯：旧印 +0；若你控制温蒂的护身符，自动成功。

const factory = () => ({ inv }) => ({ delta: 0, autoSuccess: inv.assets.some(asset => asset.code === '01014') })

export default {
  code: '01005',
  kind: 'investigator',
  elderSign: { id: '01005-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
