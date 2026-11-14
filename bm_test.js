// Test: BOM picker uses company Product Master. Usage: node bm_test.js
const fs=require('fs'),vm=require('vm');const s=fs.readFileSync(__dirname+'/app.js','utf8');
const grab=n=>{const i=s.search(new RegExp('(async )?function '+n+'\\('));let d=0,j=s.indexOf('{',i);for(let k=j;k<s.length;k++){if(s[k]=='{')d++;if(s[k]=='}'){d--;if(!d)return s.slice(i,k+1);}}};
const store={companies:{a:{name:'Kenjitei'},b:{name:'Tanoshi'}},products:{P1:{sapCode:'P1',posCode:'POS1',itemName:'PORK BELLY',companies:['Kenjitei'],looseUOM:'KG'},P2:{sapCode:'P2',itemName:'TANOSHI ONLY',companies:['Tanoshi']},P3:{sapCode:'P3',itemName:'NO COMPANY'}},
 sap_items:{x:{company:'Kenjitei',itemCode:'P1',itemName:'PORK BELLY SAP',invUom:'KG',purchUom:'KG',lastPrice:300,updateDate:'2026-07-10',lastPurchaseDate:'2026-06-25',asOf:'2026-07-13',importedAt:'2026-07-14T02:00:00Z'},y:{company:'Kenjitei',itemCode:'S9',itemName:'SAP ONLY ITEM',invUom:'KG',lastPrice:10}},inventory_items:{},inventory_bom:{},inventory_costs:{}};
const q=(n,flt)=>({get:async()=>{const a=Object.entries(store[n]||{}).filter(([k,v])=>!flt||v[flt[0]]===flt[1]);return{forEach:f=>a.forEach(([k,v])=>f({id:k,data:()=>v}))}},where:(f,o,v)=>q(n,[f,v]),doc:id=>({get:async()=>({exists:!!(store[n]||{})[id],data:()=>store[n][id]})})});
const els={'bm-q':{value:'pork'},'bm-r':{style:{},innerHTML:''}};
const ctx={console,db:{collection:n=>q(n)},document:{getElementById:i=>els[i]||null},srchEsc:x=>String(x),invMoney:x=>x,invSlug:x=>x,smartMatch:(qq,...a)=>a.join(' ').toLowerCase().includes(qq.toLowerCase()),bmRender(){},bmRoot:()=>({}),bmInactive:false};
vm.createContext(ctx);
vm.runInContext("let bmS={company:'',companies:[],sap:{},prod:[],boms:{},items:{},q:''},bmDraft={};"+['productCompanies','hubKey','bmRaw','bmCostPerUnit','loadBomMgmt','bmSearch','bmDates','sapStamp','sapLatest'].map(grab).join('\n')+';this.bmS=bmS;this.bmDraft=bmDraft',ctx);
(async()=>{await ctx.loadBomMgmt();const names=ctx.bmS.prod.map(p=>p.itemName);console.log('picker (Kenjitei):',names,'| sap lookup has S9:',!!ctx.bmS.sap.S9);
 ctx.bmSearch();console.log(els['bm-r'].innerHTML.includes('SAP updated 2026-07-10')&&els['bm-r'].innerHTML.includes('SAP as of 2026-07-13')?'dates shown ok':'dates FAIL');console.log(ctx.sapLatest(Object.values(ctx.bmS.sap)));
 const ok=names.length==1&&names[0]=='PORK BELLY'&&ctx.bmS.sap.P1.lastPrice==300&&!names.includes('SAP ONLY ITEM');console.log(ok?'ALL PASS':'FAIL');})();
