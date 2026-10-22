// 03341 恶灵附身
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：险境。隐私。
// 卡面：显现 - 将恶灵附身(折磨)秘密加入你的手牌。
// 卡面：如果你身上的恐惧数量大于你神智值的两倍，你立即退场并阵亡。
// 卡面：[action]花费5资源：从你手牌中弃掉恶灵附身(折磨)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03341', scope: 'treachery', hiddenRule: { killAtHorrorOverSanityMultiplier: 2, discard: { actions: 1, resources: 5 } } }
