# dsh-deep-ptc-mode

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-deep-ptc-mode.svg)](https://www.npmjs.com/package/dsh-deep-ptc-mode)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-0.2.1%2B-4B6BFB)](https://github.com/deepseek-ai/deepseek-harness)

[简体中文](README.zh.md)

## Introduction

**Deep PTC mode** (「深度PTC模式」) is an open-source agent preset for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), for sessions where the model should work visibly and spend its full capability instead of rationing tokens.

It keeps the built-in **PTC** preset's surface exactly — the same programmatic `run_code` tooling, the same tool list, sub-agent wiring, plan mode and compaction — and replaces only the persona with a working contract:

- **Visible progress.** One short sentence before every `run_code`; longer updates at real milestones; no silent stretches.
- **No token anxiety.** Reads, searches, commands and verification are the work, not a cost to cut.
- **Ask what it means.** Unknown names, unresolved referents, competing technical routes, unclear sources and unstated expectations about process get asked about first — the model asks the user, not a search engine. One to three concrete questions, options with the recommended one first.
- **Converge, then build.** The answers turn into a one-paragraph plan with success criteria and an explicit "not doing" list; scope does not grow past what was agreed.
- **Plan by size.** Five minutes or less is planned internally and executed. Five to twenty minutes gets the plan written out, then work starts without waiting for approval. More than twenty minutes gets the plan written out and approved before any work. Plan mode's own rules still win.
- **Wait without blocking.** Never sleeps and never holds one long foreground call. A long command, build, test run or external job runs in the background with its job id noted, and the turn ends; a finished job or a user message wakes the model at once, so the user can redirect it while it waits. When no job will finish, `schedule_create` provides the reminder instead of a timer.
- **Delegate when the work splits.** Small sequential work stays with one agent; genuinely independent pieces, broad exploration, parallel verification or an independent reviewer can become subagents or an Agent Team.
- **DeepSeek's unlimited token budget.** The persona says the budget is unlimited and turns it into depth and verification — with guardrails against padding, rambling updates and context overflow.

Pick **深度PTC模式** in the mode picker when starting a new task. Same tools, same `run_code` surface, same plan mode and compaction as the built-in PTC preset; other presets and the deployment-level system prompt are untouched.

## What changes compared with the built-in PTC preset

| Habit | What Deep PTC mode does |
| --- | --- |
| Head down and silent, one big hand-off at the end | One short sentence before every `run_code` says what is about to be checked, changed or verified. At real milestones — first pass of inspection, plan fixed, a batch of edits done, tests run, direction changed — the update is a little longer. If two or three tool calls go by without a word, the agent stops and reports where it is. |
| Skimping on tools and verification to save tokens | Tool calls are the work, not a cost: no skipping a read, a search, a command or a check to save tokens. Related calls are batched into one `run_code` program, verification is matched to the task, and scope is not expanded beyond the user's success criteria. |
| Guessing at what the user meant | Ask about meaning, not permission. An unknown preset, plugin, product or codename; an unresolved "that thing we did last time"; several materially different technical routes; an unclear source of truth, environment or version; or an unstated expectation about process — each gets a question to the user before any work starts. Searching the workspace for the user's own terminology is explicitly ruled out. Questions go through `ask_user_question` from a `run_code` program, 1–3 at a time, options with the recommended one first, and a generous `timeoutMs` (for example 600000) so the wait is not cut off. "I don't know" is a valid answer and hands the choice to the model; a real answer outranks the model's inference. |
| Doing more than was asked | Scope is treated as part of intent: the smallest change that satisfies the confirmed criteria, no unrequested features, refactors or abstractions, and verification sized to the change rather than turned into a new project. If the work seems to need more, the model asks before expanding it, and its plan states what it is deliberately not doing. |
| Treating every task the same way | The expected time to finish chooses the planning behavior. Five minutes or less: plan internally and execute. Five to twenty minutes: write the plan out, start at once without waiting for approval, and stay open to redirection. More than twenty minutes: write the plan out and ask for approval before any work. When the estimate crosses a band the behavior moves with it, boundary estimates round up, and plan mode's own `exit_plan_mode` rules always win. |
| Doing everything alone | Small sequential work stays with one agent. The model opens a subagent or an Agent Team when the work splits into genuinely independent pieces, a broad exploration would flood its context, parts can be inspected or verified in parallel, or an independent reader would catch what it cannot see. When it opens a team it leads it: one responsibility per teammate, a complete brief, disjoint write scopes on shared tasks, no duplicate work, and every result collected and verified before the report. |
| Sleeping or blocking through a long wait | Never waits by sleeping, and never holds one long foreground call open. A long command, build, test run or external job is started in the background, the job id is noted, and the turn ends: a finished job or a user message wakes the model at once, so the user can redirect it while it waits. When nothing will finish on its own, `schedule_create` provides the reminder instead of a timer. |
| Reading "unlimited" as licence to pad or overflow | The same section caps the budget as well as granting it. No padding, repetition or filler; progress updates stay to one short line unless a real milestone is reached; "Length follows what the user needs to act on, not how much work you did". The context window of a single request is still finite, so tool output stays bounded and compaction, the result pruner and sub-agents keep long work inside the window. |

