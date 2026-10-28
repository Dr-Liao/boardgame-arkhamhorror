import * as m from '../src/cards/cards-data.js';

const all = m.ALL_CARDS;
console.log('ALL_CARDS type:', typeof all, 'array:', Array.isArray(all), 'map:', all instanceof Map);
let list;
if (all instanceof Map) {
  list = [...all.values()];
  console.log('map size', all.size, 'first key', [...all.keys()][0]);
} else if (Array.isArray(all)) {
  list = all;
} else {
  console.log('object keys', Object.keys(all).slice(0, 5), 'count', Object.keys(all).length);
  list = Object.values(all);
}
console.log('list length', list.length);
console.log('first item keys', Object.keys(list[0]));

const byCode = new Map();
for (const c of list) byCode.set(c.code, c);

const dodge = byCode.get('01023');
console.log('DODGE 01023:', JSON.stringify(dodge, null, 1));

function findInCard(c, needleLower) {
  const s = JSON.stringify(c).toLowerCase();
  return s.includes(needleLower);
}

for (const needle of ['低语', 'whispers in your head', '不能打出事件', 'cannot play events', '恐怖', 'peril', 'hidden', '毕宿']) {
  const hits = list.filter((c) => findInCard(c, needle.toLowerCase()));
  console.log(`\n=== ${needle} -> ${hits.length} ===`);
  for (const h of hits.slice(0, 8)) {
    console.log(h.code, '|', h.name, '|', h.nameEn || h.englishName || '', '|', (h.text || h.textEn || '').slice?.(0, 200).replace(/\n/g, ' / '));
  }
}
