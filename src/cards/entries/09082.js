// 09082 仪式镰刀（Ceremonial Sickle）· 秘术师支援 · 0 经验。
// 卡面：[action] 攻击。本次攻击使用你的[willpower]，或得到 +1[combat]。在你发动此能力时，选择一项——
//       - 横置仪式镰刀并在上面放置 1 个毁灭标记，以使本次攻击得到 +1 技能值并造成 +1 伤害。
//       - 如果本次攻击击败了敌人，移除仪式镰刀的 1 个毁灭标记。
//
// 读点：真实攻击检定 api.fight（skill 覆盖 / combatBonus / damageBonus / noSpend）；
//       毁灭由 api.placeDoomOnCard / api.removeDoomFromCard 唯一写点；击败判定读 state.enemies。
const chooseSkill = (state, inv, api) => api.choice({
  kind: 'effect', source: '09082', seat: inv.seat,
  prompt: '选择本次攻击使用的技能。',
  options: [
    { id: 'willpower', label: '使用意志' },
    { id: 'combat', label: '使用战斗并获得 +1 战斗' },
  ],
}) === 'willpower' ? { skill: 'willpower', combatBonus: 0 } : { skill: 'combat', combatBonus: 1 }

export default {
  code: '09082',
  abilities: [
    {
      kind: 'action',
      label: '攻击：使用意志或 +1 战斗；可选择横置放毁灭换取 +1 技能值 +1 伤害',
      cost: { action: true },
      countsAs: 'fight',
      target: { kind: 'enemy' },
      resolve: ({ state, inv, source, target, api }) => {
        const enemy = target?.entity
        if (!source || !enemy) return
        const base = chooseSkill(state, inv, api)
        const mode = api.choice({
          kind: 'effect', source: '09082', seat: inv.seat,
          prompt: '在你发动此能力时选择一项。',
          options: [
            { id: 'doom', label: '横置并放置 1 个毁灭：本次攻击 +1 技能值且 +1 伤害' },
            { id: 'defeat', label: '若本次攻击击败敌人，移除 1 个毁灭' },
          ],
        })
        let combatBonus = base.combatBonus
        let damageBonus = 0
        if (mode === 'doom' && !source.exhausted) {
          api.exhaust(source)
          api.placeDoomOnCard(source, 1)
          combatBonus += 1
          damageBonus += 1
        }
        const result = api.fight(inv.seat, enemy.id, {
          skill: base.skill,
          combatBonus,
          damageBonus,
          noSpend: true,
        })
        const defeated = !state.enemies.includes(enemy)
        if (defeated && mode === 'defeat' && (source.doom || 0) > 0) {
          api.removeDoomFromCard(source, 1)
          api.info('🌑 「仪式镰刀」：攻击击败敌人，移除 1 个毁灭标记。')
        }
        void result
      },
    },
  ],
  modifiers: [],
}
