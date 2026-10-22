// 03071 舞厅
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：[reaction]你在舞厅里执行谈判行动后：获得2资源。(团队每阶段仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 112 轮：最后之王两个会客室。

export default { code: '03071', scope: 'location', flags: { afterParley: 'resources' } }
