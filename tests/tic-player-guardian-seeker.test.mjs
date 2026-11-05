import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture as coreFixture, asset, enemy, settle as coreSettle } from '../tests/core-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import { executeDescriptor, performTest, reactionWindow, enemyAttack, getStat, drawEncounter, legalMoves, validateMove, applyMove, applyDamage, slotUsage, effectiveTraits } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
function fixture(...args) { const s=coreFixture(...args); s.humanSeats=s.investigators.map(inv=>inv.seat); s.abilityLimits={}; if(s.scenarioFlags.mechanics?.beneath) s.scenarioFlags.mechanics.beneath={}; return s }
const codes = ['07017','07018','07019','07020','07021','07022','07023','07024','07111','07112','07113','07152','07153','07155','07191','07192','07220','07221','07222','07263','07264','07301','07302','07303','07109','07154','07190','07108','07110','07189','07223','07261','07262','07304']
for (const code of codes) if (!registeredEntry(code)) registerCardAbilities((await import(`../src/cards/entries/${code}.js`)).default)
registerCardAbilities({code:'testTicP6Play',abilities:[{kind:'action',cost:{action:false},resolve:({api,context})=>api.playCard(0,context.code)}]})
const desc = c => c.options.find(o => o.id.startsWith('desc:'))?.id
function run(s, fn, select = () => null) {
  const exec = d => fn(d)
  resolveTransaction(s, 0, {action:'ticP6CardTest'}, exec)
  for(let n=0;s.pendingChoice;n++) {
    assert.ok(n<200, JSON.stringify(s.pendingChoice))
    const c=s.pendingChoice
    const id=select(c,s) ?? (c.kind==='mechanic' ? c.options.find(o=>o.id==='confirm')?.id : null) ?? ['done','skip','self'].find(id=>c.options.some(o=>o.id===id)) ?? c.options[0].id
    const m={action:'choose',choiceId:c.id,optionId:id}
    assert.equal(choiceError(s,c.seat,m),null)
    resolveTransaction(s,c.seat,m,exec)
  }
}
function invoke(s,code,index=0,select=()=>null,context={}) {
  run(s,d=>executeDescriptor(d,{inv:d.investigators[0],source:d.investigators[0].assets.find(a=>a.code===code)||{id:code,code},descriptor:registeredEntry(code).abilities[index],events:[],context,silent:true}),select)
}
function play(s,code,select=()=>null) {s.investigators[0].hand.push(code);run(s,d=>executeDescriptor(d,{inv:d.investigators[0],source:{code:'testTicP6Play'},descriptor:registeredEntry('testTicP6Play').abilities[0],events:[],context:{code},silent:true}),select)}
const owned=(s,code)=>s.investigators[0].assets.find(a=>a.code===code)
const seal=(s,id,n=1)=>createMechanicsApi(s).chaosTokens.seal(id,'bless',n)

