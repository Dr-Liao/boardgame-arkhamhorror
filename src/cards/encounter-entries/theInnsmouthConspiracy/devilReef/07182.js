import { keysAt } from '../../_shared.js'

export default {
  code: '07182',
  scope: 'enemy',
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged',
    label: '深潜者掠食者交战后：将1个线索或1把钥匙移到它身上',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, inv, source, context }) => source.id === context.enemy?.id
      && inv.seat === context.seat
      && ((inv.clues || 0) > 0 || keysAt(state, `investigator:${inv.seat}`, { reveal: true }).length > 0),
    resolve: ({ inv, source, api }) => {
      const from = `investigator:${inv.seat}`
      const colors = api.keys.at(from, { reveal: true })
      const names = { red: '红色', yellow: '黄色', green: '绿色', blue: '蓝色', purple: '紫色', white: '白色', black: '黑色' }
      const options = colors.map(color => ({ id: color, label: `移动${names[color]}钥匙` }))
      if ((inv.clues || 0) > 0) options.push({ id: 'clue', label: '移动1个线索' })
      if (!options.length) return
      const choice = options.length === 1 ? options[0].id : api.choice({
        kind: 'effect', source: source.id, seat: inv.seat,
        prompt: '选择将你的1个线索或1把钥匙移到深潜者掠食者身上。', options,
      })
      if (choice === 'clue') api.scenario.moveClueToEnemy(source, { from: 'investigator', seat: inv.seat })
      else if (colors.includes(choice)) api.keys.transfer(choice, from, `enemy:${source.id}`, { reveal: true })
    },
  }, {
    kind: 'forced', trigger: ['enemyDefeated', 'evadeSuccess'],
    label: '击败或躲避深潜者掠食者时：获得它身上所有钥匙和线索',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, inv, source, context }) => source.id === context.enemy?.id
      && inv.seat === context.seat
      && ((source.clues || 0) > 0 || (state.enemies.some(enemy => enemy.id === source.id)
        && keysAt(state, `enemy:${source.id}`, { reveal: true }).length > 0)),
    resolve: ({ inv, source, api }) => {
      const clues = api.scenario.clearCluesOnEnemy(source)
      if (clues > 0) api.scenario.gainClues(inv.seat, clues)
      // Defeat may already have released keys before this window; onExit is
      // deliberately safe for that removed physical enemy and then does nothing.
      api.keys.onExit(`enemy:${source.id}`, source.location, inv.seat)
    },
  }],
}
