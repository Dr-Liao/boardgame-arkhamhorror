import { ownSeat } from '../../engine/matcher.js'
import { attackableEnemies } from './_shared.js'

export default {
  code: '11066',
  uses: 9,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action', countsAs: 'fight',
      label: '用意志攻击；可使用充能额外揭示标记，所选与忽略同面则成功攻击额外 +2 伤害',
      criteria: [({ helpers }) => !helpers.capabilityBlocked('fight')],
      target: { kind: 'enemy', query: ({ state, inv, entity, helpers }) =>
        !helpers.entityRuleActive(entity, 'cannot:beAttacked') && attackableEnemies(state, inv).includes(entity) },
      resolve: ({ inv, source, targetId, api }) => api.fight(inv.seat, targetId, {
        assetId: source.id, trackAssetSource: true, skill: 'willpower', noSpend: true,
        damageBonusForResult: result => result.ignoredTokens?.includes(result.chosenToken) ? 2 : 0,
      }),
    },
    {
      kind: 'forced', trigger: 'beforeChaosTokenReveal', silent: true,
      label: '可花费至多 3 充能以额外揭示等量标记并选一枚结算',
      limit: { scope: 'perTest', owner: 'instance' },
      criteria: [ownSeat(), ({ state, source }) => state.skillTest?.assetSourceId === source.id],
      resolve: ({ inv, source, api }) => api.spendUsesForExtraChaos(inv.seat, source, 3),
    },
  ],
}
