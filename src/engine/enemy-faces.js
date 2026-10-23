// 异端者多面与放逐 —— 第 2 步 P2.12。
//
// 《罪恶报应》的 6 个异端者每张卡有两个面：**敌人面**与**未了之事面**（威胁区剧情卡）。
// 卡面允许「把异端者翻到另一面」「把未了之事翻回敌人」；另有「不能以任何方式被击败」与
// 「放逐」（进胜利区而不是弃牌堆）的单章规则。
//
// 数据形状（关卡 definition 的敌人上，纯 JSON；也可以写在已放置的敌人实例上）：
//   enemy.faces = [
//     { code: '<敌人面卡号>', side: 'enemy' },
//     { code: '<未了之事卡号>', side: 'unfinishedBusiness' },
//   ]
//   enemy.side = 'enemy' | 'unfinishedBusiness'   // 当前面，缺省 'enemy'
//
// 读点/动作：
//   faceOf(enemy) / enemyFacesOf(enemy)             —— 当前面与全部面
//   flipEnemyFace(state, enemy, nextCode, deps)     —— 换面：敌人 → 威胁区剧情 / 剧情 → 敌人
//   banishEnemyToVictory(state, enemy, deps)        —— 放逐：解除交战、移出敌人列表、进胜利区
//   enemyCannotBeDefeated(enemy)                    —— 卡面 `cannotBeDefeated` 的统一读点
//
// 引擎不认卡号：面的代码、属性全部来自关卡数据/卡面定义（deps.defOf）。
// 一次性剧情分支（某张未了之事的特殊翻面条件）写在章节 behavior，注册到 primitive-plan 的 escape。

export function faceOf(enemy) {
  return enemy?.side === 'unfinishedBusiness' ? 'unfinishedBusiness' : 'enemy'
}

export function enemyFacesOf(enemy) {
  return Array.isArray(enemy?.faces) ? enemy.faces.filter(face => face && face.code) : []
}

export function currentFaceCode(enemy) {
  const face = enemyFacesOf(enemy).find(entry => (entry.side || 'enemy') === faceOf(enemy))
  return face?.code || enemy?.originalCode || enemy?.code || null
}

export function enemyCannotBeDefeated(enemy) {
  return enemy?.cannotBeDefeated === true
}

// 换面。敌人面 → 未了之事面时，敌人离开战场、对应剧情卡进入调查员威胁区；
// 未了之事面 → 敌人面时反向。`deps` 全部由引擎注入，本函数不 import 引擎装配点：
//   defOf(code) → 卡面定义（fight/evade/health/name/victory…）
//   newCardInstance(code) → 生成威胁区实例
//   info / events → 日志
export function flipEnemyFace(state, enemy, nextCode, deps = {}) {
  const { defOf = () => null, newCardInstance = code => ({ code, id: 'threat-' + code }), info, events } = deps
  if (!enemy) return null
  const face = enemyFacesOf(enemy).find(entry => entry.code === nextCode)
  if (!face) return null
  const side = face.side === 'unfinishedBusiness' ? 'unfinishedBusiness' : 'enemy'
  const from = faceOf(enemy)
  if (side === from) return { side, code: nextCode, changed: false }
  if (side === 'unfinishedBusiness') {
    // 敌人面 → 未了之事：解除交战并从敌人列表移出，剧情卡进入「击败者」或队长威胁区。
    const holder = state.investigators.find(inv => inv.engaged?.includes(enemy.id))
      || state.investigators.find(inv => !inv.defeated && !inv.resigned) || null
    for (const inv of state.investigators) {
      if (Array.isArray(inv.engaged)) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
    }
    if (holder) {
      holder.threat.push(newCardInstance(nextCode))
    }
    const index = state.enemies.indexOf(enemy)
    if (index >= 0) state.enemies.splice(index, 1)
    enemy.side = side
    info?.(state, events, `🎭 「${enemy.name || enemy.code}」翻到了「未了之事」面并进入${holder ? holder.name : '场上'}的威胁区。`)
    return { side, code: nextCode, changed: true, threatHolder: holder?.seat ?? null }
  }
  // 未了之事 → 敌人面：从威胁区移除剧情卡，重新生成敌人。
  const def = defOf(nextCode) || {}
  // 场上那张「未了之事」剧情卡用的是**上一面**的代码，按面表移除。
  const threatCodes = new Set(enemyFacesOf(enemy)
    .filter(entry => entry.side === 'unfinishedBusiness')
    .map(entry => entry.code))
  threatCodes.add(nextCode)
  for (const inv of state.investigators) {
    if (!Array.isArray(inv.threat)) continue
    inv.threat = inv.threat.filter(card => !threatCodes.has(card.code))
  }
  enemy.code = nextCode
  enemy.originalCode = nextCode
  enemy.side = side
  if (def.name) enemy.name = def.name
  for (const key of ['fight', 'evade', 'health', 'damage', 'horror', 'victory']) {
    if (def[key] != null) enemy[key] = def[key]
  }
  if (!state.enemies.includes(enemy)) state.enemies.push(enemy)
  info?.(state, events, `🎭 「${enemy.name || nextCode}」翻回了敌人面并重新进入战场。`)
  return { side, code: nextCode, changed: true }
}

// 放逐：不能以任何方式被击败的卡面也会用「放逐」离场——移出敌人列表、解除交战、
// 进胜利展示区（有胜利点就计分），不进遭遇弃牌堆。
export function banishEnemyToVictory(state, enemy, deps = {}) {
  const { info, events, victory = Number(enemy?.victory || 0), addVictory = null } = deps
  if (!enemy) return false
  for (const inv of state.investigators) {
    if (Array.isArray(inv.engaged)) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
  }
  const index = state.enemies.indexOf(enemy)
  if (index >= 0) state.enemies.splice(index, 1)
  const code = enemy.originalCode || enemy.code
  if (addVictory) {
    addVictory(state, enemy, events)
  } else if (victory > 0) {
    state.victory = (state.victory || 0) + victory
    state.victoryDisplay ||= []
    state.victoryDisplay.push({ id: `enemy:${enemy.id}`, code, originalCode: code, victory })
  }
  info?.(state, events, `🌫️ 「${enemy.name || code}」被放逐到胜利展示区。`)
  return true
}
