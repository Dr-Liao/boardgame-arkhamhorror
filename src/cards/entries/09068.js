// 09068 直捣蜂窝（Kicking the Hornet's Nest）· 游荡者（Rogue）事件 · 0 经验 · 策略 · 战术。
//
// 卡面：查找遭遇牌库顶 9 张卡牌，找出一个非[[精英]]敌人，并将其生成（不按通常生成地点，改为与
//       你交战）。然后，发现你所在地点的 1 个线索并获得 X 资源，其中 X 为该敌人的生命值。
//       混洗遭遇牌库。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 遭遇牌库顶 9 张里的敌人 → api.encounterEnemies(9)（encounterDeck 末位是牌库顶）。
//   · 生成并交战 + 洗回遭遇牌库 → api.spawnEncounterEnemy(seat, code)（spawnEnemy + engageEnemy + shuffle）。
//   · 发现线索 → api.discoverClue；获得资源 → api.gainResources；X = 生成后的敌人生命值（实例字段只读）。
// approximation: cards-data 没有精英标志（精英信息在关卡数据里），因此「非[[精英]]」在生成后按
//   实例的 elite 复核并在日志里说明，见 primitive-requests/09068.json。
const CODE = '09068'

export default {
  code: CODE,
  simplified: true,
  note: 'approximation: cards-data 没有[[精英]]标志，查找阶段不过滤精英；生成后按实例 elite 复核并写日志（primitive-requests/09068.json）。',
  abilities: [
    {
      kind: 'played',
      label: '查找遭遇牌库顶 9 张中的非[[精英]]敌人，与其交战；发现 1 个线索并获得等于其生命值的资源',
      resolve: ({ inv, api }) => {
        const candidates = api.encounterEnemies(9)
          .filter(code => api.cardType(code) === 'enemy')
        if (!candidates.length) {
          api.info('「直捣蜂窝」：遭遇牌库顶 9 张里没有敌人。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '「直捣蜂窝」：选择要生成的敌人。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const spawned = api.spawnEncounterEnemy(inv.seat, picked)
        if (!spawned) {
          api.info(`「直捣蜂窝」：「${api.cardName(picked)}」没有生成。`)
          return
        }
        if (spawned.elite === true) api.info('「直捣蜂窝」：注意，这张敌人是[[精英]]（数据层未提供精英标志，按实例复核）。')
        api.info(`🐝 「直捣蜂窝」：「${api.cardName(picked)}」与你交战。`)
        const clue = api.discoverClue(inv.seat, 1)
        const health = Math.max(0, Number(spawned.health) || 0)
        api.gainResources(inv.seat, health)
        api.info(`🐝 「直捣蜂窝」：发现 ${clue} 个线索，获得 ${health} 资源（等于该敌人的生命值）。`)
      },
    },
  ],
  modifiers: [],
}
