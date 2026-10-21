// 04151 准备万全
// 卡面：[free]横置准备万全：选择你控制的一张支援卡牌。你本次技能检定得到+X技能值，X为所选支援上对应的技能图标数量。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04151 有备无患：横置，按所选支援的匹配图标给本次检定加值（旧 wellPrepared）。

import { SKILL_NAMES_ZH } from './_shared.js'

export default {
  code: '04151',
  abilities: [
    {
      kind: 'free', label: '横置：本次检定按所选支援的匹配图标加值',
      cost: { action: false, exhaust: true }, duringOwnSkillTest: true,
      resolve: ({ state, inv, api }) => {
        const skill = state.skillTest?.skill
        if (!skill) { api.info('只能在技能检定期间使用。'); return }
        const candidates = inv.assets.filter(card => card.code !== '04151' && Number(api.cardIcons(card.code)[skill] || 0) > 0)
        if (!candidates.length) { api.info('没有提供匹配图标的支援。'); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '04151', seat: inv.seat,
            prompt: `选择要参考${SKILL_NAMES_ZH[skill]}图标的支援。`,
            options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const card = candidates.find(item => item.id === chosen) || candidates[0]
        const icons = Number(api.cardIcons(card.code)[skill] || 0)
        api.addPendingTestBonus(icons)
        api.info(`「${api.cardName('04151')}」：${api.cardName(card.code)} 提供 ${icons} 点${SKILL_NAMES_ZH[skill]}加值。`)
      },
    },
  ],
  modifiers: [

  ],
}
