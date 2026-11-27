// 05129 屋主的住处（Landlord’s Quarters）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：强制 - 揭示后查找遭遇牌库/弃牌堆找鼠群生成在发霉的走道；闹鬼同效果。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { originalOf } from '../../_shared.js'

function spawnRats(state, api) {
  const target = state.locations.find(entry => originalOf(entry) === '05128')
  if (!target || !api.takeEncounterCard('01159')) {
    api.info?.('🐀 屋主的住处：没有找到可生成的「鼠群」。')
    return
  }
  api.spawn?.('01159', target.id)
  api.shuffleEncounterDeck?.()
  api.info?.('🐀 屋主的住处：找出「鼠群」并生成在「发霉的走道」。')
}

export default {
  code: '05129', scope: 'location', implemented: true,
  locationRule: {
    onReveal: (state, location, api) => spawnRats(state, api),
    hauntedScripts: { landlordsQuartersRats: spawnRats },
  },
}
