// 02329 星际旅行者
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：生成 - 任意[[异次元]]地点。
// 卡面：猎手。
// 卡面：强制 - 在星际旅行者进入一个地点时：将该地点的1个线索标记翻至毁灭面，并放在星际旅行者上；如果该地点没有线索，则在星际旅行者上放置1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { starlightTravelerEnters } from '../../_shared.js'

export default {
  code: '02329', scope: 'enemy', enemySpawnRule: { spawnMode: 'extradimensional' },
  enemyScript: {
    onSpawn(state, enemy) { starlightTravelerEnters(state, enemy) },
    onMove(state, enemy) { starlightTravelerEnters(state, enemy) },
  },
}