test('P6 07017 Book of Psalms heals only one local investigator and clamps bless supply',()=>{
 const s=fixture('07001',2);asset(s,'07017');s.investigators[1].location=s.investigators[0].location;s.investigators[1].horror=2;s.chaosBag=Array(9).fill('bless');invoke(s,'07017');assert.equal(s.investigators[1].horror,1);assert.equal(owned(s,'07017').uses,3);assert.equal(s.chaosBag.length,10)
})
test('P6 07018 Blessed Blade ready attack and optional before-reveal exhaust',()=>{
 const s=fixture('07001');const a=asset(s,'07018');const e=enemy(s);s.chaosBag=['0'];invoke(s,'07018',0,c=>c.options.some(o=>o.id.startsWith('desc:'))?desc(c):null,{targetId:e.id});assert.equal(owned(s,'07018').exhausted,true);assert.equal(s.lastTestResult.success,true);assert.equal(s.enemies.find(x=>x.id===e.id).damageTaken,1+(s.lastTestResult.drawn.some(t=>['bless','eldersign'].includes(t))?1:0));assert.equal(a.id,owned(s,'07018').id)
})
test('P6 07019 Rite of Sanctification seals chosen amount and pays last token for discount',()=>{
 const s=fixture('07001');s.chaosBag=['0','bless'];play(s,'07019',c=>c.options.some(o=>o.id==='1')?'1':null);assert.ok(owned(s,'07019'));const before=s.investigators[0].resources;play(s,'07017',desc);assert.equal(s.investigators[0].resources,before-1);assert.equal(owned(s,'07019'),undefined);assert.equal(s.chaosBag.includes('bless'),true)
})
test('P6 07020 Hand of Fate cancels actual enemy attack and adds printed combined harm',()=>{
 const s=fixture('07001');s.investigators[0].hand=['07020'];const e=enemy(s,{damage:2,horror:1});run(s,d=>enemyAttack(d,d.enemies.find(x=>x.id===e.id),d.investigators[0],[],'test'),c=>c.options.find(o=>o.cardCode==='07020')?.id);assert.equal(s.investigators[0].damage,0);assert.equal(s.investigators[0].horror,0);assert.equal(s.chaosBag.filter(x=>x==='bless').length,3);assert.ok(s.investigators[0].discard.includes('07020'))
})
test('P6 07021 Cryptographic Cipher free and action modes use distinct shroud modifiers',()=>{
 const s=fixture('07002');asset(s,'07021');invoke(s,'07021');const upper=s.lastTestResult.difficulty;owned(s,'07021').exhausted=false;invoke(s,'07021',1);assert.equal(upper-s.lastTestResult.difficulty,Math.min(3,upper));assert.equal(owned(s,'07021').uses,1)
})
test('P6 07022 Cryptic Grimoire translates with ten bag curses and replacement respects supply cap',()=>{
 const s=fixture('07002');asset(s,'07022');s.chaosBag=Array(10).fill('curse');invoke(s,'07022',1);assert.equal(owned(s,'07022'),undefined);assert.equal(s.campaign.records.youHaveTranslatedTheGrimoire,true);assert.equal(s.chaosBag.filter(t=>t==='curse').length,5);assert.equal(s.chaosBag.filter(t=>t==='bless').length,5)
})
test('P6 07023 Deep Knowledge distributes exactly three draws and adds two curses as cost',()=>{
 const s=fixture('07002',2);s.investigators[1].location=s.investigators[0].location;play(s,'07023',c=>c.source==='07023'?'1':null);assert.equal(s.investigators[1].hand.length,3);assert.equal(s.investigators[0].hand.length,0);assert.equal(s.chaosBag.filter(t=>t==='curse').length,2)
})
test('P6 07024 Plan of Action has first/second/third completed-action boundaries',()=>{
 for(const n of [0,1,2,3]){const s=fixture('07002');s.investigators[0].actionHistory={turn:s.turnSerial,entries:Array.from({length:n},()=>['draw'])};s.investigators[0].hand=['07024'];const before=s.investigators[0].hand.length;run(s,d=>performTest(d,0,n===0?'willpower':'combat',0,{}),c=>c.kind==='commit'&&c.options.some(o=>o.id==='0')?'0':null);assert.equal(s.lastTestResult.success,true);assert.equal(s.investigators[0].hand.length,n===1?before:before-1);assert.equal(s.lastTestResult.value-s.lastTestResult.baseValue,n===1?1:2)}
})
test('P6 07111 Eldritch Sophist moves a secret to colocated asset without uses',()=>{
 const s=fixture('07002',2);const a=asset(s,'07111');s.investigators[1].location=s.investigators[0].location;const b=asset(s,'01030',{},1);invoke(s,'07111',0,c=>c.options.find(o=>o.label.includes('→')&&o.label.includes('巡警'))?.id);assert.equal(owned(s,'07111').uses,2);assert.equal(s.investigators[1].assets.find(x=>x.id===b.id).useTokens.secret,1);assert.equal(owned(s,'07111').exhausted,true)
})
test('P6 07112 Stirring Up Trouble pays actual shroud in curses and discovers two clues',()=>{
 const s=fixture('07002');const loc=s.locations.find(x=>x.id===s.investigators[0].location);loc.clues=4;play(s,'07112');assert.equal(s.investigators[0].clues,2);assert.equal(loc.clues,4,'transaction retains original object snapshot');assert.equal(s.locations.find(x=>x.id===loc.id).clues,2);assert.equal(s.chaosBag.filter(t=>t==='curse').length,s.lastTestResult?.difficulty||loc.shroud)
})
test('P6 07113 Blasphemous Covenant changes only one local curse modifier and retains token',()=>{
 const s=fixture('07002');asset(s,'07113');s.chaosBag=['curse','0'];s.rngState=0;run(s,d=>performTest(d,0,'intellect',0,{}),desc);assert.ok(s.lastTestResult.drawn.includes('curse'));{assert.equal(owned(s,'07113').exhausted,true);assert.equal(s.lastTestResult.value-s.lastTestResult.baseValue,1);assert.ok(s.chaosBag.includes('curse'))}
})
test('P6 07152 Keen Eye spends two resources for phase-long intellect/combat effects',()=>{
 const s=fixture('07001');asset(s,'07152');const before=s.investigators[0].resources;const stat=getStat(s,s.investigators[0],'combat');invoke(s,'07152',1);assert.equal(s.investigators[0].resources,before-2);assert.equal(getStat(s,s.investigators[0],'combat'),stat+1);assert.equal(s.effects.at(-1).duration,'endOfPhase')
})
test('P6 07153 Radiant Smite seals zero through three tokens and returns to pool on defeat',()=>{
 const s=fixture('07001');const e=enemy(s,{health:1});s.chaosBag=['0','bless','bless','bless'];play(s,'07153',c=>c.source==='07153'&&c.kind==='token'?'3':c.source==='07153'&&c.kind==='skill'?'willpower':null);assert.equal(s.enemies.some(x=>x.id===e.id),false);assert.equal(s.chaos?.sealed?.length||0,0);assert.equal(s.chaosBag.includes('bless'),false)
})
test('P6 07155 Gaze of Ouraxsh inspects without resolving curse chains and divides damage',()=>{
 const s=fixture('07002');enemy(s);s.chaosBag=['curse','autofail','0'];play(s,'07155');assert.equal(s.enemies[0].damageTaken,3);assert.equal(s.chaosBag.length,3);assert.equal(s.chaosBag.filter(t=>t==='curse').length,1)
})
test('P6 07191 Cryptic Grimoire gains secrets for each resolved curse then makes Insight fast',()=>{
 const s=fixture('07002',2,{seatInvestigators:['07002','01001']});const a=asset(s,'07191',{uses:0});s.chaosBag=['curse','curse','0'];s.rngState=0;run(s,d=>performTest(d,0,'willpower',0,{}),desc);assert.equal(owned(s,'07191').uses,2);assert.deepEqual(s.lastTestResult.drawn,['curse','curse','0']);
 s.investigators[0].resources=1;s.investigators[0].actionsLeft=0;s.investigators[0].damage=2;s.investigators[0].hand=['02105'];enemy(s,{damage:1});const fast=legalMoves(s).find(m=>m.action==='play'&&m.cardId==='02105'&&m.fastSourceId===a.id);assert.ok(fast,'one resource and no ordinary actions still permits the printed fast route');assert.equal(validateMove(s,0,fast),null);applyMove(s,0,fast);coreSettle(s,desc);assert.equal(owned(s,'07191').uses,0);assert.equal(s.investigators[0].resources,0);assert.equal(s.investigators[0].actionsLeft,0);assert.equal(s.investigators[0].damage,0,'fast play provokes no opportunity attack');assert.ok(s.investigators[0].discard.includes('02105'))
})
test('P6 07192 Cryptic Grimoire replaces actual encounter top draw with player deck draw',()=>{
 const s=fixture('07002');asset(s,'07192',{uses:5});const before=s.encounterDeck.length;run(s,d=>drawEncounter(d,d.investigators[0],[]),desc);assert.equal(s.encounterDeck.length,before);assert.equal(s.investigators[0].hand.length,1);assert.equal(owned(s,'07192').uses,0)
})
test('P6 07220 Holy Rosary boosts willpower and adds bless after a treachery willpower success',()=>{
 const s=fixture('07001');asset(s,'07220');assert.equal(getStat(s,s.investigators[0],'willpower'),s.investigators[0].willpower+1);
 // 审计 M8：「你」= 检定的执行者；窗口上下文里的 seat 是诡计座位而不是检定者，改由 skillTest.seat 判定。
 s.skillTest={...s.skillTest,seat:1,skill:'willpower'};run(s,d=>reactionWindow(d,'treacheryTestSuccess',{when:'treacheryTestSuccess',seat:0,location:d.investigators[0].location,skill:'willpower',cardCode:'rottingRemains'},[]),desc);assert.equal(s.chaosBag.filter(t=>t==='bless').length,0,'别人检定成功不触发');
 s.skillTest={...s.skillTest,seat:0};run(s,d=>reactionWindow(d,'treacheryTestSuccess',{when:'treacheryTestSuccess',seat:0,location:d.investigators[0].location,skill:'willpower',cardCode:'rottingRemains'},[]),desc);assert.equal(s.chaosBag.filter(t=>t==='bless').length,2);assert.equal(owned(s,'07220').exhausted,true)
})
test('P6 07221 Shield of Faith releases its last seal to cancel actual attack and discards',()=>{
 const s=fixture('07001');const a=asset(s,'07221');s.chaosBag=['0','bless'];seal(s,a.id);const e=enemy(s,{damage:2,horror:1});run(s,d=>enemyAttack(d,d.enemies.find(x=>x.id===e.id),d.investigators[0],[],'test'),desc);assert.equal(s.investigators[0].damage,0);assert.equal(owned(s,'07221'),undefined);assert.equal(s.chaosBag.includes('bless'),true)
})
test('P6 07222 Fey optionally returns after an actually revealed curse and otherwise discards',()=>{
 const s=fixture('07002');s.chaosBag=['curse','0'];s.rngState=0;s.investigators[0].hand=['07222'];run(s,d=>performTest(d,0,'intellect',0,{}),c=>c.kind==='commit'&&c.options.some(o=>o.id==='0')?'0':c.source==='07222'?'return':null);assert.ok(s.investigators[0].hand.includes('07222'))
})
test('P6 07263 The Stygian Eye discounts only bag curses and grants all skills through round end',()=>{
 const s=fixture('07002');s.chaosBag=['0',...Array(8).fill('curse')];const before=s.investigators[0].resources;const combat=getStat(s,s.investigators[0],'combat');play(s,'07263',desc);assert.equal(s.investigators[0].resources,before-2);assert.equal(getStat(s,s.investigators[0],'combat'),combat+3);assert.equal(s.effects.at(-1).duration,'endOfRound')
})
test('P6 07264 Hyperawareness pays from its asset resources and replenishes at round start',()=>{
 const s=fixture('07002');asset(s,'07264');run(s,d=>performTest(d,0,'intellect',0,{}),c=>c.options.find(o=>o.label.includes('本次检定 intellect'))?.id||(c.options.some(o=>o.id==='asset')?'asset':null));assert.ok(owned(s,'07264').uses<2);run(s,d=>reactionWindow(d,'roundStarts',{when:'roundStarts',round:d.round},[]));assert.equal(owned(s,'07264').uses,2)
})
test('P6 07301 Hallow pays ten physical bless including seals and removes one chosen doom',()=>{
 const s=fixture('07001');const a=asset(s,'07302');s.chaosBag=['0',...Array(10).fill('bless')];seal(s,a.id,3);s.doom=2;play(s,'07301');assert.equal(s.doom,1);assert.equal(s.chaosBag.includes('bless'),false);assert.equal(s.chaos.sealed.length,0)
})
test('P6 07302 Holy Spear seals two bless for stronger attack and can later release one',()=>{
 const s=fixture('07001');const a=asset(s,'07302');const e=enemy(s);s.chaosBag=['0','bless','bless'];invoke(s,'07302',1,()=>null,{targetId:e.id});assert.equal(s.enemies[0].damageTaken,3);assert.equal(s.chaos.sealed.filter(t=>t.source===a.id).length,2);invoke(s,'07302',0,c=>c.source===a.id?'release':null,{targetId:e.id});assert.equal(s.enemies[0].damageTaken,5);assert.equal(s.chaos.sealed.filter(t=>t.source===a.id).length,1)
})
test('P6 07303 Ancestral Knowledge stores five random non-weakness skills and draws chosen one',()=>{
 const s=fixture('07002');const a=asset(s,'07303');s.investigators[0].deck=['01093','01089','01090','01091','01092','07009'];invoke(s,'07303',0,c=>c.source==='07303'?'attach':null);const beneath=createMechanicsApi(s).commitOrigins.beneath(0,a.id);assert.equal(beneath.length,5);assert.equal(s.investigators[0].deck.includes('07009'),true);invoke(s,'07303',1);assert.equal(createMechanicsApi(s).commitOrigins.beneath(0,a.id).length,4);assert.equal(s.investigators[0].hand.length,1);assert.equal(owned(s,'07303').exhausted,true)
})

