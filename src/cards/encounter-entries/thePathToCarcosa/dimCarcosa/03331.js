// 03331 王之宫殿
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：除非哈斯塔有至少5[per_investigator]伤害，否则王之宫殿不能翻面。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 跨卡身份查询用条目标志：内容层用 entryFlags / enemyRuleFor 判断「这张牌是不是 X」，
// 不再在章节脚本里写死卡号（第 114 轮）。
// 子嗣（02255）用 entries/02255.js 的 enemyRule.brood，追猎恐魔（02141）用 enemyRule.huntingHorror。

export default { code: '03331', scope: 'location', flags: { palaceOfTheKing: true } }
