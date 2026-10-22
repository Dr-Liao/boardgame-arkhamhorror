// 03084d 脑海中的低语
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：delusions
// 卡面：险境。隐私。
// 卡面：显现 - 将脑海中的低语(疑惑)秘密加入你的手牌。
// 卡面：你不能打出事件。
// 卡面：[action][action]：从你手牌中弃掉脑海中的低语(疑惑)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03084d', implemented: true, scope: 'treachery', hiddenRule: { cannotPlayTypes: ['event'], discard: { actions: 2 } } }
