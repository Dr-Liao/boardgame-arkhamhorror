// 06084 灰织蛛（Grey Weaver，敌人，2 张）
// 归属：战役共用 · theDreamEaters/_shared（12 个跨章遭遇组之一）。遭遇组：agents_of_atlach_nacha。
// 出现章节：PONR / WOC（gatherRefs）。
// 卡面：猎物 - [agility] 最低。猎手。
//       灰织蛛处于重整状态时，位于其地点的每位调查员不能进行移动行动。
// 实现：prey 用条目规则覆盖（card-ops PREY_RANK 的 lowestAgility key；印刷文本解析不出 key）；
//   「重整时封锁同地点调查员的移动」缺全共享层读点：TDE encounter-rules 没有 moveError 分派。
//   已写 flags.moveBlockWhileReady + 协调请求（w-p8-f-shared-hooks.json），待主进程接线。
export default {
  code: '06084',
  scope: 'enemy',
  implemented: true,
  enemyRule: { prey: 'lowestAgility' },
  // 共享 encounterRules.moveError 读 entryFlags.moveBlockWhileReady（重整时封锁同地点调查员移动）。
  flags: { moveBlockWhileReady: true },
}
