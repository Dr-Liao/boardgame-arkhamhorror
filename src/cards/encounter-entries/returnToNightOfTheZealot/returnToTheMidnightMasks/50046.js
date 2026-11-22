// 50046 阿尔玛·希尔（Alma Hill）· 敌人 · return_cult
// 卡面：生成 - 南区。[action]：谈判。抽取遭遇牌库顶 3 张卡牌。然后，将阿尔玛·希尔加入胜利区。
// 读点：engine/parley.js#parleyMovesFor → 实体 abilities 的 actionKind:'parley' 描述子。
// 近似：印刷「抽取遭遇牌库顶 3 张」不逐张结算（避免在谈判中插入 3 次遭遇结算），
//   改为弃掉遭遇牌库顶 3 张进入遭遇弃牌堆；见 dossier 已知近似。
export default {
  code: '50046',
  scope: 'enemy',
  implemented: true,
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：抽取遭遇牌库顶 3 张，然后将阿尔玛·希尔加入胜利区',
    cost: { action: 1 },
    resolve: ({ inv, source, api }) => {
      const discarded = typeof api.scenario.discardEncounterTop === 'function'
        ? api.scenario.discardEncounterTop(3)
        : []
      const drawn = Array.isArray(discarded) ? discarded : []
      api.info(`🤝 ${inv.name} 与阿尔玛·希尔谈判：抽取遭遇牌库顶 ${drawn.length} 张卡牌。`)
      const inPlay = (api.state?.enemies || []).some(enemy => enemy.id === source?.id)
        || (api.scenario?.state?.enemies || []).some(enemy => enemy.id === source?.id)
      if (inPlay) api.scenario.addEnemyToVictory(source)
      api.info('阿尔玛·希尔加入胜利区。')
    },
  }],
}
