import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';

// Values built inside the vm realm are compared as plain JSON.
const plain = value => JSON.parse(JSON.stringify(value));

function fakeDocument() {
  const attributes = new Set();
  const document = { sessionId: 'deep', width: 1200, fullscreen: false };
  const parent = { getBoundingClientRect: () => ({ top: 0, right: document.width, bottom: 800, width: document.width, height: 800 }) };
  const region = { parentElement: parent, isConnected: true,
    getBoundingClientRect: parent.getBoundingClientRect,
    getAttribute: () => document.sessionId, closest: () => null, querySelector: () => null,
    toggleAttribute: (name, on) => on ? attributes.add(name) : attributes.delete(name),
    removeAttribute: name => attributes.delete(name), style: { setProperty() {}, removeProperty() {} },
    contains: node => node === region,
  };
  return Object.assign(document, { region, attributes,
    querySelectorAll: selector => selector === '[data-conversation-region="chat"]' ? [region]
      : selector.startsWith('[data-sidebar-right-panel') && document.fullscreen ? [{ getClientRects: () => [{}] }] : [],
    querySelector: () => null, body: { hasAttribute: () => false }, addEventListener() {}, removeEventListener() {} });
}

function fixture({ snapshot, mutate = async () => true, outcome = { ok: true, value: { commandId: 'c', result: { kind: 'success' } } },
  storage = new Map(), browser = {}, activeEffects = false, jobsService, localeId, sidebar } = {}) {
  let plugin;
  const document = browser.document ?? fakeDocument();
  const slots = new Map();
  const writes = [];
  const calls = [];
  const copies = [];
  const tabTypes = [];
  let current = snapshot;
  const listeners = new Set();
  const localeListeners = new Set();
  let dictionaries;
  let localeRevision = 0;
  const effects = [];
  const form = snapshot === undefined ? undefined : {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => current,
    async mutate(ops, revision) {
      writes.push({ ops, revision });
      const ok = await mutate(ops, revision);
      if (ok) {
        current = { ...current, revision: current.revision + 1, value: { ...current.value, ...Object.fromEntries(ops.map(op => [op.path[0], op.value])) } };
        for (const listener of listeners) listener();
      }
      return ok;
    },
  };
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: definition => { plugin = definition.factory(name => name === 'react-dom' ? { createPortal: node => node } : React); } },
      innerWidth: 1200, innerHeight: 800, addEventListener() {}, removeEventListener() {} },
    document, setInterval, clearInterval, setTimeout, clearTimeout, URLSearchParams,
    requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout,
    navigator: { userAgent: 'test', clipboard: { writeText: async text => copies.push(text) } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    ...browser,
  });
  const templated = ['jobsMore', 'outputsMore', 'outputTurn', 'sshUsed', 'sshFailed'];
  const ctx = { locale: {
      bind: () => key => dictionaries?.[localeId]?.[key] ?? (templated.includes(key) ? `${key} {count}{turn}` : key),
      register(_, value) { dictionaries = value; },
      getSnapshot: () => ({ revision: localeRevision }),
      subscribe(listener) { localeListeners.add(listener); return () => localeListeners.delete(listener); },
    },
    effect(callback, label) {
      if (label === undefined || label.endsWith('sidebar tab type')) callback();
      if (activeEffects && label?.endsWith(': active session')) effects.push(callback());
    },
    get: name => name === 'jobs' ? jobsService : name === 'sidebarRight' ? sidebar : undefined,
    configForms: { get: () => form, whileServed: (_, callback) => callback() },
    remote: { commands: { async execute(...args) { calls.push(args); return outcome; } } },
    sidebarRightTabs: { register(definition) { tabTypes.push(definition); return () => {}; } },
    slots: { inject: (name, callback) => callback(),
      register: (slot, render) => { slots.set(`${slot.name}#${slot.id ?? slot.key}`, { slot, render }); return () => {}; } },
  };
  ctx.inject = (deps, callback) => callback(ctx);
  plugin.apply(ctx);
  return { slots, tabTypes, document, legacy: slots.get('sidebar.right.pane.tab#dsh-deep-ptc-mode'), dock: slots.get('conversation.composer.dock#deep-ptc-side'),
    writes, calls, copies, dispose: () => effects.forEach(cleanup => cleanup()),
    setLocale: id => { localeId = id; localeRevision++; for (const listener of localeListeners) listener(); } };
}

const windows = (value = {}) => ({ status: 'ready', writable: true, revision: 7, value: {
  environment: 'powershell', wslDistribution: '', shellExecutable: 'pwsh-7', hostPlatform: 'win32',
  shellChoices: [{ id: 'pwsh-7', label: 'PowerShell 7', path: 'C:/pwsh.exe', family: 'powershell' }],
  sshClient: 'C:\\Windows\\System32\\OpenSSH\\ssh.exe', sshHosts: [], ...value } });
const noTools = { v: 1, epoch: 0, blocked: [], report: null };