// Route cards use the real movement pipeline, including intermediate reveals and engagement.
test('P6 07109 Righteous Hunt traverses each location and engages the selected distant enemy',()=>{
 const s=fixture('07001');const start=s.investigators[0].location;
 s.locations=[{id:start,name:'A',revealed:true,connections:['middle'],shroud:1,clues:0},{id:'middle',name:'B',revealed:true,connections:[start,'end'],shroud:1,clues:0},{id:'end',name:'C',revealed:true,connections:['middle'],shroud:1,clues:0}];
 const e=enemy(s,{location:'end',engagedSeat:null,horror:2});play(s,'07109');assert.equal(s.investigators[0].location,'end');assert.equal(s.enemies.find(x=>x.id===e.id).engagedSeat,0);assert.equal(s.chaosBag.filter(t=>t==='bless').length,2)
})
test('P6 07154 The Truth Beckons stops on first newly revealed intermediate location',()=>{
 const s=fixture('07002');const start=s.investigators[0].location;
 s.locations=[{id:start,name:'A',revealed:true,connections:['middle'],shroud:1,clues:0},{id:'middle',name:'B',revealed:false,connections:[start,'end'],shroud:1,clues:0},{id:'end',name:'C',revealed:false,connections:['middle'],shroud:1,clues:0}];
 play(s,'07154',c=>c.options.some(o=>o.id==='end')?'end':null);assert.equal(s.investigators[0].location,'middle');assert.equal(s.locations.find(x=>x.id==='middle').revealed,true);assert.equal(s.locations.find(x=>x.id==='end').revealed,false)
})
test('P6 07190 Blessing of Isis treats the second physical bless as the performing investigator elder sign',()=>{
 const s=fixture('07001');asset(s,'07190');s.chaosBag=['bless','bless'];run(s,d=>performTest(d,0,'willpower',0,{}),desc);assert.equal(owned(s,'07190').exhausted,true);assert.equal(s.lastTestResult.value-s.lastTestResult.baseValue,3);assert.equal(s.chaosBag.filter(t=>t==='bless').length,3)
})

