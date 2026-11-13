// 《绯红密钥》内容层：隐匿迷你卡揭露 / 绯红密钥变换的统一入口。
//
// 为什么需要这一层（2026-11-13 P1-1）：
//   · 引擎的 `tskExposed` / `tskKeyShifted` 窗口只在机制面包装器
//     （`api.mechanics.tsk.concealed.expose` / `api.mechanics.tsk.keys.shift`，能力面另摊平到 `api.tsk.*`）
//     里派发；直接调用 `src/engine/tsk-concealed.js#exposeMiniCard` / `tsk-scarlet-keys.js#shiftKey`
//     只会改状态、不触发 18 张挂在这些时机上的条目。
//   · 内容层（章节 behavior、事件处理器）不应自己复制窗口上下文，统一走这里：
//       暴露 → { id, kind, decoy, locationId, position, seat }
//       变换 → { keyId, from, to, face, keyStable, stable, seat }
//   · 传入的 api 可以是 abilityApi（顶层有 tsk.*）或 scenarioRuntime（只有 mechanics.tsk）；两者都兼容。
//     拿不到机制面时回落到原语（只改状态），保证测试/离线夹具仍可用。
import { exposeMiniCard } from '../../../src/engine/tsk-concealed.js'
import { shiftKey } from '../../../src/engine/tsk-scarlet-keys.js'

function concealedSurface (api) {
  const top = api?.mechanics?.tsk?.concealed
  if (typeof top?.expose === 'function') return top
  const flat = api?.tsk?.concealed
  return typeof flat?.expose === 'function' ? flat : null
}

function keysSurface (api) {
  const top = api?.mechanics?.tsk?.keys
  if (typeof top?.shift === 'function') return top
  const flat = api?.tsk?.keys
  return typeof flat?.shift === 'function' ? flat : null
}

/** 揭露一张隐匿迷你卡，并派发 tskExposed（若 api 暴露了机制面）。 */
export function exposeWithReaction (state, api, miniCardId, { seat = null } = {}) {
  const surface = concealedSurface(api)
  return surface ? surface.expose(miniCardId, { seat }) : exposeMiniCard(state, miniCardId)
}

/** 变换（翻面）一把绯红密钥，并派发 tskKeyShifted（若 api 暴露了机制面）。 */
export function shiftWithReaction (state, api, keyId, options = {}) {
  const surface = keysSurface(api)
  return surface ? surface.shift(keyId, options) : shiftKey(state, keyId, options)
}
