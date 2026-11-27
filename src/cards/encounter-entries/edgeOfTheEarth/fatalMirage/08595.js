// 08595 高田弘子 · 坚毅伙伴
export default {
  code: '08595', scope: 'storyAsset', implemented: true,
  flags: { partner: true, resolute: true },
  uses: 9, usesType: 'resources',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '横置：获得 1 资源，然后将高田弘子的最多 3 资源移入你的资源池',
    cost: { exhaust: true },
    resolve: ({ inv, source, api }) => {
      api.gainResources(inv.seat, 1)
      const available = Math.min(3, source.uses || 0)
      if (available <= 0) return
      const amount = Number(api.choice({ kind: 'number', source: '08595', seat: inv.seat,
        prompt: '选择从高田弘子移入资源池的数量。',
        options: Array.from({ length: available + 1 }, (_, n) => ({ id: String(n), label: '移动 ' + n + ' 资源' })) }))
      if (Number.isSafeInteger(amount) && amount > 0 && amount <= available && api.spendUses(source, amount)) api.gainResources(inv.seat, amount)
    },
  }],
}
