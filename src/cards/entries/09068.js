// 09068 直捣蜂窝（Kicking the Hornet's Nest）· 游荡者（Rogue）事件 · 0 经验 · 策略 · 战术。
//
// 卡面：查找遭遇牌库顶 9 张卡牌，找出一个非[[精英]]敌人，并将其生成（不按通常生成地点，改为与
//       你交战）。然后，发现你所在地点的 1 个线索并获得 X 资源，其中 X 为该敌人的生命值。
//       混洗遭遇牌库。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
const CODE = '09068'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      label: '查找遭遇牌库顶 9 张中的非[[精英]]敌人，与其交战；发现 1 个线索并获得等于其生命值的资源',
      resolve: ({ inv, api }) => {
        const candidates = [...new Set(api.encounterEnemies(9, { nonElite: true }))]
        if (!candidates.length) {
          api.shuffleEncounterDeck()
          api.info('「直捣蜂窝」：遭遇牌库顶 9 张里没有非精英敌人。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '「直捣蜂窝」：选择要生成的敌人。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const spawned = api.spawnEncounterEnemy(inv.seat, picked, { ignoreSpawn: true })
        if (!spawned) {
          api.info(`「直捣蜂窝」：「${api.cardName(picked)}」没有生成。`)
          return
        }
        api.info(`🐝 「直捣蜂窝」：「${api.cardName(picked)}」与你交战。`)
        const clue = api.discoverClue(inv.seat, 1)
        const health = Math.max(0, Number(api.enemyHealth(spawned)) || 0)
        api.gainResources(inv.seat, health)
        api.info(`🐝 「直捣蜂窝」：发现 ${clue} 个线索，获得 ${health} 资源（等于该敌人的生命值）。`)
      },
    },
  ],
  modifiers: [],
}
