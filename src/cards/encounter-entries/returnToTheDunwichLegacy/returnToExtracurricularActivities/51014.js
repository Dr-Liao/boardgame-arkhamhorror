// 51014 被奴役的保安（重返课外活动）
// 归属：关卡专用 · returnToExtracurricularActivities
// 遭遇组：return_to_extracurricular_activities
// 卡面：猎手。反击。强制 - 攻击你后：弃掉你牌库顶 2 张卡牌。
//       强制 - 被躲避后：其被击败。
// 说明：攻击后弃牌接线；「被躲避后击败」待通用 onEvaded 读点（见 dossier 已知近似）。
export default {
  code: '51014', scope: 'enemy',
  implemented: true,
  enemyScript: {
    onAttackResolved(state, enemy, inv, api) {
      api.discardTop(inv.seat, 2)
    },
  },
}
