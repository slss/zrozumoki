import {execute as original,methodology as baseMethodology} from './engine.mjs';
import {extendedExecute} from './planner.mjs';
import {history,cashflow} from './history.mjs';
import {wrappers} from './wrappers.mjs';
export function execute(name,input){if(name==='calculate_oki_year_from_history')return history(input);if(name==='simulate_oki_cashflow_date')return cashflow(input);if(name==='compare_savings_wrappers')return wrappers(input);return extendedExecute(name,input)??original(name,input);}
export function methodology(){return {...baseMethodology(),planningModels:'monthly_without_tax',historyScope:'one_account_one_group_full_2027_no_transfers_no_same_day_inout',retirementScope:'new_plans_qualified_withdrawal_age_65_five_contribution_years',futureParameters:'user_assumptions_not_forecasts'};}
