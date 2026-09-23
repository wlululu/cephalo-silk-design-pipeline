import assert from 'node:assert/strict';

// Normalization is to a common scalar contract, not a change of physical units.
// Positive improvement means better for either supported direction. Zero reference
// magnitude cannot define a relative percentage and is rejected, never divided by.
export function scalarObjective({id, label, direction, value, baseline_value, target, valid = true}) {
 assert.ok(['decrease', 'increase'].includes(direction), 'Unsupported objective direction');
 assert.equal(target.kind, 'relative_improvement_percent');
 assert.ok(Number.isFinite(target.value) && target.value >= 0);
 const finite = Number.isFinite(value) && Number.isFinite(baseline_value) && baseline_value !== 0;
 const improvement_percent = finite ? 100 * (direction === 'decrease' ? baseline_value - value : value - baseline_value) / Math.abs(baseline_value) : null;
 return {id, label, direction, value, baseline_value, improvement_percent, target,
  valid:valid && finite && Number.isFinite(improvement_percent),
  target_reached:valid && finite && Number.isFinite(improvement_percent) && improvement_percent >= target.value};
}
