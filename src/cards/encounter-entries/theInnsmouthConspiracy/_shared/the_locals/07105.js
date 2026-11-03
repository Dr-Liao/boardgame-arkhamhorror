// 07105 印斯茅斯闹事者 · 当地人（the_locals，第二章/第三章共用遭遇组）
//
// 印刷（中文）：
//   生成 - 线索最多的地点。
//   猎手。
//   [action] 将你的 1 个线索放到你所在地点：谈判。横置印斯茅斯闹事者。其在下一个
//   补给阶段期间不重整。本能力可以由连接地点的调查员触发。
//
// 引擎读点：
//   · 谈判能力挂在敌人实体上：scope 'enemy' + kind 'action' + actionKind 'parley'
//     （非玩家卡的 action 必须带 actionKind，注册期强制）。legalMoves 由
//     parley.js#parleyMovesFor 枚举，执行走 ability-exec.js#doEntityAbility，与其它
//     实体行动共用费用/日志/目标管线；'parley' 视作谈判，不引发借机攻击。
//   · range:'connecting' 对应「本能力可以由连接地点的调查员触发」
//     （parley.js#entityAbilityInRange）；默认 range 只允许同地点。
//   · cost.clues 扣行动者的线索；「放到你所在地点」用 api.returnClueToLocation
//     把线索放回行动者所在地点（同一原语见 04154「一目十行」）。
//   · 横置走 api.scenario.exhaustEnemy；「下一个补给阶段不重整」走
//     api.scenario.preventEnemyReadyNextUpkeep，读点是 phases.js 的 skipNextUpkeepReady。
//   · 猎手是印刷关键词，由 cards-data 的 hunter 字段随敌人生成自动写入实例，条目无需声明。
//
// 未实现（见 artifacts/migration/tic/p7/primitive-requests/）：
//   · 「生成 - 线索最多的地点」没有引擎读点：现有数据只支持 def.spawn /
//     enemyRule.revelationSpawn（指定卡号或最远）/ spawnAnyEmpty / spawnChoices。
//     需要 enemySpawnRule 的「线索最多的地点」规则（request-id:
//     p7-a1-07105-spawn-most-clues）；在落地前本卡会按引擎默认生成规则出现在抽牌者处
//     并与其交战，与印刷不同。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

export default {
  code: '07105', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'parley', range: 'connecting',
    label: '将你的1个线索放到你所在地点：谈判，横置印斯茅斯闹事者并不在下次补给阶段重整',
    cost: { clues: 1 },
    resolve: ({ inv, source, api }) => {
      // 「放到你所在地点」是效果而非退费：先由 cost.clues 从调查员身上扣，再放回地点。
      api.returnClueToLocation(inv.seat, 1)
      api.scenario.exhaustEnemy(source)
      api.scenario.preventEnemyReadyNextUpkeep(source)
    },
  }],
}
