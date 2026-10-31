// 06150 黑暗夜魇（theSearchForKadath）· 敌人（怪物 / 夜魇，猎手，印刷 2 张）
// 卡面：猎手。
// 卡面：强制 - 在黑暗夜魇因某张幕的设置而离场时：将其放在一边（它保留其上的所有标记与附属）。
//       结算该幕的设置后，将它放回场上任意一个[[城市]]地点。
//
// 一卡一文件：规则数据在这里声明；章节 behavior 的区域设置流程读取并接线。
// 简化：重新入场时保留伤害/毁灭标记；附属（地点附属与敌人附属）在离场时随引擎清理，不保留
// （见报告 simplified）。
export default {
  code: '06150', scope: 'enemy', implemented: true,
  enemyRule: { setAsideDuringActSetup: true },
}
