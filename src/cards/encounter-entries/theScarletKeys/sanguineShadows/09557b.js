// 09557b 红衣女郎（La Chica Roja · Your Watchful Shadow）· 剧情支援面
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   [reaction] 在你回合结束时，横置红衣女郎：将你的调查员迷你卡放入阴影中。你在阴影中时，
//   你不在任何地点。将要生成与你交战的敌人，改为生成在你先前的地点。当你回合开始时，将你移动回
//   你的先前地点（如果不能，则移动到任意已揭示地点）。
//
// 实现口径：引擎没有「调查员在阴影中」原语（已登记原语请求 new.investigatorInShadows）。
// 本条目只落可表达的一半：横置她 → 用 `api.setScenarioFlag('sanguineShadowAnchor:<seat>', 地点)`
// 记录锚点；章节 behavior 的 `turnBegins` 读同一个键，把移动过的调查员移回锚点后清键。
// 「不在任何地点 / 敌人生成改在先前地点」这两句记在 note 与原语请求里，不冒充已实现。
export default {
  code: '09557b',
  scope: 'storyAsset',
  implemented: true,
  simplified: true,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnEnded',
      label: '横置红衣女郎：把你的调查员迷你卡放入阴影',
      cost: { exhaust: true },
      resolve: ({ inv, api }) => {
        if (!inv?.location) return false
        api.setScenarioFlag(`sanguineShadowAnchor:${inv.seat}`, inv.location)
        api.info?.(`🌑 ${inv.name || '调查员'} 的迷你卡进入阴影（回合开始时回到「${inv.location}」）。`)
        return true
      },
    },
  ],
  note: '近似：锚点已接线（behavior.turnBegins 读取同一个 scenarioFlags 键），但「在阴影中时不在任何地点」与「敌人改为生成在先前地点」需要引擎原语 new.investigatorInShadows，已登记为待实现请求。',
}