The identity line is explicit: the model works at DeepSeek (深度求索), and its token budget in this mode is unlimited — *"spend it on the work, never ration it."* The contract turns that framing into behavior rather than a slogan, so "unlimited" improves answers instead of inflating them.

Three boundaries keep it from over-correcting: editing a file that is in scope is the work itself and needs no permission; facts the model can establish by inspection — where code lives, how current behavior works, what version is installed — are inspected rather than asked about; and plan mode's own question rules still take precedence over this contract. When the user does answer, that answer outranks the model's inference, its preference and this file's defaults.

## Install

Requires DSH `>= 0.2.1-rc.3` — see [Compatibility](#compatibility).

**From npm (recommended once published).** The same bundle is published as `dsh-deep-ptc-mode`:

```js
plugin_manager({ action: "install_bundle", target: "dsh-deep-ptc-mode@1.2.0" })
```

**From GitHub.** In the desktop app open **Plugins → Install plugin** and paste:

```text
github:lishize20040802-rgb/dsh-deep-ptc-mode
```

Or from an agent session that has the `plugin_manager` tool:

```js
plugin_manager({ action: "install_bundle", target: "github:lishize20040802-rgb/dsh-deep-ptc-mode" })
```

**From a local checkout** (development):

```js
plugin_manager({ action: "install_bundle", target: "C:\\path\\to\\dsh-deep-ptc-mode" })
```

After installation, newly created tasks show **深度PTC模式** in the mode picker's *Custom* group, and it can be set as the default mode for new tasks. Sessions that were already running keep the preset they were created with. Installing the same bundle again updates it.

## Compatibility

`package.json` declares:

```json
"engines": { "dsh": ">=0.2.1-rc.3" }
```

This is a **floor, not an exact pin**. DSH checks plugin requirements as SemVer ranges with prereleases included, so `0.2.1-rc.4`, `0.2.1`, `0.2.2-rc.1`, `0.3.0` and every later release satisfy the range, while older runtimes such as `0.2.1-rc.2` or `0.2.0` are refused before anything is installed. An exact pin (`"0.2.1-rc.3"`) would reject every future release, including that version's own patch and release-candidate builds.

## Files

- `cordis.patch.yml` — one `@deepseek-ai/dsh-agent-preset` declaration: `config.id` `deep-ptc`, display name 「深度PTC模式」, `order: 5`, the child-plugin list copied from the built-in PTC preset, and a persona `prefix`/`suffix` carrying the identity, the unlimited-budget statement, and the behavior contract in seven sections — visible progress, unlimited budget, confident tool use, asking before guessing, planning by expected size, waiting without blocking, and delegation.
- `package.json` — the bundle manifest: `dsh.bundle.patch` points at the patch above, and `engines.dsh` is the compatibility floor.
- `assets/icon.png` — the storefront/market icon.

## Design notes

- The behavior contract lives in `dsh-persona`'s `suffix` (system-prompt order 10200, after first-party guidance) rather than `prefix`, so it is the constraint closest to the moment the model answers; the prefix keeps the identity line, extended with one sentence that this mode's token budget is unlimited.
- The unlimited-budget section sits immediately before the tool-use rules, where it changes how much effort the model spends, and it carries two guardrails — no verbosity and a finite per-request context — so the framing cannot be read as permission to pad or overflow. A prompt that only said "tokens are unlimited" would trade one failure mode (skimping) for another (rambling).
- No extra plugin injects mechanical progress notes. The 1017 model's problem is expression, not capability; a prompt contract plus PTC's batched call rhythm is enough, and it avoids additional runtime cost.
- The child-plugin list is kept identical to the shipped PTC declaration. It was compared against the preset installed with dsh-web-app **0.2.1-rc.5**: same 23 rows, same configs, same plan-mode text, same disabled rows (workflow and plugin-manager tools stay disabled exactly as PTC ships them). Only the persona differs, so no official PTC capability is dropped or retuned by this plugin.
- The deployment-level `system-prompt` is untouched, so only sessions that select this preset are affected.
- The asking section separates user-owned semantics from inspectable facts on purpose. A prompt that only said "ask more" would have the model interrupting the user for facts one `read` would settle; a prompt that only said "inspect before asking" reproduces the original failure, where an unfamiliar name in the request is guessed at or searched for instead of being asked about. The rule is: meaning goes to the user, mechanics go to the tools.
- Planning by expected size replaces both extremes — a plan dumped for every edit, and no plan for a day-long job — with a band that matches the risk. The bands are written on the expected completion time, including verification; a boundary estimate rounds up because one approval costs less than a large piece of work started against the wrong plan; and plan mode's `exit_plan_mode` approval always outranks these bands, with `ask_user_question` used only as the outside-plan-mode fallback for the over-twenty-minute band.
- Waiting is contract-level and needs no runtime plugin. A sleep or one long foreground poll inside `run_code` blocks the step, and steering messages are only claimed at a step boundary, so the contract forbids long in-turn waits: long work goes to a background job and the turn ends, where the job-finished notice and the user's next message both resume the agent immediately. `schedule_create` covers waits with no job to finish. This keeps the user in control without adding a new host service or changing the agent loop.
- Delegation is described conditionally and adds no plugin rows. Agent Team tools (`spawn_teammate`, `team_task_*`, `wait_agent`, …) are host-plane tools supplied by the host's experimental Agent Team bundle, not something a preset can mount; on a host without that bundle the preset's own `subagent` / `subagent_fork` rows remain the delegation surface. The contract therefore tells the model to use the delegation tools its catalog actually lists, and to lead a team when it opens one.
- Version 1.2.0 adds the three behaviors: delegating by the shape of the work; asking about meaning — names, referents, routes, sources and expected process — before guessing, with scope convergence so asking cannot be skipped in favor of doing more work; planning by expected size, where only work estimated over twenty minutes waits for approval; and waiting without blocking — background jobs and an ended turn instead of sleeps, so a user message or a finished job resumes the work at once.

## Uninstall

Use `plugin_manager` `remove_bundle` with the bundle package name `dsh-deep-ptc-mode`. Deleting this directory does not immediately affect an already-installed copy, but updates and re-installs will fail — handle them in order.

## Open source

Deep PTC mode is open source under the MIT License. The repository is the source of every published artifact; issues, pull requests and forks are welcome at [github.com/lishize20040802-rgb/dsh-deep-ptc-mode](https://github.com/lishize20040802-rgb/dsh-deep-ptc-mode).

## License

MIT — see [LICENSE](LICENSE).
