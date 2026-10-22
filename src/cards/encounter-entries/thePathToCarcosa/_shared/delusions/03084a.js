// 03084a 脑海中的低语
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：delusions
// 卡面：险境。隐私。
// 卡面：显现 - 将脑海中的低语(沮丧)秘密加入你的手牌。
// 卡面：你不能在技能检定投入技能卡牌。
// 卡面：[action][action]：从你手牌中弃掉脑海中的低语(沮丧)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：从 content/campaigns/thePathToCarcosa/card-data.js 的三张表搬来的卡面规则。
// 隐藏卡（03084a–d / 03186 / 03187 / 03340–03342）。

export default { code: '03084a', implemented: true, scope: 'treachery', hiddenRule: { cannotCommitTypes: ['skill'], discard: { actions: 2 } } }
