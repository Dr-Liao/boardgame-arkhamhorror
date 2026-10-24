// 05309 秘社打手
// 卡面：生成于裂口最多的地点；如果场上地点都没有裂口，生成在银暮秘社；反击；
// 将其所在地点的印刷文本视为空白（空白效果由章节 behavior 的动作屏蔽近似）。
// 生成位置是数据（enemySpawnRule），behavior.spawnLocation 按 location 类型分派。
export default {
  code: '05309',
  scope: 'enemy',
  implemented: true,
  enemySpawnRule: {
    location: 'mostBreaches',
    fallbackLocationIds: ['silverTwilightMusic', 'silverTwilightSecrets'],
  },
}