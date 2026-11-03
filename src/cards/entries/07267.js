import { skillModifier } from './_shared.js'
export default { code: '07267', modifiers: ['willpower', 'intellect'].map(skill => skillModifier(skill,
  ({ source }) => 1 - (source.capturedCards || []).length)), abilities: [
  { kind: 'reaction', trigger: 'cardWouldBeDrawn', cost: { exhaust: true }, label: '取消基础弱点并面朝下放于伊奇亚克下方',
    criteria: ({ inv, context, helpers }) => context.location === inv.location && helpers.cardSubtype(context.cardCode) === 'basicweakness',
    resolve: ({ source, context, api }) => api.playerTools.captureWeakness(context, source.id) },
  { kind: 'leavesPlay', label: '归属者重新抽取伊奇亚克下方的弱点',
    resolve: ({ source, api }) => api.playerTools.returnCapturedWeaknesses(source) },
] }
