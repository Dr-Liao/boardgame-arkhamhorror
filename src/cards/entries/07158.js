import { SKILL_NAMES_ZH } from './_shared.js'
export default { code: '07158', abilities: ['willpower', 'combat'].map(skill => ({
  kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], label: `放置 1 毁灭：本次检定${SKILL_NAMES_ZH[skill]} +2`,
  cost: { doomOnSource: 1 }, limit: { scope: 'perTest', owner: 'player' },
  criteria: ({ state, inv }) => state.skillTest?.seat === inv.seat && [state.skillTest.skill].flat().includes(skill),
  resolve: ({ api }) => api.addTestPendingBonus(2),
})) }
