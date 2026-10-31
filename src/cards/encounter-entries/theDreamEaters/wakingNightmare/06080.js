// 06080 席瓦妮·马斯沃伦医生（Dr. Shivani Maheswaran）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 剧情支援（type=asset，由 lead 控制；若战役日志记录她加入调查）。
// 卡面：[fast] 横置席瓦妮·马斯沃伦医生：自动躲避一个与你交战的「可疑的护工」。
//   [reaction] 当一位调查员在滋生标记上揭示 [skull] 或 [cultist] 符号时，把席瓦妮·马斯沃伦医生
//   移出游戏：取消该标记并将其放回滋生袋。
// 读点（Lead 口径 3）：storyAsset scope + flags。第一条由章节 behavior.fastActions 读
//   entryFlags('06080').fastAutoEvadeOrderly（受控支援 → 任意玩家窗口提供 [fast] 行动），
//   behavior.performAction 调 api.evadeEnemy；第二条由 behavior.infestationTest 读
//   entryFlags('06080').cancelInfestationToken（揭示前询问持有者并移出游戏）。
export default {
  code: '06080',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    fastAutoEvadeOrderly: { nameEn: 'Suspicious Orderly', trait: 'Staff' },
    cancelInfestationToken: ['skull', 'cultist'],
  },
}
