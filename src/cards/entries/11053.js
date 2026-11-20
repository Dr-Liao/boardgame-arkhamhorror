const code = '11053'

export default {
  code,
  playCondition: [({ state }) => !state.scenario?.mechanics?.noEncounterDeck
    && (state.encounterDeck.length + state.encounterDiscard.length > 0)],
  abilities: [
    {
      kind: 'played', countsAs: 'parley',
      label: '谈判：在遭遇牌库和弃牌堆查找非精英敌人，横置并与你交战生成，抽取等于其伤害与恐惧总和的卡牌',
      resolve: ({ inv, api }) => {
        api.searchAndSpawnEnemy(inv.seat, {
          nonElite: true, exhausted: true, engage: true, source: code,
          onSpawn: enemy => {
            const amount = (enemy.damage || 0) + (enemy.horror || 0)
            if (amount > 0) api.drawCards(inv.seat, amount)
          },
        })
      },
    },
  ],
}
