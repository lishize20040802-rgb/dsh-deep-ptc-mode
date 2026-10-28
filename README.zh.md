# 深度PTC模式（dsh-deep-ptc-mode）

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-deep-ptc-mode.svg)](https://www.npmjs.com/package/dsh-deep-ptc-mode)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-0.2.1%2B-4B6BFB)](https://github.com/deepseek-ai/deepseek-harness)

[English](README.md)

DeepSeek Harness 的自定义 Agent preset，以内置 **PTC 模式**为基础。工具面完全一致：同样的 `run_code` 程序化工具、同样的工具清单与子 agent 配置、同样的 plan 模式与压缩策略；只把 `dsh-persona` 的人设换成一份工作契约：持续汇报进度、放心使用工具、需求不明确时先问清楚，并写明 DeepSeek 为这个模式提供无限 token 预算。

## 它和内置 PTC 的差别

| 问题 | 深度PTC模式的做法 |
| --- | --- |
| 埋头干活、全程不吭声，最后一次性交工 | 每次 `run_code` 前用一句话说明要检查、修改或验证什么；关键节点（摸清现状、定下方案、改完一批、验证之后、改变方向）给稍长的更新；连续两三个工具调用没有出声就必须停下来汇报 |
| 为了省 token 不用工具、不验证 | 明确“工具调用是工作本身，不是成本”，不为省 token 跳过读取、搜索、命令或验证；相关调用批量放进一个 `run_code`，按任务需要验证、不过度扩张 |
| 需求不明确时思考过少、直接交工 | 有歧义、有用户自己的取舍、或只能靠猜意图时，先问再动手；用 `ask_user_question` 提 1–3 个带选项的问题，推荐项在前；单独提问的程序给足 `timeoutMs`（如 600000），避免默认 120 秒超时把等待截断 |
| 把「无限预算」读成可以注水或撑爆上下文 | 同一段既给预算也设上限：不注水、不重复、不写废话；进度更新除真正的里程碑外只留一句话；「长度取决于用户需要据此做什么，而不是你干了多少活」。单次请求的上下文窗口仍然是有限的——工具输出保持有界，压缩、结果裁剪与子 agent 把长任务关在窗口内 |

身份也写清楚了：模型在 DeepSeek（深度求索）工作，这个模式下的 token 预算是无限的——「spend it on the work, never ration it」（把预算花在工作上，不要省着用）。契约把这句口号翻译成具体行为，所以「无限」带来的是更深的答案，而不是更长的废话。

另外保留两条边界，避免矫枉过正：

- 需求清楚、单步就能做完的事不需要确认，不要问用户已经授权的操作；
- plan 模式里仍按 plan 模式的提问规则走，不被这套契约覆盖。

## 安装

要求 DSH `>= 0.2.1-rc.3`，见[兼容性](#兼容性)。

**从 npm 安装（发布后推荐）**：同一个 bundle 已发布为 `dsh-deep-ptc-mode`：

```js
plugin_manager({ action: "install_bundle", target: "dsh-deep-ptc-mode@1.1.0" })
```

**从 GitHub 安装**：桌面端打开 **插件 → 安装插件**，粘贴：

```text
github:lishize20040802-rgb/dsh-deep-ptc-mode
```

或在带 `plugin_manager` 工具的会话里：

```js
plugin_manager({ action: "install_bundle", target: "github:lishize20040802-rgb/dsh-deep-ptc-mode" })
```

**从本地目录安装**（开发用）：

```js
plugin_manager({ action: "install_bundle", target: "C:\\path\\to\\dsh-deep-ptc-mode" })
```

安装后：新任务会在模式选择器的“自定义”分组里出现「深度PTC模式」，也可以把它设为新任务默认模式；已在运行的会话保持不变（preset 在会话创建时绑定）。同一个 bundle 重复安装即为更新。

## 兼容性

`package.json` 声明：

```json
"engines": { "dsh": ">=0.2.1-rc.3" }
```

这是**下限，不是精确锁定**。DSH 用 SemVer 范围判定插件要求，并且包含预发布版本：`0.2.1-rc.4`、`0.2.1`、`0.2.2-rc.1`、`0.3.0` 以及之后的所有版本都满足，而 `0.2.1-rc.2`、`0.2.0` 这类更旧的运行时会在安装前就被拒绝。写成精确版本（`"0.2.1-rc.3"`）会把之后的所有版本——包括该版本自己的补丁版和后续 rc——全部挡在门外。

## 文件

- `cordis.patch.yml` — 一条 `@deepseek-ai/dsh-agent-preset` 声明：`config.id` 为 `deep-ptc`，展示名「深度PTC模式」，`order: 5`，子插件清单照抄内置 PTC preset，persona 的 `prefix`/`suffix` 承载身份、无限预算声明与行为契约。
- `package.json` — bundle 清单：`dsh.bundle.patch` 指向上面的补丁，`engines.dsh` 是兼容性下限。
- `assets/icon.png` — 插件市场/卡片图标。

## 设计取舍

- 行为契约放在 `dsh-persona` 的 `suffix`（系统提示词 order 10200，第一方指导之后），而不是 prefix，确保它是最接近模型回答时刻的约束；prefix 只保留身份与“在台面上工作”的一句话，并补一句本模式 token 预算无限。
- 无限预算段放在工具使用规则之前，因为它改变的是模型愿意花多少力气；同段还带两条护栏——不注水、单次上下文有限——避免「无限」被读成允许啰嗦或撑爆上下文。只写「token 无限」的提示词会把「省」的毛病换成「废话多」的毛病。
- 没有另写插件做机械化的进度注入：1017 的问题是表达习惯而不是能力缺失，提示词契约 + PTC 的批量调用节奏足够，也避免额外运行时负担。
- 没有改动部署级 `system-prompt`，因此只影响选择该 preset 的会话。

## 卸载

`plugin_manager` 的 `remove_bundle`，目标为本 bundle 的包名 `dsh-deep-ptc-mode`。删掉本目录不会立刻影响已安装副本，但更新与重装会失败，建议按顺序处理。

## 开源

深度PTC模式以 MIT 许可证开源，仓库是所有发布产物的来源；欢迎在 [github.com/lishize20040802-rgb/dsh-deep-ptc-mode](https://github.com/lishize20040802-rgb/dsh-deep-ptc-mode) 提 issue、PR 或 fork。

## 许可证

MIT，见 [LICENSE](LICENSE)。
