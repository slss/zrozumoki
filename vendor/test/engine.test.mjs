import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execute} from '../core/engine.mjs';
import {tools,registerTools} from '../core/tools.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures.json',import.meta.url)));
const account=(s='0',i='0',n='0')=>({savingsGroupAveragePln:s,investmentGroupAveragePln:i,nonExemptGroupAveragePln:n});
const tax=accounts=>execute('calculate_oki_tax_from_averages',{taxYear:2027,accounts});
const plan={initialPln:'100000',monthlyPln:'0',years:1,annualReturnPercent:0,annualFixedFeePln:'0',annualFeePercent:0};
const compare={...plan,group:'I',futureTaxPercent:0.85,thresholdIndexationPercent:0};
for(const c of fixture.cases) test(c.title,()=>{
 const r=tax([account(c.S,c.I,c.N)]); assert.equal(r.status,'ok');
 assert.equal(Number(r.taxBasePln),Number(c.tax_base));assert.equal(Number(r.exemptions.S),Number(c.exemption_S));assert.equal(Number(r.exemptions.I),Number(c.exemption_I));assert.equal(Number(r.taxBeforeFinalRoundingPln),Number(c.tax_before_rounding));
});
test('wspólne zwolnienia dwóch kont i dokładna nadwyżka groszowa',()=>{
 assert.equal(tax([account('0','80000'),account('0','80000')]).taxBasePln,'60000.00');
 assert.equal(tax([account('0','100000.01')]).taxBeforeFinalRoundingPln,'0.000085');
});
test('nieznane lata, brak i błędne kwoty nie dają zera',()=>{
 assert.equal(execute('calculate_oki_tax_from_averages',{taxYear:2028,accounts:[account()]}).status,'unsupported_year');
 for(const value of ['',undefined,null,-1,'-1','NaN','1e4','1,25','0.001',' 0 ',{}])assert.notEqual(tax([{...account(),savingsGroupAveragePln:value}]).status,'ok');
 assert.equal(tax([]).status,'invalid_input');
 assert.equal(tax([{...account(),other:'0'}]).status,'invalid_input');
});
test('zerowy zwrot: wpłaty pozostają kapitałem i nie rodzą PIT',()=>{
 const r=execute('compare_oki_scenarios',{...compare,initialPln:'0',monthlyPln:'100'});
 assert.equal(r.oki.balancePln,'1200.00');assert.equal(r.ordinary.netBalancePln,'1200.00');assert.equal(r.ordinary.taxPln,'0.00');
});
test('N bez zwolnienia: znana stała wycena, podatek od aktywów',()=>{
 const r=execute('compare_oki_scenarios',{...compare,group:'N'});assert.equal(r.oki.taxPln,'850.00');assert.equal(r.oki.balancePln,'99150.00');
});
test('opłaty: kwota pobrana i wpływ nie są mylone',()=>{
 const r=execute('calculate_oki_costs',{...plan,annualFixedFeePln:'100',annualFeePercent:1});
 assert.equal(r.withFees.feesPln,'1100.00');assert.equal(r.costImpactPln,'1100.00');
});
test('wzrost dzienny daje roczny zwrot, także rok przestępny 2028',()=>{
 const r=execute('simulate_oki_scenario',{...plan,years:2,annualReturnPercent:10});assert.equal(r.balancePln,'121000.00');assert.equal(r.rows[1].year,2028);
});
test('spadek nie daje ujemnego podatku zwykłego rachunku',()=>{
 const r=execute('compare_oki_scenarios',{...compare,annualReturnPercent:-20,group:'N'});assert.equal(r.ordinary.taxPln,'0.00');assert.ok(Number(r.oki.taxPln)>0);
});
test('brak przyszłych założeń i nieznana grupa są odrzucane',()=>{
 const {futureTaxPercent,...missing}=compare; assert.equal(execute('compare_oki_scenarios',missing).status,'needs_data');
 assert.equal(execute('compare_oki_scenarios',{...compare,group:'ETF'}).status,'invalid_input');
 for(const v of [NaN,Infinity,'5',null])assert.notEqual(execute('simulate_oki_scenario',{...plan,annualReturnPercent:v}).status,'ok');
});
test('zmiana portfela: podatek teraz i jeden wspólny próg dla nowych wpłat',()=>{
 const r=execute('compare_existing_portfolio',{...compare,acquisitionCostPln:'50000',saleFeePln:'0',monthlyPln:'2000'});
 assert.equal(r.status,'ok');assert.equal(r.upfrontTaxPln,'9500.00');assert.equal(r.proceedsPln,'90500.00');assert.ok(Number(r.sellNowNetPln)<114500);
 const zero=execute('compare_existing_portfolio',{...compare,initialPln:'0',acquisitionCostPln:'0',saleFeePln:'0',monthlyPln:'100'});assert.equal(zero.differencePln,'0.00');
});
test('narzędzie i silnik dają to samo; rejestracja to tylko test kontraktu',async()=>{
 const args={taxYear:2027,accounts:[account('25000','100000')]};
 assert.deepEqual(tools[0].execute(args),tax(args.accounts));
 assert.equal((await registerTools({})).status,'unavailable');
 const registered=[];const mock={modelContext:{registerTool:async(t,o)=>{assert.ok(o.signal);registered.push(t);}}};
 const r=await registerTools(mock);assert.equal(r.status,'registered');assert.equal(registered.length,tools.length);assert.deepEqual(registered[0].execute(args),tax(args.accounts));r.dispose();
 const broken=await registerTools({modelContext:{registerTool:()=>{throw Error('no');}}});assert.equal(broken.status,'registration_error');
});
