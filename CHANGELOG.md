# Changelog

## 1.3.0 — 2026-10-30

- Add bilingual settings for Automatic, WSL Bash, Windows PowerShell, native Zsh and native Bash. WSL distribution is optional. Unsupported choices are disabled according to the host platform.
- Isolate executors inside the preset. Settings apply to new sessions; existing sessions and jobs retain their revision. Global shell configuration stays independent.
- Launch WSL explicitly with separate argv entries. Reuse official process, terminal and approval implementations. Refuse confined WSL execution before spawning.
- Allow focused fact lookup before semantic questions, preserve authorization when work takes longer, and distinguish finite jobs from servers and unregistered external tasks.
- Add verification stopping conditions and collect delegated results through the actual tool's channel.
- Remove unsupported unlimited-budget and DeepSeek-employment claims. Reduce the persona from about 2,203 to 1,091 English words.
- Add upstream composition checks, platform/argv tests, revision lifecycle tests and rendered settings-form tests.
- Raise the minimum DSH version to `0.2.1-rc.5`, the runtime used for integration verification.

## 1.2.0

Previous persona-only PTC preset with semantic questions, duration-based planning, progress updates and delegation instructions.
