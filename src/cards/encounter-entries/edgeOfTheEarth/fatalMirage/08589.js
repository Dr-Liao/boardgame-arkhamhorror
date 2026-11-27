// 08589 伊里亚·阿什瓦克 · 坚毅伙伴
export default {
  code: '08589', scope: 'storyAsset', implemented: true,
  flags: { partner: true, resolute: true },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'free', actionKind: 'evade', label: '花费 1 秘密并横置：以基础敏捷 6 躲避，成功可移动到连接地点',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ state, inv }) => state.phase === 'investigation' && state.currentSeat === inv.seat,
    target: { kind: 'enemy', query: ({ inv, entity }) => entity.engagedSeat === inv.seat },
    resolve: ({ inv, target, api }) => api.evade(inv.seat, {
      enemyId: target.id, skill: 'agility', baseValue: 6, onSuccess() {
        const destinations = api.moveDestinations(inv.seat)
        if (!destinations.length) return
        const destination = api.choice({ kind: 'move', source: '08589', seat: inv.seat, canSkip: true,
          prompt: '躲避成功后，可以移动到一个连接地点。',
          options: [{ id: 'skip', label: '留在原地' }, ...destinations.map(id => ({ id, label: api.locName(id) }))] })
        if (destinations.includes(destination)) api.moveInvestigator(inv.seat, destination)
      },
    }),
  }],
}
