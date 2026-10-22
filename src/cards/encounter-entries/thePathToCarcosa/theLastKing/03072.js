// 03072 客厅
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：[reaction]你在客厅里执行谈判行动后：抽取1张卡牌。(团队每阶段仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03072', scope: 'location', flags: { afterParley: 'draw' } }
