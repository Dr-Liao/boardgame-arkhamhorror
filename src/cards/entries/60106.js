import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60106',
  uses: 4,
  usesType: 'charges',
  abilities: [{
    kind: 'reaction', trigger: 'harmDealt', label: '花费 1 充能，取消这次攻击的 1 点伤害或恐惧',
    cost: { exhaust: true, uses: 1 },
    criteria: [ownSeat(), ({ context }) => Boolean(context.attack?.enemy)
      && (context.damage > 0 || context.horror > 0)],
    resolve: ({ inv, context, api }) => api.cancelHarm(inv.seat, { context, maximum: 1, source: '60106' }),
  }],
}
