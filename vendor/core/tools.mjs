import {execute,methodology} from './api.mjs';
import {calculators,fields} from './definitions.mjs';
const money={type:'string',pattern:'^\\d{1,10}(\\.\\d{1,2})?$'};
const groupSchema={type:'object',required:['S','I','N'],additionalProperties:false,properties:{S:money,I:money,N:money}};
const account={type:'object',additionalProperties:false,properties:{savingsGroupAveragePln:money,investmentGroupAveragePln:money,nonExemptGroupAveragePln:money},required:['savingsGroupAveragePln','investmentGroupAveragePln','nonExemptGroupAveragePln']};
export function schemaFor(spec){
 let properties=Object.fromEntries(spec.fields.map(k=>[k,{...fields[k].schema,description:fields[k].label+'. '+fields[k].hint}]));
 for(const [k,value] of Object.entries(spec.preset))properties[k]={const:value,type:typeof value};
 if(spec.id==='S08')properties={taxYear:{type:'integer',enum:[2027]},accounts:{type:'array',minItems:1,maxItems:50,items:account}};
 if(spec.id==='S20')properties={before:groupSchema,after:groupSchema};
 return {type:'object',properties,required:Object.keys(properties),additionalProperties:false};
}
export function toolFor(spec){return {name:spec.tool,description:spec.intro+' Zadanie: '+spec.question,inputSchema:schemaFor(spec),annotations:{readOnlyHint:true},execute:input=>{
 if(!input||typeof input!=='object'||Array.isArray(input))return {status:'invalid_input',message:'Podaj obiekt danych.'};
 for(const [key,value] of Object.entries(spec.preset))if(input[key]!==value)return {status:'invalid_input',field:key,message:'Ten tryb wymaga wartości '+String(value)};
 return execute(spec.tool,input);
}};}
const methodTool={name:'get_oki_methodology',description:'Odczytaj wersję, źródła i zakres metod; symulacje nie zastępują rozliczenia.',inputSchema:{type:'object',properties:{},required:[],additionalProperties:false},annotations:{readOnlyHint:true},execute:input=>(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)?{status:'invalid_input',message:'Ta operacja przyjmuje pusty obiekt.'}:methodology()};
export const tools=[...new Map(calculators.map(spec=>[spec.tool,toolFor(spec)])).values(),methodTool];
export async function registerTools(doc=globalThis.document,selection){
 if(typeof doc?.modelContext?.registerTool!=='function')return {status:'unavailable'};
 const selected=selection&&typeof selection==='object'&&!Array.isArray(selection)?[toolFor(selection),methodTool]:selection?tools.filter(t=>selection.includes(t.name)):tools;
 const lifecycle=new AbortController();
 try{for(const tool of selected)await doc.modelContext.registerTool(tool,{signal:lifecycle.signal});return {status:'registered',dispose:()=>lifecycle.abort()};}
 catch{lifecycle.abort();return {status:'registration_error'};}
}
