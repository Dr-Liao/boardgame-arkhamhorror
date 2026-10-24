// 05346 · 敌人 05346 阿撒托斯：不在任何地点、免疫、不能击败；毁灭/攻击用 scenarioFlags.azathothDoom + 3/3 近似
// （behavior.addAzathothDoom/azathothAttack）。它从不入遭遇牌库/放一边，且 behavior.spawnLocation 对其直接判
// 生成失败（内容侧兜底）；定义上的 cannotBeDefeated/immuneToPlayerCards/omnipotent 目前没有引擎读点，
// 已登记 primitive request（engine-omnipotent-immunity）。
export default {
  code: '05346',
  scope: 'enemy',
  implemented: true,
}
