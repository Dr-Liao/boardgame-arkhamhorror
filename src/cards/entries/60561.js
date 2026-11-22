// 60561 一如往常 · 支援（2 费，智识图标，条件）
// 卡面：使用（5 补给）。如果没有补给，将其弃掉。
//       你可以将一如往常的补给作为资源花费，以支付你所在地点任意调查员打出的事件。
// 说明：补给/资源互换缺少通用原语；这里用 uses + 弃掉空卡 + note 声明，
//       并排队 primitive-requests/w6-supplies-as-resources.json。
const CODE = '60561'

export default {
  code: CODE,
  // 读点：play-payment.js 的 playCostUses（同地点任意调查员打出事件时，补给按 1:1 当资源支付）。
  assetRule: { playCostUses: { cardType: 'event', scope: 'location' } },
  uses: 5,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [],
  modifiers: [],
  note: '',
}
