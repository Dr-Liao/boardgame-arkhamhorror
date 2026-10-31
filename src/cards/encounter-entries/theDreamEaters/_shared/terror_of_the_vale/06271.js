// 06271 滑行的巨噬蠕虫（Slithering Dhole，敌人，1 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：terror_of_the_vale（PONR）。
// 卡面：Spawn - 最近的带有附属「巨噬蠕虫隧道」的地点。（否则，将滑行的巨噬蠕虫混洗回遭遇
//       牌库，并且其获得涌动。）猎手。庞大。
//       滑行的巨噬蠕虫移动时，所有附属「巨噬蠕虫隧道」的地点视作互相连接。
// 实现：生成规则/spawn 失败的行为写 flags（spawn 数据分派由共享层 spawnLocation 读取；
//   「失败洗回 + 涌动」也是 spawnFailed 数据分派）；「移动时隧道地点互相连接」需要
//   enemyConnections 钩子的数据分派 → 已登记 coordinator request。
export default {
  code: '06271',
  scope: 'enemy',
  implemented: true,
  flags: {
    spawn: { kind: 'nearestLocationWithAttachment', code: '06272' },
    spawnFailed: { shuffleBack: true, surge: true },
    tunnelLocationsConnectedWhileMoving: true,
  },
  simplified: true,
  note: '生成地点/失败涌动已由共享 spawnLocation/spawnFailed 数据分派；「移动时所有隧道地点视作互相连接」需要 enemyConnections 读点（引擎无内容通道）。',
}
