export const VERSION = '1.0.0';
export const RULES = '2027-averages-v1';
export const SOURCE = 'https://eli.gov.pl/eli/DU/2026/1098/ogl/pol';
const meta = { calculationVersion: VERSION, rulesVersion: RULES, checkedAt: '2026-11-08', currency: 'PLN', sources: [SOURCE] };
class InputError extends Error { constructor(message, field, status = 'invalid_input') { super(message); this.field = field; this.status = status; } }
const fail = (message, field, status) => { throw new InputError(message, field, status); };
function object(v) { if (!v || typeof v !== 'object' || Array.isArray(v)) fail('Podaj obiekt danych.', 'input'); }
function keys(v, allowed) { object(v); for (const k of Object.keys(v)) if (!allowed.includes(k)) fail('Nieobsługiwane pole.', k); }
function required(v, key) { if (v === undefined || v === null || v === '') fail('Uzupełnij wymagane dane.', key, 'needs_data'); }
export function parseMoney(v, key = 'amount') {
  required(v, key);
  if (typeof v !== 'string' || !/^\d{1,10}(\.\d{1,2})?$/.test(v)) fail('Kwota musi być nieujemnym tekstem dziesiętnym PLN, maks. 2 miejsca po kropce.', key);
  const [a,b=''] = v.split('.'); return BigInt(a)*100n + BigInt(b.padEnd(2,'0'));
}
const decimal = (n, digits = 2) => { const s = n.toString().padStart(digits + 1, '0'); return s.slice(0,-digits)+'.'+s.slice(-digits); };
function number(v, key, min, max, integer = false) {
  required(v,key); if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) fail(`Wartość poza zakresem ${min}–${max}.`,key); return v;
}
const min = (a,b) => a < b ? a : b;
function averages(input) {
  keys(input, ['taxYear','accounts']);
  required(input.taxYear, 'taxYear');
  if (input.taxYear !== 2027) fail('Ten rachunek obsługuje wyłącznie rok 2027. Przyszłe lata nie są rozliczeniem.', 'taxYear', 'unsupported_year');
  required(input.accounts,'accounts');
  if (!Array.isArray(input.accounts) || input.accounts.length < 1 || input.accounts.length > 50) fail('Podaj od 1 do 50 kont.', 'accounts');
  const totals = [0n,0n,0n];
  const fields = ['savingsGroupAveragePln','investmentGroupAveragePln','nonExemptGroupAveragePln'];
  input.accounts.forEach((account,i) => { keys(account, fields); fields.forEach((field,j) => totals[j] += parseMoney(account[field], `accounts.${i}.${field}`)); });
  const [s,i,n] = totals, es = min(s,2500000n), ei = min(i,10000000n-es), base = s+i+n-es-ei;
  // Cents × 85 / 10000 gives cents; preserve all six decimal places in PLN.
  return { ...meta, status: 'ok', calculationMode: 'annual_averages_before_final_rounding', input,
    totals: Object.fromEntries(['S','I','N'].map((k,j)=>[k,decimal(totals[j])])),
    exemptions: { S:decimal(es), I:decimal(ei) }, taxBasePln:decimal(base),
    taxBeforeFinalRoundingPln:decimal(base*85n,6), ratePercent:'0.85',
    steps:['Zsumowano średnie wszystkich kont według grup.','Odjęto zwolnienie S do 25 000 zł, następnie I do pozostałej części 100 000 zł.','Podstawę pomnożono przez 0,85%.'],
    limitations:['Dane muszą być już poprawnie zakwalifikowanymi średnimi rocznymi, nie wpłatami ani saldem.','To kwota arytmetyczna przed końcowym zaokrągleniem zobowiązania, nie zeznanie podatkowe.'] };
}
const scenarioKeys = ['initialPln','monthlyPln','years','annualReturnPercent','annualFixedFeePln','annualFeePercent'];
function scenario(input, extra = []) {
  keys(input,[...scenarioKeys,...extra]);
  const initial = Number(parseMoney(input.initialPln,'initialPln'))/100;
  const monthly = Number(parseMoney(input.monthlyPln,'monthlyPln'))/100;
  const years = number(input.years,'years',1,40,true);
  const rate = number(input.annualReturnPercent,'annualReturnPercent',-50,50)/100;
  const fixed = Number(parseMoney(input.annualFixedFeePln,'annualFixedFeePln'))/100;
  const fee = number(input.annualFeePercent,'annualFeePercent',0,10)/100;
  return { initial,monthly,years,rate,fixed,fee };
}
const amount = n => n.toFixed(2);
function simulatePath(p, taxOptions) {
  let balance=p.initial, fees=0, taxes=0; const rows=[];
  for(let y=0;y<p.years;y++) {
    const year=(p.startYear??2027)+y, days=(year%4===0 && (year%100!==0 || year%400===0))?366:365;
    const daily=Math.pow(1+p.rate,1/days)-1; let sum=0, yearFees=0, yearTax=0;
    for(let day=0;day<days;day++) {
      const date=new Date(Date.UTC(year,0,day+1));
      if(date.getUTCDate()===1) balance+=p.monthly;
      balance*=1+daily; sum+=balance;
    }
    const average=sum/days;
    // Year-end costs and model tax paid from portfolio after its final daily valuation.
    yearFees=Math.min(balance,p.fixed+balance*p.fee); balance-=yearFees; fees+=yearFees;
    if(taxOptions) {
      const rate=y===0?0.0085:taxOptions.futureRate;
      const scale=year>=2030?Math.pow(1+taxOptions.indexation,year-2029):1;
      const exemption=taxOptions.group==='S'?25000*scale:taxOptions.group==='I'?100000*scale:0;
      yearTax=Math.min(balance,Math.max(0,average-exemption)*rate); balance-=yearTax; taxes+=yearTax;
      if(Math.max(0,average-exemption)*rate>yearTax+0.000001) fail('Brak środków na modelowy podatek. Ten przypadek wymaga innego sposobu finansowania.','scenario','unsupported_case');
    }
    if(!Number.isFinite(balance) || balance>1e13) fail('Wynik poza obsługiwanym zakresem modelu.','scenario','unsupported_case');
    rows.push({year,averagePln:amount(average),balancePln:amount(balance),feesPln:amount(yearFees),taxPln:amount(yearTax)});
  }
  return { balancePln:amount(balance),feesPln:amount(fees),taxPln:amount(taxes),rows };
}
const modelLimitations=[
  'Symulacja jednego konta i jednej grupy, od początku 2027 r. Brak innych kont, walut, dywidend, wypłat i podatków zagranicznych.',
  'Wpłaty pierwszego dnia miesiąca, stała modelowa stopa przeliczona na dni kalendarzowe. Brak losowości i prognozy.',
  'Opłaty i modelowy podatek OKI pobierane z portfela na koniec roku. To założenie modelu, nie termin ustawowej zapłaty podatku.',
  'Średnie symulowane z dziennych wartości jednej grupy bez wpłat i wypłat tego samego dnia. Model zmiany wartości nie jest historią rzeczywistych wycen.',
  'Symulacja używa arytmetyki zmiennoprzecinkowej; wyniki prezentowane do groszy. Nie służy do rozliczenia.'
];
function savings(input) {
  const p=scenario(input), path=simulatePath(p);
  return {...meta,status:'ok',input,calculationMode:'capital_model_without_tax',contributionsPln:amount(p.initial+12*p.monthly*p.years),...path,limitations:[...modelLimitations,'Ten kalkulator nie uwzględnia podatków. Porównanie rachunków jest osobnym narzędziem.']};
}
function compare(input) {
  const p=scenario(input,['group','futureTaxPercent','thresholdIndexationPercent']);
  if(!['S','I','N'].includes(input.group)) fail('Wybierz potwierdzoną grupę S, I lub N.','group');
  const futureRate=number(input.futureTaxPercent,'futureTaxPercent',0.1,5)/100;
  const indexation=number(input.thresholdIndexationPercent,'thresholdIndexationPercent',0,20)/100;
  const oki=simulatePath(p,{group:input.group,futureRate,indexation});
  const ordinary=simulatePath(p), contributions=p.initial+12*p.monthly*p.years;
  const pit=Math.max(0,Number(ordinary.balancePln)-contributions)*0.19;
  ordinary.taxPln=amount(pit); ordinary.netBalancePln=amount(Number(ordinary.balancePln)-pit);
  return {...meta,status:'ok',input,calculationMode:'scenario_comparison_not_tax_return',contributionsPln:amount(contributions),oki,ordinary,
    differencePln:amount(Number(oki.balancePln)-Number(ordinary.netBalancePln)),
    assumptions:{ ordinaryTaxPercent:19,ordinaryRealization:'end_only',futureOkiTaxPercent:input.futureTaxPercent,thresholdIndexationFrom2030Percent:input.thresholdIndexationPercent },
    limitations:[...modelLimitations,'Stawka OKI od 2028 r. i zmiana progów od 2030 r. są stałymi założeniami użytkownika, nie znanymi parametrami przyszłości.','Zwykły rachunek: jedna sprzedaż na końcu, 19% od dodatniej różnicy po modelowych opłatach, bez kompensacji strat, szczegółowej kwalifikacji kosztów i PIT-38.','Jednakowa taryfa obu wariantów. Wartość OKI po podatkach, a zwykłego rachunku po końcowej sprzedaży. Kwota początkowa traktowana jak nowa wpłata, nie istniejący portfel.'] };
}
function costs(input) {
  const p=scenario(input), withFees=simulatePath(p), withoutFees=simulatePath({...p,fixed:0,fee:0});
  return {...meta,status:'ok',input,calculationMode:'cost_model_without_tax',withFees,withoutFees,costImpactPln:amount(Number(withoutFees.balancePln)-Number(withFees.balancePln)),limitations:[...modelLimitations,'Koszt całkowity obejmuje model utraconego wzrostu, a opłaty to suma pobranych kwot. Brak podatków, prowizji transakcyjnych, minimalnych i walutowych.']};
}
function migrate(input) {
  keys(input,[...scenarioKeys,'group','futureTaxPercent','thresholdIndexationPercent','acquisitionCostPln','saleFeePln']);
  const acquisition=Number(parseMoney(input.acquisitionCostPln,'acquisitionCostPln'))/100;
  const saleFee=Number(parseMoney(input.saleFeePln,'saleFeePln'))/100;
  const raw={...input}; delete raw.acquisitionCostPln; delete raw.saleFeePln;
  const p=scenario(raw,['group','futureTaxPercent','thresholdIndexationPercent']);
  if(saleFee>p.initial) fail('Opłata sprzedaży przewyższa wartość portfela.','saleFeePln');
  const upfrontTax=Math.max(0,p.initial-acquisition-saleFee)*0.19;
  const proceeds=p.initial-saleFee-upfrontTax;
  const newMoney=compare({...raw,initialPln:'0.00'});
  const held=simulatePath({...p,monthly:0});
  const endTax=Math.max(0,Number(held.balancePln)-acquisition)*0.19;
  // Two components simulate the same one-group OKI but their exemptions cannot be used twice.
  const combined=compare({...raw,initialPln:amount(proceeds)});
  const keep=Number(held.balancePln)-endTax+Number(newMoney.oki.balancePln);
  return {...meta,status:'ok',input,calculationMode:'existing_portfolio_simplified_sale',upfrontTaxPln:amount(upfrontTax),upfrontSaleFeePln:amount(saleFee),proceedsPln:amount(proceeds),sellNowNetPln:combined.oki.balancePln,keepPortfolioNetPln:amount(keep),differencePln:amount(Number(combined.oki.balancePln)-keep),
    limitations:[...combined.limitations.filter((_,i)=>i!==0 && i!==7),'Porównanie sprzedaży całego starego portfela teraz i wpłaty środków do jednego OKI z pozostawieniem go na zwykłym rachunku oraz kierowaniem nowych wpłat do jednego OKI. To nie transfer papierów.','Uproszczony PIT 19% dodatniego modelowego zysku; brak rozliczania strat, kosztów zakupu nowych instrumentów i pozostałych przychodów.','Taryfa roczna stosowana per konto: wariant zachowania portfela ma dwa konta. Opłata sprzedaży teraz dotyczy tylko wariantu sprzedaży; nie modelujemy końcowych prowizji sprzedaży.']};
}
const operations={calculate_oki_tax_from_averages:averages,simulate_oki_scenario:savings,compare_oki_scenarios:compare,calculate_oki_costs:costs,compare_existing_portfolio:migrate};
export function execute(name,input) {
  try { if(!operations[name]) fail('Nieobsługiwane narzędzie.','tool','unsupported_case'); return operations[name](input); }
  catch(error) { return {...meta,status:error instanceof InputError?error.status:'calculation_error',field:error.field??null,message:error instanceof InputError?error.message:'Nie udało się obliczyć wyniku.'}; }
}
export function methodology() { return {...meta,status:'ok',supportedTaxYears:[2027],simulationStartYear:2027,limitations:modelLimitations,rounding:'K01: dokładne grosze BigInt, kwota arytmetyczna do 6 miejsc, bez końcowego zaokrąglenia zobowiązania. Symulacje: Number i prezentacja do groszy.'}; }

export { scenario, simulatePath, compare, modelLimitations, amount };
