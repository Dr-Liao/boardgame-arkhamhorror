export default { code: '07157', keepOnPlay: true,
  assetRule: { enemyEntryAmbush: { autoEvade: true, clues: 1, preventReady: 1 } },
  playCondition: [{ when: ({ state, inv }) => !(state.playerLocationAttachments || []).some(card => card.code === '07157' && card.location === inv.location),
    message: '本地点已有一张严密监视' }], abilities: [{ kind: 'played', label: '附属到所在地点；非精英敌人进入时躲避并发现线索',
    resolve: ({ inv, api }) => api.attachToLocation(inv.location, { code: '07157', ownerSeat: inv.seat }),
  }],
}
