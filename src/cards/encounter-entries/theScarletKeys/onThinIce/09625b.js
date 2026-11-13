// 09625b 索恩（Thorne · Consummate Professional）· 剧情支援 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。物理卡 09625 的剧情支援面（a/b 两面同号）。
// 卡面（中）：[reaction] 你所在地点的调查员将卡牌放在一边，作为空洞后，横置索恩：
//   该调查员可以立即进行一次行动，如同是自己回合。
//
// 读点（章节 behavior，条目只声明数据）：
//   · behavior.maybeThorneReaction 读 `assetRule.onHollowSetAside`：本章所有空洞写入点
//     （手牌/牌库顶/在场支援）结算后统一派发一次；
//   · 「横置」由内容层写实例 `exhausted`；「立即行动」走 `api.beginImmediateAction`（通用原语）。
// 「Raw Deal 3」把他放进场：behavior.resolveRawDeal 的 putThorneAssetInPlay。
export default {
  code: '09625b',
  name: '索恩',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    onHollowSetAside: { exhaustSelf: true, immediateAction: true },
    triggersWhenHollowOwner: true,
  },
  note: 'approximation: 引擎没有「卡被放在一边作为空洞」的通用窗口，反应由本章的空洞写入点'
    + '（hollowFromHand / hollowFromDeckTop / hollowAssetInPlay / resolveKeyShift）统一调用 behavior.maybeThorneReaction；'
    + '跨章节来源的空洞（其它章节把卡放在一边）不会触发他（本章只服务本关）。',
}