// Render one conversation's Deep PTC panel (or its capsule) and unmount it even when an assertion
// fails, so timers never keep the process alive.
async function withPanel(f, { sessions = {}, tools = noTools, activity, preset = 'deep-ptc', sessionId = 'deep', entry = f.dock } = {}, body) {
  f.document.sessionId = sessionId;
  const injected = entry.slot.inject(sessionId);
  const jobsStore = injected.hooks?.jobs;
  let view;
  await act(async () => { view = Renderer.create(React.createElement(entry.render, { ...injected, sessionId,
    useProjection: key => key === 'agentPreset' ? preset : key === 'deepPtcTools' ? tools : key === 'deepPtcActivity' ? activity : undefined,
    useJobs: jobsStore ? select => select(React.useSyncExternalStore(jobsStore.subscribe, jobsStore.getState)) : undefined,
    useSessionStatus: select => select(new Map()), useSessions: select => select(sessions) })); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  try { await body(view); } finally { await act(async () => view.unmount()); }
}
const radios = view => view.root.findAllByProps({ role: 'radio' });
const checked = view => radios(view).find(node => node.props['aria-checked']).props.children;
const text = view => JSON.stringify(view.toJSON());
const visibleText = node => typeof node === 'string' ? node : node.children.map(visibleText).join(' ');
const sections = view => view.root.findAllByType('section').map(node => node.props['aria-label']);
const jobs = (count, status) => Array.from({ length: count }, (_, index) => ({
  id: `${status}-${index}`, label: `${status}-${index}`, status, startedAt: index,
  finishedAt: status === 'running' ? undefined : index + 10,
}));
const outputs = count => Array.from({ length: count }, (_, index) => ({
  path: `C:\\work\\out-${count - index}.md`, kind: index === 0 ? 'presented' : 'produced', turn: count - index }));

test('the panel uses the composer dock and its own settings page, with a hint for saved sidebar tabs', () => {
  const f = fixture({ snapshot: windows() });
  assert.deepEqual(plain(f.tabTypes.map(type => ({ id: type.id, kind: type.kind, guide: type.guide.map(entry => entry.id) }))),
    [{ id: 'dsh-deep-ptc-mode', kind: 'deep-ptc', guide: [] }]);
  assert.equal(f.tabTypes[0].title(), 'sideTitle');
  assert.ok(f.slots.has('sidebar.right.pane.tab.title#dsh-deep-ptc-mode'));
  assert.equal(f.slots.get('settings.section#deep-ptc').slot.label(), 'title');
  assert.ok(f.slots.has('settings.section.icon#deep-ptc'));
  // No entry reuses another plugin's id, so the settings nav lists Agent presets once.
  assert.equal(f.slots.has('settings.section#agent-presets'), false);
  assert.ok(f.dock, 'the capsule lives in the composer dock');
});

test('the panel holds the environment switch, outputs, SSH and tool state', async () => {
  const f = fixture({ snapshot: windows() });
  await withPanel(f, {}, async view => {
    assert.deepEqual(radios(view).map(node => node.props.children), ['envAuto', 'WSL', 'PowerShell', 'Bash']);
    assert.equal(checked(view), 'PowerShell');
    assert.match(text(view), /envForNew/u, 'the switch applies to new sessions');
    assert.ok(view.root.findAllByType('button').some(node => node.props.children === 'toolReset'));
    assert.deepEqual(sections(view), ['environment', 'jobsTitle', 'outputsTitle', 'sshTitle', 'toolsSection', 'visualEffects']);
    assert.match(text(view), /outputsEmpty/u);
    assert.match(text(view), /sshEmpty/u);
  });
});

test('switching environment writes the host form at its current revision and drops a shell of another family', async () => {
  const f = fixture({ snapshot: windows() });
  await withPanel(f, {}, async view => {
    await act(async () => { radios(view).find(node => node.props.children === 'WSL').props.onClick(); });
    assert.deepEqual(plain(f.writes.at(-1)), { ops: [
      { op: 'set', path: ['environment'], value: 'wsl' }, { op: 'set', path: ['shellExecutable'], value: '' }], revision: 7 });
    assert.equal(checked(view), 'WSL');
    assert.match(text(view), /envSaved/u);
    await act(async () => { view.root.findByProps({ className: 'dpt-input' }).props.onChange({ target: { value: ' Ubuntu ' } }); });
    await act(async () => { await view.root.findByProps({ className: 'dpt-field' }).props.onSubmit({ preventDefault() {} }); });
    assert.deepEqual(plain(f.writes.at(-1)), { ops: [{ op: 'set', path: ['wslDistribution'], value: 'Ubuntu' }], revision: 8 });
  });
});

test('choosing the current environment writes nothing, and a rejected write is reported', async () => {
  const f = fixture({ snapshot: windows(), mutate: async () => false });
  await withPanel(f, {}, async view => {
    await act(async () => { radios(view).find(node => node.props.children === 'PowerShell').props.onClick(); });
    assert.equal(f.writes.length, 0);
    await act(async () => { radios(view).find(node => node.props.children === 'envAuto').props.onClick(); });
    assert.deepEqual(plain(f.writes.map(write => write.ops)), [[{ op: 'set', path: ['environment'], value: 'auto' }]]);
    assert.match(text(view), /envFailed/u);
    assert.equal(checked(view), 'PowerShell');
  });
});

test('a read-only form shows the environment without allowing a switch', async () => {
  const f = fixture({ snapshot: { ...windows(), writable: false } });
  await withPanel(f, {}, async view => {
    assert.ok(radios(view).every(node => node.props.disabled));
    assert.match(text(view), /readOnly/u);
  });
});

test('Windows Bash writes the environment and executable together from the panel', async () => {
  const f = fixture({ snapshot: windows() });
  await withPanel(f, {}, async view => {
    await act(async () => radios(view).find(node => node.props.children === 'Bash').props.onClick());
    assert.equal(f.writes.length, 0);
    const exe = 'C:/Program Files/Niubash/bash.exe';
    await act(async () => view.root.findByProps({ 'aria-label': 'bashPath' }).props.onChange({ target: { value: ` ${exe} ` } }));
    await act(async () => view.root.findByProps({ className: 'dpt-field' }).props.onSubmit({ preventDefault() {} }));
    assert.deepEqual(plain(f.writes), [{ ops: [
      { op: 'set', path: ['environment'], value: 'bash' }, { op: 'set', path: ['shellExecutable'], value: exe },
    ], revision: 7 }]);
    assert.equal(checked(view), 'Bash');
  });
});

test('subagents keep live state indicators and show only their names and same-row durations', async () => {
  const f = fixture({ localeId: 'en', snapshot: windows({ hostPlatform: 'darwin', environment: 'auto', shellChoices: [] }) });
  const sessions = { projectionsBySession: { deep: { values: { subagentCatalog: [
    { id: 'child-1', label: 'Research', mode: 'continuable', activity: 'running' },
    { id: 'child-2', label: 'Report', mode: 'one-shot', activity: 'inactive' },
    { id: 'child-3', label: 'Live', mode: 'one-shot', activity: 'inactive' }] } } },
  byId: { 'child-3': { running: true }, 'child-2': { projectionValues: { subagentTiming: { settledMs: 75_000, lastTurnCompleted: true },
    tokenUsage: { uncachedInputTokens: 1000, outputTokens: 500, cacheReadTokens: 10_000, cacheWriteTokens: 0 } } } } };
  await withPanel(f, { sessions }, async view => {
    assert.deepEqual(radios(view).map(node => node.props.children), ['Auto', 'Zsh', 'Bash']);
    const rows = view.root.findAllByProps({ className: 'dpt-agent' });
    assert.deepEqual(rows.map(node => node.props['data-state']), ['running', 'completed', 'running']);
    assert.deepEqual(rows.map(visibleText), [' Research', ' Report 1m 15s', ' Live']);
    assert.equal(rows[1].children.at(-1).props.className, 'dpt-agent-duration');
    assert.equal(rows[1].props['aria-label'], 'Report · Done', 'the state remains accessible without visible status text');
    assert.deepEqual(sections(view).slice(0, 2), ['Execution environment', 'Subagents']);
  });
});

test('output files show the newest first in three positions, and overflow takes one of them', async () => {
  const f = fixture({ snapshot: windows() });
  for (const [count, visible, hidden] of [[1, 1, 0], [3, 3, 0], [4, 2, 2], [9, 2, 7]]) {
    await withPanel(f, { activity: { v: 1, outputs: outputs(count), ssh: [] } }, async view => {
      const section = view.root.findByProps({ 'aria-label': 'outputsTitle' });
      const list = section.findAllByType('ul')[0];
      const shown = list.children.filter(node => node.props.className !== 'dpt-files-more');
      assert.deepEqual(shown.map(node => node.findByProps({ className: 'dpt-file-name' }).props.children),
        outputs(count).slice(0, visible).map(row => row.path.split('\\').at(-1)), `${count} files`);
      assert.equal(list.children.length, visible + (hidden ? 1 : 0), 'at most three positions');
      if (hidden) {
        assert.match(section.findByType('summary').props.children, new RegExp(`outputsMore ${hidden}`, 'u'));
        assert.equal(section.findAllByType('ul')[1].children.length, hidden);
      } else assert.equal(section.findAllByType('details').length, 0);
      assert.equal(list.children[0].findByType('button').props.title, outputs(count)[0].path, 'the full path is the tooltip');
    });
  }
});

test('every output opens through the native file viewer with its own session and intact path', async () => {
  const opened = [];
  const f = fixture({ snapshot: windows(), sidebar: {
    openResourceIn: (sessionId, address) => opened.push({ sessionId, address }),
    openResource() { assert.fail('the session-scoped API must take precedence'); },
  } });
  const files = [
    ['./设计图 #1?.svg', '设计图 #1?.svg'],
    ['C:\\work\\图表 100%\\a#b?.txt', 'C:/work/图表 100%/a#b?.txt'],
    ['/tmp/report & notes.txt', '/tmp/report & notes.txt'],
    ['\\\\server\\share\\报告.pdf', '//server/share/报告.pdf'],
  ];
  const sessionId = 'workspace /?#';
  await withPanel(f, { sessionId, activity: { outputs: files.map(([path], turn) => ({path, turn, kind:'produced'})) } }, async view => {
    const section = view.root.findByProps({ 'aria-label': 'outputsTitle' });
    const buttons = section.findAllByType('button');
    assert.equal(buttons.length, 4, 'folded outputs are also interactive');
    for (const button of buttons) await act(async () => button.props.onClick());
    assert.equal(opened.length, 4);
    for (const [index, call] of opened.entries()) {
      assert.equal(call.sessionId, sessionId);
      const url = new URL(call.address);
      assert.equal(url.protocol, 'dsh-resource:');
      assert.equal(url.hostname, 'file');
      assert.equal(url.search, '');
      assert.equal(url.hash, '');
      const [, scope, id, ...path] = url.pathname.split('/').map(decodeURIComponent);
      assert.equal(scope, 'session');
      assert.equal(id, sessionId);
      assert.equal(path.join('/'), files[index][1]);
    }
  });
});

test('output opening supports the older viewer API and reports a failed preview without breaking the panel', async () => {
  let fail = true;
  const opened = [];
  const f = fixture({ localeId: 'zh', snapshot: windows(), sidebar: {
    async openResource(address) {
      if (fail) throw new Error('No viewer claims this file');
      opened.push(address);
    },
  } });
  await withPanel(f, { activity: { outputs: outputs(1) } }, async view => {
    const section = view.root.findByProps({ 'aria-label': '输出文件' });
    await act(async () => section.findByType('button').props.onClick());
    assert.match(visibleText(section.findByProps({role:'status'})), /无法打开文件/u);
    assert.equal(view.root.findAllByProps({className:'dpt-panel'}).length, 1);
    fail = false;
    await act(async () => section.findByType('button').props.onClick());
    assert.equal(opened.length, 1);
    assert.equal(section.findAllByProps({role:'status'}).length, 0);
  });
  await withPanel(fixture({snapshot:windows()}), {activity:{outputs:outputs(1)}}, async view => {
    const section = view.root.findByProps({'aria-label':'outputsTitle'});
    await act(async () => section.findByType('button').props.onClick());
    assert.match(visibleText(section.findByProps({role:'status'})), /outputOpenFailed/u);
  });
});

test('SSH lists reached hosts first with their outcome, then configured aliases', async () => {
  const f = fixture({ snapshot: windows({ sshHosts: [
    { alias: 'web1', hostName: '10.0.0.1', user: 'deploy', port: '2222' }, { alias: 'gpu', hostName: '', user: '', port: '' }] }) });
  const activity = { v: 1, outputs: [], ssh: [{ host: 'db1', ok: false, count: 1, turn: 4 }, { host: 'web1', ok: true, count: 3, turn: 2 }] };
  await withPanel(f, { activity }, async view => {
    const rows = view.root.findByProps({ 'aria-label': 'sshTitle' }).findAllByProps({ className: 'dpt-file dpt-host' });
    assert.deepEqual(rows.map(node => [node.findByProps({ className: 'dpt-file-name' }).props.children, node.props['data-state']]),
      [['db1', 'failed'], ['web1', 'ok'], ['gpu', 'idle']]);
    assert.equal(rows[1].props.title, 'deploy@10.0.0.1:2222');
  });
  await withPanel(fixture({ snapshot: windows({ sshClient: '' }) }), {}, async view => assert.match(text(view), /sshNoClient/u));
});

test('SSH exposes a general connection check and optional DSH Go connection details', async () => {
  const f = fixture({ localeId: 'en', snapshot: windows({ sshHosts: [
    { alias: 'web1', hostName: '10.0.0.1', user: 'deploy', port: '2222' },
  ] }) });
  await withPanel(f, {}, async view => {
    const section = view.root.findByProps({ 'aria-label': 'SSH connections' });
    await act(async () => section.findAllByType('button').find(button => button.props.children === 'Copy SSH check command').props.onClick());
    assert.equal(f.copies[0], "ssh -o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=1 -- 'web1' hostname");
    await act(async () => section.findAllByType('button').find(button => button.props.children === 'Copy DSH Go connection details').props.onClick());
    assert.match(f.copies[1], /Host: 10\.0\.0\.1\nPort: 2222\nUser: deploy/u);
    assert.match(f.copies[1], /attach-only.*Windows/u);
    assert.equal(f.calls.length, 0, 'copying information starts no connection');
  });
  for (const environment of ['powershell', 'bash']) {
    const quoted = fixture({ localeId: 'en', snapshot: windows({ environment, sshHosts: [{ alias: "test'host" }] }) });
    await withPanel(quoted, {}, async view => {
      const copy = view.root.findAllByType('button').find(button => button.props.children === 'Copy SSH check command');
      await act(async () => copy.props.onClick());
      const target = environment === 'powershell' ? "'test''host'" : "'test'\\''host'";
      assert.ok(quoted.copies[0].endsWith(`-- ${target} hostname`));
    });
  }
});

test('the bottom capsule collapses the independent side panel without opening the native sidebar', async () => {
  const opened = [];
  const f = fixture({ snapshot: windows(), sidebar: { openTab: kind => opened.push(kind) } });
  await withPanel(f, { entry: f.dock }, async view => {
    assert.match(text(view), /PowerShell/u);
    assert.equal(view.root.findAllByProps({ className: 'dpt-sidecar' }).length, 1);
    assert.ok(f.document.attributes.has('data-dpt-panel-open'));
    await act(async () => view.root.findByProps({ className: 'dpt-capsule' }).props.onClick());
    assert.deepEqual(opened, []);
    assert.equal(view.root.findAllByProps({ className: 'dpt-panel' }).length, 0);
  });
  const g = fixture({ snapshot: windows() });
  g.document.width = 600;
  await withPanel(g, { entry: g.dock }, async view => {
    assert.equal(view.root.findAllByProps({ className: 'dpt-sidecar' }).length, 0);
    await act(async () => view.root.findByProps({ className: 'dpt-capsule' }).props.onClick());
    assert.equal(view.root.findByProps({ className: 'dpt-sidecar' }).props['data-floating'], '');
  });
  await withPanel(g, { entry: g.dock, preset: 'standard' }, async view => assert.equal(view.toJSON(), null));
});

test('the side panel follows conversation resizing and disappears under a fullscreen native sidebar', async () => {
  const document = fakeDocument();
  const observers = [];
  const f = fixture({ snapshot: windows(), browser: {
    document, MutationObserver: class {
      constructor(callback) { observers.push(callback); }
      observe() {}
      disconnect() {}
    },
  } });
  const layoutChanged = async () => act(async () => {
    observers.forEach(changed => changed([{ type: 'attributes', target: document.region }]));
    await new Promise(resolve => setTimeout(resolve, 5));
  });
  await withPanel(f, {}, async view => {
    assert.equal(view.root.findByProps({ className: 'dpt-sidecar' }).props.style.right, 0);
    document.width = 1000;
    await layoutChanged();
    assert.equal(view.root.findByProps({ className: 'dpt-sidecar' }).props.style.right, 200);
    document.fullscreen = true;
    await layoutChanged();
    assert.equal(view.root.findAllByProps({ className: 'dpt-sidecar' }).length, 0);
    assert.equal(document.attributes.has('data-dpt-panel-open'), false);
    document.fullscreen = false;
    await layoutChanged();
    assert.equal(view.root.findAllByProps({ className: 'dpt-sidecar' }).length, 1);
  });
  assert.equal(document.attributes.has('data-dpt-panel-open'), false);
});

test('the effects switch removes and restores the effects at once and remembers the choice', async () => {
  const document = fakeDocument();
  const attrs = new Set();
  const layers = new Set();
  const keyHandlers = new Set();
  const frames = new Set();
  const storage = new Map();
  let nextFrame = 0;
  Object.assign(document, {
    addEventListener(type, listener) { if (type === 'keydown') keyHandlers.add(listener); },
    removeEventListener(type, listener) { if (type === 'keydown') keyHandlers.delete(listener); },
    createElement: tagName => ({ tagName, dataset: {}, style: {}, setAttribute() {},
      getContext: () => ({ setTransform() {} }), remove() { layers.delete(this); } }),
  });
  Object.assign(document.body, {
    toggleAttribute: (name, on) => on ? attrs.add(name) : attrs.delete(name),
    hasAttribute: name => attrs.has(name), removeAttribute: name => attrs.delete(name),
    appendChild: layer => layers.add(layer),
  });
  const f = fixture({ snapshot: windows(), storage, activeEffects: true, browser: {
    document,
    requestAnimationFrame() { frames.add(++nextFrame); return nextFrame; },
    cancelAnimationFrame: frame => frames.delete(frame),
    MutationObserver: class { observe() {} disconnect() {} },
  } });
  const renderBridge = preset => f.slots.get('conversation.session.header.actions#deep-ptc-session').render({
    sessionId: 'deep', useProjection: () => preset, useSessionStatus: () => new Map([['deep', { running: true }]]),
  });
  let bridge;
  try {
    await act(async () => { bridge = Renderer.create(renderBridge('deep-ptc')); });
    await withPanel(f, {}, async view => {
      const control = () => view.root.findByProps({ role: 'switch', 'aria-label': 'visualEffects' });
      assert.equal(control().props['aria-checked'], true);
      assert.match(text(view), /visualEffectsHint/u);
      assert.deepEqual([...layers].map(layer => layer.tagName), ['canvas'], 'one canvas, no diagnostics overlay');
      assert.equal(keyHandlers.size, 1, 'only the passive Enter observer for the send burst');
      assert.ok(frames.size > 0);
      await act(async () => control().props.onClick());
      assert.equal(control().props['aria-checked'], false);
      assert.equal(attrs.has('data-dpt-ui'), false);
      assert.equal(layers.size, 0);
      assert.equal(frames.size, 0);
      assert.equal(keyHandlers.size, 0);
      await withPanel(fixture({ snapshot: windows(), storage }), {}, async fresh => {
        assert.equal(fresh.root.findByProps({ role: 'switch', 'aria-label': 'visualEffects' }).props['aria-checked'], false);
      });
      await act(async () => control().props.onClick());
      assert.deepEqual([...layers].map(layer => layer.tagName), ['canvas']);
      await act(async () => bridge.update(renderBridge('standard')));
      assert.equal(layers.size, 0);
      assert.equal(keyHandlers.size, 0);
    });
  } finally {
    await act(async () => bridge?.unmount());
    f.dispose();
  }
  assert.equal(layers.size, 0);
  assert.equal(frames.size, 0);
});

test('an appearance plugin turns effects off by default, but an explicit choice wins', async () => {
  const styled = { ...fakeDocument(), querySelector: selector => selector === 'style[data-plugin="dsh-claude-style"]' ? {} : null };
  await withPanel(fixture({ snapshot: windows(), browser: { document: styled } }), {}, async view => {
    assert.equal(view.root.findByProps({ role: 'switch', 'aria-label': 'visualEffects' }).props['aria-checked'], false);
    assert.match(text(view), /visualEffectsAuto/u);
  });
  const chosen = new Map([['dsh-deep-ptc-mode:visual-effects', '1']]);
  await withPanel(fixture({ snapshot: windows(), storage: chosen, browser: { document: styled } }), {}, async view => {
    assert.equal(view.root.findByProps({ role: 'switch', 'aria-label': 'visualEffects' }).props['aria-checked'], true);
    assert.match(text(view), /visualEffectsHint/u);
  });
});

test('the desktop jobs service is watched for this session and pushes running-to-finished updates', async () => {
  const listeners = new Set();
  const watched = new Set();
  let state = { rows: { deep: jobs(1, 'running'), other: jobs(1, 'failed') } };
  const jobsService = {
    state: { subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, getState: () => state },
    watchRows(id) { watched.add(id); return () => watched.delete(id); },
  };
  const f = fixture({ snapshot: windows(), jobsService });
  await withPanel(f, {}, async view => {
    assert.deepEqual([...watched], ['deep']);
    const row = () => view.root.findByProps({ className: 'dpt-job' });
    assert.equal(row().props['data-state'], 'running');
    await act(async () => {
      state = { rows: { ...state.rows, deep: [{ ...state.rows.deep[0], status: 'completed', finishedAt: 100 }] } };
      for (const listener of listeners) listener();
    });
    assert.equal(row().props['data-state'], 'completed');
    assert.doesNotMatch(text(view), /failed-0/u);
  });
  assert.equal(watched.size, 0);
});

test('background jobs share six positions and reserve one for overflow from either cap', async () => {
  const cases = [
    { running: 0, completed: 4, active: 0, finished: 3, hidden: 1 },
    { running: 3, completed: 3, active: 3, finished: 3, hidden: 0 },
    { running: 4, completed: 3, active: 4, finished: 1, hidden: 2 },
    { running: 5, completed: 1, active: 5, finished: 1, hidden: 0 },
    { running: 5, completed: 2, active: 5, finished: 0, hidden: 2 },
    { running: 6, completed: 0, active: 5, finished: 0, hidden: 1 },
  ];
  const f = fixture({ snapshot: windows() });
  for (const { running, completed, active, finished, hidden } of cases) {
    const sessions = { jobsBySession: { deep: [...jobs(completed, 'completed'), ...jobs(running, 'running')], other: jobs(1, 'failed') } };
    await withPanel(f, { sessions }, async view => {
      const card = view.root.findByProps({ 'aria-label': 'jobsTitle' });
      const list = card.findAllByType('ul')[0];
      assert.deepEqual(list.children.map(node => node.props['data-state'] ?? 'overflow'), [
        ...Array(active).fill('running'), ...Array(finished).fill('completed'), ...(hidden ? ['overflow'] : []),
      ], `${running} running, ${completed} completed`);
      if (hidden) assert.match(card.findByType('summary').props.children, new RegExp(`jobsMore ${hidden}`, 'u'));
      else assert.equal(card.findAllByType('details').length, 0);
    });
  }
});

test('the reload button resets only the current conversation through the host command and lists failed tools', async () => {
  const f = fixture({ snapshot: windows() });
  await withPanel(f, { sessionId: 'session-A', tools: { ...noTools, report: { tools: [{ name: 'bad_tool', provider: 'example-plugin' }] } } }, async view => {
    assert.match(text(view), /bad_tool/u);
    assert.match(text(view), /example-plugin/u);
    const reload = view.root.findAllByType('button').find(node => node.props.children === 'toolReset');
    await act(async () => { await reload.props.onClick(); });
    assert.deepEqual(plain(f.calls), [['session-A', '/deep-ptc-reset-tools', []]]);
    assert.match(text(view), /toolResetDone/u);
  });
});

test('the panel and an existing reload result follow the DSH language', async () => {
  const f = fixture({ snapshot: windows(), localeId: 'en' });
  await withPanel(f, { sessions: { jobsBySession: { deep: jobs(1, 'running') } } }, async view => {
    assert.match(text(view), /Background jobs.*Output files.*SSH connections.*Visual effects/u);
    const reload = view.root.findAllByType('button').find(node => node.props.children === 'Reload all tool states');
    await act(async () => reload.props.onClick());
    assert.match(text(view), /Tool states reloaded for this conversation/u);
    await act(async () => f.setLocale('zh'));
    assert.match(text(view), /后台任务.*运行中.*输出文件.*SSH 连接.*本对话工具状态已重载.*界面特效/u);
    assert.doesNotMatch(text(view), /Tool states reloaded for this conversation/u);
    assert.equal(f.calls.length, 1);
    assert.equal(f.writes.length, 0);
  });
});

test('a denied reset is shown as a failure; the panel never claims success', async () => {
  const f = fixture({ snapshot: windows(), outcome: { ok: false, error: { code: 'access-denied', message: 'access denied' } } });
  await withPanel(f, {}, async view => {
    await act(async () => { await view.root.findAllByType('button').find(node => node.props.children === 'toolReset').props.onClick(); });
    assert.match(text(view), /toolResetFailed/u);
    assert.match(text(view), /access denied/u);
    assert.doesNotMatch(text(view), /toolResetDone/u);
  });
});

test('a missing remote command is distinguishable from a handler failure', async () => {
  for (const [outcome, reason] of [
    [{ ok: true, value: undefined }, /toolResetUnavailable/u],
    [{ ok: true, value: { result: { kind: 'error', text: 'state not writable' } } }, /state not writable/u],
  ]) {
    await withPanel(fixture({ snapshot: windows(), outcome }), {}, async view => {
      await act(async () => view.root.findAllByType('button').find(node => node.props.children === 'toolReset').props.onClick());
      assert.match(text(view), reason);
      assert.doesNotMatch(text(view), /toolResetDone/u);
    });
  }
});

test('without settings or a readable tool state the panel keeps the reload button and shows what it has', async () => {
  const f = fixture({ snapshot: undefined });
  await withPanel(f, { tools: null }, async view => {
    assert.equal(radios(view).length, 0, 'no settings form, no environment switch');
    assert.ok(view.root.findAllByType('button').some(node => node.props.children === 'toolReset'));
    assert.doesNotMatch(text(view), /toolFailures/u);
    assert.equal(f.calls.length, 0);
  });
});

test('other modes have no Deep PTC side panel or capsule', async () => {
  const f = fixture({ snapshot: windows() });
  await withPanel(f, { preset: 'standard', activity: { v: 1, outputs: outputs(2), ssh: [{ host: 'x-host', ok: true, count: 1, turn: 1 }] } }, async view => {
    assert.equal(view.toJSON(), null);
    assert.equal(view.root.findAllByType('button').some(node => node.props.children === 'toolReset'), false);
    assert.equal(view.root.findAllByProps({ 'aria-label': 'outputsTitle' }).length, 0);
    assert.doesNotMatch(text(view), /x-host/u, 'another mode\'s SSH use is not listed');
    assert.equal(f.calls.length, 0);
  });
});

test('the settings page holds the form, the effects switch and copyable diagnostics', async () => {
  const f = fixture({ snapshot: windows() });
  const page = f.slots.get('settings.section#deep-ptc');
  let view;
  await act(async () => { view = Renderer.create(React.createElement(page.render, {})); });
  try {
    assert.equal(view.root.findAllByType('form').length, 1, 'the environment form');
    assert.equal(view.root.findAllByProps({ role: 'switch', 'aria-label': 'visualEffects' }).length, 1);
    const copy = view.root.findAllByType('button').find(node => node.props.children === 'diagCopy');
    await act(async () => copy.props.onClick());
    assert.match(view.root.findByType('pre').props.children, /dsh-deep-ptc-mode client \| effects=/u);
  } finally { await act(async () => view.unmount()); }
});

test('effects animate only opacity or transform while looping, and never take keys or window dragging', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  // An !important box-shadow beats an animation, so the focus rule must step aside while the agent works.
  assert.match(source, /\$\{ON\}:not\(\[data-dpt-busy\]\) \$\{COMPOSER\}:focus-within\{box-shadow:/u);
  assert.match(source, /\$\{ON\}\[data-dpt-busy\] \$\{COMPOSER\}::after\{animation:dpt-glow/u);
  assert.match(source, /@keyframes dpt-glow\{0%,100%\{opacity:\.3\}50%\{opacity:1\}\}/u);
  assert.match(source, /@keyframes dpt-dot-flash\{0%,100%\{opacity:1\}50%\{opacity:\.35\}\}/u);
  assert.doesNotMatch(source, /dpt-breathe/u, 'no animated box-shadow');
  assert.doesNotMatch(source, /:focus-within::before\{opacity:1;animation/u, 'focus does not start a loop');
  assert.match(source, /\.dpt-fx\{[^}]*pointer-events:none;-webkit-app-region:initial!important/u);
  assert.doesNotMatch(source, /ctrlKey|metaKey/u, 'no keyboard shortcuts');
  assert.doesNotMatch(source, /setInterval\(update/u, 'no polling of the active session');
  assert.doesNotMatch(source, /getComputedStyle/u, 'host elements are found by their own attributes');
});

// Render the dock host and the toolbar capsule of one conversation together, as the composer does.
async function withComposer(f, { preset = 'deep-ptc', sessionId = 'deep' } = {}, body) {
  f.document.sessionId = sessionId;
  const toolbar = f.slots.get('conversation.input.right#deep-ptc-capsule');
  const props = { sessionId, ...f.dock.slot.inject(sessionId),
    useProjection: key => key === 'agentPreset' ? preset : key === 'deepPtcTools' ? noTools : undefined,
    useSessionStatus: select => select(new Map()), useSessions: select => select({}) };
  let view;
  await act(async () => { view = Renderer.create(React.createElement(React.Fragment, null,
    React.createElement('div', { id: 'dock' }, React.createElement(f.dock.render, props)),
    React.createElement('div', { id: 'toolbar' }, React.createElement(toolbar.render, props)))); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const within = id => view.root.find(node => node.props?.id === id);
  try { await body(view, within); } finally { await act(async () => view.unmount()); }
}
const capsules = node => node.findAll(child => child.type === 'button' && child.props?.className === 'dpt-capsule');
const claudeStyled = () => {
  const document = fakeDocument();
  document.body = { hasAttribute: name => name === 'data-dsh-claude-style' };
  return document;
};

test('the capsule stays below the composer by default and moves into the toolbar beside dsh-claude-style', async () => {
  const plainHost = fixture({ snapshot: windows() });
  assert.ok(plainHost.slots.has('conversation.input.right#deep-ptc-capsule'), 'the toolbar slot is registered');
  await withComposer(plainHost, {}, async (view, within) => {
    assert.equal(capsules(within('dock')).length, 1);
    assert.equal(capsules(within('toolbar')).length, 0);
    assert.equal(within('dock').findByProps({ className: 'dpt-capsule-row' }).props['data-placement'], 'dock');
  });
  const styled = fixture({ snapshot: windows(), browser: { document: claudeStyled() } });
  await withComposer(styled, {}, async (view, within) => {
    // The dock keeps its marker and the panel, but takes no row.
    const row = within('dock').findByProps({ className: 'dpt-capsule-row' });
    assert.equal(row.props['data-placement'], 'toolbar');
    assert.equal(capsules(within('dock')).length, 0);
    const [compact] = capsules(within('toolbar'));
    assert.equal(compact.props['data-compact'], '');
    assert.equal(view.root.findAllByProps({ className: 'dpt-sidecar' }).length, 1, 'wide conversations dock the panel');
    await act(async () => compact.props.onClick());
    assert.equal(view.root.findAllByProps({ className: 'dpt-sidecar' }).length, 0, 'the toolbar capsule collapses the same panel');
    assert.equal(capsules(within('toolbar'))[0].props['aria-expanded'], false);
    await act(async () => capsules(within('toolbar'))[0].props.onClick());
    assert.equal(view.root.findAllByProps({ className: 'dpt-sidecar' }).length, 1);
  });
  await withComposer(styled, { preset: 'standard' }, async view => assert.equal(capsules(view.root).length, 0));
});

test('the capsule position is a remembered choice, and hidden leaves the sidebar tab as the way back', async () => {
  const storage = new Map();
  const f = fixture({ snapshot: windows(), storage });
  const page = f.slots.get('settings.section#deep-ptc');
  let settings;
  await act(async () => { settings = Renderer.create(React.createElement(page.render, {})); });
  const group = () => settings.root.findByProps({ role: 'radiogroup', 'aria-label': 'capsulePlacement' });
  const option = label => group().findAll(node => node.props.role === 'radio' && node.props.children === label)[0];
  try {
    assert.equal(option('placementAuto').props['aria-checked'], true);
    assert.match(text(settings), /placementAutoNow/u);
    await act(async () => option('placementHidden').props.onClick());
    assert.equal(storage.get('dsh-deep-ptc-mode:capsule-placement'), 'hidden');
    // The tab type is listed on the new-tab guide while the capsule is hidden.
    assert.deepEqual(plain(f.tabTypes.at(-1).guide.map(entry => entry.id)), ['deep-ptc']);
    await withComposer(f, {}, async (view, within) => {
      assert.equal(capsules(view.root).length, 0);
      await act(async () => view.root.findByProps({ className: 'dpt-sidecar' }).findByProps({ 'aria-label': 'panelClose' }).props.onClick());
      assert.equal(view.root.findAllByProps({ className: 'dpt-sidecar' }).length, 0);
      let tab;
      await act(async () => { tab = Renderer.create(React.createElement(f.legacy.render, { sessionId: 'deep' })); });
      assert.match(text(tab), /panelMovedHidden/u);
      await act(async () => tab.root.findByType('button').props.onClick());
      assert.equal(view.root.findAllByProps({ className: 'dpt-sidecar' }).length, 1, 'the tab button reopens the panel');
      await act(async () => tab.unmount());
      assert.equal(within('dock').findByProps({ className: 'dpt-capsule-row' }).props['data-placement'], 'hidden');
    });
    await act(async () => option('placementDock').props.onClick());
    assert.deepEqual(plain(f.tabTypes.at(-1).guide), []);
  } finally { await act(async () => settings.unmount()); }
  await withComposer(fixture({ snapshot: windows(), storage: new Map([['dsh-deep-ptc-mode:capsule-placement', 'toolbar']]) }), {},
    async (view, within) => assert.equal(capsules(within('toolbar')).length, 1, 'a stored choice applies without compact themes'));
});

test('the side panel edge resizes the panel within bounds and remembers the width', async () => {
  const storage = new Map();
  const f = fixture({ snapshot: windows(), storage });
  await withPanel(f, {}, async view => {
    const sidecar = () => view.root.findByProps({ className: 'dpt-sidecar' });
    const handle = () => view.root.findByProps({ role: 'separator' });
    const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(sidecar().props.style.width, 280);
    assert.equal(handle().props['aria-valuemax'], 640, 'room 1200 leaves 540 for the conversation, capped at 640');
    await act(async () => handle().props.onKeyDown({ key: 'ArrowLeft', shiftKey: false, preventDefault() {} }));
    await settle();
    assert.equal(sidecar().props.style.width, 296);
    assert.equal(storage.get('dsh-deep-ptc-mode:side-panel-width'), '296');
    // Dragging the left edge leftwards widens the panel; the release is what gets remembered.
    const listeners = {};
    const target = { addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: type => { delete listeners[type]; }, setPointerCapture() {} };
    await act(async () => handle().props.onPointerDown({ button: 0, clientX: 900, pointerId: 1, currentTarget: target, preventDefault() {} }));
    await act(async () => listeners.pointermove({ clientX: 700 }));
    await settle();
    assert.equal(sidecar().props.style.width, 496);
    assert.equal(storage.get('dsh-deep-ptc-mode:side-panel-width'), '296', 'not written while dragging');
    await act(async () => listeners.pointermove({ clientX: 0 }));
    await act(async () => listeners.pointerup({}));
    await settle();
    assert.equal(sidecar().props.style.width, 640, 'clamped to the room left for the conversation');
    assert.equal(storage.get('dsh-deep-ptc-mode:side-panel-width'), '640');
    assert.equal(Object.keys(listeners).length, 0, 'the drag listeners are removed on release');
    await act(async () => handle().props.onDoubleClick());
    await settle();
    assert.equal(sidecar().props.style.width, 280);
  });
  // The remembered width shrinks to fit a smaller room instead of covering the conversation.
  const small = fixture({ snapshot: windows(), storage: new Map([['dsh-deep-ptc-mode:side-panel-width', '600']]) });
  small.document.width = 900;
  await withPanel(small, {}, async view => {
    assert.equal(view.root.findByProps({ className: 'dpt-sidecar' }).props.style.width, 360);
  });
});

test('a widget pinned to the bottom-right corner leaves the panel bottom clear', async () => {
  const document = fakeDocument();
  const base = document.querySelectorAll;
  document.querySelectorAll = selector => selector === '.dshwv-root .dshwv-img'
    ? [{ getBoundingClientRect: () => ({ left: 1050, right: 1200, top: 650, bottom: 800, width: 150, height: 150 }) }] : base(selector);
  await withPanel(fixture({ snapshot: windows(), browser: { document } }), {}, async view => {
    assert.equal(view.root.findByProps({ className: 'dpt-sidecar' }).props.style['--dpt-inset-bottom'], '150px');
  });
  await withPanel(fixture({ snapshot: windows() }), {}, async view => {
    assert.equal(view.root.findByProps({ className: 'dpt-sidecar' }).props.style['--dpt-inset-bottom'], undefined);
  });
});
