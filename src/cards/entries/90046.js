// 90046 “灰堆”皮特（平行 / The Drifter）· 求生者 · 独立发行平行调查员。
//
// 卡面：你以皮特的吉他在场上开始游戏。
//   [reaction] 在一张附属到冒险卡上的、属于你的卡牌将要被弃置时：改为将它加入你的手牌。（每轮仅限一次。）
//   [elder_sign] 效果：+1。选择一张附属到冒险卡上的、属于你的卡牌；你可以将它返回手牌。
//
// 引擎读点：
//   · 「以皮特的吉他在场上开始游戏」= 条目级 `investigator.startsWith: '90047'`
//     （setup.js 开局读点，与 02005 的 startsWith 同一实现）。
//   · 旧印 +1 = elderSign 描述子的 delta。
// 近似/缺原语：
//   · 「附属到冒险卡上的你的一张卡将要被弃置 → 改为加入手牌」需要「玩家拥有的卡将要被弃置」拦截窗口
//     （现有 assetLeavesPlay 是离场之后；attachDepartingAsset 只能把附属挂到宿主而不是返回手牌），
//     且 cards-data 没有「冒险卡」这一可查询标记 → primitive-requests/core-cards-a-90046-attached-card-would-discard.json。
//     旧印的返手选择依赖同一查询，暂只结算 +1。
//   · 因此本条目声明的读点是 startsWith 与旧印；未实现的两段不写无法生效的描述子（见 note）。
const code = '90046'

export default {
  code,
  kind: 'investigator',
  investigator: {
    startsWith: '90047',
    elderSign: { bonus: 1 },
  },
  elderSign: {
    id: `${code}-eldersign`,
    label: '旧印：+1（将附属到冒险卡上的你的一张卡返回手牌待原语）',
    resolve: () => ({ delta: 1 }),
  },
  abilities: [],
  modifiers: [],
  note: '近似：startsWith/旧印已接线；「附属到冒险卡上的你的卡将要被弃置时返回手牌」与旧印返手选择缺读点（无 will-be-discarded 拦截窗口、cards-data 无冒险卡标记）→ primitive-requests/core-cards-a-90046-attached-card-would-discard.json。',
}
