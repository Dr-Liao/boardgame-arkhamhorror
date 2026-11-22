// 12021 韧劲
// 卡面：（无印刷能力文本）
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 说明：2026 核心盒的「韧劲」是一张纯承伤才能卡（费用 3，2 生命 / 2 理智，无槽位、无能力文本）。
// 它的行为全部由卡面数据与引擎通用规则实现，条目本身没有需要引擎读取的描述子：
//   · 伤害/恐惧分配与「支援被击败」判定：src/engine/harm-threat.js#assignHarm +
//     src/engine/asset-defeat.js#isAssetDefeated（读卡片数据的 health/sanity）；
//   · 因此这里只注册 code：构筑池的「有行为实现」判定由 card-implementation.js 的条目通道给出。

export default {
  code: '12021',
  note: '卡面无能力文本：行为由卡面数据（2 生命 / 2 理智）与引擎通用承伤规则实现，条目仅注册。',
}
