// 08710 失落的修格斯（Lost Shoggoth）· 敌人 · shoggoths
// 卡面：猎手。强制 - 失落的修格斯与你交战后：抽取忒咳哩-哩牌库顶的 1 张卡牌（如果你不能这么做，
//   失落的修格斯攻击你）。
// 读点：forced + trigger 'enemyEngaged'（enemies.js#engageEnemy 开窗）；tekeliDraw 取牌。
//   「抽到后按弱点结算」需要引擎的按卡号结算弱点读点（primitive-requests/p7-08710.json）。
export default {
  code: '08710', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged',
    label: '与失落的修格斯交战后：抽取忒咳哩-哩牌库顶 1 张；不能则它攻击你',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, context, api }) => {
      const code = api.mechanics.tekeli.draw()
      if (code) {
        api.info('👁️ 「失落的修格斯」：抽出忒咳哩-哩「' + (api.cardName?.(code) || code) + '」（按弱点结算）。')
        return
      }
      const seat = Number.isSafeInteger(context?.seat) ? context.seat : state.currentSeat
      api.info('「失落的修格斯」：没有忒咳哩-哩可抽，它攻击了你。')
      api.scenario.attack(source, state.investigators[seat])
    },
  }],
  note: '「抽到后立即按弱点结算」需要引擎的按卡号结算弱点读点（primitive-requests/p7-08710.json）。',
}

