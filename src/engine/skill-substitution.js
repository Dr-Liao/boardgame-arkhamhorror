import { registeredEntry } from './ability.js'

export function actionTestSkill(state, inv, original, replacement, choose) {
  if (original === replacement) return replacement
  const source = inv.assets.find(asset => {
    const rule = registeredEntry(asset.code)?.ignoreSkillSubstitution
    return rule?.from === original && rule.to === replacement
  })
  if (!source) return replacement
  const answer = choose(state, { kind: 'skill', source: source.code, seat: inv.seat,
    prompt: '是否忽略此次技能替换，使用原本的技能？',
    options: [{ id: replacement, label: replacement }, { id: original, label: original }] })
  return answer === original ? original : replacement
}
