// 09127 恐怖异灵（Ectoplasmic Horror）· 基础弱点 · 敌人
// 卡面：[mystic] 调查员专用。
//       猎手。
//       你攻击或尝试躲避恐怖异灵，第一次揭示混乱标记时，你每有一个法术槽位无支援，
//       额外揭示一个混乱标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 敌人型弱点：scope:'enemy'，由 resolveWeakness 的 enemy 分支在本地点生成并交战；
//     关键词来自条目级 enemyWeakness（card-lookup.js#enemyDef）；
//   · 额外揭示：testBegins 窗口（tests.js 在揭示标记前开窗）→ api.addExtraChaosChoices，
//     读点是 state.skillTest.extraChaosChoices（标记揭示段唯一读点）。
// approximation: 「法术槽位无支援」的**容量**没有读点（槽位容量只在 canEquip/slotUsage 内部），
//   近似为「基础 1 个法术槽 - 当前占用法术槽的支援数」，额外法术槽（add:slot）不计。
const code = '09127'

import { ALL_CARDS } from '../../cards/cards-data.js'

const filledArcaneSlots = inv => (inv.assets || []).filter(asset => {
  const card = ALL_CARDS[asset.code]
  return [card?.slot, ...(card?.slots || [])].some(slot => /arcane/i.test(String(slot || '')))
}).length

export default {
  code,
  scope: 'enemy',
  note: 'approximation: 空法术槽按「基础 1 槽 - 占用数」近似（缺容量读点，额外法术槽不计）。',
  enemyWeakness: { hunter: true },
  abilities: [
    {
      kind: 'forced',
      trigger: 'testBegins',
      silent: true,
      label: '攻击/躲避恐怖异灵首次揭示标记时：每个空法术槽额外揭示 1 个标记',
      criteria: [({ state, inv, source }) => {
        const test = state.skillTest
        if (!test || test.seat !== inv.seat) return false
        if (!['fight', 'evade'].includes(test.actionKind)) return false
        return Boolean(source) && test.target?.kind === 'enemy' && test.target.id === source.id
      }],
      resolve: ({ inv, api }) => {
        const empty = Math.max(0, 1 - filledArcaneSlots(inv))
        if (!empty) return
        api.addExtraChaosChoices(empty)
        api.info(`👻 「恐怖异灵」：${inv.name} 有 ${empty} 个空法术槽，额外揭示 ${empty} 个混乱标记。`)
      },
    },
  ],
  modifiers: [],
}
