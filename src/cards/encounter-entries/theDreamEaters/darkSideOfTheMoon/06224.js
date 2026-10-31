// 06224 剧情支援「维吉尔·格雷」（Virgil Gray · 文思泉涌）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// [reaction] 你的警报等级提高后：抽取 1 张卡牌，获得 1 资源，或治愈维吉尔·格雷的 1 点恐惧。
// 如果游戏中有超过 1 位调查员，将维吉尔·格雷的控制权交给另一位调查员。
// 强制 - 如果维吉尔·格雷离场：将他从游戏中移除。
//
// 依据 Haskell Asset/Cards/...（Truly Inspired，卡池 type=asset，由 act1 背面交给调查员控制）：
//   · 「离场移除」→ 引擎条目字段 removeFromGameOnLeave（已有读点）；
//   · 「警报等级提高后」的反应需要「警报等级提高之后」的全局窗口，引擎尚未提供
//     （artifacts/migration/tde/primitive-catalog.json 的 deferred：window.afterAlarmRaised）；
//     已写 primitive request（w-p8-c-alarm-level-window.json），接线前该反应不触发（记 simplified）。
export default {
  code: '06224',
  scope: 'storyAsset',
  implemented: true,
  removeFromGameOnLeave: true,
  // 反应的数据形状先声明在这里，等 afterAlarmRaised 窗口落地后由 engine/ability 读点接线。
  flags: {
    afterAlarmRaisedReaction: {
      draw: 1,
      resource: 1,
      healHorrorFromSelf: 1,
      passControlIfMultipleInvestigators: true,
    },
  },
  note: 'simplified：反应「警报等级提高后：抽 1 / 得 1 资源 / 治愈自身 1 恐惧，并交给另一位调查员」等待 '
    + 'window.afterAlarmRaised 原语（请求已写 primitive-requests/w-p8-c-alarm-level-window.json）；'
    + '「离场移出游戏」已由 removeFromGameOnLeave 实现。',
}
