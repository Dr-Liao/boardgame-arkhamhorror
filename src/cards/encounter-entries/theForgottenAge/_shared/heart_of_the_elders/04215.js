// 04215 落入陷阱
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：heart_of_the_elders
// 卡面：险境。
// 卡面：显现 - 你必须(选择以下一项)：
// 卡面：- 检定[agility](3)来尝试跳过这条裂隙。你检定失败且每低于难度1点，受到1点伤害。
// 卡面：- 将落入陷阱洗入探索牌库。落入陷阱如果是从探索牌库抽出的，你不能选择这个选项。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 下面四张是两个「久远腹地」章节共用的遭遇卡。第 117 轮先把卡号判断收进条目标志；
// 两章的文案/数值仍有细微差异，合并成单一 encounterResolve 实现留到后续专门一轮。

export default { code: '04215', scope: 'treachery', implemented: true, flags: { pitfall: true } }