test('P6 07108 Riot Whistle grants exactly one real engage action after ordinary actions run out',()=>{
 const s=fixture('07001',2,{seatInvestigators:['07001','01001']});asset(s,'07108');s.investigators[0].hand=['07024'];s.investigators[0].actionsLeft=0;const e=enemy(s,{engagedSeat:null});
 const m=legalMoves(s).find(m=>m.action==='engage'&&m.enemyId===e.id);assert.ok(m);assert.equal(legalMoves(s).some(m=>m.action==='resource'),false);assert.equal(validateMove(s,0,m),null);applyMove(s,0,m);coreSettle(s);assert.equal(s.enemies.find(x=>x.id===e.id).engagedSeat,0);assert.equal(s.investigators[0].actionsLeft,0);assert.ok(s.investigators[0].actionHistory.entries.some(x=>x.includes('engage')));assert.equal(owned(s,'07108').restrictedActionSpent,true);assert.equal(s.currentSeat,1)
})
test('P6 07110 Sacred Covenant immediately returns chosen bless and ignores that modifier',()=>{
 const s=fixture('07001');asset(s,'07110');s.chaosBag=['bless','0'];s.rngState=0;run(s,d=>performTest(d,0,'willpower',0,{}),c=>desc(c)||(c.source==='returnRevealed'?c.options.find(o=>o.id!=='done')?.id:null));assert.equal(owned(s,'07110').exhausted,true);assert.ok(s.chaosBag.includes('bless'));assert.equal(s.lastTestResult.value,s.lastTestResult.baseValue)
})
test('P6 07189 Enchanted Armor transfers control, tests owner, and reassigns only new harm on failure',()=>{
 const s=fixture('07001',2);s.investigators[1].location=s.investigators[0].location;play(s,'07189',c=>c.options.some(o=>o.id==='1')?'1':null);assert.equal(owned(s,'07189'),undefined);const a=s.investigators[1].assets.find(a=>a.code==='07189');assert.ok(a);assert.equal(a.ownerSeat,0);s.chaosBag=['autofail'];
 run(s,d=>applyDamage(d,d.investigators[1],1,[]),c=>c.kind==='assign-damage'&&c.options.some(o=>o.id===a.id)?a.id:null);assert.equal(s.investigators[1].assets.some(x=>x.id===a.id),false);assert.equal(s.investigators[0].damage,1);assert.equal(s.investigators[1].damage,0);assert.ok(s.investigators[0].discard.includes('07189'));assert.equal(s.investigators[1].discard.includes('07189'),false)
})
test('P6 07223 Guided by the Unseen searches performer top three and commits only after secret payment',()=>{
 const s=fixture('07002');const a=asset(s,'07223');s.investigators[0].deck=['01030','01090','01088'];
 run(s,d=>performTest(d,0,'intellect',0,{}),c=>c.options.find(o=>o.label.includes('检定者查找'))?.id||c.options.find(o=>o.cardCode==='01090')?.id||c.options.find(o=>o.id==='pay'||o.id==='commit')?.id);assert.equal(owned(s,'07223').uses,3);assert.ok(s.investigators[0].discard.includes('01090'));assert.equal(s.lastTestResult.value-s.lastTestResult.baseValue,2);assert.equal(s.investigators[0].hand.filter(c=>c==='01090').length,0)
})
test('P6 07261 Enchant Weapon adds Relic and arcane slot and uses attachment owner willpower',()=>{
 const s=fixture('07001',2,{seatInvestigators:['07001','01001']});s.investigators[1].location=s.investigators[0].location;const w=asset(s,'07302',{},1);play(s,'07261',c=>c.options.some(o=>o.id===w.id)?w.id:null);const attachment=s.investigators[1].assets.find(x=>x.id===w.id).attachments.find(x=>x.code==='07261');assert.ok(attachment);assert.equal(attachment.ownerSeat,0);assert.equal(slotUsage(s.investigators[1]).arcane,1);assert.ok(effectiveTraits(s,s.investigators[1],'07302').some(t=>t.toLowerCase()==='relic'));
 s.investigators[1].combat=1;let enchantOffered=false;const e=enemy(s,{engagedSeat:1,fight:7});run(s,d=>executeDescriptor(d,{inv:d.investigators[1],source:d.investigators[1].assets.find(x=>x.id===w.id),descriptor:registeredEntry('07302').abilities[0],events:[],context:{targetId:e.id},silent:true}),c=>{if(c.source?.when==='weaponFightInitiated')enchantOffered=true;return desc(c)});assert.ok(enchantOffered,'weaponFightInitiated must offer the attachment controller its reaction');assert.equal(s.lastTestResult.success,true,JSON.stringify({result:s.lastTestResult,attachment:s.investigators[1].assets.find(x=>x.id===w.id).attachments,ownerWillpower:getStat(s,s.investigators[0],'willpower')}));assert.equal(s.enemies.find(x=>x.id===e.id).damageTaken,3);assert.equal(s.investigators[1].assets.find(x=>x.id===w.id).attachments.find(x=>x.code==='07261').exhausted,true)
})
test('P6 07262 Nephthys seals only actually consumed bless and can pay three seals for damage',()=>{
 const s=fixture('07001');const a=asset(s,'07262');s.chaosBag=['bless','bless','bless','0'];seal(s,a.id,2);s.rngState=0;run(s,d=>performTest(d,0,'willpower',0,{}),desc);assert.equal(s.chaos.sealed.filter(x=>x.source===a.id).length,3);const e=enemy(s);invoke(s,'07262',1,c=>c.options.some(o=>o.id==='damage')?'damage':null);assert.equal(s.enemies.find(x=>x.id===e.id).damageTaken,2);assert.equal(s.chaos.sealed.filter(x=>x.source===a.id).length,0);assert.equal(owned(s,'07262').exhausted,true)
})
test('P6 07304 Ariadne Twine pays colocated asset secrets and converts own secrets/resources',()=>{
 const s=fixture('07002',2);s.investigators[1].location=s.investigators[0].location;const twine=asset(s,'07304',{uses:1});const cipher=asset(s,'07021',{uses:0},1);run(s,d=>executeDescriptor(d,{inv:d.investigators[1],source:d.investigators[1].assets.find(x=>x.id===cipher.id),descriptor:registeredEntry('07021').abilities[0],events:[],silent:true}));assert.equal(owned(s,'07304').uses,0);assert.equal(s.investigators[1].assets.find(x=>x.id===cipher.id).uses,0);const before=s.investigators[0].resources;
 invoke(s,'07304',0,c=>c.options.some(o=>o.id===`secret:${twine.id}`)?`secret:${twine.id}`:null);assert.equal(owned(s,'07304').uses,1);assert.equal(s.investigators[0].resources,before-1);owned(s,'07304').exhausted=false;invoke(s,'07304',0,c=>c.options.some(o=>o.id===`resource:${twine.id}`)?`resource:${twine.id}`:null);assert.equal(owned(s,'07304').uses,0);assert.equal(s.investigators[0].resources,before)
})

