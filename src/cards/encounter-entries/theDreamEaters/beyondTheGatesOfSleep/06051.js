// 06051 魔幻森林·祖格鼠村落（Enchanted Woods · Village of Zoogs）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：强制 - 带蜂拥 X 的[[祖格鼠]]敌人生成本地点后：为它额外加 1 张蜂拥卡。
// 读点：条目只声明数据 flag；章节 behavior.enemySpawned 在共享层放置完基础蜂拥卡后，
//   查 entryFlags('06051').addSwarmOnZoogSpawn 与生成敌人特性/地点，再调 api.swarm.place(enemy, 1)。
export default {
  code: '06051',
  scope: 'location',
  implemented: true,
  flags: {
    addSwarmOnZoogSpawn: true,
  },
}
