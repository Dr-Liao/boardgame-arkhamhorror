import { skillModifier } from './_shared.js'
export default { code: '07265', modifiers: ['willpower', 'intellect', 'combat', 'agility'].map(skill => skillModifier(skill, 1)), abilities: [
  { kind: 'forced', trigger: 'assetEnteredPlay', label: '承诺自己回合不抽牌、不打牌或不投入牌',
    criteria: ({ source, context }) => context.assetId === source.id,
    resolve: ({ inv, source, api }) => {
      const event = api.choice({ kind: 'effect', source: '07265', seat: inv.seat, prompt: '选择此禁誓在自己每个回合中的承诺。',
        options: [{ id: 'draw', label: '不抽取卡牌' }, { id: 'play', label: '不打出卡牌' }, { id: 'commit', label: '不投入卡牌' }] })
      api.promise(inv.seat, source.id, event)
    } },
  { kind: 'forced', trigger: 'promiseBroken', label: '违约：弃掉禁誓并添加 10 诅咒',
    criteria: ({ source, context }) => context.sourceId === source.id,
    resolve: ({ inv, source, api }) => { api.discardAsset(inv.seat, source); api.chaosTokens.add('curse', 10) } },
] }
