// 陌生洞室：显现后的随机钥匙保持背面朝上；身份/随机数由钥匙原语维护。
export default {
  code: '07047', scope: 'location', implemented: true,
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.keys.placeRandom(`location:${location.id}`)
    },
  },
}
