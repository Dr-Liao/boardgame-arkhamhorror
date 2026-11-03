import { SKILL_NAMES_ZH } from './_shared.js'
export default { code: '07159', abilities: [{ kind: 'action', label: '横置：攻击；可加毁灭提高技能与伤害', countsAs: 'fight',
  cost: { action: true, exhaust: true }, target: { kind: 'enemy' }, resolve: ({ inv, source, target, api }) => {
    if ((source.doom || 0) < 3 && api.choice({ kind: 'effect', source: '07159', seat: inv.seat,
      prompt: '是否在深渊魔典上放置 1 个毁灭（最多 3）？', options: [{ id: 'yes', label: '放置 1 毁灭' }, { id: 'no', label: '不放置' }] }) === 'yes') api.placeDoomOnCard(source, 1)
    const skill = api.choice({ kind: 'effect', source: '07159', seat: inv.seat, prompt: '选择本次攻击使用的技能。',
      options: ['combat', 'intellect', 'willpower'].map(id => ({ id, label: SKILL_NAMES_ZH[id] })) })
    api.fight(inv.seat, target.id, { assetId: source.id, skill, conditionalBonus: { sourceDoom: true } })
  },
}] }
