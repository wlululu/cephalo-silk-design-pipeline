import assert from 'node:assert/strict';
import {createBridgeObjective, createBridgeDesignVariable, bridgeAcceptance} from './bridge-adapters.mjs';

// Static allowlists: configuration selects implemented adapters, never executable code.
const objectives = new Map([['bridge.maxDeckDisplacement', createBridgeObjective]]);
const variables = new Map([['bridge.primaryScale', createBridgeDesignVariable]]);
const acceptances = new Map([['bridge.original-acceptance', bridgeAcceptance]]);
const resolve = (registry, id) => {
 assert.ok(registry.has(id), `Unsupported adapter: ${id}`);
 return registry.get(id);
};
export function resolveAdapters(policy, context) {
 const objective = resolve(objectives, policy.objective.adapter_id);
 const variable = resolve(variables, policy.design_variable.adapter_id);
 const acceptance = resolve(acceptances, policy.acceptance.adapter_id);
 return {objectiveAdapter:objective(policy.objective), designVariableAdapter:variable(policy, context), acceptance};
}
