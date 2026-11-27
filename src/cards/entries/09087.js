// 09087 爆炸结界（Explosive Ward）· 秘术师事件 · 0 经验。
// 卡面：你打出爆炸结界前，可以从自己的法术槽位弃掉任意数量的卡牌。
//       对一个与你交战的非[[精英]]敌人造成 X 点伤害。X 不能大于你没有支援的法术槽位数量。
//       本行动不会触发趁乱攻击。
//
import { ALL_CARDS } from '../cards-data.js'

const code = '09087'
const arcaneAssets = inv => inv.assets.filter(asset =>
  (ALL_CARDS[asset.code]?.slots || []).some(slot => /^arcane/i.test(String(slot))))

function discardFromArcaneSlots({ inv, context, api }) {
  while (true) {
    const candidates = arcaneAssets(inv).filter(asset => api.investigatorTools.canDiscardAsset(inv.seat, asset))
    if (!candidates.length) break
    const picked = api.choice({
      kind: 'discard', source: code, seat: inv.seat, canSkip: true,
      prompt: '打出爆炸结界前，可以弃掉法术槽位里的支援。',
      options: [{ id: 'done', label: '完成' },
        ...candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))],
    })
    const asset = candidates.find(item => item.id === picked)
    if (!asset || !api.discardAsset(inv.seat, asset)) break
  }
  api.setReactionFlag('maxVariableResourceCost', api.emptyAssetSlots(inv.seat, 'arcane'), context)
}

const engagedNonElite = (state, inv) => state.enemies.filter(enemy =>
  !enemy.defeated && !enemy.elite && (enemy.engagedSeat === inv.seat || inv.engaged.includes(enemy.id)))

export default {
  code,
  chooseResourceCostOnPlay: true,
  variableCostPaidAs: 'paidX',
  playCondition: [{
    when: ({ state, inv }) => engagedNonElite(state, inv).length > 0,
    message: '爆炸结界需要与你交战的非精英敌人',
  }],
  abilities: [
    {
      kind: 'forced', fromHand: true, noPlayCost: true, silent: true,
      trigger: 'beforePlayAttempt',
      label: '打出前可从自己的法术槽位弃置任意数量的支援',
      criteria: [({ inv, context }) => context.seat === inv.seat && context.cardCode === code
        && context.maxVariableResourceCost == null],
      resolve: discardFromArcaneSlots,
    },
    {
      kind: 'played',
      noOpportunityAttack: true,
      label: '对与你交战的非精英敌人造成 X 伤害（X 至多等于空法术槽数量）',
      resolve: ({ state, inv, context, api }) => {
        const damage = Number(context?.variableX || 0)
        if (!damage) return
        const targets = engagedNonElite(state, inv)
        if (!targets.length) return
        const picked = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat, prompt: '选择受到伤害的非精英敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
        })
        const enemy = targets.find(item => item.id === picked)
        if (enemy) api.damageEnemy(enemy, damage, inv.seat, { code })
      },
    },
  ],
  modifiers: [],
}
