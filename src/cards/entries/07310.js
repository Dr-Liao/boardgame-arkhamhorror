export default { code: '07310', keepOnPlay: true, assetRule: { sharedLocationAbility: true }, abilities: [
  { kind: 'played', label: '附属到所在地点，放置3奉献',
    resolve: ({ inv, api }) => api.attachToLocation(inv.location, { code: '07310', ownerSeat: inv.seat,
      extra: { uses: 3, usesType: 'offerings' } }) },
  { kind: 'free', label: '抽取遭遇牌、横置并花费1奉献：收回至多2张总等级至多5的弃牌',
    cost: { exhaust: true, uses: 1, drawEncounter: 1 },
    resolve: ({ inv, api }) => api.playerTools.recoverDiscard(inv.seat, { max: 2, maxLevel: 5 }) },
] }
