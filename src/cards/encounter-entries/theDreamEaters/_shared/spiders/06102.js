// 06102 蛛群（Swarm of Spiders，敌人，3 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：spiders（WOC）。
// 卡面：Swarming 2。
//       X 等于本地点的蛛群敌人数量（包括蜂拥卡牌）。
// 实现：Swarming 2 由 TDE card-data 解析、共享层 enemySpawned 自动放蜂拥卡；
//   「躲避值 = X」用声明式修正 enemyEvade（引擎 entityModifierTotal 读点）。
//   基数为印刷占位 -2，修正 = 地点上蛛群数量 + 2（含蜂拥卡），净值为数量。
import { originalOf } from '../../../_shared.js'

const SWARM_CODE = '06102'

function swarmCountAtLocation(state, entity) {
  const locationId = entity?.location
  let count = 0
  for (const other of state.enemies || []) {
    if (other.location !== locationId || originalOf(other) !== SWARM_CODE) continue
    count += 1
    count += Array.isArray(other.swarmCards) ? other.swarmCards.filter(card => !card.defeated).length : 0
  }
  return count
}

export default {
  code: '06102',
  scope: 'enemy',
  implemented: true,
  modifiers: [
    { target: 'enemyEvade', amount: ({ state, entity }) => swarmCountAtLocation(state, entity) + 2 },
  ],
}
