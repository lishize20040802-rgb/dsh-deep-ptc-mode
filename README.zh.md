# 深度 PTC 模式

[English](README.md) · MIT · 当前版本：**1.3.0**

DeepSeek Harness 的协作型 PTC preset：持续汇报、先查证再澄清、控制改动范围、充分验证并及时收尾。1.3.0 增加可以自由选择的执行环境。

## 选择 WSL、PowerShell 或 macOS 工具

安装并加载后，打开 **设置 → 插件 → 深度 PTC**，选择执行环境并保存，再新建一个「深度PTC模式」会话。

| 选项 | 宿主 | 实际执行方式 / 模型工具 |
| --- | --- | --- |
| 自动 | Windows / macOS / Linux | Windows 选 PowerShell，macOS 选 Zsh，Linux 选 Bash |
| WSL Bash | Windows | `wsl.exe ... --exec bash -lc`，工具名 `bash` |
| PowerShell | Windows | Harness 官方原生 PowerShell 执行器，工具名 `pwsh` |
| Zsh | macOS / Linux | macOS 用 `/bin/zsh -lc`；Linux 用已安装的 `zsh`；工具名 `zsh` |
| 原生 Bash | macOS / Linux | Harness 官方 Bash 执行器，工具名 `bash` |

不适用于宿主的选项会禁用，运行时配置也会拒绝这些选择。WSL 发行版留空时使用 Windows 默认发行版，也可填写 `Ubuntu` 等已安装名称。Linux 上选择 Zsh 前需要安装 Zsh。

**选择会改变实际执行器和模型看到的命令语法，不只改工具名称。** 执行器隔离在本 preset 中，不修改全局 shell，也不影响其他 preset。保存设置后，新会话使用新版本；已有会话和后台任务继续使用创建时的环境。切换环境时请新建会话，避免同一任务中途换方言。

WSL 命令使用 Linux/POSIX 语法；文件工具和 `workdir` 仍用 Windows 宿主路径。执行器用 `--cd` 进入目录，发行版、目录和命令分别作为 argv 传递，不额外拼接 shell 字符串。WSL 内的 PATH、代理等由所选发行版的登录 shell 配置决定，Windows 环境变量不会全部自动变成 Linux 环境变量。

### 沙箱边界

原生 PowerShell、Bash 和 Zsh 继续使用 Harness 的沙箱、审批和进程管理。WSL 跨越 Windows/Linux 边界，目前仅支持宿主已经授权的 `danger-full-access` 执行；`read-only` 或 `workspace-write` 调用在启动命令前失败。插件不会自行升权、改变默认权限或悄悄换 shell。

## 工作规则

- **进度可见：** 开始前说明目的，在发现、方案变化、委派和验证等节点汇报。活跃工作约 30–60 秒没有更新时，在工具步骤边界补充一句；连续的简单读取可以合并。
- **先查证，再问真正的歧义：** 可在相关安装目录或工作区做一轮有限的只读定位；仍有多个候选、私人术语无法解释或关键偏好影响路线时及时询问。搜索不替用户定义意图。
- **计划和授权分开：** 小任务内部计划后执行；复杂任务展示简短计划并继续。耗时增加不使先前授权失效；范围或关键决策变化时才重新确认。显式 plan mode 的只读和批准规则优先。
- **充分验证并停止：** 查当前证据，验证改动触及的行为和边界。验收标准满足、相关检查通过且关键疑点解决后交付；出现新变化或失败才重新检查。
- **按任务生命周期等待：** 构建和测试可作为完成型 job；服务器启动后检查就绪并继续验收；外部 task id 不被假定为 Harness job。收齐相关结果后才能声称完成。
- **按需委派：** 只在任务确实可拆分或需要独立复核时使用。按实际工具提供的消息、job 或团队等待渠道收集结果，不硬性要求不存在的工具名。

