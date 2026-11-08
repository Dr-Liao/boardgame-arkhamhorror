// 08722 高田弘子（Takada Hiroko） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(9资源)。[action]横置：将高田弘子上的最多 3 资源移动到你的资源池。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

const CODE = '08722'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'gain1ResourceMoveUpTo3' } },
  uses: 9, usesType: 'resources',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '横置：将高田弘子上的最多 3 资源移动到你的资源池',
    cost: { action: 1, exhaust: true },
    resolve: ({ inv, source, api }) => {
      const available = Math.min(3, Math.max(0, Number(source?.uses) || 0))
      if (available <= 0) return
      const amount = available === 1 ? 1 : Number(api.choice({ kind: 'number', source: CODE, seat: inv.seat,
        prompt: '把多少资源移动到你的资源池？（最多 3）',
        options: Array.from({ length: available }, (_, index) => ({ id: String(index + 1), label: '移动 ' + (index + 1) + ' 资源' })) }))
      const n = Number.isSafeInteger(amount) && amount > 0 && amount <= available ? amount : available
      api.spendUses(source, n)
      api.gainResources(inv.seat, n)
    },
  }],
}


