# 插件协作与验证范围 / Plugin workflows and verification

Deep PTC **1.9.3** · 核对日期：2026-11-12。接口验证使用 DSH Desktop 0.2.2-rc.2 的校验器与 SDK 渲染器、内嵌 Node 24.21.0。

## 可以配合完成哪些工作

插件需要安装在 Deep PTC 所在的同一运行配置中，并完成各自要求的账号、CLI 或服务设置。下表按实际工作流说明配合方式和已有证据。

| 插件及核对版本 | 在 Deep PTC 任务中的作用 | 验证范围 |
| --- | --- | --- |
| [DrawAI](https://github.com/fourzkw/dsh-drawai) 0.4.6 | 读取和修改画布，在讨论、编码或整理需求时制作流程图与架构图，再导出 SVG 交付 | 实际注册 19 个工具和 2 条内嵌技能；读图→改图→回读、SVG 导出通过。连续旧 revision 拒写后工具仍可用，新 revision 写入通过。浏览器画面、PNG、语音及视频渲染未做端到端验证 |
| [归藏设计](https://github.com/op7418/dsh-guizang-design) 0.1.4 | 按需读取页面、PPT、图文卡片、文案润色与语气技能，并使用作品库和语气工具，把任务内容整理为设计交付物 | 实际注册 2 个工具；5 条技能可列出并读取全文。工具经过 Deep PTC 发现、选用及宿主 SDK 渲染。技能中的脚本、浏览器缩略图和设计生成未做端到端验证 |
| [Agentero](https://github.com/poco-ai/agentero-dsh-plugin) 0.1.8 | 在论文阅读和研究任务中选用论文列表、导入、笔记读取/搜索和 arXiv 发现工具 | host 的实际注册函数提供 5 个工具；参数校验、发现、选用及宿主 SDK 渲染通过。需配置 Agentero CLI 与论文库；未联网导入论文、翻译或执行外部 CLI |
| dsh-ops：实际包验证 0.5.0，源码研究 0.5.4 | 让依赖官方预设 ID 的执行环境在 Deep PTC 会话中识别为 PTC；Niubash 可作为 Windows 原生 Bash 后端 | 既有真实包预设识别路径及 Windows Niubash 命令验证通过，见 [1.9.0 记录](CHANGELOG.md#190--2026-11-11)。本轮未重做其全部业务验证 |
| DSH Go / dsh-go | 保持屏幕控制工具初始可用，配合 Deep PTC 的任务处理；需要 SSH 时可复制主机、端口、用户等连接资料 | 屏幕工具保留规则和资料复制有自动化覆盖。手机连接、认证和隧道由 DSH Go 管理；未连接真实手机或 SSH 主机 |
| [dsh-context](https://github.com/bowenliang123/dsh-context) 0.83.1 | 按当前 Agent 的服务读取 Skill 信息，便于检查 Deep PTC 会话的上下文 | 已核对 `agentPresets.serviceFor(agent, 'skills')` 读取路径。属于源码接口核对，图表和 Token 统计未做实机验证 |

“隔离接口验证”使用已发布包的真实注册函数、工具代码和宿主参数/SDK 实现，其余服务上下文为模拟。它证明所列调用路径可用，不代表插件的全部业务功能已验收。

## DrawAI 的调用方式

选择 Deep PTC 后，DrawAI 仍注册自己的工具和技能。Deep PTC 通过现有通用目录接入，保留完整工具定义。

1. 发现所需画布/视频能力，再选用工具。`diagram_apply` 定义较大时，通过现有完整 SDK 披露机制接入，不截断参数。
2. 修改前调用 `diagram_read`，将返回的 `revision` 交给 `diagram_apply.expectRevision`。DrawAI 的并发保护继续拒绝过旧版本，Deep PTC 将明确的 revision/ETag 冲突归为输入状态过旧，允许重读，不累计工具故障。
3. 交付矢量图时可调用 `diagram_export`，无需打开浏览器画布。该 SVG 是宿主侧的近似重绘，视觉验收仍需浏览器画布。
4. 视频和其他异步任务由 DrawAI 自己的状态工具管理。其任务 ID 不转换成 Harness job ID，也不保证出现在 Deep PTC 后台任务卡片中。
5. `pending`、`not-open`、`timeout` 等正常返回状态不等同于工具实现故障。缺少附件/图像服务的隔离环境返回 `look.status="unsupported"`，读图和改图仍正常。

## SSH 与 DSH Go

SSH 辅助也服务于日常远程命令、文件传输和端口转发。面板可以复制非交互 SSH 检查命令；模型沿用认证失败即停、长任务转后台、隧道显式绑定回环地址的规则。

DSH Go 的连接资料是额外便利：按远端系统选择托管启动或连接已有服务，使用实际服务端口，并在客户端配置认证。复制资料不会发起连接，也不会收集或修改密钥。

## 界面与轻量化

外观重叠时，可关闭 Deep PTC 额外界面特效，必要时收起对话侧边面板。关闭特效不修改其他插件的工具注册与执行方式。

本版没有为这些插件增加运行时依赖、轮询、固定常驻工具清单或每款插件专属提示词。只有用户选择 Deep PTC 的会话使用其适配逻辑；第三方自身的权限、沙箱和运行条件仍生效。

## 验证与来源

- npm 固定版本发布包经过 SHA-512 校验，仅在忽略目录中解包；第三方安装脚本未执行，也未安装到用户日常 profile。
- DrawAI、归藏设计和 Agentero host 合计 26 个真实工具通过宿主 JSON Schema 校验、Deep PTC 发现/选用及 TypeScript / Python SDK 渲染；7 条技能全文读取通过。
- 在临时工作区复现并发编辑问题：修复前，三次旧 revision 拒写会误隔离 `diagram_apply`；修复后同样三次拒写保持文件不变，工具仍可调用，新 revision 写入通过。临时文件在验证后清理。
- 新增两项错误分类回归。完整 199 项自动化测试通过；缺模块、实现缺陷及明确部分完成仍保持原分类。
- 归藏设计、context 和 Agentero 的推荐来源可追溯到官方 11 月 8 日文章：[原文](https://x.com/DeepSeekHarness/status/2119431663642153128)、[保留原作者与编号的正文镜像](https://threadnavigator.com/thread/2119431663642153128/)。原文在核对时返回 403，正文通过镜像读取。DrawAI 是 fourzkw 的社区项目。本表不代表官方对 Deep PTC 的认证。

## English

Deep PTC 1.9.3 can use DrawAI for diagram editing and SVG delivery, guizang-design for design/writing skills and library tools, and Agentero for paper/note tools. dsh-ops supplies compatible execution environments, DSH Go can combine screen tools with SSH connection assistance, and dsh-context can inspect skills through the current Agent's service.

Twenty-six published DrawAI 0.4.6, guizang-design 0.1.4 and Agentero host 0.1.8 tool definitions passed isolated registration, host 0.2.2-rc.2 schema validation, Deep PTC discovery/selection and both host SDK renderers. Seven skill contents were readable. DrawAI read/edit/readback, SVG export and repeated stale-revision rejection followed by a fresh-revision write passed. The generic conflict-classification fix preserves unavailable-provider, defect and partial-effect handling. All 199 automated tests pass.

The table distinguishes those checks from prior dsh-ops evidence, automated DSH Go rules and source-only context inspection. Browser visuals, design generation, external paper CLI workflows, real phone/SSH connections, PNG and video rendering were not validated end to end. Plugins retain their own setup and authorization requirements. No runtime dependencies, polling or vendor-specific resident tool lists were added.
