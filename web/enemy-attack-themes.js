// These are visual categories, not rules keywords. Unknown imagery stays neutral.
export const ENEMY_ATTACK_GROUPS = Object.freeze({
  melee: { color:'#dc9a88', sound:'directImpact', glyph:'fist' },
  claw: { color:'#eb776d', sound:'enemyClaw', glyph:'claw' },
  bite: { color:'#dcab7f', sound:'enemyGrowl', glyph:'fang' },
  swarm: { color:'#a7b56a', sound:'enemySwarm', glyph:'swarm' },
  bind: { color:'#86b49c', sound:'p1Acid', glyph:'coil' },
  heavy: { color:'#bd918b', sound:'enemyHeavy', glyph:'shock' },
  psychic: { color:'#b89bdb', sound:'enemyFear', glyph:'eye' },
  spectral: { color:'#84c6ca', sound:'enemyGhost', glyph:'ghost' },
  spell: { color:'#d58bcb', sound:'p1Energy', glyph:'sigil' },
  flying: { color:'#b1a7cf', sound:'enemyWing', glyph:'wings' },
  vehicle: { color:'#d0a77d', sound:'enemyHeavy', glyph:'vehicle' },
  uncertain: { color:'#b7a8a1', sound:'directImpact', glyph:'shock' },
})
export const ENEMY_ATTACK_FAMILIES = Object.freeze({
  ghoulPriest:{glyph:'skull',color:'#d45f59'}, maskedHunter:{glyph:'mask',color:'#c9b795'},
  umordhoth:{glyph:'abyss',color:'#9470ba'}, experiment:{glyph:'mutation',color:'#90ad75'},
  huntingHorror:{glyph:'dragon',color:'#a293bb'}, silas:{glyph:'branches',color:'#ae9375'},
  brood:{glyph:'invisible',color:'#b0c1a6'}, yog:{glyph:'gates',color:'#b3a5e4'},
  organist:{glyph:'organ',color:'#b6a3d3'}, hastur:{glyph:'yellowSign',color:'#e1c65b'},
  harbinger:{glyph:'serpentRune',color:'#b5ad72'}, yig:{glyph:'serpent',color:'#7db080'},
  formless:{glyph:'amorphous',color:'#b59bb9'}, watcher:{glyph:'watch',color:'#89bdc4'},
  anette:{glyph:'witch',color:'#b689c6'}, azathoth:{glyph:'cosmos',color:'#b692da'},
  unnamable:{glyph:'fracture',color:'#ba98b3'}, nyarlathotep:{glyph:'masks',color:'#cc947a'},
  atlach:{glyph:'web',color:'#c7b5bb'}, amalgam:{glyph:'flesh',color:'#b28483'},
  terror:{glyph:'seaBeast',color:'#7daaaa'}, dagon:{glyph:'tideCrown',color:'#6eaaa3'},
  hydra:{glyph:'manyLimbs',color:'#86b9a0'},
})
