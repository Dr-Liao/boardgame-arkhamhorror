// 05003 普雷斯顿·费尔蒙特
// 卡面：你每次从卡牌效果获得资源，不将其放在资源池，改为放在家族遗产上。
// 卡面：[elder_sign]效果：+0。你可以花费2资源以改为自动成功。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 资源寄存的规则、状态与卡面读数都在引擎的 src/engine/resource-bank.js；
// 这里只声明「哪张支援是寄存卡、每回合放几资源」。

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05003')

export default {
  code: '05003',
  kind: 'investigator',
  investigator: {
    resourceBank: { assetCode: '05011', perTurn: 4 },
    elderSign: { bonus: 0, autoSuccessCost: 2 },
  },
  elderSign: {
    id: '05003-eldersign',
    label: '旧印：+0，可花 2 资源改为自动成功',
    resolve: ({ inv, api }) => {
      const bonus = Number(sign.bonus ?? 0)
      const cost = Number(sign.autoSuccessCost ?? 2)
      // R7 resource-bank v2 预接线：寄存资源「可以被花费，如同在你的资源池中」，
      // 所以旧印的 2 资源门槛/支付应看统一可用资源；原语未落地时回落资源池。
      const available = typeof api.availableResources === 'function' ? Number(api.availableResources(inv) || 0) : (inv.resources || 0)
      if (available < cost) return { delta: bonus }
      const answer = api.choice({
        kind: 'effect', source: 'prestonElderSign', seat: inv.seat,
        prompt: `旧印：是否花费 ${cost} 资源改为自动成功？`,
        options: [{ id: 'pay', label: `花费 ${cost} 资源自动成功` }, { id: 'skip', label: `仅 ${bonus > 0 ? '+' : ''}${bonus}` }],
      })
      if (answer !== 'pay') return { delta: bonus }
      if (typeof api.spendResources === 'function') api.spendResources(inv.seat, cost)
      else api.loseResources(inv.seat, cost)
      api.info(`${inv.name} 花费 ${cost} 资源，旧印改为自动成功。`)
      return { delta: bonus, autoSuccess: true }
    },
  },
  abilities: [],
  modifiers: [],
}
