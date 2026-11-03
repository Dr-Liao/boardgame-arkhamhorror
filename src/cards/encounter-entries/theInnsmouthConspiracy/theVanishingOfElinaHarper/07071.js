import { hasTrait, putRevealedPrintedLocation } from '../../_shared.js'
// 锯骨巷：光环只作用于此处当前具有类人特性的敌人。
const humanoidHere = ({ entity, host }) => host === 'location' && hasTrait(entity, 'Humanoid')
export default {
  code: '07071', scope: 'location', implemented: true,
  encounterResolve: putRevealedPrintedLocation,
  modifiers: [
    { target: 'enemyFight', amount: 2, condition: { when: humanoidHere } },
    { target: 'enemyEvade', amount: -2, condition: { when: humanoidHere } },
  ],
}
