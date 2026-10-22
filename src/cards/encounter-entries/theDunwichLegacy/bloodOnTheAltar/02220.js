// 02220 绑架！
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：显现 - 检定[willpower](4)或[agility](4)。如果你检定失败，将你控制的一个[[盟友]]支援加入潜在牺牲池。然后，将绑架！附属到当前密谋。如果你没有[[盟友]]支援，改为受到2点伤害并弃掉绑架！。
// 卡面：强制 - 在附属的密谋推进时：随机选择一个潜在牺牲并将其放在密谋牌库底下。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '02220', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const skill = api.choose({ kind: 'skill', source: code, seat: inv.seat, prompt: '绑架：选择意志或敏捷进行检定（4）。',
      options: [{ id: 'willpower', label: '意志' }, { id: 'agility', label: '敏捷' }] })
    api.test(inv.seat, skill, 4, result => {
      if (result.success) { state.encounterDiscard.push(code); return }
      const allies = inv.assets.filter(asset => ALL_CARDS[asset.code]?.traits?.includes('Ally'))
      if (!allies.length) { api.damage(inv.seat, 2); state.encounterDiscard.push(code); return }
      const chosen = api.choose({ kind: 'target', source: code, seat: inv.seat, prompt: '选择被绑架的盟友。',
        options: allies.map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || asset.code })) })
      state.scenarioZones.sacrifices.push(api.removeAsset(inv.seat, chosen))
      state.scenarioFlags.kidnapped = (state.scenarioFlags.kidnapped || 0) + 1
    })
    return true
  },
}
