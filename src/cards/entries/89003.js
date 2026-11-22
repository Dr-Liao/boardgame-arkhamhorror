// 89003 反刍（Regurgitation）· 中立 · 事件/力量 · 0 资源 · 5U-21 签名卡（3 张）。
//
// 卡面（cards-data 89003）：
//   Subject 5U-21 deck only.
//   Fast. Play only during your turn.
//   If Ravenous (Uncontrolled Hunger) is face up, flip it over. Choose and return up to 3 cards you
//   devoured (beneath Ravenous or set-aside) to their owners' hands. For each card returned in this
//   way, heal 1 damage or 1 horror.
//
// 引擎读点：
//   · 快速/自己回合：`fast: true` + playCondition `ownTurn()`。
//   · 翻面：`api.flipAsset(asset, '89002')`（api-misc.js 物理面翻转）。
//   · 吞噬卡所在：`api.commitOrigins.beneath(seat, hostId)` / `.take(seat, hostId, code, 'hand')`
//     （commit-origins.js；近似：两面共用同一宿主下方容器，见 89002 文件头说明）。
//   · 治疗：`api.healDamage` / `api.healHorror`（api-misc.js）。

import { ownTurn } from '../../engine/matcher.js'

const code = '89003'
const ravenousAssets = inv => (inv.assets || []).filter(asset => asset.code === '89002' || asset.code === '89002b')

export default {
  code,
  playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
  abilities: [{
    kind: 'played',
    fast: true,
    label: '翻回可控饥饿；将至多 3 张被吞噬的卡返回其所有者手牌，每张治疗 1 点伤害/恐惧',
    resolve: ({ inv, api }) => {
      const assets = ravenousAssets(inv)
      const uncontrolled = assets.find(asset => asset.code === '89002b')
      if (uncontrolled) api.flipAsset(uncontrolled, '89002')
      const devoured = []
      for (const host of assets) {
        for (const cardCode of api.commitOrigins.beneath(inv.seat, host.id)) devoured.push({ host, cardCode })
      }
      if (!devoured.length) {
        api.info('「反刍」：没有可返回的被吞噬卡牌。')
        return
      }
      const returned = []
      for (let i = 0; i < 3 && devoured.length; i++) {
        const remaining = devoured.filter(entry => !returned.some(item => item.cardCode === entry.cardCode && item.host.id === entry.host.id))
        if (!remaining.length) break
        const picked = remaining.length === 1 ? remaining[0] : api.choice({
          kind: 'card', source: code, seat: inv.seat, canSkip: true,
          prompt: `选择要返回手牌的被吞噬卡牌（还可选 ${3 - i} 张）。`,
          options: remaining.map(entry => ({ id: `${entry.host.id}:${entry.cardCode}`, cardCode: entry.cardCode,
            label: api.cardName(entry.cardCode) })),
        })
        if (picked === 'skip') break
        const entry = remaining.find(item => `${item.host.id}:${item.cardCode}` === picked)
        if (!entry) break
        api.commitOrigins.take(inv.seat, entry.host.id, entry.cardCode, 'hand')
        returned.push(entry)
        const heal = api.choice({ kind: 'effect', source: code, seat: inv.seat, canSkip: true,
          prompt: '选择治疗 1 点伤害或 1 点恐惧。',
          options: [{ id: 'skip', label: '不治疗' },
            ...(inv.damage > 0 ? [{ id: 'damage', label: '治疗 1 点伤害' }] : []),
            ...(inv.horror > 0 ? [{ id: 'horror', label: '治疗 1 点恐惧' }] : [])] })
        if (heal === 'damage') api.healDamage(inv.seat, 1)
        else if (heal === 'horror') api.healHorror(inv.seat, 1)
      }
      if (returned.length) api.info(`「反刍」将 ${returned.length} 张被吞噬卡牌返回手牌。`)
    },
  }],
  modifiers: [],
  note: '近似：两面共用宿主下方容器，「set aside」场外区未实现（primitive-requests/core-inv-89002-ravenous-devour.json）；返回的卡一律进入吞噬者手牌（其他所有者的卡无跨所有者搬运原语）。',
}
