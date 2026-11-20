import { enemiesAt } from '../../engine/matcher.js'

export default {
  code: '11036',
  uses: 4,
  usesType: 'supplies',
  abilities: [{
    kind: 'action', countsAs: 'investigate',
    label: '花费 1 补给：用智力或敏捷调查，技能值 +1；成功且此处有横置敌人则治愈 1 恐惧',
    cost: { uses: 1 },
    criteria: [({ helpers }) => !helpers.capabilityBlocked('investigate')],
    resolve: ({ inv, source, api }) => {
      const skill = api.choice({
        kind: 'effect', source: '11036', seat: inv.seat, prompt: '选择这次调查使用的技能。',
        options: [{ id: 'intellect', label: '智力' }, { id: 'agility', label: '敏捷' }],
      })
      api.investigate(inv.seat, {
        assetId: source.id, trackAssetSource: true, skill, bonus: 1,
        onInvestigateSuccess: (_result, { state }) => {
          if (enemiesAt(state, inv.location).some(enemy => enemy.exhausted && !enemy.defeated)) api.healHorror(inv.seat, 1)
        },
      })
    },
  }],
}
