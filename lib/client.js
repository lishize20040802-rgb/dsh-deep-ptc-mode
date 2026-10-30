window.__ModuleLoader__.load({ id: 'dsh-deep-ptc-mode', factory: require => {
  const React = require('react');
  const h = React.createElement;
  const NS = 'deep-ptc-settings';
  const inject = ['slots', 'locale', 'configForms'];
  const dictionaries = {
    zh: {
      title: '深度 PTC', summary: '选择执行环境，应用于之后新建的深度 PTC 会话。',
      environment: '执行环境', auto: '自动（Windows：PowerShell；macOS：Zsh；Linux：Bash）',
      wsl: 'WSL Bash（Windows）', powershell: 'PowerShell（Windows）',
      zsh: 'Zsh（macOS / Linux）', bash: '原生 Bash（macOS / Linux）',
      distribution: 'WSL 发行版', distributionHint: '留空使用 Windows 的默认发行版，例如 Ubuntu。',
      sessions: '保存后请新建一个“深度PTC模式”会话。已有会话与后台任务保留原环境。',
      wslHint: 'WSL 暂不支持 Windows 的受限沙箱；受限调用会明确失败，不会自动切换或绕过限制。',
      save: '保存', saving: '保存中…', saved: '已保存，新会话将使用所选环境。',
      failed: '未能保存，请检查环境是否适用于宿主、发行版名称及配置是否已被其他窗口修改。',
      readOnly: '当前设置为只读。', loading: '正在读取设置…',
    },
    en: {
      title: 'Deep PTC', summary: 'Choose the execution environment for new Deep PTC sessions.',
      environment: 'Execution environment', auto: 'Automatic (Windows: PowerShell; macOS: Zsh; Linux: Bash)',
      wsl: 'WSL Bash (Windows)', powershell: 'PowerShell (Windows)',
      zsh: 'Zsh (macOS / Linux)', bash: 'Native Bash (macOS / Linux)',
      distribution: 'WSL distribution', distributionHint: 'Leave blank for the Windows default distribution, for example Ubuntu.',
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
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [failed, setFailed] = React.useState(false);
    const draftRevision = React.useRef();
    const dirty = React.useRef(false);
    React.useEffect(() => {
      if (!state.value || dirty.current) return;
      setEnvironment(state.value.environment);
      setDistribution(state.value.wslDistribution ?? '');
      draftRevision.current = state.revision;
    }, [state.value, state.revision]);
    if (view === 'summary') return t('summary');
    if (state.status !== 'ready') return h('p', null, t('loading'));
    const allowed = state.value.hostPlatform === 'win32'
      ? ['auto', 'wsl', 'powershell'] : ['auto', 'zsh', 'bash'];
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
        ], draftRevision.current);
        if (!ok) throw new Error('Configuration was rejected');
        dirty.current = false;
        const latest = form.getSnapshot();
        draftRevision.current = latest.revision;
        setEnvironment(latest.value?.environment ?? environment);
        setDistribution(latest.value?.wslDistribution ?? distribution.trim());
        setMessage(t('saved'));
      } catch {
        draftRevision.current = form.getSnapshot().revision;
        setFailed(true); setMessage(t('failed'));
      } finally { setSaving(false); }
    }
    const control = { width: '100%', padding: '8px 10px', borderRadius: '6px',
      color: 'inherit', background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-border-l1)' };
    return h('form', { onSubmit: save, style: { display: 'grid', gap: '12px', maxWidth: '600px' } },
      h('label', { htmlFor: 'deep-ptc-environment' }, t('environment')),
      h('select', { id: 'deep-ptc-environment', value: environment, disabled, style: control,
        onChange: event => { changed(); setEnvironment(event.target.value); } },
      ...['auto', 'wsl', 'powershell', 'zsh', 'bash'].map(value =>
        h('option', { key: value, value, disabled: !allowed.includes(value) }, t(value)))),
      environment === 'wsl' ? h(React.Fragment, null,
        h('label', { htmlFor: 'deep-ptc-distribution' }, t('distribution')),
        h('input', { id: 'deep-ptc-distribution', value: distribution, disabled, style: control,
          onChange: event => { changed(); setDistribution(event.target.value); } }),
        h('p', null, t('distributionHint')), h('p', null, t('wslHint'))) : null,
      h('p', null, t('sessions')),
      !state.writable ? h('p', { role: 'status' }, t('readOnly')) : null,
      message ? h('p', { role: failed ? 'alert' : 'status' }, message) : null,
      h('button', { type: 'submit', disabled, style: { justifySelf: 'start', padding: '7px 16px' } }, t(saving ? 'saving' : 'save')),
    );
  }

  function apply(ctx) {
    const t = ctx.locale.bind('deep-ptc');
    ctx.effect(() => ctx.locale.register('deep-ptc', dictionaries));
    const form = ctx.configForms.get(NS);
    ctx.effect(() => ctx.configForms.whileServed([NS], () =>
      ctx.slots.inject('plugins.item', () => ctx.slots.register({
        name: 'plugins.item', id: 'deep-ptc', order: 41,
        label: () => t('title'), locale: 'deep-ptc',
      }, props => h(Card, { ...props, form, t })))));
  }
  return { apply, inject };
} });
