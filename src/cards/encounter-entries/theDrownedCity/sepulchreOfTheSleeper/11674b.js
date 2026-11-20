// 11674b · enemy · sepulchreOfTheSleeper
//
// 克苏鲁（「城市之下」背面）。猎手/庞大/无情；生成于梦者安息地；被躲避后重整他，或所在地点每位调查员受 1 直接伤害。读点：behavior.spawnCthulhu / enemyStatModifier（被神器削弱时的 -1 战斗/-1 躲避）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11674b',
  scope: 'enemy',
  implemented: true,
  flags: { spawnAt: 'dreamersRest', massive: true, relentless: true, hunter: true, evadeEffect: 'readyOrDamage' },
  enemyRule: { relentless: true },
  note: "克苏鲁（「城市之下」背面）。猎手/庞大/无情（生成与每轮神话阶段开始用 P7 `api.scenario.setEnemyKeywords(enemy,['relentless'],{enabled:true,throughRound:state.round})` 同步，`enemyRule.relentless` 为印刷回退；被神器削弱时覆盖为 `enabled:false` 本轮生效）；生成于梦者安息地（behavior.spawnCthulhu）；被躲避后重整他，或所在地点每位调查员受 1 直接伤害（behavior.afterEvade）；被神器削弱在 behavior.enemyStatModifier。",
}