本模式表达充分使用能力的工作偏好，不授予额外 token，不修改模型或计费，也不保证模型每次完全遵守提示词。效果需要实际任务评测。

## 安装和升级

要求 Node `>=24`、DSH `>=0.2.1-rc.5`。1.3.0 已用 Windows 桌面端 rc.5 做 WSL/PowerShell 命令验证。macOS/Zsh 分支做了配置、工具挂载与参数测试，尚未在 macOS 真机执行。

本地目录或构建产物可通过插件管理器安装：

```js
plugin_manager({ action: "install_bundle", target: "dsh-deep-ptc-mode@1.3.0" })
// 也可从本地目录或安装包安装：
plugin_manager({ action: "install_bundle", target: "C:\\path\\to\\dsh-deep-ptc-mode" })
// 或 target: "C:\\path\\to\\dsh-deep-ptc-mode-1.3.0.tgz"
```

GitHub 地址：`github:lishize20040802-rgb/dsh-deep-ptc-mode`。该地址安装远端实际内容；本地升级不会自动发布到 GitHub/npm。

已有旧版时，安装同一个 bundle 即更新。从只有 persona 的旧版切到 1.3.0，需要宿主重新加载插件；桌面端若未出现设置卡片，可重新打开应用。安装不会将其他新任务的默认模式改为深度 PTC。

设置持久化到当前 profile 的 Cordis patch：

```yaml
- id: deep-ptc-settings
  config:
    environment: wsl        # auto | wsl | powershell | zsh | bash
    wslDistribution: Ubuntu # 留空为 Windows 默认发行版
```

优先使用界面保存，宿主会处理版本冲突和原子配置写入。

## 兼容性与维护

1.3.0 将上游 rc.5 的 23 项 PTC 配置保存为 `lib/preset.json`。除 persona 外，模板与该上游一致；运行时仅将两个互斥 shell 工具替换为一个带 `shell` 隔离的执行组。计划模式、压缩、裁剪、网页与子代理等其他配置保持一致。

本版增加了必要的宿主/浏览器代码，不再是仅靠 persona 的声明式插件。`compatibility.json` 记录已验证上游和 fixture 哈希；`engines` 是安装下限，不能证明之后所有宿主都经过测试。

```sh
npm ci
npm run check
npm test
npm run check:upstream -- /path/to/ptc.patch.yml
npm pack
```

检查器不会执行 YAML 的 `!!js`；比较官方插件结构、plan mode 和压缩等嵌套配置，发现差异即失败并要求复核。测试覆盖平台选择、命令边界、受限 WSL 拒绝、设置表单原子保存及并发版本约束，以及 preset 版本更换与清理。真实任务评测仍应记录成功率、无必要提问、范围控制、后台收尾和耗时。

## 文件和卸载

- `cordis.patch.yml`：宿主设置入口。
- `lib/index.mjs`：配置 schema、preset 注册和版本切换。
- `lib/model.mjs`：平台选择、参数、隔离配置和环境说明。
- `lib/executor.mjs`：复用官方进程/沙箱语义的 WSL/Zsh 执行器。
- `lib/terminal.mjs`：复用官方终端工具，提供 Zsh 方言与工具名。
- `lib/client.js`：中英文设置卡片。
- `lib/preset.json`：persona 和上游 PTC 模板。
- `test/`、`scripts/check.mjs`、`compatibility.json`：回归与上游差异检查。

卸载使用插件管理器的 `remove_bundle`，目标为 `dsh-deep-ptc-mode`。本地 link 安装直接依赖源目录，应先卸载再删除目录。

## 作者

深度PTC模式由 [lishize20040802-rgb](https://github.com/lishize20040802-rgb) 编写与维护。

- 问题与需求：[GitHub Issues](https://github.com/lishize20040802-rgb/dsh-deep-ptc-mode/issues)
- 邮箱：lishize20040802@gmail.com

上游 DeepSeek Harness 本身的问题请提到 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)。
