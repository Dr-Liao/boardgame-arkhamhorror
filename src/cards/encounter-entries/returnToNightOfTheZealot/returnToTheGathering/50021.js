// 50021 远在房屋之下 / 食尸鬼洞穴（Deep Below Your House / Ghoul Pits）· 地点 ·
// return_to_the_gathering
// 卡面（揭示面「食尸鬼洞穴」）：强制 - 你揭示食尸鬼洞穴后：检定[agility](3)。
//   你检定失败且每低于难度 1 点，查找遭遇牌库和遭遇弃牌堆，找出 1 张鼠群并将其抽取。混洗遭遇牌库。
// 读点：locations.js#revealLocation → locationRule.onReveal；
//   检索走 api.takeEncounterDeckCard / api.takeEncounterDiscard，抽取走 api.drawEncounter({code,from:'search'})。
const SWARM_OF_RATS = '01159'

export default {
  code: '50021',
  scope: 'location',
  implemented: true,
  locationRule: {
    onReveal(state, loc, api, seat) {
      void loc
      const tester = seat == null ? (state.campaign?.leadSeat ?? 0) : seat
      const difficulty = 3
      api.test(tester, 'agility', difficulty, result => {
        if (result?.success) return
        const amount = Math.max(0, difficulty - Number(result?.value ?? 0))
        let drawn = 0
        for (let index = 0; index < amount; index += 1) {
          const taken = api.takeEncounterDeckCard(SWARM_OF_RATS) || api.takeEncounterDiscard(SWARM_OF_RATS)
          if (!taken) break
          api.drawEncounter(tester, { code: SWARM_OF_RATS, from: 'search' })
          drawn += 1
        }
        api.shuffleEncounterDeck()
        api.info(`食尸鬼洞穴：敏捷检定失败 ${amount} 点，找出并抽取 ${drawn} 张「鼠群」。`)
      })
    },
  },
}
