// 08615 木制雪撬（Wooden Sledge）· storyAsset
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   使用(4充能)。
//   [action]横置木制雪撬：位于本地点的一位调查员查找其牌库顶的6张卡牌，找出最多3张非弱点
//   [[道具]]或[[供给]]卡牌，正面朝下附属到木制雪撬。混洗其牌库。
//   木制雪撬在调查员控制下时，正面朝下附属在木制雪橇的卡牌可以被打出，如同该卡牌在该地点任意一位调查员手中。
//
// 读点：action 描述子 → legalMoves/doAbility；检索走引擎统一入口 api.searchDeck
// （会开「查找牌库」窗口、混洗牌库，并处理「被找到的牌自身规则」）。
// approximation: 引擎没有「正面朝下附属到支援、可当作手牌打出」的通用通道，本条目把
//   「找出最多 3 张道具/供给」结算为检索后加入该调查员手牌（打出口径等同手牌）；
//   该近似已在 behavior.scenarioGaps 登记。
export default {
  code: '08615',
  scope: 'storyAsset',
  implemented: true,
  uses: 4,
  usesType: 'charges',
  flags: { expedition: true },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '横置：查找牌库顶 6 张，找出最多 3 张[[道具]]/[[供给]]牌（近似：加入手牌）',
    cost: { action: true, exhaust: true },
    resolve: ({ inv, api }) => {
      const found = api.searchDeck(inv.seat, {
        traitsAny: ['Item', 'Supply'],
        choose: 3,
        shuffle: true,
        optional: true,
        source: '08615',
        prompt: '木制雪撬：从牌库中找出最多 3 张[[道具]]或[[供给]]卡牌（近似：加入手牌）。',
      }) || []
      api.info(found.length
        ? `🛷 木制雪撬：找出 ${found.length} 张道具/供给卡牌。`
        : '🛷 木制雪撬：没有找出符合条件的卡牌。')
    },
  }],
}
