// 09091 星界映射（Astral Mirror）· 秘术师支援 · 2 经验。
// 卡面：你每有一个法术槽位没有支援，拥有一个额外的手部槽位。
//       你在自己回合期间可以执行一个行动，该行动只能用于打出支援到你的一个手部槽位。
//
export default {
  code: '09091',
  assetRule: { restrictedAction: 'handAssetPlay' },
  modifiers: [{
    target: 'add:slot',
    value: 'hand',
    amount: ({ inv, helpers }) => helpers.emptyAssetSlots(inv, 'arcane'),
  }],
  abilities: [],
}
