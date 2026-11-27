// 09557b 红衣女郎（La Chica Roja · Your Watchful Shadow）· 剧情支援面
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   [reaction] 在你回合结束时，横置红衣女郎：将你的调查员迷你卡放入阴影中。你在阴影中时，
//   你不在任何地点。将要生成与你交战的敌人，改为生成在你先前的地点。当你回合开始时，将你移动回
//   你的先前地点（如果不能，则移动到任意已揭示地点）。
export default {
  code: '09557b',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnEnded',
      label: '横置红衣女郎：把你的调查员迷你卡放入阴影',
      cost: { exhaust: true },
      criteria: ({ inv, context }) => inv.location && context.seat === inv.seat,
      resolve: ({ inv, api }) => api.tsk.investigatorShadows.enter(inv.seat),
    },
  ],
}
