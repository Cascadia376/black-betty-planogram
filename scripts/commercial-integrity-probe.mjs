import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = process.argv[2] || '/workspace/worktrees/betty';
const require = createRequire(`${root}/package.json`);
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const runner = await createServer({root,configFile:false,logLevel:'silent',cacheDir:'/tmp/parksville-betty-review-vite',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null},appType:'custom'});
try {
  const commercial = await runner.ssrLoadModule(`${root}/src/domain/promotion/commercial.ts`);
  const ranking = await runner.ssrLoadModule(`${root}/src/domain/promotion/ranking.ts`);
  const {syntheticCommercialEvidence} = await runner.ssrLoadModule(`${root}/src/services/promotion/commercialFixture.ts`);
  const request = {sku:'0000123',start:'2026-01-01',end:'2026-03-31',storeIds:Array.from({length:13},(_,i)=>i+1)};
  const original = await syntheticCommercialEvidence(request);
  const other = await syntheticCommercialEvidence({...request,sku:'0000124'});
  other.receipt.scope = {storeIds:[...other.receipt.scope.storeIds].reverse(),end:other.receipt.scope.end,start:other.receipt.scope.start};
  const comparable = ranking.rankComparableReceipts([{id:'a',receipt:original.receipt},{id:'b',receipt:other.receipt}],{volume:1,margin:0,lift:0}).state;
  const marginReceipt = structuredClone(original.receipt);
  marginReceipt.totals = {units:1,revenue:0.3,cost:0.2};
  marginReceipt.sourceContract.reconciliation.totals = marginReceipt.totals;
  const margin = ranking.receiptSignals(marginReceipt).values.margin;
  const digestFindings = [];
  for(const target of ['observations','receipt']) {
    const imported = structuredClone(original);
    const nativeDigest = crypto.subtle.digest.bind(crypto.subtle);
    let release;
    const gate = new Promise(resolve=>{release=resolve});
    crypto.subtle.digest = async(...args)=>{await gate;return nativeDigest(...args)};
    let outcome;
    try {
      const pending = commercial.verifyCommercialEvidence(imported).then(()=>({accepted:true}),error=>({accepted:false,error:error.message}));
      if(target === 'observations') [imported.observations[0].revenue,imported.observations[30].revenue]=[imported.observations[30].revenue,imported.observations[0].revenue];
      else imported.receipt.mode='observed';
      release(); outcome=await pending;
      try {outcome.ranked=ranking.rankEvidence(imported,{volume:1,margin:0,lift:0}).score} catch(error) {outcome.rankError=error.message}
    } finally {release();crypto.subtle.digest=nativeDigest}
    digestFindings.push({target,...outcome});
  }
  const {emptyWorkspace} = await runner.ssrLoadModule(`${root}/src/domain/promotion/schema.ts`);
  const {ingestSource} = await runner.ssrLoadModule(`${root}/src/domain/promotion/intake.ts`);
  const {retainCommercialDecision} = await runner.ssrLoadModule(`${root}/src/domain/promotion/decision.ts`);
  const {DEMO_SOURCE,demoExtract} = await runner.ssrLoadModule(`${root}/src/services/promotion/demoExtractor.ts`);
  const {SupabaseIntelligenceRepository} = await runner.ssrLoadModule(`${root}/src/services/promotion/repository.ts`);
  const workspace = await ingestSource(emptyWorkspace(),{kind:'email',title:'SYNTHETIC',text:DEMO_SOURCE,supplier:'',representative:'',date:''},demoExtract(DEMO_SOURCE),'demo','Buyer');
  const item=workspace.opportunities[0];item.authoritativeSku=item.supplierSku;item.intelligence.resolution='MATCHED';
  const evidence=await syntheticCommercialEvidence({sku:item.supplierSku,start:'2026-01-01',end:'2026-01-03',storeIds:[1]});
  workspace.opportunities[0]=await retainCommercialDecision(item,evidence,{volume:1,margin:0,lift:0},'Buyer');
  const receipt=workspace.opportunities[0].intelligence.commercialDecisions[0].receipt;
  const contract=receipt.sourceContract;receipt.mode='observed';receipt.qualification='unverified';delete receipt.sourceContract;
  let releaseLoad,dispatched;
  const load = new Promise(resolve=>{releaseLoad=resolve});
  const chain={select(){return this},eq(){return this},single(){return load},update(body){dispatched=structuredClone(body);return this},maybeSingle(){return Promise.resolve({data:{workspace:dispatched.workspace,version:2},error:null})}};
  const repository=new SupabaseIntelligenceRepository({from:()=>chain});
  const save=repository.save(workspace,1).then(()=>({accepted:true}),error=>({accepted:false,error:error.message}));
  receipt.qualification='qualified';receipt.sourceContract=contract;
  releaseLoad({data:{workspace:emptyWorkspace(),version:1},error:null});
  const saveOutcome=await save;
  const sentReceipt=dispatched?.workspace.opportunities[0].intelligence.commercialDecisions[0].receipt;
  const results={root,canonicalScope:comparable,decimalMargin:margin,digestFindings,sharedSave:{...saveOutcome,dispatchedQualification:sentReceipt?.qualification,dispatchedContract:!!sentReceipt?.sourceContract}};
  console.log(JSON.stringify(results,null,2));
  if(process.argv.includes('--assert-safe')) {
    assert.equal(comparable,'Comparable Evidence');assert.equal(margin,0.1);
    for(const finding of digestFindings) {assert.equal(finding.accepted,false);assert.equal(finding.ranked,undefined)}
    assert.ok(!sentReceipt || (sentReceipt.qualification==='unverified'&&!sentReceipt.sourceContract));
  }
} finally {await runner.close()}
