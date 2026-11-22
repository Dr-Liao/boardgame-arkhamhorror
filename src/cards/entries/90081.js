// 90081 马泰奥神父（平行 / The Warden）· 秘术师 · 独立发行平行调查员。
//
// 卡面：
//   [fast] 在你的回合期间：将 1 个 [bless] 标记封印到你所在地点一位没有封印 [bless] 标记的调查员上。
//     （每轮仅限一次。）
//   [reaction] 在一位调查员将要揭示混乱标记时：改为结算封印在其上的 [bless] 标记。解除该标记的封印。
//   [elder_sign] 效果：+1。结算马泰奥神父的 [fast] 能力，忽略其限制。
//
// 引擎读点：
//   · 旧印 +1 = elderSign delta（读点 tests.js#elderSignEffect）。
// 缺原语：
//   · 「把混乱标记封印在调查员上」：`api.chaosTokens.seal(source, token, count)` 的封印宿主需要实体 id，
//     调查员实例没有 id（封印度按卡的 id 索引）→ 无法挂在调查员上；
//   · 「将揭示的标记替换为某调查员上封印的标记（且不弃牌）」：campaign-plugin.js#campaignBeforeChaosReveal
//     的替代读点只支持「弃掉带 substituteSealedToken 的支援」的 04199 语义，没有「替换后解除封印、卡留在场」
//     的接口（90038 也登记了同一缺口）。
//   → primitive-requests/core-cards-a-90081-mateo-parallel-seal.json。
//   未实现的两段不写无法生效的描述子（见 note）。
const code = '90081'

export default {
  code,
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 1 },
  },
  elderSign: {
    id: `${code}-eldersign`,
    label: '旧印：+1（结算 [fast] 封印能力待原语）',
    resolve: () => ({ delta: 1 }),
  },
  abilities: [],
  modifiers: [],
  note: '待原语：封印 [bless] 到调查员上、以及「揭示时改为结算该调查员上封印的 [bless] 并解除封印」的替换读点（primitive-requests/core-cards-a-90081-mateo-parallel-seal.json）；[fast] 与 [reaction] 暂未接线，旧印 +1 已实现。',
}
