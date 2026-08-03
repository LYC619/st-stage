# STS New-Variable Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make new-variable parsing, schema validation, manual editing, diagnostics, and built-in templates internally consistent and testable.

**Architecture:** Keep schema and parser logic pure in the existing engine, add one quote-aware legacy scanner rather than extending fragile regular expressions, and route manual edits through the same validator used for AI operations. Treat templates as validated data with dedicated contract tests.

**Tech Stack:** TypeScript 5.7, Vitest 4/jsdom, native DOM, pnpm 10.

---

### Task 1: Enforce JSON Patch Structure and Schema-Gated Remove

**Files:**
- Modify: `st-extension/src/apps/newvar/engine.ts`
- Modify: `st-extension/src/apps/newvar/engine.test.ts`
- Modify: `docs/VARIABLES.md`

- [ ] **Step 1: Write failing tests**

Cover:

```ts
expect(parseUpdateBlock('<UpdateVariable>[{"op":"remove","path":"/状态"}]</UpdateVariable>'))
  .toMatchObject({ rejected: expect.arrayContaining([expect.objectContaining({ reason: expect.stringContaining('叶子') })]) })

expect(parseUpdateBlock('<UpdateVariable>[{"op":"move","path":"/体力"}]</UpdateVariable>'))
  .toMatchObject({ rejected: [expect.objectContaining({ reason: expect.stringContaining('op') })] })
```

Also cover non-object entries, missing path/value, dangerous paths, undefined leaves, a valid defined-leaf remove, and removal followed by snapshot normalization.

- [ ] **Step 2: Verify RED**

```powershell
pnpm exec vitest run st-extension/src/apps/newvar/engine.test.ts --reporter=dot
```

- [ ] **Step 3: Implement structured diagnostics**

Represent every parsed candidate as accepted or rejected. `remove` must resolve exactly one schema leaf; parent objects and unknown leaves are rejected. Keep processing later valid operations while retaining ordered diagnostics.

- [ ] **Step 4: Verify and commit**

```powershell
git commit -m "fix: validate new-variable patch operations"
```

### Task 2: Generate Parseable Prompt Examples

**Files:**
- Modify: `st-extension/src/apps/newvar/engine.ts`
- Modify: `st-extension/src/apps/newvar/engine.test.ts`

- [ ] **Step 1: Write prompt round-trip RED tests**

Extract the generated `<UpdateVariable>` JSON Patch example, parse it with `JSON.parse`, and assert it contains a valid value for number, boolean, enum, and text definitions. Feed a representative generated-format response back through the parser and validator.

- [ ] **Step 2: Implement typed examples**

Use `JSON.stringify` on concrete example values rather than interpolating `新值` as an unquoted token:

```ts
function exampleValue(def: VariableDefinition): unknown {
  if (def.type === 'number') return def.min ?? 0
  if (def.type === 'boolean') return true
  if (def.type === 'enum') return def.options?.[0] ?? ''
  return '新值'
}
```

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "fix: emit valid variable update examples"
```

### Task 3: Replace the Legacy `_.set` Regex Parser

**Files:**
- Create: `st-extension/src/apps/newvar/legacy-set-parser.ts`
- Create: `st-extension/src/apps/newvar/legacy-set-parser.test.ts`
- Modify: `st-extension/src/apps/newvar/engine.ts`

- [ ] **Step 1: Write scanner RED tests**

Cover exact parsing of:

```ts
_.set('状态.网址', 'https://example.test/a//b', 'https://next.test/a,b')
_.set("状态.说明", "旧值,含逗号", "新值)含括号")
_.set('状态.引号', 'old', '他说\\'你好\\'') // escaped quote
```

Reject unterminated quotes, trailing garbage, missing arguments, executable expressions, and prototype-dangerous paths.

- [ ] **Step 2: Implement one-pass quote-aware scanning**

Expose:

```ts
export interface LegacySetCall { path: string; oldValue: unknown; newValue: unknown }
export function parseLegacySetCalls(source: string): {
  calls: LegacySetCall[]
  errors: string[]
}
```

The scanner recognizes only `_.set(` and JSON-like primitive/string arguments. It never evaluates JavaScript.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "fix: parse legacy variable updates safely"
```

### Task 4: Validate Manual Variable Editing

**Files:**
- Modify: `st-extension/src/apps/variable-tree.ts`
- Create or modify: `st-extension/src/apps/variable-tree.test.ts`
- Modify: `st-extension/src/apps/newvar/runtime.ts`
- Create or modify: `st-extension/src/apps/newvar/runtime.test.ts`

- [ ] **Step 1: Write UI and runtime RED tests**

Assert a number edit rejects text, clamps or rejects out-of-range values according to engine policy, enum edits allow only configured values, booleans remain boolean, and invalid commits leave persisted state unchanged while displaying an error.

- [ ] **Step 2: Route edits through one validator**

Expose a runtime operation:

```ts
setManualValue(path: string, rawValue: unknown):
  | { ok: true; value: unknown }
  | { ok: false; error: string }
```

The tree receives variable definitions and uses type-appropriate controls: number input, enum select, boolean toggle, and text input. Runtime remains the final validation boundary.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "fix: validate manual variable edits"
```

### Task 5: Correct Built-In Templates

**Files:**
- Modify: `st-extension/src/apps/newvar/templates.ts`
- Create: `st-extension/src/apps/newvar/templates.test.ts`
- Modify: `docs/VARIABLES.md`

- [ ] **Step 1: Write template contract RED tests**

For every built-in template, assert:

- unique template ID and variable path;
- defaults pass `validateValue`;
- number ranges and enum options are complete;
- every definition has a non-empty description and update rule;
- generated prompt is parseable and contains no stale placeholder identity after applying a renamed-character fixture.

Add focused expectations for multi-character presence gating, RPG mana rules, concrete relationship thresholds, and explicit date/time state.

- [ ] **Step 2: Implement corrections**

Use concrete relationship stages:

```text
陌生 0-19；熟悉 20-39；信任 40-59；亲密 60-79；挚爱 80-100
```

Repeat the presence condition on each character-dependent variable. Replace identity-bearing prose through template parameters instead of asking users to rename paths manually.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "fix: correct built-in variable templates"
```

### Task 6: Add Practical Variable Templates

**Files:**
- Modify: `st-extension/src/apps/newvar/templates.ts`
- Modify: `st-extension/src/apps/newvar/templates.test.ts`
- Modify: `docs/VARIABLES.md`

- [ ] **Step 1: Write RED tests for three template fixtures**

Assert exact IDs and paths for:

```ts
['survival-exploration', 'mystery-investigation', 'quest-progression']
```

Each template must stay within primitive leaves, provide valid defaults/ranges/enums, generate a bounded prompt, and round-trip one valid update in both JSON Patch and legacy formats.

- [ ] **Step 2: Implement templates**

Survival fields: health, hunger, thirst, fatigue, temperature state, danger, location, time.

Mystery fields: objective, clue summary, suspicion, urgency, location, phase.

Quest fields: goal, progress, phase, blocker, deadline pressure, complete.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "feat: add practical variable templates"
```

### Task 7: Variable Integration Verification

**Files:**
- Regenerate: `bundle.js`
- Regenerate only when changed: `index.js`, `style.css`, `version.json`

- [ ] **Step 1: Run focused and full gates**

```powershell
pnpm exec vitest run st-extension/src/apps/newvar --reporter=dot
pnpm test -- --reporter=dot
pnpm typecheck
pnpm lint
pnpm build:ext
git diff --check
```

- [ ] **Step 2: Commit generated integration output**

```powershell
git commit -m "test: verify new-variable update integration"
```
