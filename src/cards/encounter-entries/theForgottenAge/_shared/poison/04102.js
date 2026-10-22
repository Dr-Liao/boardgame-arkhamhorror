// 04102 中毒
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：poison
// 卡面：每位调查员仅限1张。每套牌库仅限1张。
// 卡面：永久。
// 卡面：你中毒了。(这张卡牌本身没有效果。你已中毒时，其他卡牌效果可能改变或增强。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 中毒（04102）：一张会进入牌组的威胁；战役补给可花 XP 移除。
// 第 123 轮：`poisonWeakness` 让 src/campaign/campaign-effects.js 不再写死这个卡号。

export default {
  code: '04102', implemented: true, name: '中毒', scope: 'treachery', text: '中毒弱点。', poisonThreat: true,
  poisonWeakness: true, flags: { poisoned: true }, treacheryRule: { permanent: true },
  encounterResolve(state, inv, card, api) {
    api.poison(inv.seat)
    return false
  },
}
