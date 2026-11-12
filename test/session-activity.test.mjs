import test from 'node:test';
import assert from 'node:assert/strict';
import { activityView, blankActivity, foldActivity, mutationPath, sshDestinations } from '../lib/session-activity.mjs';
import { parseSshConfig, sshGuidance } from '../lib/ssh.mjs';

const fold = events => events.reduce((state, event, index) => foldActivity(state, { seq: index + 1, ...event }), blankActivity());
const call = (callId, name, args) => ({ type: 'tool/call', data: { callId, name, arguments: JSON.stringify(args) } });
const result = (callId, extra = {}) => ({ type: 'tool/result', data: { message: { source: { callId }, isError: extra.isError }, meta: extra.meta } });

test('mutation paths follow the official deliverables rule', () => {
  assert.equal(mutationPath('write', { file_path: 'a.md', content: '' }), 'a.md');
  assert.equal(mutationPath('write', { file_path: 'a.md' }), undefined);
  assert.equal(mutationPath('edit', { file_path: 'b.js', old_string: 'x', new_string: 'y' }), 'b.js');
  assert.equal(mutationPath('edit', { file_path: 'b.js', old_string: 'x', new_string: 'x' }), undefined);
  assert.equal(mutationPath('str_replace_editor', { command: 'create', path: 'c.txt' }), 'c.txt');
  assert.equal(mutationPath('str_replace_editor', { command: 'view', path: 'c.txt' }), undefined);
  assert.equal(mutationPath('read', { file_path: 'a.md' }), undefined);
});

test('successful writes, dispatched writes and presented files are outputs, newest first and deduplicated', () => {
  const state = fold([
    { type: 'turn/start', data: { turn: 1 } },
    call('c1', 'write', { file_path: 'notes.md', content: 'x' }),
    result('c1', { meta: { path: 'C:\\work\\notes.md' } }),
    call('c2', 'write', { file_path: 'broken.md', content: 'x' }),
    result('c2', { isError: true }),
    { type: 'turn/start', data: { turn: 2 } },
    { type: 'tool/ptc-dispatch-start', data: { subCallId: 's1', name: 'edit', arguments: { file_path: 'app.js', old_string: 'a', new_string: 'b' } } },
    { type: 'tool/ptc-dispatch', data: { subCallId: 's1', name: 'edit' } },
    { type: 'deliverables/presented', data: { files: [{ path: 'report.pdf' }, { nope: 1 }] } },
    call('c3', 'edit', { file_path: 'C:\\work\\notes.md', old_string: 'x', new_string: 'y' }),
    result('c3'),
  ]);
  assert.deepEqual(state.outputs.map(row => [row.path, row.kind, row.turn]), [
    ['C:\\work\\notes.md', 'produced', 2], ['report.pdf', 'presented', 2], ['app.js', 'produced', 2],
  ]);
  assert.deepEqual(state.pending, []);
  assert.deepEqual(Object.keys(activityView(state)).sort(), ['outputs', 'ssh', 'v']);
});

test('ssh, scp and sftp destinations are read from shell commands', () => {
  assert.deepEqual(sshDestinations('ssh -o BatchMode=yes -p 2222 deploy@web1 "uptime"'), ['web1']);
  assert.deepEqual(sshDestinations('ssh -i ~/.ssh/id prod-db ls; ssh gpu'), ['prod-db', 'gpu']);
  assert.deepEqual(sshDestinations('scp -B ./a.txt build:/tmp/a.txt && scp C:\\x.txt me@[10.0.0.5]:/srv/'), ['build', '10.0.0.5']);
  assert.deepEqual(sshDestinations('sftp -b batch.txt ssh://ops@mirror:2022'), ['mirror']);
  assert.deepEqual(sshDestinations('& "C:\\Windows\\System32\\OpenSSH\\ssh.exe" lab hostname'), ['lab']);
  assert.deepEqual(sshDestinations('echo sshd is fine; git push'), []);
  assert.deepEqual(sshDestinations(undefined), []);
});

test('SSH use is recorded per host with the outcome of its call, most recent first', () => {
  const state = fold([
    { type: 'turn/start', data: { turn: 3 } },
    call('a', 'bash', { command: 'ssh -o BatchMode=yes web1 uptime' }),
    result('a'),
    call('b', 'pwsh', { command: 'ssh db1 "df -h"' }),
    result('b', { isError: true }),
    call('c', 'bash', { command: 'ssh web1 whoami' }),
    result('c'),
  ]);
  assert.deepEqual(state.ssh.map(row => [row.host, row.ok, row.count]), [['web1', true, 2], ['db1', false, 1]]);
});

test('ssh config aliases keep endpoints and skip patterns and secrets', () => {
  const hosts = parseSshConfig([
    'Host *', '  IdentityFile ~/.ssh/id_all',
    'Host web1 web1-alias # comment', '  HostName 10.0.0.1', '  User deploy', '  Port 2222', '  HostName ignored',
    'Host gpu', '  hostname=gpu.example.com',
    'Match host foo', '  User nobody',
    'Host !bad *.internal',
  ].join('\n'));
  assert.deepEqual(hosts, [
    { alias: 'web1', hostName: '10.0.0.1', user: 'deploy', port: '2222' },
    { alias: 'web1-alias', hostName: '10.0.0.1', user: 'deploy', port: '2222' },
    { alias: 'gpu', hostName: 'gpu.example.com' },
  ]);
  assert.equal(JSON.stringify(hosts).includes('id_all'), false);
});

test('SSH guidance is non-interactive and names the configured aliases', () => {
  const text = sshGuidance({ environment: 'powershell', client: 'C:\\Windows\\System32\\OpenSSH\\ssh.exe',
    hosts: [{ alias: 'web1', hostName: '10.0.0.1', user: 'deploy', port: '2222' }, { alias: 'gpu' }] });
  assert.match(text, /BatchMode=yes/u);
  assert.match(text, /web1 \(deploy@10\.0\.0\.1:2222\), gpu/u);
  assert.match(text, /OpenSSH\\ssh\.exe/u);
  assert.match(text, /DSH Go.*POSIX.*Windows/u);
  assert.match(text, /scp -B/u);
  assert.match(text, /sftp -b/u);
  assert.match(text, /ExitOnForwardFailure=yes/u);
  assert.match(sshGuidance({ environment: 'wsl', client: '', hosts: [] }), /inside the distribution/u);
});
