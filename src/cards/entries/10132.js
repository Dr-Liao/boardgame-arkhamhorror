// 10132 密教珍藏：手部、饰品、法术共用一个额外槽，只能放祝福或诅咒萦绕支援。
export default {
  code: '10132',
  restrictedSlots: [{ slots: ['hand', 'accessory', 'arcane'], traitsAny: ['Blessed', 'Cursed'], count: 1 }],
}
