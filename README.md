# dsh-deep-ptc-mode

[简体中文](README.zh.md)

**Deep PTC mode** (「深度PTC模式」) is a custom agent preset for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It keeps the built-in **PTC** preset's surface exactly — the same programmatic `run_code` tooling, the same tool list, sub-agent wiring, plan mode and compaction — and replaces only the persona with a working contract: visible progress, confident tool use, early clarification, and DeepSeek's unlimited token budget.

## What changes compared with the built-in PTC preset

| Habit | What Deep PTC mode does |
| --- | --- |
| Head down and silent, one big hand-off at the end | One short sentence before every `run_code` says what is about to be checked, changed or verified. At real milestones — first pass of inspection, plan fixed, a batch of edits done, tests run, direction changed — the update is a little longer. If two or three tool calls go by without a word, the agent stops and reports where it is. |
| Skimping on tools and verification to save tokens | Tool calls are the work, not a cost: no skipping a read, a search, a command or a check to save tokens. Related calls are batched into one `run_code` program, verification is matched to the task, and scope is not expanded beyond the user's success criteria. |
| Guessing when the request is ambiguous | Ask first. For real ambiguity, a user-owned tradeoff, or intent that would otherwise be guessed, it asks 1–3 concrete questions with options through `ask_user_question`, recommended option first, and gives a question-only program a generous `timeoutMs` (for example 600000) so the wait is not cut off by the default timeout. |
| Reading "unlimited" as licence to pad or overflow | The same section caps the budget as well as granting it. No padding, repetition or filler; progress updates stay to one short line unless a real milestone is reached; "Length follows what the user needs to act on, not how much work you did". The context window of a single request is still finite, so tool output stays bounded and compaction, the result pruner and sub-agents keep long work inside the window. |

The identity line is explicit: the model works at DeepSeek (深度求索), and its token budget in this mode is unlimited — *"spend it on the work, never ration it."* The contract turns that framing into behavior rather than a slogan, so "unlimited" improves answers instead of inflating them.

Two boundaries keep it from over-correcting: a clear single-step request needs no confirmation, and the agent never asks about operations the user has already authorized; plan mode's own question rules still take precedence over this contract.

## Install

Requires DSH `>= 0.2.1-rc.3` — see [Compatibility](#compatibility).

**From GitHub (recommended).** In the desktop app open **Plugins → Install plugin** and paste:

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

- `cordis.patch.yml` — one `@deepseek-ai/dsh-agent-preset` declaration: `config.id` `deep-ptc`, display name 「深度PTC模式」, `order: 5`, the child-plugin list copied from the built-in PTC preset, and a persona `prefix`/`suffix` carrying the identity, the unlimited-budget statement, and the behavior contract.
- `package.json` — the bundle manifest: `dsh.bundle.patch` points at the patch above, and `engines.dsh` is the compatibility floor.

## Design notes

- The behavior contract lives in `dsh-persona`'s `suffix` (system-prompt order 10200, after first-party guidance) rather than `prefix`, so it is the constraint closest to the moment the model answers; the prefix keeps the identity line, extended with one sentence that this mode's token budget is unlimited.
- The unlimited-budget section sits immediately before the tool-use rules, where it changes how much effort the model spends, and it carries two guardrails — no verbosity and a finite per-request context — so the framing cannot be read as permission to pad or overflow. A prompt that only said "tokens are unlimited" would trade one failure mode (skimping) for another (rambling).
- No extra plugin injects mechanical progress notes. The 1017 model's problem is expression, not capability; a prompt contract plus PTC's batched call rhythm is enough, and it avoids additional runtime cost.
- The deployment-level `system-prompt` is untouched, so only sessions that select this preset are affected.

## Uninstall

Use `plugin_manager` `remove_bundle` with the bundle package name `dsh-deep-ptc-mode`. Deleting this directory does not immediately affect an already-installed copy, but updates and re-installs will fail — handle them in order.

## License

MIT — see [LICENSE](LICENSE).
