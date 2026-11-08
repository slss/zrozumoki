import {parseMoney,VERSION,RULES,SOURCE} from './engine.mjs';
const meta={calculationVersion:VERSION,rulesVersion:RULES,checkedAt:'2026-11-08',currency:'PLN',sources:[SOURCE]};
const format=(n,d=6)=>{const s=n.toString().padStart(d+1,'0');return s.slice(0,-d)+'.'+s.slice(-d);};
function check(v,keys){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Oczekiwano obiektu danych.');for(const k of Object.keys(v))if(!keys.includes(k))throw Error('Nieobsługiwane pole: '+k);}
export function history(input){
 try{
 check(input,['taxYear','group','rows']);if(input.taxYear!==2027)return {...meta,status:'unsupported_year',message:'Analizator obsługuje pełny rok 2027.'};
 if(!['S','I','N'].includes(input.group))throw Error('Potwierdź jedną grupę aktywów.');
 if(!Array.isArray(input.rows)||input.rows.length!==365)return {...meta,status:'needs_data',message:'Potrzebne są wszystkie 365 wycen końca dnia za pełny rok 2027, bez luk.'};
 let total=0n;const months=Array.from({length:12},()=>({sum:0n,count:0}));
 for(let i=0;i<365;i++){
  const row=input.rows[i];check(row,['date','valuePln','depositPln','withdrawalPln']);
  const date=new Date(Date.UTC(2027,0,i+1)),expected=date.toISOString().slice(0,10);
  if(row.date!==expected)throw Error('Brak lub niepoprawna kolejność dat: oczekiwano '+expected);
  const value=parseMoney(row.valuePln,'valuePln'),dep=parseMoney(row.depositPln,'depositPln'),wd=parseMoney(row.withdrawalPln,'withdrawalPln');
  if(dep>0n&&wd>0n)return {...meta,status:'unsupported_case',message:'Wpłata i wypłata tego samego dnia wymagają odrębnej korekty. Ten analizator nie obsługuje tego przypadku.'};
  total+=value;months[date.getUTCMonth()].sum+=value;months[date.getUTCMonth()].count++;
 }
 const limit=input.group==='S'?2500000n:input.group==='I'?10000000n:0n,baseNumerator=total>limit*365n?total-limit*365n:0n;
 const average=format(total*10000n/365n),tax=format(baseNumerator*85n/365n),basePln=format(baseNumerator*10000n/365n);
 return {...meta,status:'ok',calculationMode:'daily_history_single_group_full_2027',input,metrics:[{label:'Średnia roczna (zł, do 6 miejsc)',value:average,unit:'PLN'},{label:'Podstawa po zwolnieniu (zł)',value:basePln,unit:'PLN'},{label:'Kwota przed końcowym zaokrągleniem',value:tax,unit:'PLN'}],rows:months.map((m,i)=>({month:i+1,averagePln:format(m.sum*10000n/BigInt(m.count))})),limitations:['Wyłącznie jedno konto posiadane przez cały 2027 r., jedna potwierdzona grupa i komplet dziennych wycen w PLN. Nie uwzględnia innych kont podatnika.','Nie obsługuje transferów, zmian grup, parasola, walut ani jednoczesnej wpłaty i wypłaty. Wycenę i kwalifikację przygotowuje użytkownik.','Przy braku jednoczesnych wpłat i wypłat korekta wpłat w obsługiwanym zakresie jest zerowa. Podana wartość dnia ma już obejmować aktywa po przepływach.','Rachunek ilorazowy na BigInt; prezentacja do 6 miejsc przez obcięcie. Brak końcowego zaokrąglenia zobowiązania i obsługi zeznania.']};
 }catch(e){return {...meta,status:e.status??'invalid_input',field:e.field??'rows',message:e.message};}
}
export function cashflow(input){
 try{check(input,['initialPln','annualReturnPercent','group','flowDate','flowPln','direction']);const initial=Number(parseMoney(input.initialPln))/100,flow=Number(parseMoney(input.flowPln))/100;
 if(typeof input.annualReturnPercent!=='number'||!Number.isFinite(input.annualReturnPercent)||input.annualReturnPercent< -50||input.annualReturnPercent>50)throw Error('Zwrot poza zakresem −50% do 50%.');
 if(!['S','I','N'].includes(input.group)||!['deposit','withdrawal'].includes(input.direction))throw Error('Wybierz grupę i kierunek przepływu.');
 const when=new Date(input.flowDate+'T00:00:00Z');if(!/^2027-\d\d-\d\d$/.test(input.flowDate??'')||!Number.isFinite(when.getTime())||when.toISOString().slice(0,10)!==input.flowDate)throw Error('Podaj poprawną datę w roku 2027.');
 const daily=Math.pow(1+input.annualReturnPercent/100,1/365)-1,limit=input.group==='S'?25000:input.group==='I'?100000:0;let before=initial,after=initial,sumA=0,sumB=0;
 for(let i=0;i<365;i++){if(new Date(Date.UTC(2027,0,i+1)).toISOString().slice(0,10)===input.flowDate){if(input.direction==='withdrawal'&&flow>after)return {...meta,status:'insufficient_funds',message:'W zadanym dniu brakuje środków na wypłatę.'};after+=input.direction==='deposit'?flow:-flow;}before*=1+daily;after*=1+daily;sumA+=before;sumB+=after;}
 const avgA=sumA/365,avgB=sumB/365;
 return {...meta,status:'ok',input,calculationMode:'one_flow_full_year_model',metrics:[{label:'Średnia modelowa bez zmiany',value:avgA.toFixed(2),unit:'PLN'},{label:'Średnia modelowa z przepływem',value:avgB.toFixed(2),unit:'PLN'},{label:'Kwota arytmetyczna bez zmiany',value:(Math.max(0,avgA-limit)*.0085).toFixed(6),unit:'PLN'},{label:'Kwota arytmetyczna po zmianie',value:(Math.max(0,avgB-limit)*.0085).toFixed(6),unit:'PLN'}],rows:[],limitations:['Jedno konto i grupa przez pełny 2027 r., jeden przepływ na początku wybranego dnia i jawny stały modelowy zwrot. Bez innych kont i przepływów.','Nie wyznacza faktycznych wycen ani klasyfikacji instrumentu; brak kosztów. To model wpływu daty, nie rozliczenie podatkowe.']};
 }catch(e){return {...meta,status:e.status??'invalid_input',field:e.field??'input',message:e.message};}
}
