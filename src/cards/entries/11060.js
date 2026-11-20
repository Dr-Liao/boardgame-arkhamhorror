import { attackableEnemies } from './_shared.js'
import { ownSeat } from '../../engine/matcher.js'
import { enemyIsBody } from '../../engine/enemy-parts.js'

const code = '11060'

export default {
  code, limitPerInvestigator: true, sealOnEnter: '0',
  abilities: [
    {
      kind: 'reaction', trigger: ['locationPlaced', 'locationRevealed'], label: '再次封印一个 0 标记',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [ownSeat(), ({ state }) => state.chaosBag.includes('0')],
      resolve: ({ source, api }) => api.chaosTokens.seal(source.id, '0', 1),
    },
    {
      kind: 'reaction', trigger: 'enemyEngaged', label: '横置并释放一个封印：用地点帷幕作为基础技能值攻击或躲避',
      cost: { exhaust: true },
      criteria: [ownSeat(), ({ state, inv, source, context }) =>
        context.enemy?.engagedSeat === inv.seat && context.enemy.location === inv.location
          && !enemyIsBody(context.enemy)
          && (state.chaos?.sealed || []).some(item => item.source === source?.id && item.token === '0')],
      resolve: ({ state, inv, source, context, api }) => {
        const enemy = context.enemy
        const options = []
        if (!api.capabilityBlocked(inv.seat, 'evade')) options.push({ id: 'evade', label: '躲避' })
        if (!api.capabilityBlocked(inv.seat, 'fight') && attackableEnemies(state, inv).includes(enemy)) {
          options.push({ id: 'fight', label: '攻击' })
        }
        if (!options.length) return
        const mode = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: code, seat: inv.seat, prompt: '选择攻击或躲避这个敌人。',
          options,
        })
        if (!options.some(item => item.id === mode) || api.chaosTokens.release(source.id, '0', 1) !== 1) return
        const baseValue = api.locationShroud(inv.location, inv.seat)
        const opts = { baseValue, assetId: source.id, sourceCode: code, trackAssetSource: true }
        if (mode === 'fight') api.fight(inv.seat, enemy.id, { ...opts, noSpend: true })
        else api.evade(inv.seat, { ...opts, enemyId: enemy.id })
      },
    },
  ],
}
