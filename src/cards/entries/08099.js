// 08099 吉恩·波尔格
// 卡面：你得到+1[intellect]和+1[agility]。
//       [reaction]在你回合期间，你移动到一个地点后，横置吉恩·波尔格：将1个线索或一个非[[精英]]敌人
//       从一个连接地点移动到你的地点，或从你的地点移动到一个连接地点。
//
// 读点：move 窗口（移动后反应）；线索 api.moveClueToLocation(fromId,toId,count)；
// 敌人 api.moveEnemy(enemy, locationId)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08099',
  abilities: [
    { kind: 'reaction', trigger: 'move', label: '移动后横置：在连接地点之间搬运 1 线索或 1 非精英敌人',
      cost: { exhaust: true },
      criteria: ({ inv, context }) => context?.seat === inv.seat && state_has_connection(inv, context),
      resolve: ({ inv, state, source, api }) => {
        if (!source) return
        const here = state.locations.find(location => location.id === inv.location)
        const connected = (here?.connections || []).map(id => state.locations.find(location => location.id === id))
          .filter(Boolean)
        const options = []
        for (const location of connected) {
          if ((location.clues || 0) > 0) options.push({ id: `clueIn:${location.id}`, label: `把「${location.name}」的 1 个线索拿到这里` })
        }
        if ((here?.clues || 0) > 0) {
          for (const location of connected) options.push({ id: `clueOut:${location.id}`, label: `把这里的 1 个线索移到「${location.name}」` })
        }
        for (const enemy of state.enemies) {
          if (enemy.defeated || enemy.elite) continue
          if (connected.some(location => location.id === enemy.location)) {
            options.push({ id: `enemyIn:${enemy.id}`, label: `把「${enemy.name}」移到你的地点` })
          }
          if (enemy.location === inv.location) {
            options.push({ id: `enemyOut:${enemy.id}`, label: `把「${enemy.name}」移到一个连接地点` })
          }
        }
        if (!options.length) return
        const picked = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: '08099', seat: inv.seat,
          prompt: '选择要搬运的线索或敌人。', options })
        const [mode, id] = String(picked).split(':')
        if (mode === 'clueIn') api.moveClueToLocation(id, inv.location, 1)
        else if (mode === 'clueOut') api.moveClueToLocation(inv.location, id, 1)
        else if (mode === 'enemyIn') api.moveEnemy(state.enemies.find(enemy => enemy.id === id), inv.location)
        else if (mode === 'enemyOut') {
          const enemy = state.enemies.find(item => item.id === id)
          const destination = api.choice({ kind: 'location', source: '08099', seat: inv.seat,
            prompt: '选择该敌人的目的地。', options: connected.map(location => ({ id: location.id, label: location.name })) })
          api.moveEnemy(enemy, destination)
        }
      } },
  ],
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
    { target: 'skill:agility', amount: 1 },
  ],
}

// 移动后窗口上下文只带 seat/location；只要本卡控制者仍在场内即可尝试搬运。
function state_has_connection(inv) {
  return Boolean(inv) && !inv.defeated && !inv.resigned
}
