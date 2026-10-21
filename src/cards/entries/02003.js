// 02003 珍妮·巴恩斯
// 卡面：你在每个补给阶段期间获取额外1资源。
// 卡面：[elder_sign]效果：你每有1个资源，+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// “阿什坎·彼得斯”：旧印 +X，X 为当前资源数。

const factory = () => ({ inv }) => ({ delta: inv.resources })

export default {
  code: '02003',
  kind: 'investigator',
  elderSign: { id: '02003-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
