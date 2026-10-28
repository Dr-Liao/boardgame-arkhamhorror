import { ALL_CARDS } from '../src/cards/cards-data.js';

const list = Object.values(ALL_CARDS);
const needles = ['毕宿五', '脑海中的低语'];
for (const n of needles) {
  const hits = list.filter((c) => JSON.stringify(c).includes(n));
  console.log(`=== ${n} -> ${hits.length} ===`);
  for (const h of hits) {
    console.log(JSON.stringify({ code: h.code, name: h.name, nameZh: h.nameZh, subnameZh: h.subnameZh, type: h.type, pack: h.pack, textZh: (h.textZh || '').replace(/\n/g, ' / '), traitsZh: h.traitsZh }));
  }
}
