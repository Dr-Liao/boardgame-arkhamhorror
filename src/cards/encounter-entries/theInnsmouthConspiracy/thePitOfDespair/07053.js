import { keysAt } from '../../_shared.js'
const keyNames = { red: '红色', yellow: '黄色', green: '绿色', blue: '蓝色', purple: '紫色', white: '白色', black: '黑色' }

export default {
  code: '07053', scope: 'enemy', implemented: true,
  abilities: [
    {
      kind: 'reaction', trigger: 'evadeSuccess', label: '躲避成功至少2点：取得其1把钥匙',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: ({ state, inv, source, context }) => state.enemies.includes(source) && context.enemy?.id === source.id
        && context.seat === inv.seat && context.successBy >= 2 && keysAt(state, `enemy:${source.id}`).length > 0,
      resolve: ({ inv, source, api }) => {
        const keys = api.keys.at(`enemy:${source.id}`, { reveal: true })
        if (!keys.length) return
        const color = keys.length === 1 ? keys[0] : api.choice({ kind: 'effect', seat: inv.seat,
          source: '07053', prompt: '选择取得的钥匙。', options: keys.map(color => ({ id: color, label: keyNames[color] })) })
        api.keys.transfer(color, `enemy:${source.id}`, `investigator:${inv.seat}`, { reveal: true })
      },
    },
    {
      kind: 'forced', trigger: 'enemyEngaged', label: '交战后：交出1把钥匙，或受到立即攻击',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: ({ state, inv, source, context }) => context.enemy?.id === source.id
        && context.seat === inv.seat && keysAt(state, `investigator:${inv.seat}`).length > 0,
      resolve: ({ inv, source, api }) => {
        const keys = api.keys.at(`investigator:${inv.seat}`, { reveal: true })
        const answer = api.choice({ kind: 'effect', seat: inv.seat, source: '07053',
          prompt: '将你的1把钥匙放到敌人上，或令其立即攻击你。',
          options: [...keys.map(color => ({ id: `key:${color}`, label: `交出${keyNames[color]}钥匙` })), { id: 'attack', label: '令其攻击你' }] })
        if (answer === 'attack') api.scenario.attack(source, inv)
        else api.keys.transfer(answer.slice(4), `investigator:${inv.seat}`, `enemy:${source.id}`, { reveal: true })
      },
    },
    {
      kind: 'forced', trigger: 'enemyDefeated', label: '被击败时：将同一实体放入深处',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: ({ source, context }) => context.accepted === true && context.enemy?.id === source.id,
      resolve: ({ source, context, api }) => api.enemyOutcomes.destination(context,
        { kind: 'enemyZone', id: 'depths', clearTokens: true, ready: true }, { sourceId: source.id }),
    },
  ],
}
