export default {
  code: '51001',
  restrictedSlots: [{ slot: 'hand', traitsAny: ['Weapon'], count: 2 }],
  modifiers: [{
    target: 'skill:willpower', amount: 1,
    condition: { occupiedAssetSlotsAtLeast: { slot: 'hand', count: 2, traitsAny: ['Weapon'] } },
  }],
}
