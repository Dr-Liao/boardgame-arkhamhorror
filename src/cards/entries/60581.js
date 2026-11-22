// 60581 简易炸弹 · 事件（3 费，3 经验，敏捷/战斗/万用图标，陷阱）
// 卡面：附属到你所在地点。每个地点仅限附属 1 张[[陷阱]]。
//       [reaction]一个敌人或一位调查员进入所附属的地点后，弃掉本卡：
//       对该地点的每个敌人和每位调查员各造成 3 点伤害。
const CODE = '60581'

export default {
  code: CODE,
  keepOnPlay: true,
  assetRule: { ownerLocationAttachmentAbility: true },
  abilities: [
    {
      kind: 'played',
      label: '附属到你所在地点',
      resolve: ({ inv, api }) => api.attachToLocation(inv.location, { code: CODE, ownerSeat: inv.seat }),
    },
    {
      kind: 'reaction',
      trigger: 'entersAttachedLocation',
      label: '弃掉简易炸弹：对本地点每个敌人和每位调查员各造成 3 点伤害',
      cost: { discardSelf: true },
      criteria: [({ source, context }) => Boolean(context) && context.location === source?.location],
      resolve: ({ state, source, api }) => {
        const locationId = source?.location
        if (!locationId) return
        for (const enemy of (state.enemies || []).filter(item => item.location === locationId)) {
          api.damageEnemy(enemy, 3, source?.ownerSeat ?? state.currentSeat)
        }
        for (const inv of state.investigators.filter(item =>
          !item.defeated && !item.resigned && item.location === locationId)) {
          api.damage(inv.seat, 3)
        }
        api.info('简易炸弹：对本地点每个敌人和每位调查员各造成 3 点伤害。')
      },
    },
  ],
  modifiers: [],
  note: '「敌人或调查员进入地点」已接 entersAttachedLocation 窗口（敌人生成/移动与调查员移动进入均触发）。',
}
