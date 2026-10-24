// 05055b 女巫圆环（Witches’ Circle）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：显现 - 把 set aside 的安妮特·梅森生成在此；强制 - 敌军阶段开始后，重整且未交战的女巫敌人向圆环移动一次。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

export default {
  code: '05055b', scope: 'location', implemented: true,
  locationRule: {
    onReveal(state, location, api) {
      const list = state.scenarioZones?.setAside || []
      const index = list.indexOf('05057')
      if (index >= 0) list.splice(index, 1)
      state.scenarioFlags ||= {}
      state.scenarioFlags.anetteSpawned = true
      const enemy = api.spawn?.('05057', location.id)
      api.info?.(`🌒 「女巫圆环」显现：安妮特·梅森在圆环中央现身${enemy ? '' : '（生成失败）'}。`)
      return true
    },
  },
}
