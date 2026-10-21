// 03191 逻辑推理
// 卡面：仅当你至少拥有1个线索才可打出。
// 卡面：选择你所在地点的一位调查员。该调查员治愈2点恐惧或弃掉其威胁区域中的一张[[恐怖]]卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03191 逻辑推理：治疗同地点调查员 2 点恐惧，或弃掉其威胁区的 1 张恐怖卡。

import { investigatorClues } from '../../engine/matcher.js'

export default {
  code: '03191',
  playCondition: [{ when: investigatorClues(1), message: '需要至少 1 个线索才能打出' }],
  abilities: [
    {
      kind: 'played', label: '治疗 2 点恐惧或弃掉 1 张恐怖卡',
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location)
        if (!candidates.length) return
        const seatId = candidates.length === 1 ? String(candidates[0].seat)
          : api.choice({ kind: 'investigator', source: '03191', seat: inv.seat, prompt: '选择目标调查员。',
            options: candidates.map(other => ({ id: String(other.seat), label: other.name })) })
        const target = state.investigators[Number(seatId)] || inv
        const terrors = (target.threat || []).filter(item =>
          (api.cardTraits?.(item.code) || []).some(trait => String(trait).toLowerCase() === 'terror'))
        const answer = api.choice({ kind: 'effect', source: '03191', seat: inv.seat, prompt: '选择逻辑推理的效果。',
          options: [{ id: 'heal', label: '治疗2点恐惧' },
            ...terrors.map(item => ({ id: item.id, label: `弃置「${api.cardName(item.code)}」` }))] })
        if (answer === 'heal') api.healHorror(target.seat, 2)
        else {
          const threat = terrors.find(item => item.id === answer)
          if (threat) api.removeThreat(threat)
        }
      },
    },
  ],
  modifiers: [

  ],
}
