window.__ModuleLoader__.load({ id: 'dsh-deep-ptc-mode', factory: require => {
  const React = require('react');
  const h = React.createElement;
  let ReactDOM;
  try { ReactDOM = require('react-dom'); } catch { /* hosts without portals keep the inline panel */ }
  const NS = 'deep-ptc-settings';
  const inject = ['slots', 'locale', 'configForms'];
  const dictionaries = {
    zh: {
      title: '深度 PTC', summary: '选择执行环境，应用于之后新建的深度 PTC 会话。',
      presetName: '深度 PTC 模式',
      presetDescription: '任务运行时可插话，按任务规模制定计划，意图不清时先提问。支持 WSL、PowerShell、Zsh 和 Bash。',
      presetEnvironment: '当前环境：{env}', presetSafeMode: '当前为安全模式', presetOfficial: '官方默认',
      environment: '执行环境', auto: '自动（Windows：PowerShell；macOS：Zsh；Linux：Bash）',
      wsl: 'WSL Bash（Windows）', powershell: 'PowerShell（Windows）',
      zsh: 'Zsh（macOS / Linux）', bash: '原生 Bash（macOS / Linux）',
      windowsBash: '原生 Bash（Windows）', bashPath: 'bash.exe 的绝对路径',
      bashPathHint: '可填写 dsh-ops 随包的 Niubash。路径不可用时保留官方 Shell。受限模式请选 PowerShell。',
      distribution: 'WSL 发行版', distributionHint: '留空使用 Windows 的默认发行版，例如 Ubuntu。',
      shell: 'Shell 版本', shellAuto: '自动（沿用官方查找顺序）',
      shellSystem: '{name}（系统自带）', shellPreview: 'PowerShell 7 预览版',
      shellHint: '只列出本机已发现的常见版本。文件消失后自动回退。WSL 仍只选择发行版。',
      sessions: '保存后请新建一个“深度PTC模式”会话。已有会话与后台任务保留原环境。',
      wslHint: 'WSL 暂不支持 Windows 的受限沙箱；受限调用会明确失败，不会自动切换或绕过限制。',
      save: '保存', saving: '保存中…', saved: '已保存，新会话将使用所选环境。',
      failed: '未能保存，请检查环境是否适用于宿主、发行版名称及配置是否已被其他窗口修改。',
      readOnly: '当前设置为只读。', loading: '正在读取设置…',
    },
    en: {
      title: 'Deep PTC', summary: 'Choose the execution environment for new Deep PTC sessions.',
      presetName: 'Deep PTC Mode',
      presetDescription: 'Steer running tasks, plan according to task size, and clarify unclear requests. Supports WSL, PowerShell, Zsh, and Bash.',
      presetEnvironment: 'Current environment: {env}', presetSafeMode: 'Safe mode is active', presetOfficial: 'Official default',
      environment: 'Execution environment', auto: 'Automatic (Windows: PowerShell; macOS: Zsh; Linux: Bash)',
      wsl: 'WSL Bash (Windows)', powershell: 'PowerShell (Windows)',
      zsh: 'Zsh (macOS / Linux)', bash: 'Native Bash (macOS / Linux)',
      windowsBash: 'Native Bash (Windows)', bashPath: 'Absolute path to bash.exe',
      bashPathHint: 'You can use the Niubash bundled with dsh-ops. An unavailable path keeps the official shell. Choose PowerShell for confined work.',
      distribution: 'WSL distribution', distributionHint: 'Leave blank for the Windows default distribution, for example Ubuntu.',
      shell: 'Shell version', shellAuto: 'Automatic (official lookup)',
      shellSystem: '{name} (system)', shellPreview: 'PowerShell 7 Preview',
      shellHint: 'Lists common executables found on this machine. A missing file falls back to automatic. WSL still selects a distribution only.',
      sessions: 'After saving, create a new Deep PTC session. Existing sessions and background jobs keep their environment.',
      wslHint: 'WSL does not support the confined Windows sandbox. Confined calls fail without execution or fallback.',
      save: 'Save', saving: 'Saving…', saved: 'Saved. New sessions will use this environment.',
      failed: 'Could not save. Check host compatibility, distribution name, and concurrent configuration changes.',
      readOnly: 'Settings are read-only.', loading: 'Loading settings…',
    },
  };

  function Card({ view, form, t }) {
    const subscribe = React.useCallback(listener => form.subscribe(listener), [form]);
    const read = React.useCallback(() => form.getSnapshot(), [form]);
    const state = React.useSyncExternalStore(subscribe, read, read);
    const [environment, setEnvironment] = React.useState('auto');
    const [distribution, setDistribution] = React.useState('');
    const [shellExecutable, setShellExecutable] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [failed, setFailed] = React.useState(false);
    const draftRevision = React.useRef();
    const dirty = React.useRef(false);
    React.useEffect(() => {
      if (!state.value || dirty.current) return;
      setEnvironment(state.value.environment);
      setDistribution(state.value.wslDistribution ?? '');
      setShellExecutable(state.value.shellExecutable ?? '');
      draftRevision.current = state.revision;
    }, [state.value, state.revision]);
    if (view === 'summary') return t('summary');
    if (state.status !== 'ready') return h('p', null, t('loading'));
    const platform = state.value.hostPlatform;
    const allowed = allowedEnvironments(platform);
    const windowsBash = platform === 'win32' && environment === 'bash';
    const disabled = !state.writable || saving;
    const changed = () => {
      if (!dirty.current) draftRevision.current = state.revision;
      dirty.current = true;
      setMessage('');
    };
    async function save(event) {
      event.preventDefault();
      setSaving(true); setMessage(''); setFailed(false);
      try {
        const ok = await form.mutate([
          { op: 'set', path: ['environment'], value: environment },
          { op: 'set', path: ['wslDistribution'], value: distribution.trim() },
          { op: 'set', path: ['shellExecutable'], value: windowsBash ? shellExecutable.trim() : shellExecutable },
        ], draftRevision.current);
        if (!ok) throw new Error('Configuration was rejected');
        dirty.current = false;
        const latest = form.getSnapshot();
        draftRevision.current = latest.revision;
        setEnvironment(latest.value?.environment ?? environment);
        setDistribution(latest.value?.wslDistribution ?? distribution.trim());
        setShellExecutable(latest.value?.shellExecutable ?? shellExecutable);
        setMessage('saved');
      } catch {
        draftRevision.current = form.getSnapshot().revision;
        setFailed(true); setMessage('failed');
      } finally { setSaving(false); }
    }
    const effective = environment === 'auto'
      ? (state.value.hostPlatform === 'win32' ? 'powershell' : state.value.hostPlatform === 'darwin' ? 'zsh' : 'bash')
      : environment;
    const choices = (Array.isArray(state.value.shellChoices) ? state.value.shellChoices : [])
      .filter(item => item && item.family === effective && typeof item.id === 'string');
    const showShell = effective !== 'wsl' && choices.length > 0;
    const control = { width: '100%', padding: '8px 10px', borderRadius: '6px',
      color: 'inherit', background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-border-l1)' };
    return h('form', { onSubmit: save, style: { display: 'grid', gap: '12px', maxWidth: '600px' } },
      h('label', { htmlFor: 'deep-ptc-environment' }, t('environment')),
      h('select', { id: 'deep-ptc-environment', value: environment, disabled, style: control,
        onChange: event => {
          changed();
          const next = event.target.value;
          if (platform === 'win32' && (environment === 'bash' || next === 'bash')) setShellExecutable('');
          setEnvironment(next);
        } },
      ...['auto', 'wsl', 'powershell', 'zsh', 'bash'].map(value =>
        h('option', { key: value, value, disabled: !allowed.includes(value) }, t(platform === 'win32' && value === 'bash' ? 'windowsBash' : value)))),
      environment === 'wsl' ? h(React.Fragment, null,
        h('label', { htmlFor: 'deep-ptc-distribution' }, t('distribution')),
        h('input', { id: 'deep-ptc-distribution', value: distribution, disabled, style: control,
          onChange: event => { changed(); setDistribution(event.target.value); } }),
        h('p', null, t('distributionHint')), h('p', null, t('wslHint'))) : null,
      windowsBash ? h(React.Fragment, null,
        h('label', { htmlFor: 'deep-ptc-shell' }, t('bashPath')),
        h('input', { id: 'deep-ptc-shell', value: shellExecutable, disabled, style: control, required: true,
          onChange: event => { changed(); setShellExecutable(event.target.value); } }),
        h('p', null, t('bashPathHint'))) : showShell ? h(React.Fragment, null,
        h('label', { htmlFor: 'deep-ptc-shell' }, t('shell')),
        h('select', { id: 'deep-ptc-shell', value: shellExecutable, disabled, style: control,
          onChange: event => { changed(); setShellExecutable(event.target.value); } },
        h('option', { value: '' }, t('shellAuto')),
        ...choices.map(item => h('option', { key: item.id, value: item.id }, shellLabel(item.label, t)))),
        h('p', null, t('shellHint'))) : null,
      h('p', null, t('sessions')),
      !state.writable ? h('p', { role: 'status' }, t('readOnly')) : null,
      message ? h('p', { role: failed ? 'alert' : 'status' }, t(message)) : null,
      h('button', { type: 'submit', disabled: disabled || (windowsBash && !shellExecutable.trim()),
        style: { justifySelf: 'start', padding: '7px 16px' } }, t(saving ? 'saving' : 'save')),
    );
  }

  function ToolStateControls({ sessionId, useProjection, reset, t }) {
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState(null);
    const generation = React.useRef(0);
    React.useEffect(() => { generation.current++; setBusy(false); setMessage(null); return () => { generation.current++; }; }, [sessionId]);
    let preset, state;
    try {
      if (typeof useProjection !== 'function') return null;
      preset = useProjection('agentPreset');
      state = useProjection('deepPtcTools');
    } catch { return null; }
    if (preset !== 'deep-ptc') return null;
    // The failure list needs the tool-state projection; the reset command does not.
    const failed = state && typeof state === 'object' ? state.report?.tools ?? [] : [];
    async function reload() {
      const current = generation.current;
      setBusy(true); setMessage(null);
      try {
        const outcome = await reset();
        if (current !== generation.current) return;
        if (outcome?.ok === false) throw new Error(outcome.error?.message);
        const reply = outcome?.ok === true ? outcome.value : outcome;
        if (reply === undefined) {
          setMessage({ key: 'toolResetFailed', reason: 'toolResetUnavailable' });
          return;
        }
        const result = reply?.result ?? reply;
        if (result?.kind !== 'success') throw new Error(result?.text);
        setMessage({ key: 'toolResetDone' });
      } catch (error) {
        if (current === generation.current) {
          const detail = String(error?.message ?? error ?? '').slice(0, 220);
          setMessage({ key: 'toolResetFailed', detail });
        }
      }
      finally { if (current === generation.current) setBusy(false); }
    }
    return h('section', { className: 'dpt-side-section dpt-side-tools', 'aria-label': t('toolsSection') },
      h('div', { className: 'dpt-side-label' }, h('span', null, t('toolsSection')),
        failed.length ? h('span', { className: 'dpt-side-hint', 'data-tone': 'warn' }, `${t('toolFailures')} ${failed.length}`) : null),
      failed.length ? h('div', { className: 'dpt-tool-failures', role: 'status' },
        h('p', null, t('toolFailureHint')),
        h('ul', null, ...failed.map(row => h('li', { key: row.name }, h('code', null, row.name), ` — ${row.provider}`)))) : null,
      h('button', { type: 'button', className: 'dpt-btn dpt-btn-block', onClick: reload, disabled: busy, title: t('toolResetHint'), 'aria-busy': busy },
        busy ? t('toolResetBusy') : t('toolReset')),
      h('p', { className: 'dpt-side-note', role: 'status', 'data-tone': message ? (message.key === 'toolResetDone' ? 'ok' : 'error') : undefined },
        message ? [t(message.key), message.reason ? t(message.reason) : commandText(message.detail, t)].filter(Boolean).join(' ') : t('toolResetHint')));
  }
  Object.assign(dictionaries.zh, {
    visualEffects: '界面特效', visualEffectsHint: '使用外部主题或 UI 插件时，建议关闭此开关。',
    jobsTitle: '后台任务', jobsEmpty: '本会话暂无后台任务。', jobsMore: '另有 {count} 个任务',
    jobRunning: '运行中', jobStopping: '正在停止', jobCompleted: '已完成', jobKilled: '已取消', jobFailed: '已失败',
    toolReset: '重载所有工具状态', toolResetBusy: '正在重载…', toolResetDone: '本对话工具状态已重载。',
    toolResetFailed: '未能重载工具状态。', toolResetUnavailable: '当前会话无法调用工具重载命令。',
    commandNoSession: '当前没有活动对话。', commandWrongMode: '该功能仅在深度 PTC 会话中可用。', commandInvalidSkill: '无效的 Skill 卡片操作。',
    toolResetHint: '清除本对话的故障标记和按需加载选择；正在运行的任务继续执行。',
    toolFailures: '工具适配提醒', toolFailureHint: '以下外部工具调用失败，可能存在适配问题，已在本对话中禁用。任务会优先使用其他可用工具；未进一步排查故障原因。',
  });
  Object.assign(dictionaries.en, {
    visualEffects: 'Visual effects', visualEffectsHint: 'Keep this off when using an external theme or UI plugin.',
    jobsTitle: 'Background jobs', jobsEmpty: 'No background jobs in this conversation.', jobsMore: '{count} more jobs',
    jobRunning: 'Running', jobStopping: 'Stopping', jobCompleted: 'Completed', jobKilled: 'Canceled', jobFailed: 'Failed',
    toolReset: 'Reload all tool states', toolResetBusy: 'Reloading…', toolResetDone: 'Tool states reloaded for this conversation.',
    toolResetFailed: 'Could not reload tool states.', toolResetUnavailable: 'The reload command is unavailable in this conversation.',
    commandNoSession: 'No active conversation.', commandWrongMode: 'This command is available in Deep PTC sessions only.', commandInvalidSkill: 'Invalid skill card command.',
    toolResetHint: 'Clear quarantine and on-demand selections in this conversation. Running jobs continue.',
    toolFailures: 'Tool compatibility notice', toolFailureHint: 'These external tools failed and may have compatibility issues. They are disabled in this conversation. Continue with working alternatives; no root-cause investigation was performed.',
  });
  Object.assign(dictionaries.zh, {
    skillTitle: '当前上下文中的 Skill', skillLoaded: '{count} 个已加载', skillClosing: '{count} 个将在下一条消息后移除',
    skillHint: '关闭的 Skill 会在你发送下一条消息时移出上下文，历史记录不受影响。',
    skillKeepAll: '全部保留', skillCloseAll: '全部关闭', skillNoDescription: '无描述', skillThisTurn: '本轮',
    skillShowAll: '显示全部 {count} 个', skillShowLess: '收起',
    agentsTitle: '子代理',
    agentRunning: '运行中', agentCompleted: '已完成', agentIdle: '空闲', agentExternal: '外部',
    agentOpen: '在右侧栏打开这个子代理的对话',
    sideTitle: '深度 PTC', toolsSection: '工具状态', envAuto: '自动', envForNew: '新会话生效', envThisSession: '本会话保持创建时的环境。',
    envAutoNow: '当前按自动选择：{env}。本会话保持创建时的环境。', envSaved: '已保存，之后新建的会话使用 {env}。',
    envFailed: '未能保存，请检查发行版名称或设置是否已在别处修改。', envDefaultDistribution: '默认发行版',
    durationSeconds: '{s} 秒', durationMinutes: '{m} 分 {s} 秒', durationHours: '{h} 小时 {m} 分',
    sideGuide: '执行环境、子代理、后台任务、输出文件与 SSH', sideOtherMode: '当前对话不是深度 PTC 模式。这里的执行环境用于之后新建的深度 PTC 会话。',
    capsuleOpen: '展开或收起侧边面板', panelClose: '收起侧边面板',
    panelMoved: '深度 PTC 面板已回到对话区侧边，请使用输入框下方的胶囊展开。',
    panelMovedToolbar: '深度 PTC 面板在对话区侧边，请使用输入框工具栏里的胶囊展开。',
    panelMovedHidden: '胶囊已隐藏。可以用下面的按钮打开深度 PTC 面板，或在「设置 → 深度 PTC → 外观」里重新显示胶囊。',
    panelOpen: '打开深度 PTC 面板', panelResize: '拖动调整侧边面板宽度，双击恢复默认',
    capsulePlacement: '胶囊位置', placementAuto: '自动', placementDock: '输入框下方', placementToolbar: '工具栏', placementHidden: '隐藏',
    placementHint: '「自动」在检测到 dsh-claude-style 等紧凑输入框时放进工具栏，否则放在输入框下方。隐藏后可从右侧栏「深度 PTC」页签打开面板。',
    placementAutoNow: '「自动」当前放在：{place}。',
    outputsTitle: '输出文件', outputsEmpty: '本会话暂无输出文件。', outputsMore: '另有 {count} 个文件',
    outputPresented: '已交付', outputTurn: '第 {turn} 轮',
    outputOpenFailed: '无法打开文件，请检查文件是否仍存在，以及宿主文件预览是否可用。',
    sshTitle: 'SSH 连接', sshHint: '非交互连接', sshNoClient: '未找到 OpenSSH 客户端', sshConfigured: '已配置',
    sshUsed: '第 {turn} 轮 · {count} 次', sshFailed: '第 {turn} 轮失败', sshEmpty: '~/.ssh/config 中没有主机别名，本会话也未连接过远程主机。',
    sshCopy: '复制 SSH 检查命令', sshGoCopy: '复制 DSH Go 连接资料', sshCopied: '已复制', sshCopyFailed: '复制失败，请检查剪贴板权限。',
    sshGoDetails: 'DSH Go SSH 连接\n主机：{host}\n端口：{port}\n用户：{user}\nSSH 别名（本机）：{alias}\n\n在 DSH Go 中选择 SSH 并配置认证。远端为 Linux/macOS 时可选托管启动 dsh web；远端为 Windows 时选择仅连接已有服务，端口取自实际启动结果。服务监听 127.0.0.1，授权信息在客户端填写。手机需要能访问这里的主机地址。',
    sshUserNeeded: '在客户端填写远程用户名',
    appearance: '外观', visualEffectsAuto: '检测到外观插件 {name}，特效默认关闭。手动打开后会保留你的选择。',
    diagTitle: '诊断信息', diagHint: '复制后可附在 issue 中，便于排查界面问题。', diagCopy: '复制诊断信息', diagCopied: '已复制',
    shellStore: 'PowerShell 7（应用商店）', presetSafeReason: '当前为安全模式：{reason}',
  });
  Object.assign(dictionaries.en, {
    skillTitle: 'Skills in context', skillLoaded: '{count} loaded', skillClosing: '{count} leave after your next message',
    skillHint: 'A closed skill leaves the model context when you send your next message. The history stays complete.',
    skillKeepAll: 'Keep all', skillCloseAll: 'Close all', skillNoDescription: 'No description', skillThisTurn: 'this turn',
    skillShowAll: 'Show all {count}', skillShowLess: 'Show less',
    agentsTitle: 'Subagents',
    agentRunning: 'Running', agentCompleted: 'Done', agentIdle: 'Idle', agentExternal: 'External',
    agentOpen: 'Open this subagent in the right sidebar',
    sideTitle: 'Deep PTC', toolsSection: 'Tool state', envAuto: 'Auto', envForNew: 'for new sessions', envThisSession: 'This session keeps the environment it was created with.',
    envAutoNow: 'Automatic picks {env}. This session keeps the environment it was created with.', envSaved: 'Saved. New sessions use {env}.',
    envFailed: 'Could not save. Check the distribution name, or whether settings changed elsewhere.', envDefaultDistribution: 'Default distribution',
    durationSeconds: '{s}s', durationMinutes: '{m}m {s}s', durationHours: '{h}h {m}m',
    sideGuide: 'Environment, subagents, background jobs, output files and SSH', sideOtherMode: 'This conversation is not in Deep PTC mode. The environment here applies to new Deep PTC sessions.',
    capsuleOpen: 'Expand or collapse the side panel', panelClose: 'Collapse the side panel',
    panelMoved: 'The Deep PTC panel is beside the conversation. Use the capsule below the composer to expand it.',
    panelMovedToolbar: 'The Deep PTC panel is beside the conversation. Use the capsule in the composer toolbar to expand it.',
    panelMovedHidden: 'The capsule is hidden. Open the Deep PTC panel with the button below, or show the capsule again in Settings → Deep PTC → Appearance.',
    panelOpen: 'Open the Deep PTC panel', panelResize: 'Drag to resize the side panel; double-click to reset',
    capsulePlacement: 'Capsule position', placementAuto: 'Auto', placementDock: 'Below composer', placementToolbar: 'Toolbar', placementHidden: 'Hidden',
    placementHint: 'Auto puts the capsule in the toolbar when a compact composer such as dsh-claude-style is present, and below the composer otherwise. When hidden, open the panel from the Deep PTC tab in the right sidebar.',
    placementAutoNow: 'Auto currently uses: {place}.',
    outputsTitle: 'Output files', outputsEmpty: 'No output files in this conversation.', outputsMore: '{count} more files',
    outputPresented: 'Delivered', outputTurn: 'Turn {turn}',
    outputOpenFailed: 'Could not open the file. Check that it still exists and the host file preview is available.',
    sshTitle: 'SSH connections', sshHint: 'non-interactive', sshNoClient: 'OpenSSH client not found', sshConfigured: 'Configured',
    sshUsed: 'Turn {turn} · {count}×', sshFailed: 'Failed in turn {turn}', sshEmpty: 'No host aliases in ~/.ssh/config and no remote host reached in this conversation.',
    sshCopy: 'Copy SSH check command', sshGoCopy: 'Copy DSH Go connection details', sshCopied: 'Copied', sshCopyFailed: 'Could not copy. Check clipboard permissions.',
    sshGoDetails: 'DSH Go SSH connection\nHost: {host}\nPort: {port}\nUser: {user}\nLocal SSH alias: {alias}\n\nChoose SSH and configure authentication in DSH Go. Use managed dsh web on a Linux/macOS remote host, or attach-only with an existing service on a Windows host. Read the actual service port from its launch result. Bind the service to 127.0.0.1 and enter authorization in the client. The phone must be able to reach this host address.',
    sshUserNeeded: 'Enter the remote user in the client',
    appearance: 'Appearance', visualEffectsAuto: '{name} is installed, so effects start off. Turning them on keeps your choice.',
    diagTitle: 'Diagnostics', diagHint: 'Copy and attach to an issue to help investigate interface problems.', diagCopy: 'Copy diagnostics', diagCopied: 'Copied',
    shellStore: 'PowerShell 7 (Microsoft Store)', presetSafeReason: 'Safe mode: {reason}',
  });

  // Placeholders are filled here, so the text is right whether or not the host locale interpolates.
  const fill = (text, values) => String(text).replace(/\{(\w+)\}/gu, (whole, key) => values[key] === undefined ? whole : String(values[key]));
  const tf = (t, key, values) => fill(t(key, values), values);
  const commandMessageKeys = new Map([
    ['No active conversation. / 当前没有活动对话。', 'commandNoSession'],
    ['This command is available in Deep PTC sessions only. / 该功能仅在深度 PTC 会话中可用。', 'commandWrongMode'],
    ['Invalid skill card command. / 无效的 Skill 卡片操作。', 'commandInvalidSkill'],
  ]);
  function commandText(text, t) {
    const key = commandMessageKeys.get(text);
    return key ? t(key) : text;
  }
  let hostCtx;

  // ---------------------------------------------------------------------------------------------
  // Stylesheet. The cards render only in Deep PTC sessions. The visual effects (the refined look and
  // its motion) apply only while the conversation on screen is a Deep PTC session and effects are on:
  // every effect rule is scoped by body[data-dpt-ui]. Effect rules target the host's own stable
  // attributes (data-composer-card, data-message-bubble); the send button is the one element tagged.
  // Looping animations change opacity or transform only, so the compositor runs them without repaints.
  // ---------------------------------------------------------------------------------------------
  const PLUGIN = 'dsh-deep-ptc-mode';
  const ON = 'body[data-dpt-ui]';
  const ON0 = ':where(body[data-dpt-ui])';
  const DARK = 'body[data-ds-dark-theme]:not([data-ds-dark-theme="false"])';
  const ON_DARK = 'body[data-dpt-ui][data-ds-dark-theme]:not([data-ds-dark-theme="false"])';
  const COMPOSER = '[data-composer-card]';
  const BUBBLE = ':is([data-chat-flow-kind="user"],[data-chat-flow-kind="steering"]) [data-message-bubble]';
  const CARD_CSS = `
.dpt-card,.dpt-panel,.dpt-sidecar,.dpt-capsule,.dpt-settings{--dpt-accent:var(--dpt-brand,#3370ff);--dpt-ease:cubic-bezier(.22,1,.36,1);--dpt-line:var(--dsw-alias-border-l1,#e3e7ee)}
.dpt-card{--dpt-card-fill:var(--dsw-static-neutral-50,#f7f8fa);box-sizing:border-box;width:100%;margin:2px 0 4px;border:.5px solid var(--dsw-alias-border-l2,#d6dce6);border-radius:var(--dsw-radius-lg,16px);background:var(--dpt-card-fill);color:var(--dsw-alias-label-primary,#101828);font-size:13px;line-height:20px;overflow:hidden;animation:dpt-rise 220ms var(--dpt-ease) both}
${DARK} .dpt-card{--dpt-card-fill:var(--dsw-static-neutral-850,#1a1f29)}
.dpt-card-head{display:flex;align-items:center;gap:10px;padding:10px 12px 6px}
.dpt-card-icon{flex:none;display:grid;place-items:center;width:32px;height:32px;box-sizing:border-box;border-radius:10px;border:.5px solid color-mix(in srgb,var(--dpt-accent) 22%,transparent);background:color-mix(in srgb,var(--dpt-accent) 10%,transparent);color:var(--dpt-accent)}
.dpt-card-titles{flex:1;min-width:0;display:flex;flex-direction:column}
.dpt-card-title{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpt-card-sub{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#667085);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpt-card-sub [data-tone="warn"]{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dpt-card-actions{flex:none;display:flex;gap:6px}
.dpt-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 10px;border:1px solid color-mix(in srgb,var(--dpt-accent) 35%,transparent);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#101828);font:inherit;font-size:12px;font-weight:500;line-height:18px;white-space:nowrap;cursor:pointer;transition:background-color 120ms,border-color 120ms,opacity 120ms}
.dpt-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dpt-accent) 8%,var(--dsw-alias-bg-base,#fff))}
.dpt-card .dpt-btn{border:.5px solid var(--dsw-alias-border-l3,#c9d0db);background:var(--dsw-alias-button-floating-fill,#fff);font-weight:400}
.dpt-card .dpt-btn:hover:not(:disabled){background:var(--dsw-alias-button-floating-hover,var(--dsw-alias-interactive-bg-hover,rgba(16,24,40,.05)))}
.dpt-btn:disabled{opacity:.45;cursor:default}
.dpt-btn[aria-busy="true"]{cursor:wait}
.dpt-btn:focus-visible,.dpt-switch:focus-visible,.dpt-agent:focus-visible,.dpt-file-open:focus-visible,.dpt-icon-btn:focus-visible,.dpt-link:focus-visible,.dpt-capsule:focus-visible{outline:2px solid var(--dpt-accent,#3370ff);outline-offset:2px}
.dpt-skill-list{list-style:none;margin:0;padding:0 4px 4px;display:flex;flex-direction:column;gap:2px}
.dpt-skill{display:flex;align-items:center;gap:12px;padding:7px 8px 7px 10px;border-radius:10px;transition:background-color 120ms}
.dpt-skill:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(16,24,40,.05))}
.dpt-skill-text{flex:1;min-width:0;display:flex;flex-direction:column;transition:opacity 160ms}
.dpt-skill[data-off] .dpt-skill-text{opacity:.5}
.dpt-skill-name{display:flex;align-items:center;gap:6px;min-width:0;font-family:var(--ds-font-family-code,ui-monospace,Consolas,monospace);font-size:12.5px;font-weight:500;line-height:20px}
.dpt-skill-name>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpt-skill[data-off] .dpt-skill-name>span:first-child{text-decoration:line-through;text-decoration-color:var(--dsw-alias-label-tertiary,#667085)}
.dpt-tag{flex:none;font-family:var(--ds-font-family,inherit);font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;font-weight:500;background:color-mix(in srgb,var(--dpt-accent) 12%,transparent);color:var(--dpt-accent)}
.dpt-skill-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#667085);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpt-switch{position:relative;flex:none;width:32px;height:18px;padding:0;border:0;border-radius:999px;background:var(--dsw-alias-border-l2,#cfd5df);cursor:pointer;transition:background-color 160ms var(--dpt-ease,ease)}
.dpt-switch[aria-checked="true"]{background:var(--dpt-accent,#3370ff)}
.dpt-switch:disabled{opacity:.5;cursor:default}
.dpt-switch-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(16,24,40,.28);transition:transform 160ms var(--dpt-ease,ease)}
.dpt-switch[aria-checked="true"] .dpt-switch-thumb{transform:translateX(14px)}
.dpt-card-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0;padding:8px 14px 10px;border-top:.5px solid var(--dsw-alias-border-l1,#e3e7ee);font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#667085)}
.dpt-link{flex:none;border:0;background:none;padding:0;font:inherit;color:var(--dpt-accent,#3370ff);cursor:pointer}
.dpt-panel{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary,#101828);font-size:13px;line-height:20px}
.dpt-panel[data-inline]{height:auto;max-height:min(60vh,520px);margin:6px 0 2px;border:1px solid var(--dpt-line);border-radius:14px;background:var(--dsw-alias-bg-base,#fff);overflow:hidden;animation:dpt-rise 200ms var(--dpt-ease) both}
.dpt-side-body{flex:1;overflow:auto;min-height:0;padding-top:10px}
.dpt-side-section{padding:2px 14px 12px}
.dpt-side-section+.dpt-side-section{border-top:1px solid var(--dpt-line);padding-top:10px}
.dpt-side-agents{padding-left:8px;padding-right:8px}
.dpt-side-agents .dpt-agents-list{display:flex;flex-direction:column;gap:4px;padding:2px 0}
.dpt-side-agents>.dpt-side-label{padding:0 6px}
.dpt-side-label{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-secondary,#4a5565)}
.dpt-side-hint{min-width:0;font-size:11px;font-weight:400;color:var(--dsw-alias-label-tertiary,#667085);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpt-seg{display:flex;gap:2px;padding:2px;border-radius:10px;background:color-mix(in srgb,var(--dpt-accent) 9%,transparent)}
.dpt-seg-btn{flex:1;min-width:0;height:26px;padding:0 6px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#4a5565);font:inherit;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;transition:background-color 120ms,color 120ms,box-shadow 120ms}
.dpt-seg-btn:hover:not(:disabled):not([aria-checked="true"]){color:var(--dsw-alias-label-primary,#101828)}
.dpt-seg-btn[aria-checked="true"]{background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#101828);font-weight:600;box-shadow:0 1px 3px color-mix(in srgb,var(--dpt-accent) 25%,transparent),0 0 0 1px color-mix(in srgb,var(--dpt-accent) 35%,transparent)}
.dpt-seg-btn:disabled{cursor:default}
.dpt-seg-btn:focus-visible,.dpt-input:focus-visible,.dpt-select:focus-visible{outline:2px solid var(--dpt-accent,#3370ff);outline-offset:1px}
.dpt-field{display:flex;gap:6px;margin-top:8px}
.dpt-input,.dpt-select{flex:1;min-width:0;box-sizing:border-box;height:28px;padding:0 8px;border:1px solid var(--dpt-line);border-radius:8px;background:var(--dsw-alias-bg-base,#fff);color:inherit;font:inherit;font-size:12px}
.dpt-btn-block{display:flex;width:100%}
.dpt-side-hint[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dpt-tool-failures{margin:0 0 8px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d97706) 10%,transparent);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#4a5565)}
.dpt-tool-failures p{margin:0 0 4px}
.dpt-tool-failures ul{margin:0;padding-left:16px}
.dpt-tool-failures code{font-family:var(--ds-font-family-code,ui-monospace,monospace)}
.dpt-side-note{margin:6px 0 0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#667085)}
.dpt-side-note[data-tone="ok"]{color:var(--dsw-alias-state-success-primary,#0f7a4f)}
.dpt-side-note[data-tone="error"]{color:var(--dsw-alias-state-error-primary,#c4321f)}
.dpt-agents-list{list-style:none;margin:0;padding:0;overflow:visible;min-height:0}
.dpt-agent{display:flex;align-items:flex-start;gap:10px;width:100%;box-sizing:border-box;padding:7px 8px 7px calc(8px + var(--dpt-depth,0) * 14px);border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background-color 120ms}
.dpt-agent:hover:not(:disabled){background:color-mix(in srgb,var(--dpt-accent) 7%,transparent)}
.dpt-agent:disabled{cursor:default}
.dpt-agent-dot{flex:none;width:8px;height:8px;margin-top:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#98a2b3)}
.dpt-agent[data-state="running"] .dpt-agent-dot,.dpt-capsule[data-state="running"] .dpt-agent-dot,.dpt-job[data-state="running"] .dpt-agent-dot{background:var(--dpt-accent,#3370ff);box-shadow:0 0 6px 2px color-mix(in srgb,var(--dpt-accent,#3370ff) 60%,transparent)}
${ON} .dpt-capsule[data-state="running"] .dpt-agent-dot,${ON} .dpt-agent[data-state="running"] .dpt-agent-dot{animation:dpt-dot-flash 1.2s ease-in-out infinite}
@keyframes dpt-dot-flash{0%,100%{opacity:1}50%{opacity:.35}}
.dpt-agent[data-state="completed"] .dpt-agent-dot,.dpt-job[data-state="completed"] .dpt-agent-dot{background:var(--dsw-alias-state-success-primary,#0f7a4f)}
.dpt-job[data-state="stopping"] .dpt-agent-dot,.dpt-job[data-state="killed"] .dpt-agent-dot{background:var(--dsw-alias-state-warn-primary,#b45309)}
.dpt-job[data-state="failed"] .dpt-agent-dot{background:var(--dsw-alias-state-error-primary,#c4321f)}
.dpt-side-effects .dpt-side-label{align-items:center}
.dpt-jobs-list{display:grid;gap:4px;list-style:none;padding:0;margin:0}
.dpt-job,.dpt-jobs-more{padding:5px 6px;border-radius:6px;background:var(--dpt-surface-soft,var(--dsw-alias-fill-secondary,transparent))}
.dpt-job{display:flex;align-items:flex-start;gap:7px}
.dpt-jobs-more summary{cursor:pointer;font-size:11px;line-height:16px}
.dpt-jobs-more .dpt-jobs-list{margin-top:4px}
.dpt-agent-main{flex:1;min-width:0;display:flex;flex-direction:column}
.dpt-agent-name{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpt-side-agents .dpt-agent{align-items:center}
.dpt-side-agents .dpt-agent-dot{margin-top:0}
.dpt-side-agents .dpt-agent-name{flex:1;min-width:0}
.dpt-agent-duration{flex:none;margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary,#667085);font-variant-numeric:tabular-nums;white-space:nowrap}
.dpt-agent-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#667085);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpt-capsule-row{display:flex;flex-direction:column;align-items:flex-end;padding:4px 2px 0}
.dpt-capsule{display:inline-flex;align-items:center;gap:8px;max-width:100%;height:26px;padding:0 11px;box-sizing:border-box;border-radius:999px;border:1px solid var(--dpt-line);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#4a5565);font:inherit;font-size:12px;cursor:pointer;transition:border-color 120ms,color 120ms}
.dpt-capsule>span:last-child{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpt-capsule:hover,.dpt-capsule[aria-expanded="true"]{color:var(--dsw-alias-label-primary,#101828);border-color:color-mix(in srgb,var(--dpt-accent) 40%,transparent)}
.dpt-capsule .dpt-agent-dot{margin-top:0}
.dpt-capsule-row>.dpt-panel{align-self:stretch}
.dpt-capsule-row:not([data-placement="dock"]){display:none}
.dpt-capsule[data-compact]{height:28px;max-width:200px;padding:0 10px;gap:6px;flex:none}
.dpt-sidecar{position:fixed;z-index:20;display:flex;flex-direction:column;box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#101828);border-left:1px solid var(--dpt-line);overflow:hidden}
.dpt-sidecar[data-floating]{border:1px solid var(--dpt-line);border-radius:12px;box-shadow:0 4px 20px #0002}
.dpt-sidecar-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--dpt-line);font-size:13px}
.dpt-sidecar-head h3{margin:0;font:inherit;font-weight:600}
.dpt-sidecar .dpt-panel{flex:1;height:auto;overflow:hidden}
.dpt-sidecar .dpt-side-body{padding-bottom:var(--dpt-inset-bottom,0px)}
.dpt-resize{position:absolute;left:0;top:0;bottom:0;z-index:1;width:6px;cursor:col-resize;touch-action:none;-webkit-app-region:no-drag;outline:none}
.dpt-resize::after{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:transparent;transition:background-color 120ms}
.dpt-resize:hover::after,.dpt-resize:focus-visible::after,.dpt-resize[data-active]::after{background:color-mix(in srgb,var(--dpt-accent,#3370ff) 55%,transparent)}
body[data-dpt-resizing],body[data-dpt-resizing] *{cursor:col-resize!important;user-select:none!important}
[data-conversation-region="chat"][data-dpt-panel-open]{margin-right:var(--dpt-panel-width,280px)!important}
.dpt-tab-title{display:inline-flex;align-items:center;gap:6px}
.dpt-tab-title::before,.dpt-panel-mark::before{content:"";width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,var(--dpt-brand-light,#7fb0ff),var(--dpt-accent,#3370ff))}
.dpt-settings{display:grid;gap:22px;max-width:640px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#101828)}
.dpt-settings h3{margin:0 0 10px;font-size:14px;line-height:20px;font-weight:600}
.dpt-settings .dpt-side-section{padding:0}
.dpt-settings .dpt-side-section+.dpt-side-section{border:0;padding:0}
.dpt-settings-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.dpt-diag{margin:8px 0 0;padding:10px 12px;max-height:220px;overflow:auto;border-radius:10px;border:1px solid var(--dpt-line);font:11px/16px var(--ds-font-family-code,ui-monospace,monospace);white-space:pre-wrap;word-break:break-word}
.dpt-files{display:grid;gap:1px;list-style:none;margin:0;padding:0}
.dpt-file{display:flex;align-items:center;gap:6px;min-width:0;height:22px;padding:0 6px;border-radius:6px;font-size:12px;line-height:18px}
.dpt-file-open{box-sizing:border-box;width:100%;border:0;background:transparent;color:inherit;font-family:inherit;text-align:left;cursor:pointer}
.dpt-file:hover{background:color-mix(in srgb,var(--dpt-accent) 6%,transparent)}
.dpt-file-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11.5px}
.dpt-file-meta{flex:none;max-width:45%;font-size:11px;color:var(--dsw-alias-label-tertiary,#667085);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dpt-file[data-kind="presented"] .dpt-file-name{color:var(--dpt-accent,#3370ff)}
.dpt-files-more{padding:0 6px}
.dpt-files-more summary{cursor:pointer;height:22px;font-size:11px;line-height:22px;color:var(--dsw-alias-label-tertiary,#667085)}
.dpt-host .dpt-agent-dot{width:6px;height:6px;margin-top:0}
.dpt-host[data-state="ok"] .dpt-agent-dot{background:var(--dsw-alias-state-success-primary,#0f7a4f)}
.dpt-host[data-state="failed"] .dpt-agent-dot{background:var(--dsw-alias-state-error-primary,#c4321f)}
.dpt-ssh-actions{display:flex;gap:6px;padding:2px 6px 6px}
.dpt-ssh-actions .dpt-link{font-size:11px}
[data-chat-flow-kind="command"]:has([data-dpt-hidden-command]){display:none!important}
.dpt-command-error{padding:4px 2px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary,#c4321f)}
@keyframes dpt-rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.dpt-card,.dpt-panel,.dpt-capsule,.dpt-agent-dot,.dpt-switch,.dpt-switch-thumb{animation:none!important;transition:none!important}}
`;
  const THEME_CSS = `
${ON}{--dpt-dur-fast:120ms;--dpt-dur-base:200ms;--dpt-ease-out:cubic-bezier(0.22,1,0.36,1);--dpt-brand:#3370ff;--dpt-brand-ink:#1f4fc4;--dpt-brand-light:color-mix(in srgb,var(--dpt-brand) 70%,#7fd0ff)}
${ON}{
  --dsw-alias-bg-base:#ffffff !important;--dsw-alias-surface-2:#f5f7fa !important;
  --dsw-alias-label-primary:#101828 !important;--dsw-alias-label-secondary:#4a5565 !important;--dsw-alias-label-tertiary:#667085 !important;
  --dsw-alias-text-primary:#101828 !important;--dsw-alias-text-secondary:#4a5565 !important;
  --dsw-alias-border-l1:#e3e7ee !important;--dsw-alias-border-l2:#d6dce6 !important;--dsw-alias-border-l2-darkmode-thin:#d6dce6 !important;
  --dsw-alias-interactive-bg-hover:rgba(16,24,40,0.05) !important;--dsw-alias-bg-hover:rgba(16,24,40,0.05) !important;
  --dsw-alias-interactive-bg-hover-danger:rgba(196,50,31,0.10) !important;--dsw-alias-bg-danger:rgba(196,50,31,0.10) !important;
  --dsw-alias-state-error-primary:#c4321f !important;--dsw-alias-text-danger:#c4321f !important;--dsw-alias-border-danger:#c4321f !important;
  --dsw-alias-state-success-primary:#0f7a4f !important;--dsw-alias-text-success:#0f7a4f !important;
  --dsw-alias-state-warning-primary:#8a5a00 !important;--dsw-alias-text-warning:#8a5a00 !important;
  --dsw-specific-bubble:#eaf1ff !important;--dsw-specific-input-major:#ffffff !important;
  --dsw-shadow-lv1:0 1px 2px rgba(16,24,40,0.06),0 4px 14px rgba(16,24,40,0.06) !important;
  --dsh-scrollbar-thumb:rgba(16,24,40,0.16) !important;--dsh-scrollbar-thumb-hover:rgba(16,24,40,0.32) !important;
  --ds-font-family:"Segoe UI Variable Text","Segoe UI","Microsoft YaHei UI","PingFang SC","HarmonyOS Sans SC",system-ui,sans-serif !important;
  --ds-font-family-code:"JetBrains Mono","Cascadia Code","SF Mono",ui-monospace,Consolas,monospace !important;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
${ON_DARK}{
  --dsw-alias-bg-base:#0e1117 !important;--dsw-alias-surface-2:#161b24 !important;
  --dsw-alias-label-primary:#eef2f8 !important;--dsw-alias-label-secondary:#a3adbd !important;--dsw-alias-label-tertiary:#8a94a6 !important;
  --dsw-alias-text-primary:#eef2f8 !important;--dsw-alias-text-secondary:#a3adbd !important;
  --dsw-alias-border-l1:#263041 !important;--dsw-alias-border-l2:#2f3b50 !important;--dsw-alias-border-l2-darkmode-thin:#2f3b50 !important;
  --dsw-alias-interactive-bg-hover:rgba(238,242,248,0.07) !important;--dsw-alias-bg-hover:rgba(238,242,248,0.07) !important;
  --dsw-alias-interactive-bg-hover-danger:rgba(255,123,104,0.14) !important;--dsw-alias-bg-danger:rgba(255,123,104,0.14) !important;
  --dsw-alias-state-error-primary:#ff7b68 !important;--dsw-alias-text-danger:#ff7b68 !important;--dsw-alias-border-danger:#ff7b68 !important;
  --dsw-alias-state-success-primary:#4cc38a !important;--dsw-alias-text-success:#4cc38a !important;
  --dsw-alias-state-warning-primary:#e0a93b !important;--dsw-alias-text-warning:#e0a93b !important;
  --dsw-specific-bubble:#1b2f5c !important;--dsw-specific-input-major:#161b24 !important;
  --dsw-shadow-lv1:0 1px 2px rgba(0,0,0,0.4),0 4px 14px rgba(0,0,0,0.35) !important;
  --dsh-scrollbar-thumb:rgba(238,242,248,0.18) !important;--dsh-scrollbar-thumb-hover:rgba(238,242,248,0.34) !important;
  --dpt-brand:#5b8cff;--dpt-brand-ink:#9dbcff;
}
${ON0} :where(button,[role="button"],[role="menuitem"],[role="tab"],a,summary,select,input,textarea){
  transition:background-color var(--dpt-dur-fast) var(--dpt-ease-out),color var(--dpt-dur-fast) var(--dpt-ease-out),border-color var(--dpt-dur-fast) var(--dpt-ease-out),box-shadow var(--dpt-dur-base) var(--dpt-ease-out),opacity var(--dpt-dur-fast) var(--dpt-ease-out);
}
${ON0} :where(button:active:not(:disabled),[role="button"]:active:not([aria-disabled="true"])){transform:scale(0.98)}
${ON} ::selection{background:color-mix(in srgb,var(--dpt-brand) 24%,transparent)}
${ON} ${COMPOSER}{position:relative;box-shadow:0 10px 30px rgba(16,24,40,0.07),0 2px 6px rgba(16,24,40,0.05);transition:border-color var(--dpt-dur-base) var(--dpt-ease-out),box-shadow var(--dpt-dur-base) var(--dpt-ease-out)}
${ON_DARK} ${COMPOSER}{box-shadow:0 10px 30px rgba(0,0,0,0.45),0 2px 6px rgba(0,0,0,0.35)}
${ON} ${COMPOSER}::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1.5px;pointer-events:none;background:linear-gradient(115deg,var(--dpt-brand),var(--dpt-brand-light),var(--dpt-brand),var(--dpt-brand-light));background-size:300% 100%;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity var(--dpt-dur-base) var(--dpt-ease-out)}
${ON} ${COMPOSER}:focus-within::before{opacity:1}
${ON} ${COMPOSER}::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;box-shadow:0 0 0 4px color-mix(in srgb,var(--dpt-brand) 22%,transparent),0 0 44px 10px color-mix(in srgb,var(--dpt-brand) 46%,transparent),0 14px 44px color-mix(in srgb,var(--dpt-brand) 22%,transparent);transition:opacity var(--dpt-dur-base) var(--dpt-ease-out)}
${ON}:not([data-dpt-busy]) ${COMPOSER}:focus-within{box-shadow:0 0 0 4px color-mix(in srgb,var(--dpt-brand) 10%,transparent),0 14px 38px color-mix(in srgb,var(--dpt-brand) 16%,transparent) !important}
${ON} ${COMPOSER}:hover:not(:focus-within){background-image:radial-gradient(360px circle at var(--dpt-mx,50%) var(--dpt-my,50%),color-mix(in srgb,var(--dpt-brand) 7%,transparent),transparent 70%)}
@keyframes dpt-sheen{from{background-position:0% 0}to{background-position:300% 0}}
${ON} [data-dpt-send]:not(:disabled):not([aria-disabled="true"]){background-image:linear-gradient(135deg,var(--dpt-brand-light),var(--dpt-brand)) !important;color:#fff !important;box-shadow:0 4px 14px color-mix(in srgb,var(--dpt-brand) 38%,transparent);transition:transform 160ms var(--dpt-ease-out),box-shadow 160ms var(--dpt-ease-out),filter var(--dpt-dur-fast) var(--dpt-ease-out) !important}
${ON} [data-dpt-send]:not(:disabled):not([aria-disabled="true"]):hover{transform:translateY(-1px);box-shadow:0 8px 20px color-mix(in srgb,var(--dpt-brand) 46%,transparent);filter:saturate(1.08)}
${ON} [data-dpt-send]:not(:disabled):not([aria-disabled="true"]):active{transform:translateY(0) scale(0.94);transition-duration:60ms}
${ON} ${BUBBLE}{background-image:linear-gradient(90deg,color-mix(in srgb,var(--dpt-brand) 20%,transparent),color-mix(in srgb,var(--dpt-brand) 7%,transparent)) !important;background-color:transparent !important;color:var(--dsw-alias-label-primary) !important;border-radius:18px 18px 6px 18px !important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dpt-brand) 16%,transparent);animation:dpt-bubble-rise var(--dpt-dur-base) var(--dpt-ease-out) both}
${ON} ${BUBBLE} *{color:inherit}
@keyframes dpt-bubble-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
${ON} [data-chat-flow-kind="assistant-step"]{font-size:15px}
${ON} [data-chat-flow-kind="assistant-step"] :is(p,li){line-height:1.82}
${ON} [data-chat-flow-kind="assistant-step"] p{margin-block:0.7em}
${ON} [data-chat-flow-kind="assistant-step"] pre{border-radius:14px;border:1px solid var(--dsw-alias-border-l1);box-shadow:0 1px 2px rgba(16,24,40,0.04)}
${ON} [data-chat-flow-kind="assistant-step"] blockquote{border-radius:0 10px 10px 0}
${ON} [data-row-key^="session:"][role="treeitem"]{transition:background-color var(--dpt-dur-fast) var(--dpt-ease-out),color var(--dpt-dur-fast) var(--dpt-ease-out)}
${ON} [data-row-key^="session:"][role="treeitem"]:hover{background-color:color-mix(in srgb,var(--dpt-brand) 7%,transparent)}
${ON} [data-row-key^="session:"][role="treeitem"]:hover:not(:is([aria-selected="true"],[aria-current="true"],[data-selected="true"],.ld-row-selected)){background-image:radial-gradient(160px circle at var(--dpt-mx,50%) var(--dpt-my,50%),color-mix(in srgb,var(--dpt-brand) 18%,transparent),transparent 72%)}
${ON} [data-row-key^="session:"][role="treeitem"]:is([aria-selected="true"],[aria-current="true"],[data-selected="true"],.ld-row-selected){background-image:linear-gradient(90deg,color-mix(in srgb,var(--dpt-brand) 15%,transparent),color-mix(in srgb,var(--dpt-brand) 3%,transparent));font-weight:500}
${ON}[data-dpt-busy] ${COMPOSER}::before{opacity:1;padding:2.5px;animation:dpt-sheen 1.6s linear infinite}
${ON}[data-dpt-busy] ${COMPOSER}{border-color:color-mix(in srgb,var(--dpt-brand) 55%,transparent) !important}
${ON}[data-dpt-busy] ${COMPOSER}::after{animation:dpt-glow 1.9s ease-in-out infinite}
@keyframes dpt-glow{0%,100%{opacity:.3}50%{opacity:1}}
${ON} ${COMPOSER}[data-dpt-done]{animation:dpt-done 900ms var(--dpt-ease-out) 1}
@keyframes dpt-done{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dpt-brand) 60%,transparent)}100%{box-shadow:0 0 0 26px color-mix(in srgb,var(--dpt-brand) 0%,transparent)}}
${ON}[data-dpt-busy] [data-dpt-send]{position:relative}
${ON}[data-dpt-busy] [data-dpt-send]::after{content:"";position:absolute;inset:-4px;border-radius:50%;padding:2.5px;pointer-events:none;background:conic-gradient(from 0deg,transparent 0 40%,var(--dpt-brand-light) 70%,#fff 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:dpt-spin 1.1s linear infinite}
@keyframes dpt-spin{to{transform:rotate(360deg)}}
.dpt-ripple{position:fixed;z-index:2147483000;pointer-events:none;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:2px solid color-mix(in srgb,var(--dpt-brand,#3370ff) 75%,transparent);background:radial-gradient(circle,color-mix(in srgb,var(--dpt-brand,#3370ff) 45%,transparent),color-mix(in srgb,var(--dpt-brand,#3370ff) 12%,transparent) 60%,transparent 72%);animation:dpt-ripple 650ms cubic-bezier(.22,1,.36,1) forwards}
@keyframes dpt-ripple{0%{transform:scale(.3);opacity:1}100%{transform:scale(7);opacity:0}}
.dpt-fx{position:fixed;left:0;top:0;z-index:2147482000;pointer-events:none;-webkit-app-region:initial!important}
@media (prefers-reduced-motion:reduce){
  ${ON} *,${ON} *::before,${ON} *::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important}
}
`;

  function injectCss() {
    if (typeof document === 'undefined') return () => {};
    const id = `${PLUGIN}/style.css`;
    document.querySelector(`style[data-plugin-css=${JSON.stringify(id)}]`)?.remove();
    const tag = document.createElement('style');
    tag.dataset.plugin = PLUGIN;
    tag.dataset.pluginCss = id;
    tag.textContent = CARD_CSS + THEME_CSS;
    document.head.appendChild(tag);
    return () => tag.remove();
  }

  // ---------------------------------------------------------------------------------------------
  // Which session is on screen. Each conversation header mounts a hidden bridge; the visible one
  // in the main conversation decides whether the effects are on and whether the agent works. An
  // IntersectionObserver on each bridge's container reports when a conversation is shown or hidden
  // without remounting (split views, a fullscreen sidebar).
  // ---------------------------------------------------------------------------------------------
  const SESSIONS = {
    map: new Map(), subs: new Set(),
    // Sessions whose subagents are running, reported by the capsule (Deep PTC sessions only).
    working: new Map(),
    visibility: undefined,
    watch(element) {
      if (!element || typeof IntersectionObserver !== 'function') return () => {};
      this.visibility ??= new IntersectionObserver(() => this.emit());
      this.visibility.observe(element);
      return () => this.visibility?.unobserve(element);
    },
    setWorking(id, value) { if (this.working.get(id) === value) return; if (value) this.working.set(id, true); else this.working.delete(id); this.emit(); },
    set(id, value) { this.map.set(id, value); this.emit(); },
    del(id) { this.map.delete(id); this.emit(); },
    emit() { for (const listener of this.subs) { try { listener(); } catch (error) { console.warn(`[${PLUGIN}]`, error); } } },
    current() {
      let pick, fallback;
      for (const value of this.map.values()) {
        const shown = value.el?.parentElement?.getClientRects?.().length > 0;
        if (!shown) { fallback ??= value; continue; }
        const main = value.el.closest?.('[data-slot="main.conversation"]');
        if (main || pick === undefined) pick = value;
      }
      return pick ?? fallback;
    },
  };

  // ---------------------------------------------------------------------------------------------
  // The visual effects switch. Without an explicit choice the effects are on, unless an appearance
  // plugin restyles the same composer and bubbles. The host's module loader tags every plugin's
  // <style> with data-plugin, so detection reads only that host-guaranteed marker.
  // ---------------------------------------------------------------------------------------------
  const EFFECTS_KEY = `${PLUGIN}:visual-effects`;
  const APPEARANCE_PLUGINS = ['dsh-claude-style', 'dsh-refined-ui'];
  function appearancePlugin() {
    if (typeof document === 'undefined') return undefined;
    return APPEARANCE_PLUGINS.find(name => document.querySelector(`style[data-plugin="${name}"]`) !== null);
  }
  function storedEffects() {
    try {
      const value = localStorage.getItem(EFFECTS_KEY);
      return value === '1' ? true : value === '0' ? false : undefined;
    } catch { return undefined; }
  }
  let effectsChoice = storedEffects();
  const effectListeners = new Set();
  const getEffects = () => effectsChoice ?? appearancePlugin() === undefined;
  const getEffectsChoice = () => effectsChoice;
  function subscribeEffects(listener) {
    effectListeners.add(listener);
    return () => effectListeners.delete(listener);
  }
  function setEffectsChoice(choice) {
    if (effectsChoice === choice) return;
    effectsChoice = choice;
    for (const listener of effectListeners) listener();
  }
  function toggleEffects() {
    const enabled = !getEffects();
    try { localStorage.setItem(EFFECTS_KEY, enabled ? '1' : '0'); } catch { /* use the in-memory preference */ }
    setEffectsChoice(enabled);
  }
  // The standalone dsh-refined-ui draws the same look; never stack both, whatever the switch says.
  const refinedPresent = () => typeof document !== 'undefined' && document.querySelector('style[data-plugin="dsh-refined-ui"]') !== null;
  const uiOn = () => typeof document !== 'undefined' && document.body?.hasAttribute('data-dpt-ui');

  const BUSY = { on: false, was: false, timer: 0 };
  function applyBusy() {
    if (typeof document === 'undefined') return;
    const busy = uiOn() && BUSY.on;
    document.body.toggleAttribute('data-dpt-busy', busy);
    if (BUSY.was && !busy && uiOn()) {
      const card = document.querySelector(COMPOSER);
      if (card) {
        card.setAttribute('data-dpt-done', '');
        clearTimeout(BUSY.timer);
        BUSY.timer = setTimeout(() => card.removeAttribute('data-dpt-done'), 1000);
      }
    }
    BUSY.was = busy;
  }

  function watchActiveSession() {
    if (typeof document === 'undefined') return () => {};
    let stopVisuals;
    function disableVisuals() {
      if (!stopVisuals) return;
      clearTimeout(BUSY.timer);
      document.querySelectorAll('[data-dpt-done]').forEach(node => node.removeAttribute('data-dpt-done'));
      stopVisuals();
      stopVisuals = undefined;
    }
    const update = () => {
      const current = SESSIONS.current();
      const on = getEffects() && current?.preset === 'deep-ptc' && !refinedPresent();
      document.body.toggleAttribute('data-dpt-ui', on);
      // Like dsh-refined-ui, a running subagent keeps the conversation working.
      BUSY.on = on && (current?.busy === true || SESSIONS.working.get(current?.id) === true);
      applyBusy();
      if (on && !stopVisuals) {
        const cleanups = [watchSurfaces(), watchFx()];
        stopVisuals = () => cleanups.reverse().forEach(cleanup => cleanup());
      } else if (!on) disableVisuals();
    };
    SESSIONS.subs.add(update);
    const unsubscribe = subscribeEffects(update);
    const sync = event => { if (event.key === EFFECTS_KEY || event.key === null) setEffectsChoice(storedEffects()); };
    window.addEventListener('storage', sync);
    update();
    return () => {
      SESSIONS.subs.delete(update);
      unsubscribe();
      window.removeEventListener('storage', sync);
      document.body.removeAttribute('data-dpt-ui');
      document.body.removeAttribute('data-dpt-busy');
      BUSY.on = false;
      BUSY.was = false;
      disableVisuals();
    };
  }

  // The send button carries no stable host attribute: it is the right-most button in the composer
  // card. Pointer effects (spotlight, magnetic send button, click ripple) read layout at most once
  // per animation frame, whatever the pointer rate.
  function watchSurfaces() {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const tagged = new Set();
    const highlighted = new Set();
    let tagFrame = 0, pointerFrame = 0, pointer = null, magnet = null;
    function tagSend() {
      tagFrame = 0;
      for (const card of document.querySelectorAll(COMPOSER)) {
        if (card.querySelector('[data-dpt-send]')) continue;
        let best = null, bestRight = -1;
        for (const button of card.querySelectorAll('button,[role="button"]')) {
          const rect = button.getBoundingClientRect();
          if (rect.width > 0 && rect.right >= bestRight) { best = button; bestRight = rect.right; }
        }
        if (best) { best.setAttribute('data-dpt-send', ''); tagged.add(best); }
      }
    }
    function track() {
      pointerFrame = 0;
      const event = pointer;
      pointer = null;
      if (!event || !uiOn()) return;
      const host = event.target?.closest?.(`[data-row-key^="session:"],${COMPOSER}`);
      if (host) {
        const rect = host.getBoundingClientRect();
        host.style.setProperty('--dpt-mx', `${event.x - rect.left}px`);
        host.style.setProperty('--dpt-my', `${event.y - rect.top}px`);
        highlighted.add(host);
      }
      if (reduce) return;
      const button = document.querySelector('[data-dpt-send]');
      if (magnet && magnet !== button) { magnet.style.translate = ''; magnet = null; }
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const dx = event.x - (rect.left + rect.width / 2), dy = event.y - (rect.top + rect.height / 2);
      if (Math.hypot(dx, dy) < 70) { button.style.translate = `${(dx * 0.18).toFixed(1)}px ${(dy * 0.18).toFixed(1)}px`; magnet = button; }
      else if (magnet) { button.style.translate = ''; magnet = null; }
    }
    function onMove(event) {
      pointer = { x: event.clientX, y: event.clientY, target: event.target };
      if (!pointerFrame) pointerFrame = requestAnimationFrame(track);
    }
    function onDown(event) {
      if (event.button !== 0 || reduce || !uiOn()) return;
      if (!event.target?.closest?.('button,a,[role=button],[role=treeitem],[role=tab],[role=menuitem],[role=option],summary')) return;
      const ripple = document.createElement('div');
      ripple.className = 'dpt-ripple';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }
    // Streaming text mutates the document constantly; each burst costs one cheap query per frame.
    const observer = new MutationObserver(() => { if (!tagFrame) tagFrame = requestAnimationFrame(tagSend); });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pointermove', onMove, { capture: true, passive: true });
    document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    tagSend();
    return () => {
      observer.disconnect();
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerdown', onDown, true);
      if (tagFrame) cancelAnimationFrame(tagFrame);
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      if (magnet) magnet.style.translate = '';
      for (const node of tagged) node.removeAttribute('data-dpt-send');
      tagged.clear();
      for (const node of highlighted) {
        node.style.removeProperty('--dpt-mx');
        node.style.removeProperty('--dpt-my');
      }
      for (const node of document.querySelectorAll('.dpt-ripple')) node.remove();
    };
  }

  // Send burst, completion sparkle and embers while the agent works. The canvas covers only the
  // composer and the space above it where the sparks rise, at no more than 1.5 device pixels per
  // CSS pixel, and the frame loop stops whenever nothing moves or the window is hidden.
  function watchFx() {
    if (typeof document === 'undefined' || typeof requestAnimationFrame === 'undefined' || typeof MutationObserver === 'undefined'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true) return () => {};
    const canvas = document.createElement('canvas');
    canvas.className = 'dpt-fx';
    canvas.setAttribute('aria-hidden', 'true');
    const paint = canvas.getContext('2d');
    if (!paint) return () => {};
    document.body.appendChild(canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const PAD_X = 48, PAD_TOP = 240, PAD_BOTTOM = 24, MAX_PARTS = 160;
    const hues = ['#3370ff', '#5b8cff', '#7fd0ff', '#9dbcff', '#b48cff', '#ffffff'];
    let box, parts = [], raf = 0, lastEmber = 0;
    const busy = () => document.body.hasAttribute('data-dpt-busy');
    let wasBusy = busy();
    function place() {
      const composer = document.querySelector(COMPOSER)?.getBoundingClientRect();
      if (!composer || composer.width === 0) { box = undefined; canvas.style.display = 'none'; return; }
      const left = Math.max(0, Math.floor(composer.left - PAD_X)), top = Math.max(0, Math.floor(composer.top - PAD_TOP));
      const width = Math.max(1, Math.ceil(Math.min(window.innerWidth, composer.right + PAD_X) - left));
      const height = Math.max(1, Math.ceil(Math.min(window.innerHeight, composer.bottom + PAD_BOTTOM) - top));
      if (box?.width !== width || box?.height !== height) {
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
        paint.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (box?.left !== left || box?.top !== top) canvas.style.transform = `translate(${left}px,${top}px)`;
      canvas.style.display = '';
      box = { left, top, width, height, composer };
    }
    const kick = () => { if (!raf && !document.hidden) { place(); raf = requestAnimationFrame(frame); } };
    function burst(x, y, count, power) {
      if (!uiOn()) return;
      for (let index = 0; index < count && parts.length < MAX_PARTS; index++) {
        const angle = Math.random() * Math.PI * 2, speed = (0.4 + Math.random()) * power;
        parts.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - power * 0.35, life: 1,
          decay: 0.014 + Math.random() * 0.016, r: 1.4 + Math.random() * 2.4, color: hues[(Math.random() * hues.length) | 0] });
      }
      kick();
    }
    function frame(now) {
      raf = 0;
      if (!box) { parts = []; return; }
      paint.clearRect(0, 0, box.width, box.height);
      // Embers rise from the composer while the agent works.
      if (busy() && now - lastEmber > 35 && parts.length < MAX_PARTS) {
        lastEmber = now;
        const rect = box.composer;
        parts.push({ x: rect.left + 12 + Math.random() * (rect.width - 24), y: rect.top + 2, vx: (Math.random() - 0.5) * 0.5,
          vy: -(0.5 + Math.random() * 1.1), gravity: -0.004, life: 1, decay: 0.009 + Math.random() * 0.01,
          r: 1.8 + Math.random() * 2.4, color: hues[(Math.random() * 4) | 0] });
      }
      paint.globalCompositeOperation = 'lighter';
      let live = 0;
      for (const part of parts) {
        part.x += part.vx; part.y += part.vy; part.vy += part.gravity ?? 0.09; part.vx *= 0.985; part.life -= part.decay;
        if (part.life <= 0) continue;
        parts[live++] = part;
        paint.globalAlpha = part.life;
        paint.fillStyle = part.color;
        paint.beginPath();
        paint.arc(part.x - box.left, part.y - box.top, part.r * (0.4 + part.life * 0.6), 0, 6.3);
        paint.fill();
      }
      parts.length = live;
      paint.globalAlpha = 1;
      paint.globalCompositeOperation = 'source-over';
      if (parts.length || busy()) raf = document.hidden ? 0 : requestAnimationFrame(frame);
      else paint.clearRect(0, 0, box.width, box.height);
    }
    const center = node => { const rect = node.getBoundingClientRect(); return [rect.left + rect.width / 2, rect.top + rect.height / 2]; };
    function onDown(event) {
      const button = event.target?.closest?.('[data-dpt-send]');
      if (button && event.button === 0) burst(...center(button), 34, 4.2);
    }
    // Sending with Enter bursts like a click; the key event is only observed, never consumed.
    function onSend(event) {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      if (!event.target?.closest?.('[data-composer-input]')) return;
      const button = document.querySelector('[data-dpt-send]');
      if (button) burst(...center(button), 34, 4.2);
    }
    const observer = new MutationObserver(() => {
      const now = busy();
      if (wasBusy && !now) {
        place();
        const rect = box?.composer;
        if (rect) {
          burst(rect.left + rect.width / 2, rect.top, 22, 3.2);
          burst(rect.left + rect.width * 0.25, rect.top, 10, 2.4);
          burst(rect.left + rect.width * 0.75, rect.top, 10, 2.4);
        }
      }
      if (now) kick();
      wasBusy = now;
    });
    const onResize = () => { if (raf) place(); };
    const onVisibility = () => { if (!document.hidden && (parts.length || busy())) kick(); };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-dpt-busy'] });
    document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    document.addEventListener('keydown', onSend, { capture: true, passive: true });
    if (wasBusy) kick();
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onSend, true);
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      canvas.remove();
    };
  }

  // A read-only outline of what the effects rely on, copied from the settings page for bug reports.
  function diagnostics() {
    const count = selector => typeof document === 'undefined' ? 0 : document.querySelectorAll(selector).length;
    const current = SESSIONS.current();
    return [
      `${PLUGIN} client | effects=${getEffects()} choice=${String(effectsChoice)} appearance=${appearancePlugin() ?? '-'} ui=${uiOn()}`,
      `session=${current?.id ?? '-'} preset=${current?.preset ?? '-'} busy=${current?.busy === true} working=${SESSIONS.working.size}`,
      `host: composer=${count(COMPOSER)} input=${count('[data-composer-input]')} bubble=${count('[data-message-bubble]')} send=${count('[data-dpt-send]')}`,
      `ui: capsule=${count('.dpt-capsule')} panel=${count('.dpt-panel')} skills=${count('.dpt-skills')}`,
      `ua=${typeof navigator === 'undefined' ? '-' : navigator.userAgent}`,
    ].join('\n');
  }
  // ---------------------------------------------------------------------------------------------
  // Skill card, at the end of the latest turn in the conversation.
  // ---------------------------------------------------------------------------------------------
  const SKILL_ROWS = 4;
  const SkillIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M3.5 2.75h6.25L12.5 5.5v7.75H3.5z', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' }),
    h('path', { d: 'M9.5 2.75V5.75h3M5.75 8.5h4.5M5.75 10.75h3', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }));

  function SkillSwitch({ on, disabled, label, onChange }) {
    return h('button', { type: 'button', role: 'switch', className: 'dpt-switch', 'aria-checked': on, 'aria-label': label, title: label, disabled,
      onClick: () => { if (!disabled) onChange(!on); } }, h('span', { className: 'dpt-switch-thumb', 'aria-hidden': 'true' }));
  }

  function VisualEffectsSection({ t }) {
    const enabled = React.useSyncExternalStore(subscribeEffects, getEffects, getEffects);
    const choice = React.useSyncExternalStore(subscribeEffects, getEffectsChoice, getEffectsChoice);
    const appearance = choice === undefined ? appearancePlugin() : undefined;
    const label = t('visualEffects');
    return h('section', { className: 'dpt-side-section dpt-side-effects', 'aria-label': label },
      h('div', { className: 'dpt-side-label' }, h('span', null, label),
        h(SkillSwitch, { on: enabled, label, onChange: toggleEffects })),
      h('p', { className: 'dpt-side-note' }, appearance ? tf(t, 'visualEffectsAuto', { name: appearance }) : t('visualEffectsHint')));
  }

  function SkillCard({ turn, useProjection, useChat, setSkill, setAll, t }) {
    const [busy, setBusy] = React.useState(false);
    const [expanded, setExpanded] = React.useState(false);
    // Projection failures are not caught: a silent null would make a broken card look like "no skills".
    const state = useProjection('deepPtcSkills');
    const lastTurn = typeof useChat === 'function' ? useChat(snapshot => snapshot?.timeline?.turnOrder?.at?.(-1)) : undefined;
    const turnNumber = typeof turn === 'number' ? turn : turn?.turn;
    const latest = turnNumber === undefined || (lastTurn !== undefined ? lastTurn === turnNumber : state?.turn === turnNumber);
    if (!state || state.phase !== 'idle' || !Array.isArray(state.skills) || state.skills.length === 0 || !latest) return null;
    async function run(action) {
      setBusy(true);
      try { await action(); } catch { /* the projection is authoritative */ } finally { setBusy(false); }
    }
    const closing = state.skills.filter(row => !row.enabled).length;
    const rows = expanded ? state.skills : state.skills.slice(0, SKILL_ROWS);
    return h('section', { className: 'dpt-card dpt-skills', 'aria-label': t('skillTitle') },
      h('header', { className: 'dpt-card-head' },
        h('span', { className: 'dpt-card-icon' }, h(SkillIcon)),
        h('div', { className: 'dpt-card-titles' },
          h('span', { className: 'dpt-card-title' }, t('skillTitle')),
          h('span', { className: 'dpt-card-sub' }, tf(t, 'skillLoaded', { count: state.skills.length }),
            closing ? h(React.Fragment, null, ' · ', h('span', { 'data-tone': 'warn' }, tf(t, 'skillClosing', { count: closing }))) : null)),
        h('div', { className: 'dpt-card-actions' },
          h('button', { type: 'button', className: 'dpt-btn', disabled: busy || closing === 0, 'aria-busy': busy,
            onClick: () => { void run(() => setAll(true)); } }, t('skillKeepAll')),
          h('button', { type: 'button', className: 'dpt-btn', disabled: busy || closing === state.skills.length, 'aria-busy': busy,
            onClick: () => { void run(() => setAll(false)); } }, t('skillCloseAll')))),
      h('ul', { className: 'dpt-skill-list' }, ...rows.map(row => h('li', { key: row.name, className: 'dpt-skill', 'data-off': row.enabled ? undefined : '' },
        h('div', { className: 'dpt-skill-text' },
          h('span', { className: 'dpt-skill-name' }, h('span', null, row.name),
            row.loadedTurn === state.turn ? h('span', { className: 'dpt-tag' }, t('skillThisTurn')) : null),
          h('span', { className: 'dpt-skill-desc', title: row.description || t('skillNoDescription') }, row.description || t('skillNoDescription'))),
        h(SkillSwitch, { on: row.enabled, disabled: busy, label: row.name, onChange: value => { void run(() => setSkill(row.name, value)); } })))),
      h('footer', { className: 'dpt-card-foot' }, h('span', null, t('skillHint')),
        state.skills.length > SKILL_ROWS ? h('button', { type: 'button', className: 'dpt-link', onClick: () => setExpanded(!expanded) },
          expanded ? t('skillShowLess') : tf(t, 'skillShowAll', { count: state.skills.length })) : null));
  }

  function SkillTail(props) {
    // Registered for every session; only Deep PTC sessions read the skill projection.
    let preset;
    try { preset = props.useProjection('agentPreset'); } catch { return null; }
    if (preset !== 'deep-ptc') return null;
    return h(SkillCard, props);
  }

  // ---------------------------------------------------------------------------------------------
  // The Deep PTC panel. Subagent rows follow the official subagent catalog and timing projections;
  // a row opens the official subagent chat in the right sidebar.
  // ---------------------------------------------------------------------------------------------
  const AGENT_ROWS = 24;

  function subagentRows(sessions, rootId, now) {
    const catalogOf = id => {
      const value = sessions?.projectionsBySession?.[id]?.values?.subagentCatalog ?? sessions?.byId?.[id]?.projectionValues?.subagentCatalog;
      return Array.isArray(value) ? value : [];
    };
    const rows = [];
    const seen = new Set([rootId]);
    const visit = (parentId, depth) => {
      if (depth > 2) return;
      for (const entry of catalogOf(parentId)) {
        if (rows.length >= AGENT_ROWS) return;
        if (typeof entry?.id !== 'string' || seen.has(entry.id)) continue;
        seen.add(entry.id);
        const summary = sessions?.byId?.[entry.id];
        const timing = summary?.projectionValues?.subagentTiming;
        const external = entry.mode === 'external';
        // The parent's catalog refreshes only when the official dropdown opens; the session list carries
        // each session's live running flag.
        const running = !external && (entry.activity === 'running' || summary?.running === true);
        const completed = !external && entry.activity === 'inactive' && timing?.lastTurnCompleted === true;
        const duration = timing === undefined || external ? undefined : timing.active === undefined ? timing.settledMs
          : timing.settledMs + Math.max(0, (running ? now : timing.active.through) - timing.active.since);
        rows.push({ id: entry.id, parentId, mode: entry.mode, depth,
          label: entry.label ?? summary?.title ?? summary?.displayTitle ?? entry.id,
          state: external ? 'external' : running ? 'running' : completed ? 'completed' : 'idle',
          duration: Number.isFinite(duration) ? duration : undefined });
        visit(entry.id, depth + 1);
      }
    };
    visit(rootId, 0);
    return rows;
  }

  function formatDuration(ms, t) {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60;
    if (h > 0) return tf(t, 'durationHours', { h, m });
    if (total >= 60) return tf(t, 'durationMinutes', { m: Math.floor(total / 60), s });
    return tf(t, 'durationSeconds', { s });
  }
  function openSubagent(row) {
    const sidebar = hostCtx?.get?.('sidebarRight');
    if (typeof sidebar?.openResource === 'function') {
      const query = new URLSearchParams({ parent: row.parentId, mode: row.mode ?? 'unknown' });
      sidebar.openResource(`dsh-resource://subagentchat/session/${encodeURIComponent(row.id)}?${query}`, { kind: 'subagentchat', preferNewPane: true });
      return;
    }
    const workspace = hostCtx?.get?.('uiWorkspace');
    if (typeof workspace?.openSession === 'function') {
      workspace.openSession({ parentSessionId: row.parentId, childSessionId: row.id, mode: row.mode });
    }
  }

  // The execution environment for Deep PTC sessions created from now on. It writes the same host
  // settings form as the plugin settings page; a session keeps the environment it was created with.
  const ENV_SHORT = { auto: 'envAuto', wsl: 'WSL', powershell: 'PowerShell', zsh: 'Zsh', bash: 'Bash' };
  const NO_FORM = { status: 'unavailable' };
  const noSubscribe = () => () => {};
  const noSnapshot = () => NO_FORM;
  const allowedEnvironments = platform => platform === 'win32' ? ['auto', 'wsl', 'powershell', 'bash'] : ['auto', 'zsh', 'bash'];
  const effectiveEnvironment = (environment, platform) => environment !== 'auto' ? environment
    : platform === 'win32' ? 'powershell' : platform === 'darwin' ? 'zsh' : 'bash';
  const envLabel = (value, t) => value === 'auto' ? t('envAuto') : ENV_SHORT[value] ?? value;
  function shellLabel(label, t) {
    if (label === 'PowerShell 7 Preview') return t('shellPreview');
    if (label === 'PowerShell 7 (Microsoft Store)') return t('shellStore');
    const system = /^(bash|zsh) \(system\)$/u.exec(label);
    return system ? tf(t, 'shellSystem', { name: system[1] }) : label;
  }

  // Only slots that show one entry are localized here. The settings page lists every entry of
  // settings.section, so Deep PTC has its own page instead of a second Agent presets entry.
  const PRESET_LABEL_SLOTS = [
    ['conversation.hero.agentPreset', undefined, 'useAgentPresetSeat', 'options'],
    ['conversation.session.header.actions', 'agent-preset', 'useAgentPresets', 'options'],
  ];

  // The host publishes `Deep PTC · <status>` (presetDescription in lib/model.mjs), readable as is in
  // any language. This reads the status back so the picker can show it in the active language.
  const STATUS_PREFIX = 'Deep PTC · ';
  const SAFE_LABEL = '安全模式 Safe mode';
  const OFFICIAL_LABEL = '官方 Shell Official shell';
  function presetStatus(description) {
    if (typeof description !== 'string' || !description.startsWith(STATUS_PREFIX)) return undefined;
    const text = description.slice(STATUS_PREFIX.length);
    if (text.startsWith(SAFE_LABEL)) return { kind: 'safe', reason: text.slice(SAFE_LABEL.length).replace(/^:\s*/u, '') };
    if (text === OFFICIAL_LABEL) return { kind: 'official' };
    const environment = /^(WSL|PowerShell|Zsh|Bash)(?: \((.+)\))?$/u.exec(text);
    return environment ? { kind: 'environment', label: environment[1], distribution: environment[2] } : undefined;
  }

  function translatedPreset(row, t) {
    if (row?.id !== 'deep-ptc') return row;
    const status = presetStatus(row.description);
    let line;
    if (status?.kind === 'safe') line = status.reason ? tf(t, 'presetSafeReason', { reason: status.reason }) : t('presetSafeMode');
    else if (status?.kind === 'official') line = tf(t, 'presetEnvironment', { env: t('presetOfficial') });
    else if (status?.kind === 'environment') line = tf(t, 'presetEnvironment', { env: status.distribution ? `${status.label} (${status.distribution})` : status.label });
    return { ...row, name: t('presetName'), description: [t('presetDescription'), line].filter(Boolean).join(' ') };
  }

  function presetSnapshotTranslator(rowsKey, t) {
    const cache = new WeakMap();
    return snapshot => {
      if (!snapshot || typeof snapshot !== 'object') return snapshot;
      if (cache.has(snapshot)) return cache.get(snapshot);
      const rows = snapshot[rowsKey];
      const error = snapshot.error;
      const hasPreset = Array.isArray(rows) && rows.some(row => row.id === 'deep-ptc');
      const hasPresetError = error?.preset?.id === 'deep-ptc';
      const localized = hasPreset || hasPresetError ? {
        ...snapshot,
        ...(hasPreset ? { [rowsKey]: rows.map(row => translatedPreset(row, t)) } : {}),
        ...(hasPresetError ? { error: { ...error, preset: translatedPreset(error.preset, t) } } : {}),
      } : snapshot;
      cache.set(snapshot, localized);
      return localized;
    };
  }

  // Keep the native picker and its actions. A higher-priority slot entry supplies localized
  // display snapshots only for our row, while the host owns the actual selection and preset.
  function installPresetLabels(slots, t, useLocaleRevision) {
    if (typeof slots.entriesOfSlot !== 'function' || typeof slots.entries !== 'function' || typeof slots.subscribe !== 'function') return;
    for (const [name, id, hook, rows] of PRESET_LABEL_SLOTS) {
      slots.inject(name, () => {
        let original;
        let dispose;
        const sync = () => {
          const entry = slots.entries(name).find(item => item.options?.id === id && (item.options?.priority ?? 0) === 0
            && item.locale === 'settings.agentPreset' && !item.children && !item.store && typeof item.component === 'function');
          if (entry === original) return;
          original = entry;
          dispose?.();
          dispose = undefined;
          if (!entry) return;
          function LocalizedPresetSlot(props) {
            const revision = useLocaleRevision();
            const translate = React.useMemo(() => presetSnapshotTranslator(rows, t), [revision]);
            const useRoster = props[hook];
            const useLocalizedRoster = React.useCallback((select, equal) => useRoster(
              snapshot => select(translate(snapshot)), equal), [useRoster, translate]);
            return h(entry.component, typeof useRoster === 'function' ? { ...props, [hook]: useLocalizedRoster } : props);
          }
          try {
            dispose = slots.register({ ...entry.options, name, priority: -1, locale: entry.locale, inject: entry.inject }, LocalizedPresetSlot);
          } catch { /* Another plugin may already own the presentation slot. */ }
        };
        const unsubscribe = slots.subscribe(name, sync);
        sync();
        return () => { unsubscribe(); dispose?.(); };
      });
    }
  }

  function useSettingsForm(form) {
    const subscribe = React.useCallback(listener => form ? form.subscribe(listener) : () => {}, [form]);
    const read = React.useCallback(() => form ? form.getSnapshot() : NO_FORM, [form]);
    return React.useSyncExternalStore(form ? subscribe : noSubscribe, form ? read : noSnapshot, form ? read : noSnapshot);
  }

  function EnvironmentSection({ form, t }) {
    const state = useSettingsForm(form);
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState(null);
    const [distribution, setDistribution] = React.useState(undefined);
    const [bashPath, setBashPath] = React.useState(undefined);
    if (!form || state.status === 'unavailable') return null;
    if (state.status !== 'ready' || !state.value) return h('section', { className: 'dpt-side-section' }, h('p', { className: 'dpt-side-note' }, t('loading')));
    const value = state.value;
    const platform = value.hostPlatform;
    const environment = value.environment ?? 'auto';
    const editingBash = platform === 'win32' && (environment === 'bash' || bashPath !== undefined);
    const bashDraft = bashPath ?? value.shellExecutable ?? '';
    const effective = effectiveEnvironment(environment, platform);
    const choices = (Array.isArray(value.shellChoices) ? value.shellChoices : []).filter(item => item && typeof item.id === 'string');
    const disabled = !state.writable || saving;
    const savedDistribution = value.wslDistribution ?? '';
    const draft = distribution ?? savedDistribution;
    async function save(ops, label) {
      setSaving(true); setMessage(null);
      try {
        const ok = await form.mutate(ops, form.getSnapshot().revision);
        if (!ok) throw new Error('rejected');
        setMessage({ tone: 'ok', label });
        return true;
      } catch {
        setMessage({ tone: 'error' });
        return false;
      } finally { setSaving(false); }
    }
    function choose(next) {
      if (platform === 'win32' && next === 'bash') {
        if (environment !== 'bash') setBashPath('');
        setMessage(null);
        return;
      }
      setBashPath(undefined);
      if (next === environment) return;
      const family = effectiveEnvironment(next, platform);
      const current = choices.find(item => item.id === value.shellExecutable);
      const ops = [{ op: 'set', path: ['environment'], value: next }];
      // A shell picked for another family would not apply; fall back to the official lookup.
      if (value.shellExecutable && current?.family !== family) ops.push({ op: 'set', path: ['shellExecutable'], value: '' });
      void save(ops, next === 'auto' ? { key: 'envAuto' } : envLabel(next, t));
    }
    async function saveDistribution(event) {
      event?.preventDefault?.();
      const next = draft.trim();
      if (next === savedDistribution) { setDistribution(undefined); return; }
      if (await save([{ op: 'set', path: ['wslDistribution'], value: next }], next ? `WSL (${next})` : 'WSL')) setDistribution(undefined);
    }
    async function saveBash(event) {
      event.preventDefault();
      const next = bashDraft.trim();
      if (!next || (environment === 'bash' && next === value.shellExecutable)) return;
      if (await save([{ op: 'set', path: ['environment'], value: 'bash' },
        { op: 'set', path: ['shellExecutable'], value: next }], 'Bash')) setBashPath(undefined);
    }
    const familyChoices = choices.filter(item => item.family === effective);
    let note = t('envThisSession');
    if (message?.tone === 'error') note = t('envFailed');
    else if (message) {
      const label = message.label;
      const env = typeof label === 'string' ? label : label.key ? t(label.key) : shellLabel(label.shell, t);
      note = tf(t, 'envSaved', { env });
    } else if (!state.writable) note = t('readOnly');
    else if (environment === 'auto') note = tf(t, 'envAutoNow', { env: envLabel(effective, t) });
    return h('section', { className: 'dpt-side-section', 'aria-label': t('environment') },
      h('div', { className: 'dpt-side-label' }, h('span', null, t('environment')), h('span', { className: 'dpt-side-hint' }, t('envForNew'))),
      h('div', { className: 'dpt-seg', role: 'radiogroup', 'aria-label': t('environment') },
        ...allowedEnvironments(platform).map(option => h('button', { key: option, type: 'button', role: 'radio', className: 'dpt-seg-btn',
          'aria-checked': option === (editingBash ? 'bash' : environment), disabled,
          title: t(platform === 'win32' && option === 'bash' ? 'windowsBash' : option),
          onClick: () => choose(option) }, envLabel(option, t)))),
      editingBash ? h(React.Fragment, null,
        h('form', { className: 'dpt-field', onSubmit: saveBash },
          h('input', { className: 'dpt-input', value: bashDraft, disabled, placeholder: t('bashPath'), 'aria-label': t('bashPath'),
            onChange: event => { setBashPath(event.target.value); setMessage(null); } }),
          (environment !== 'bash' || bashDraft.trim() !== value.shellExecutable)
            ? h('button', { type: 'submit', className: 'dpt-btn', disabled: disabled || !bashDraft.trim() }, t('save')) : null),
        h('p', { className: 'dpt-side-note' }, t('bashPathHint'))) : null,
      !editingBash && effective === 'wsl' ? h('form', { className: 'dpt-field', onSubmit: saveDistribution },
        h('input', { className: 'dpt-input', value: draft, disabled, placeholder: t('envDefaultDistribution'), 'aria-label': t('distribution'),
          title: t('distributionHint'), onChange: event => { setDistribution(event.target.value); setMessage(null); } }),
        draft.trim() !== savedDistribution ? h('button', { type: 'submit', className: 'dpt-btn', disabled }, t('save')) : null) : null,
      !editingBash && effective !== 'wsl' && familyChoices.length > 0 ? h('div', { className: 'dpt-field' },
        h('select', { className: 'dpt-select', value: value.shellExecutable ?? '', disabled, 'aria-label': t('shell'), title: t('shellHint'),
          onChange: event => { const item = familyChoices.find(choice => choice.id === event.target.value);
            void save([{ op: 'set', path: ['shellExecutable'], value: event.target.value }], item ? { shell: item.label } : { key: 'shellAuto' }); } },
        h('option', { value: '' }, t('shellAuto')), ...familyChoices.map(item => h('option', { key: item.id, value: item.id }, shellLabel(item.label, t))))) : null,
      h('p', { className: 'dpt-side-note', role: 'status', 'data-tone': message?.tone }, note));
  }

  const JOB_STATUS = new Map([
    ['running', 'jobRunning'], ['stopping', 'jobStopping'], ['completed', 'jobCompleted'],
    ['killed', 'jobKilled'], ['failed', 'jobFailed'],
  ]);
  const JOB_PREVIEW_LIMIT = 6;
  const ACTIVE_JOB_LIMIT = 5;
  const FINISHED_JOB_LIMIT = 3;

  function BackgroundJobs({ jobs, t }) {
    const active = [];
    const finished = [];
    for (const job of jobs ?? []) {
      if (job.status === 'running' || job.status === 'stopping') active.push(job);
      else if (JOB_STATUS.has(job.status)) finished.push(job);
    }
    active.sort((left, right) => left.startedAt - right.startedAt);
    finished.sort((left, right) =>
      (right.finishedAt ?? right.startedAt) - (left.finishedAt ?? left.startedAt) || left.startedAt - right.startedAt);

    const eligible = [...active.slice(0, ACTIVE_JOB_LIMIT), ...finished.slice(0, FINISHED_JOB_LIMIT)];
    const total = active.length + finished.length;
    // Overflow itself occupies one of the six positions, including overflow from either status cap.
    const hasOverflow = total > eligible.length || total > JOB_PREVIEW_LIMIT;
    const visibleLimit = hasOverflow ? JOB_PREVIEW_LIMIT - 1 : JOB_PREVIEW_LIMIT;
    const visible = eligible.slice(0, visibleLimit);
    const hidden = visible.length < total ? [...active, ...finished].filter(job => !visible.includes(job)) : [];
    const row = job => {
      const label = job.label || job.kind || job.id;
      return h('li', { key: job.id, className: 'dpt-job', 'data-state': job.status },
        h('span', { className: 'dpt-agent-dot', 'aria-hidden': 'true' }),
        h('span', { className: 'dpt-agent-main' },
          h('span', { className: 'dpt-agent-name', title: label }, label),
          h('span', { className: 'dpt-agent-meta' }, t(JOB_STATUS.get(job.status)))));
    };
    const title = t('jobsTitle');
    return h('section', { className: 'dpt-side-section', 'aria-label': title },
      h('div', { className: 'dpt-side-label' }, h('span', null, title)),
      total ? h('ul', { className: 'dpt-jobs-list' }, ...visible.map(row),
        hidden.length ? h('li', { className: 'dpt-jobs-more' },
          h('details', null, h('summary', null, tf(t, 'jobsMore', { count: hidden.length })),
            h('ul', { className: 'dpt-jobs-list' }, ...hidden.map(row)))) : null)
        : h('p', { className: 'dpt-side-note' }, t('jobsEmpty')));
  }

  // Desktop RCs expose the jobs roster through a dedicated service. Other hosts include it in sessions.
  function LiveBackgroundJobs({ sessionId, useJobs, watchJobs, t }) {
    const jobs = useJobs(state => state.rows[sessionId]);
    React.useEffect(() => watchJobs(sessionId), [sessionId, watchJobs]);
    return h(BackgroundJobs, { jobs, t });
  }
  // Output files: newest first, at most three positions, and overflow takes one of them.
  const OUTPUT_PREVIEW_LIMIT = 3;
  const fileName = path => String(path).split(/[\\/]/u).filter(Boolean).at(-1) ?? String(path);

  function openOutputFile(sessionId, path) {
    // Use the same session-scoped resource address as the host's deliverable cards.
    const segment = value => encodeURIComponent(value).replace(/%3A/giu, ':');
    const normalized = path.replace(/\\/gu, '/').replace(/^(?:\.\/)+/u, '');
    const address = `dsh-resource://file/session/${segment(sessionId)}/${normalized.split('/').map(segment).join('/')}`;
    const sidebar = hostCtx?.get?.('sidebarRight');
    if (typeof sidebar?.openResourceIn === 'function') return sidebar.openResourceIn(sessionId, address);
    if (typeof sidebar?.openResource === 'function') return sidebar.openResource(address);
    throw new Error('File preview is unavailable');
  }

  function OutputsSection({ sessionId, outputs, t }) {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [sessionId]);
    async function open(path) {
      setFailed(false);
      try { await openOutputFile(sessionId, path); } catch { setFailed(true); }
    }
    const rows = Array.isArray(outputs) ? outputs : [];
    const overflow = rows.length > OUTPUT_PREVIEW_LIMIT;
    const visible = rows.slice(0, overflow ? OUTPUT_PREVIEW_LIMIT - 1 : OUTPUT_PREVIEW_LIMIT);
    const hidden = overflow ? rows.slice(visible.length) : [];
    const row = item => h('li', { key: item.path },
      h('button', { type: 'button', className: 'dpt-file dpt-file-open', 'data-kind': item.kind, title: item.path,
        onClick: () => { void open(item.path); } },
      h('span', { className: 'dpt-file-name' }, fileName(item.path)),
      h('span', { className: 'dpt-file-meta' }, item.kind === 'presented' ? t('outputPresented') : tf(t, 'outputTurn', { turn: item.turn }))));
    const title = t('outputsTitle');
    return h('section', { className: 'dpt-side-section dpt-side-files', 'aria-label': title },
      h('div', { className: 'dpt-side-label' }, h('span', null, title), rows.length ? h('span', { className: 'dpt-side-hint' }, String(rows.length)) : null),
      rows.length ? h('ul', { className: 'dpt-files' }, ...visible.map(row),
        hidden.length ? h('li', { className: 'dpt-files-more' },
          h('details', null, h('summary', null, tf(t, 'outputsMore', { count: hidden.length })),
            h('ul', { className: 'dpt-files' }, ...hidden.map(row)))) : null)
        : h('p', { className: 'dpt-side-note' }, t('outputsEmpty')),
      failed ? h('p', { className: 'dpt-side-note', role: 'status' }, t('outputOpenFailed')) : null);
  }

  // SSH: the configured host aliases and the hosts this conversation reached, most recent first.
  function SshSection({ form, ssh, t }) {
    const settings = useSettingsForm(form);
    const [copyStatus, setCopyStatus] = React.useState();
    const configured = settings.status === 'ready' && Array.isArray(settings.value?.sshHosts) ? settings.value.sshHosts : [];
    const client = settings.status === 'ready' ? settings.value?.sshClient : undefined;
    const used = Array.isArray(ssh) ? ssh : [];
    const names = new Set(used.map(row => row.host));
    const rows = [...used.map(row => ({ host: row.host, used: row, config: configured.find(item => item.alias === row.host) })),
      ...configured.filter(item => !names.has(item.alias)).map(item => ({ host: item.alias, config: item }))];
    const endpoint = config => config ? [config.user ? `${config.user}@` : '', config.hostName || '', config.port && config.port !== '22' ? `:${config.port}` : ''].join('') : '';
    async function copyHost(item, go) {
      const config = item.config;
      let text;
      if (go) {
        text = tf(t, 'sshGoDetails', { host: config?.hostName || item.host, port: config?.port || '22',
          user: config?.user || t('sshUserNeeded'), alias: item.host });
      } else {
        const value = settings.value;
        const powershell = effectiveEnvironment(value?.environment ?? 'auto', value?.hostPlatform) === 'powershell';
        const quoteEscape = powershell ? "''" : "'\\''";
        const host = "'" + item.host.replaceAll("'", quoteEscape) + "'";
        text = `ssh -o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=1 -- ${host} hostname`;
      }
      try {
        await navigator.clipboard.writeText(text);
        setCopyStatus('sshCopied');
      } catch { setCopyStatus('sshCopyFailed'); }
    }
    const title = t('sshTitle');
    return h('section', { className: 'dpt-side-section dpt-side-ssh', 'aria-label': title },
      h('div', { className: 'dpt-side-label' }, h('span', null, title),
        h('span', { className: 'dpt-side-hint', 'data-tone': client === '' ? 'warn' : undefined }, client === '' ? t('sshNoClient') : t('sshHint'))),
      rows.length ? h('ul', { className: 'dpt-files' }, ...rows.slice(0, 8).map(item => h('li', { key: item.host },
        h('div', { className: 'dpt-file dpt-host',
        'data-state': item.used ? (item.used.ok ? 'ok' : 'failed') : 'idle', title: endpoint(item.config) || item.host },
        h('span', { className: 'dpt-agent-dot', 'aria-hidden': 'true' }),
        h('span', { className: 'dpt-file-name' }, item.host),
        h('span', { className: 'dpt-file-meta' }, item.used
          ? tf(t, item.used.ok ? 'sshUsed' : 'sshFailed', { count: item.used.count, turn: item.used.turn })
          : endpoint(item.config) || t('sshConfigured'))),
        h('div', { className: 'dpt-ssh-actions' },
          h('button', { type: 'button', className: 'dpt-link', onClick: () => { void copyHost(item, false); } }, t('sshCopy')),
          h('button', { type: 'button', className: 'dpt-link', onClick: () => { void copyHost(item, true); } }, t('sshGoCopy'))))))
        : h('p', { className: 'dpt-side-note' }, t('sshEmpty')),
      copyStatus ? h('p', { className: 'dpt-side-note', role: 'status' }, t(copyStatus)) : null);
  }

  function projectionValue(useProjection, key) {
    try { return typeof useProjection === 'function' ? useProjection(key) : undefined; } catch { return undefined; }
  }

  // One conversation's environment, subagents, jobs, outputs, SSH and tool state.
  function DeepPtcPanel({ sessionId, useSessions, useProjection, useJobs, watchJobs, reset, form, inline, t }) {
    const sessions = typeof useSessions === 'function' ? useSessions(state => state) : undefined;
    const preset = projectionValue(useProjection, 'agentPreset');
    const activity = projectionValue(useProjection, 'deepPtcActivity');
    const [now, setNow] = React.useState(() => Date.now());
    const deep = preset === 'deep-ptc';
    const rows = deep ? subagentRows(sessions, sessionId, now) : [];
    const running = rows.filter(row => row.state === 'running').length;
    React.useEffect(() => {
      if (running === 0) return undefined;
      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
    }, [running > 0]);
    const stateText = row => row.state === 'running' ? t('agentRunning') : row.state === 'completed' ? t('agentCompleted') : row.state === 'external' ? t('agentExternal') : t('agentIdle');
    return h('div', { className: 'dpt-panel', 'data-inline': inline ? '' : undefined, 'aria-label': t('sideTitle') },
      h('div', { className: 'dpt-side-body' },
        form ? h(EnvironmentSection, { form, t }) : null,
        !deep ? h('section', { className: 'dpt-side-section' }, h('p', { className: 'dpt-side-note' }, t('sideOtherMode'))) : null,
        deep && rows.length ? h('section', { className: 'dpt-side-section dpt-side-agents', 'aria-label': t('agentsTitle') },
          h('div', { className: 'dpt-side-label' }, h('span', null, t('agentsTitle'))),
          h('ol', { className: 'dpt-agents-list' }, ...rows.map(row =>
            h('li', { key: row.id }, h('button', { type: 'button', className: 'dpt-agent', 'data-state': row.state,
              'aria-label': `${row.label} · ${stateText(row)}`, style: { '--dpt-depth': row.depth },
              disabled: row.state === 'external', title: t('agentOpen'), onClick: () => openSubagent(row) },
              h('span', { className: 'dpt-agent-dot', 'aria-hidden': 'true' }),
              h('span', { className: 'dpt-agent-name', title: row.label }, row.label),
              row.duration !== undefined ? h('span', { className: 'dpt-agent-duration' }, formatDuration(row.duration, t)) : null))))) : null,
        deep ? (typeof useJobs === 'function' && typeof watchJobs === 'function'
          ? h(LiveBackgroundJobs, { key: `jobs:${sessionId}`, sessionId, useJobs, watchJobs, t })
          : h(BackgroundJobs, { key: `jobs:${sessionId}`, jobs: sessions?.jobsBySession?.[sessionId], t })) : null,
        deep ? h(OutputsSection, { sessionId, outputs: activity?.outputs, t }) : null,
        h(SshSection, { form, ssh: deep ? activity?.ssh : undefined, t }),
        deep && typeof reset === 'function' ? h(ToolStateControls, { sessionId, useProjection, reset, t }) : null,
        h(VisualEffectsSection, { t })));
  }

  const PANEL_WIDTH = 280;
  const PANEL_MIN_WIDTH = 240;
  const PANEL_MAX_WIDTH = 640;
  const PANEL_MIN_ROOM = 820;
  // A docked panel never squeezes the conversation below this width.
  const CHAT_MIN_WIDTH = 540;
  const PANEL_COLLAPSED_KEY = `${PLUGIN}:side-panel-collapsed`;
  const PANEL_WIDTH_KEY = `${PLUGIN}:side-panel-width`;
  const CAPSULE_KEY = `${PLUGIN}:capsule-placement`;
  const PLACEMENTS = ['auto', 'dock', 'toolbar', 'hidden'];
  const readStored = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const writeStored = (key, value) => { try { localStorage.setItem(key, value); } catch { /* kept in memory */ } };
  const readPanelWidth = () => {
    const value = Number(readStored(PANEL_WIDTH_KEY));
    return Number.isFinite(value) && value > 0 ? Math.round(value) : PANEL_WIDTH;
  };
  const readPlacement = () => { const value = readStored(CAPSULE_KEY); return PLACEMENTS.includes(value) ? value : 'auto'; };

  // Viewer preferences (collapsed, width, capsule placement) and each conversation's open state, shared
  // by the panel host in the composer dock, the capsule wherever it sits, and the right-sidebar tab.
  const PANEL = {
    collapsed: readStored(PANEL_COLLAPSED_KEY) === '1',
    width: readPanelWidth(),
    placement: readPlacement(),
    peek: new Map(), wide: new Map(), version: 0, subs: new Set(),
    subscribe(listener) { this.subs.add(listener); return () => this.subs.delete(listener); },
    emit() { this.version++; for (const listener of [...this.subs]) { try { listener(); } catch (error) { console.warn(`[${PLUGIN}]`, error); } } },
    isOpen(id) { return (this.wide.get(id) === true && !this.collapsed) || this.peek.get(id) === true; },
    // A layout change (docked, floating, covered) closes a floating peek, as before.
    setWide(id, wide) {
      if (this.wide.get(id) === wide) return;
      if (wide === undefined) this.wide.delete(id); else this.wide.set(id, wide);
      this.peek.delete(id);
      this.emit();
    },
    setCollapsed(value) { this.collapsed = value; writeStored(PANEL_COLLAPSED_KEY, value ? '1' : '0'); },
    toggle(id) {
      if (this.wide.get(id)) this.setCollapsed(!this.collapsed);
      else this.peek.set(id, this.peek.get(id) !== true);
      this.emit();
    },
    open(id) {
      if (id === undefined) return;
      if (this.wide.get(id)) this.setCollapsed(false); else this.peek.set(id, true);
      this.emit();
    },
    setWidth(width, persist) {
      const next = Math.round(width);
      if (Number.isFinite(next) && next > 0 && next !== this.width) { this.width = next; this.emit(); }
      if (persist) writeStored(PANEL_WIDTH_KEY, String(this.width));
    },
    setPlacement(value) {
      if (!PLACEMENTS.includes(value) || value === this.placement) return;
      this.placement = value;
      writeStored(CAPSULE_KEY, value);
      this.emit();
    },
    // Another window changed a preference.
    sync(event) {
      if (event.key !== null && ![PANEL_COLLAPSED_KEY, PANEL_WIDTH_KEY, CAPSULE_KEY].includes(event.key)) return;
      this.collapsed = readStored(PANEL_COLLAPSED_KEY) === '1';
      this.width = readPanelWidth();
      this.placement = readPlacement();
      this.emit();
    },
  };
  const getPanelVersion = () => PANEL.version;
  const subscribePanel = listener => PANEL.subscribe(listener);
  function usePanel() {
    React.useSyncExternalStore(subscribePanel, getPanelVersion, getPanelVersion);
    return PANEL;
  }

  // dsh-claude-style folds the composer into one row, which leaves no room for a row of our own below it.
  const compactComposer = () => typeof document !== 'undefined'
    && (document.body?.hasAttribute?.('data-dsh-claude-style') === true || appearancePlugin() === 'dsh-claude-style');
  function subscribeCompact(listener) {
    if (typeof MutationObserver !== 'function' || typeof document === 'undefined' || !document.body) return () => {};
    const observer = new MutationObserver(listener);
    try {
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-dsh-claude-style'] });
      if (document.head) observer.observe(document.head, { childList: true });
    } catch { /* detection stays as first read */ }
    return () => observer.disconnect();
  }
  const useCompactComposer = () => React.useSyncExternalStore(subscribeCompact, compactComposer, compactComposer);
  const resolvePlacement = compact => PANEL.placement === 'auto' ? (compact ? 'toolbar' : 'dock') : PANEL.placement;

  // Floating widgets pinned to the window's bottom-right corner (the dsh-whale-widget whale) cover the
  // bottom of the panel; the panel body reserves that height so its last controls scroll clear of it.
  const CORNER_FLOATERS = '.dshwv-root .dshwv-img';
  function cornerInset(box) {
    if (typeof document === 'undefined') return 0;
    let inset = 0;
    for (const node of document.querySelectorAll?.(CORNER_FLOATERS) ?? []) {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      const overlaps = rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
      if (overlaps) inset = Math.max(inset, box.bottom - rect.top);
    }
    // Never more than half the panel: the panel stays usable under a widget scaled up very large.
    return Math.round(Math.min(inset, (box.bottom - box.top) / 2));
  }

  // Measure the conversation itself, so the panel follows native sidebar resizing and is hidden
  // when that conversation is covered by a fullscreen sidebar.
  function useSidePanelLayout(sessionId, marker) {
    const [layout, setLayout] = React.useState();
    React.useEffect(() => {
      if (typeof document === 'undefined' || typeof ReactDOM?.createPortal !== 'function') return undefined;
      let frame;
      let previous;
      const watched = new Set();
      const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : undefined;
      function measure() {
        frame = undefined;
        const region = marker.current?.closest?.('[data-conversation-region="chat"]')
          ?? [...document.querySelectorAll('[data-conversation-region="chat"]')]
            .find(node => node.getAttribute('data-conversation-session') === sessionId);
        const rect = region?.getBoundingClientRect();
        const room = region?.parentElement?.getBoundingClientRect() ?? rect;
        const fullscreen = [...document.querySelectorAll('[data-sidebar-right-panel="fullscreen"][data-sidebar-right-open]')]
          .some(node => node.getClientRects().length > 0);
        if (!rect || rect.width <= 0 || rect.height <= 0 || fullscreen || region.closest('[hidden],[aria-hidden="true"]')) {
          if (previous !== undefined) { previous = undefined; setLayout(undefined); }
          return;
        }
        const targets = [region, region.parentElement].filter(Boolean);
        for (const node of watched) {
          if (!targets.includes(node)) { resize?.unobserve(node); watched.delete(node); }
        }
        for (const node of targets) {
          if (node && !watched.has(node)) { resize?.observe(node); watched.add(node); }
        }
        const wide = room.width >= PANEL_MIN_ROOM;
        const composer = region.querySelector('[data-composer-seat]')?.getBoundingClientRect();
        const fit = Math.max(0, room.width - 24);
        const maxWidth = Math.min(fit, Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, wide ? room.width - CHAT_MIN_WIDTH : fit)));
        const minWidth = Math.min(PANEL_MIN_WIDTH, maxWidth);
        const next = { region, wide, minWidth, maxWidth, top: Math.round(rect.top), right: Math.round(window.innerWidth - room.right),
          height: Math.round(wide ? rect.height : Math.max(0, Math.min(rect.height, (composer?.top ?? rect.bottom) - rect.top - 8))),
          width: Math.min(maxWidth, Math.max(minWidth, PANEL.width)) };
        const right = window.innerWidth - next.right;
        next.inset = cornerInset({ left: right - next.width, right, top: next.top, bottom: next.top + next.height });
        const same = previous?.region === region
          && ['wide', 'top', 'right', 'height', 'width', 'minWidth', 'maxWidth', 'inset'].every(key => previous[key] === next[key]);
        if (!same) { previous = next; setLayout(next); }
      }
      function schedule() {
        if (frame === undefined) frame = requestAnimationFrame(measure);
      }
      const changes = typeof MutationObserver === 'function' ? new MutationObserver(records => {
        if (!previous?.region?.isConnected || records.some(record => record.type === 'attributes'
          && (record.target.contains(previous?.region) || record.target.matches?.('[data-sidebar-right-panel],.dshwv-root')))) schedule();
      }) : undefined;
      changes?.observe(document.body, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-sidebar-right-panel', 'data-sidebar-right-open'] });
      window.addEventListener('resize', schedule);
      // A new preferred width (dragging the edge, another window) is measured like a resize.
      const unsubscribe = PANEL.subscribe(() => { if (previous?.width !== Math.min(previous?.maxWidth ?? Infinity, Math.max(previous?.minWidth ?? 0, PANEL.width))) schedule(); });
      measure();
      return () => {
        unsubscribe();
        resize?.disconnect(); changes?.disconnect();
        window.removeEventListener('resize', schedule);
        if (frame !== undefined) cancelAnimationFrame(frame);
      };
    }, [sessionId, marker]);
    return layout;
  }

  // The capsule's one-line summary: environment, subagents, tool notices.
  function useCapsuleSummary({ sessionId, useSessions, useProjection, form, t }) {
    const sessions = typeof useSessions === 'function' ? useSessions(state => state) : undefined;
    const tools = projectionValue(useProjection, 'deepPtcTools');
    const settings = useSettingsForm(form);
    const rows = subagentRows(sessions, sessionId, Date.now());
    const running = rows.some(row => row.state === 'running');
    const failures = tools && typeof tools === 'object' ? (tools.report?.tools ?? []).length : 0;
    const environment = settings.status === 'ready' && settings.value ? envLabel(settings.value.environment ?? 'auto', t) : undefined;
    const label = [environment, rows.length ? `${t('agentsTitle')} ${rows.length}` : null, failures ? `${t('toolFailures')} ${failures}` : null]
      .filter(Boolean).join(' · ') || t('sideTitle');
    return { label, running };
  }

  // The capsule toggles this conversation's side panel, below the composer or in its toolbar.
  function CapsuleButton(props) {
    const { sessionId, compact, t } = props;
    usePanel();
    const { label, running } = useCapsuleSummary(props);
    return h('button', { type: 'button', className: 'dpt-capsule', 'data-compact': compact ? '' : undefined,
      'data-state': running ? 'running' : 'idle', 'aria-expanded': props.open ?? PANEL.isOpen(sessionId),
      title: compact ? `${t('capsuleOpen')} · ${label}` : t('capsuleOpen'), onClick: () => PANEL.toggle(sessionId) },
      h('span', { className: 'dpt-agent-dot', 'aria-hidden': 'true' }), h('span', null, label));
  }

  // The panel's left edge. Dragging sets the preferred width (kept per viewer); arrow keys step it,
  // Home and End jump to the bounds, a double click restores the default.
  function ResizeHandle({ layout, t }) {
    const [active, setActive] = React.useState(false);
    const stop = React.useRef();
    React.useEffect(() => () => stop.current?.(), []);
    const clamp = value => Math.min(layout.maxWidth, Math.max(layout.minWidth, value));
    function onPointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      const target = event.currentTarget;
      const startX = event.clientX;
      const startWidth = layout.width;
      const move = next => PANEL.setWidth(clamp(startWidth + startX - next.clientX), false);
      const end = () => {
        target.removeEventListener?.('pointermove', move);
        target.removeEventListener?.('pointerup', end);
        target.removeEventListener?.('pointercancel', end);
        document.body?.removeAttribute?.('data-dpt-resizing');
        stop.current = undefined;
        setActive(false);
        PANEL.setWidth(PANEL.width, true);
      };
      try { target.setPointerCapture?.(event.pointerId); } catch { /* the move events still reach the handle */ }
      target.addEventListener?.('pointermove', move);
      target.addEventListener?.('pointerup', end);
      target.addEventListener?.('pointercancel', end);
      document.body?.setAttribute?.('data-dpt-resizing', '');
      stop.current = end;
      setActive(true);
    }
    function onKeyDown(event) {
      const step = event.shiftKey ? 64 : 16;
      const next = event.key === 'ArrowLeft' ? layout.width + step : event.key === 'ArrowRight' ? layout.width - step
        : event.key === 'Home' ? layout.minWidth : event.key === 'End' ? layout.maxWidth : undefined;
      if (next === undefined) return;
      event.preventDefault();
      PANEL.setWidth(clamp(next), true);
    }
    return h('div', { className: 'dpt-resize', role: 'separator', 'aria-orientation': 'vertical', tabIndex: 0,
      'aria-label': t('panelResize'), title: t('panelResize'), 'data-active': active ? '' : undefined,
      'aria-valuenow': layout.width, 'aria-valuemin': layout.minWidth, 'aria-valuemax': layout.maxWidth,
      onPointerDown, onKeyDown, onDoubleClick: () => PANEL.setWidth(clamp(PANEL_WIDTH), true) });
  }

  // Mounted in the composer dock for every Deep PTC conversation, whatever the capsule placement: its
  // marker locates the conversation, and it owns the side panel. When the capsule sits elsewhere the
  // row is display:none, which keeps the marker (and closest()) working without taking a row.
  function PanelHost(props) {
    const { sessionId, useSessions, t } = props;
    const marker = React.useRef(null);
    const layout = useSidePanelLayout(sessionId, marker);
    usePanel();
    const placement = resolvePlacement(useCompactComposer());
    const wide = layout ? layout.wide : undefined;
    React.useEffect(() => PANEL.setWide(sessionId, wide), [sessionId, wide]);
    React.useEffect(() => () => PANEL.setWide(sessionId, undefined), [sessionId]);
    const docked = !!layout?.wide && !PANEL.collapsed;
    const open = docked || PANEL.peek.get(sessionId) === true;
    React.useEffect(() => {
      const region = layout?.region;
      if (!region) return undefined;
      region.toggleAttribute('data-dpt-panel-open', docked);
      region.style.setProperty('--dpt-panel-width', `${layout.width}px`);
      return () => { region.removeAttribute('data-dpt-panel-open'); region.style.removeProperty('--dpt-panel-width'); };
    }, [layout?.region, layout?.width, docked]);
    const sessions = typeof useSessions === 'function' ? useSessions(state => state) : undefined;
    const running = subagentRows(sessions, sessionId, Date.now()).some(row => row.state === 'running');
    React.useEffect(() => {
      SESSIONS.setWorking(sessionId, running);
      return () => SESSIONS.setWorking(sessionId, false);
    }, [sessionId, running]);
    const panel = open && layout ? ReactDOM.createPortal(h('aside', { className: 'dpt-sidecar',
      'data-floating': docked ? undefined : '', 'aria-label': t('sideTitle'),
      style: { top: layout.top, right: layout.right, height: layout.height, width: layout.width,
        '--dpt-inset-bottom': layout.inset ? `${layout.inset}px` : undefined } },
      h(ResizeHandle, { layout, t }),
      h('header', { className: 'dpt-sidecar-head' }, h('h3', null, t('sideTitle')),
        h('button', { type: 'button', className: 'dpt-icon-btn', onClick: () => PANEL.toggle(sessionId), 'aria-label': t('panelClose') }, '×')),
      h(DeepPtcPanel, props)), document.body) : null;
    return h(React.Fragment, null,
      h('div', { ref: marker, className: 'dpt-capsule-row', 'data-placement': placement },
        placement === 'dock' ? h(CapsuleButton, { ...props, open }) : null,
        panel),
      open && !layout && typeof ReactDOM?.createPortal !== 'function' ? h(DeepPtcPanel, { ...props, inline: true }) : null);
  }

  // A boundary keeps a failing bridge or panel from taking the conversation with it.
  class Boundary extends React.Component {
    constructor(props) { super(props); this.state = { failed: false }; }
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error) { console.warn(`[${PLUGIN}] conversation extras disabled:`, error); }
    render() { return this.state.failed ? null : this.props.children; }
  }

  function SessionBridge(props) {
    const { sessionId } = props;
    const marker = React.useRef(null);
    const preset = projectionValue(props.useProjection, 'agentPreset');
    const statuses = typeof props.useSessionStatus === 'function' ? props.useSessionStatus(state => state) : undefined;
    const busy = statuses?.get?.(sessionId)?.running === true;
    React.useEffect(() => { SESSIONS.set(sessionId, { id: sessionId, preset, busy, el: marker.current }); }, [sessionId, preset, busy]);
    React.useEffect(() => () => SESSIONS.del(sessionId), [sessionId]);
    React.useEffect(() => SESSIONS.watch(marker.current?.parentElement), []);
    return h('span', { ref: marker, hidden: true, 'aria-hidden': 'true', 'data-dpt-bridge': sessionId });
  }

  function DockHost(props) {
    // Registered for every session; only Deep PTC sessions draw the capsule.
    if (projectionValue(props.useProjection, 'agentPreset') !== 'deep-ptc') return null;
    return h(Boundary, null, h(PanelHost, props));
  }

  // The compact capsule in the composer toolbar, beside the host's own controls (conversation.input.right).
  function ToolbarHost(props) {
    usePanel();
    const placement = resolvePlacement(useCompactComposer());
    if (projectionValue(props.useProjection, 'agentPreset') !== 'deep-ptc' || placement !== 'toolbar') return null;
    return h(Boundary, null, h(CapsuleButton, { ...props, compact: true }));
  }

  const PLACEMENT_NOTES = { dock: 'panelMoved', toolbar: 'panelMovedToolbar', hidden: 'panelMovedHidden' };
  function TabHost({ sessionId, t }) {
    usePanel();
    const placement = resolvePlacement(useCompactComposer());
    const id = sessionId ?? SESSIONS.current()?.id;
    return h('div', { className: 'dpt-side-section' },
      h('p', { className: 'dpt-side-note' }, t(PLACEMENT_NOTES[placement])),
      h('button', { type: 'button', className: 'dpt-btn dpt-btn-block', disabled: id === undefined, onClick: () => PANEL.open(id) }, t('panelOpen')));
  }

  const PLACEMENT_LABELS = { auto: 'placementAuto', dock: 'placementDock', toolbar: 'placementToolbar', hidden: 'placementHidden' };
  function CapsulePlacementSection({ t }) {
    usePanel();
    const compact = useCompactComposer();
    const label = t('capsulePlacement');
    const note = PANEL.placement === 'auto'
      ? `${tf(t, 'placementAutoNow', { place: t(PLACEMENT_LABELS[resolvePlacement(compact)]) })}${t('placementHint')}`
      : t('placementHint');
    return h('section', { className: 'dpt-side-section', 'aria-label': label },
      h('div', { className: 'dpt-side-label' }, h('span', null, label)),
      h('div', { className: 'dpt-seg', role: 'radiogroup', 'aria-label': label },
        ...PLACEMENTS.map(option => h('button', { key: option, type: 'button', role: 'radio', className: 'dpt-seg-btn',
          'aria-checked': option === PANEL.placement, onClick: () => PANEL.setPlacement(option) }, t(PLACEMENT_LABELS[option])))),
      h('p', { className: 'dpt-side-note' }, note));
  }

  function TabTitle({ t }) {
    return h('span', { className: 'dpt-tab-title' }, t('sideTitle'));
  }

  function DiagnosticsSection({ t }) {
    const [text, setText] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    async function copy() {
      const value = diagnostics();
      setText(value);
      try { await navigator.clipboard?.writeText(value); setCopied(true); } catch { setCopied(false); }
    }
    return h('section', { 'aria-label': t('diagTitle') },
      h('h3', null, t('diagTitle')),
      h('div', { className: 'dpt-settings-row' }, h('p', { className: 'dpt-side-note' }, t('diagHint')),
        h('button', { type: 'button', className: 'dpt-btn', onClick: () => { void copy(); } }, copied ? t('diagCopied') : t('diagCopy'))),
      text ? h('pre', { className: 'dpt-diag' }, text) : null);
  }

  // The Deep PTC settings page: the environment form, the effects switch and diagnostics.
  function SettingsPage({ form, t }) {
    return h('div', { className: 'dpt-settings' },
      // The form labels its own environment field.
      h('section', { 'aria-label': t('environment') },
        form ? h(Card, { form, t }) : h('p', { className: 'dpt-side-note' }, t('readOnly'))),
      h('section', { 'aria-label': t('appearance') }, h('h3', null, t('appearance')),
        h(VisualEffectsSection, { t }), h(CapsulePlacementSection, { t })),
      h(DiagnosticsSection, { t }));
  }

  const SettingsIcon = ({ size = 16 }) => h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M2.5 4.5h6M2.5 8h11M2.5 11.5h8', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
    h('circle', { cx: 11.5, cy: 4.5, r: 1.6, stroke: 'currentColor', strokeWidth: 1.3 }));
  // The skill switches run a host command, and the host logs every command. The log keeps it; the
  // conversation shows nothing for a success and a short line for a failure.
  function SkillCommandRow({ node, t }) {
    const outcome = node?.outcome;
    if (outcome?.kind === 'error') return h('div', { className: 'dpt-command-error', role: 'status' }, commandText(outcome.text, t));
    return h('span', { hidden: true, 'data-dpt-hidden-command': SKILL_COMMAND_NAME });
  }

  const SKILL_COMMAND_NAME = 'deep-ptc-skill-state';
  function runSkillCommand(child, sessionId, payload) {
    const execute = child.remote?.commands?.execute;
    if (typeof execute !== 'function') return Promise.resolve({ ok: false, error: { message: 'unavailable' } });
    // The remote command API takes the full line plus attachments. The JSON payload is command input.
    return execute(sessionId, `/${SKILL_COMMAND_NAME} ` + JSON.stringify(payload), []);
  }
  const TAB_KIND = 'deep-ptc';

  // Per-conversation props for the panel and its composer capsule.
  function sessionTools(child) {
    return sessionId => {
      const jobs = child.get?.('jobs');
      const props = {
        reset: () => {
          const execute = child.remote?.commands?.execute;
          if (typeof execute !== 'function') return Promise.resolve({ ok: true, value: undefined });
          return execute(sessionId, '/deep-ptc-reset-tools', []);
        },
      };
      if (jobs?.state && typeof jobs.watchRows === 'function') {
        props.hooks = { jobs: jobs.state };
        props.watchJobs = id => jobs.watchRows(id);
      }
      return props;
    };
  }

  function apply(ctx) {
    hostCtx = ctx;
    const t = ctx.locale.bind('deep-ptc');
    const subscribeLocale = listener => ctx.locale.subscribe?.(listener) ?? noSubscribe();
    const readLocale = () => ctx.locale.getSnapshot?.()?.revision ?? 0;
    const useLocaleRevision = () => React.useSyncExternalStore(subscribeLocale, readLocale, readLocale);
    function LocalizedSlot({ component, ...props }) {
      useLocaleRevision();
      return h(component, { ...props, t: props.t ?? t });
    }
    ctx.effect(() => ctx.locale.register('deep-ptc', dictionaries));
    installPresetLabels(ctx.slots, t, useLocaleRevision);
    ctx.effect(() => injectCss(), `${PLUGIN}: style`);
    ctx.effect(() => watchActiveSession(), `${PLUGIN}: active session`);
    ctx.effect(() => {
      if (typeof window?.addEventListener !== 'function') return () => {};
      const sync = event => PANEL.sync(event);
      window.addEventListener('storage', sync);
      return () => window.removeEventListener('storage', sync);
    }, `${PLUGIN}: panel preferences`);
    const form = ctx.configForms.get(NS);
    ctx.effect(() => ctx.configForms.whileServed([NS], () => {
      const disposers = [
        // The plugin manager row keeps its settings card.
        ctx.slots.inject('plugins.item', () => ctx.slots.register({
          name: 'plugins.item', id: 'deep-ptc', order: 41,
          label: () => t('title'), locale: 'deep-ptc',
        }, props => h(LocalizedSlot, { ...props, form, component: Card }))),
        // Deep PTC's own settings page, under its own id: no other entry is shadowed.
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'deep-ptc', order: 24,
          label: () => t('title'), locale: 'deep-ptc',
        }, props => h(LocalizedSlot, { ...props, form, component: SettingsPage }))),
      ];
      try {
        disposers.push(ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon', id: 'deep-ptc',
        }, SettingsIcon)));
      } catch { /* the nav keeps its default icon */ }
      return () => disposers.reverse().forEach(dispose => dispose?.());
    }));
    try {
      ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
        name: 'conversation.chat.commandview', key: SKILL_COMMAND_NAME, locale: 'deep-ptc',
      }, props => h(LocalizedSlot, { ...props, component: SkillCommandRow })));
    } catch { /* without the renderer the host shows its generic command row */ }
    try {
      // Each conversation header reports which session is on screen and whether it works.
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions', id: 'deep-ptc-session', order: 31,
      }, props => h(Boundary, null, h(SessionBridge, props))));
    } catch { /* the conversation keeps working without the look */ }
    try {
      ctx.inject?.(['remote', 'remote.commands'], child => {
        try {
          child.slots.inject('conversation.chat.turnTail', () => child.slots.register({
            name: 'conversation.chat.turnTail', id: 'deep-ptc-skills', order: 20, locale: 'deep-ptc',
            inject: sessionId => ({
              setSkill: (name, enabled) => runSkillCommand(child, sessionId, { action: 'set', name, enabled }),
              setAll: enabled => runSkillCommand(child, sessionId, { action: 'all', enabled }),
            }),
          }, props => h(LocalizedSlot, { ...props, component: SkillTail })));
        } catch { /* a broken card must not take the conversation with it */ }
        try {
          // The capsule renders in the composer's own dock, in the page flow.
          child.slots.inject('conversation.composer.dock', () => child.slots.register({
            name: 'conversation.composer.dock', id: 'deep-ptc-side', order: 89, locale: 'deep-ptc',
            inject: sessionTools(child),
          }, props => h(LocalizedSlot, { ...props, form, component: DockHost })));
        } catch { /* the composer stays usable when this slot cannot register */ }
        try {
          // The compact capsule joins the host's tool row, so a one-row composer keeps one row.
          child.slots.inject('conversation.input.right', () => child.slots.register({
            name: 'conversation.input.right', id: 'deep-ptc-capsule', order: 80, locale: 'deep-ptc',
          }, props => h(LocalizedSlot, { ...props, form, component: ToolbarHost })));
        } catch { /* the capsule stays below the composer */ }
      });
    } catch { /* the composer stays usable when this slot cannot register */ }
    try {
      // The tab holds a button that opens the panel. It is listed on the sidebar's new-tab guide only
      // while the capsule is hidden, as the way back to the panel; saved tabs open in any placement.
      ctx.inject?.(['remote', 'remote.commands', 'sidebarRightTabs'], child => {
        child.effect(() => {
          let hidden;
          let dispose;
          const register = () => {
            const next = PANEL.placement === 'hidden';
            if (next === hidden) return;
            hidden = next;
            dispose?.();
            dispose = child.sidebarRightTabs.register({
              id: PLUGIN, kind: TAB_KIND, title: () => t('sideTitle'),
              guide: hidden ? [{ id: TAB_KIND, order: 60, title: () => t('sideTitle'), description: () => t('sideGuide') }] : [],
            });
          };
          register();
          const unsubscribe = PANEL.subscribe(register);
          return () => { unsubscribe(); dispose?.(); };
        }, `${PLUGIN}: sidebar tab type`);
        child.slots.inject('sidebar.right.pane.tab', () => child.slots.register({
          name: 'sidebar.right.pane.tab', key: PLUGIN, locale: 'deep-ptc', inject: sessionTools(child),
        }, props => h(LocalizedSlot, { ...props, form, component: TabHost })));
        child.slots.inject('sidebar.right.pane.tab.title', () => child.slots.register({
          name: 'sidebar.right.pane.tab.title', key: PLUGIN,
        }, props => h(LocalizedSlot, { ...props, component: TabTitle })));
      });
    } catch { /* without a right sidebar the capsule opens the panel in place */ }
  }
  return { apply, inject };
} });
