export const ENVIRONMENTS = ['auto', 'wsl', 'powershell', 'zsh', 'bash'];

export function availableEnvironments(platform) {
  return platform === 'win32' ? ['auto', 'wsl', 'powershell'] : ['auto', 'zsh', 'bash'];
}

export function resolveEnvironment(environment = 'auto', platform = process.platform) {
  if (!availableEnvironments(platform).includes(environment)) {
    throw new Error(`Execution environment ${JSON.stringify(environment)} is unavailable on ${platform}`);
  }
  return environment === 'auto'
    ? (platform === 'win32' ? 'powershell' : platform === 'darwin' ? 'zsh' : 'bash')
    : environment;
}

export function normalizeDistribution(value = '') {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error('WSL distribution must be a name without control characters');
  }
  const distribution = value.trim();
  if (distribution.startsWith('-')) throw new Error('WSL distribution must not start with a dash');
  return distribution;
}

export function shellArgv(environment, spec, distribution = '', platform = process.platform) {
  if (environment === 'wsl') {
    if (platform !== 'win32') throw new Error('WSL requires a Windows host');
    const distro = normalizeDistribution(distribution);
    return ['wsl.exe', ...(distro ? ['--distribution', distro] : []),
      '--cd', spec.workdir, '--exec', 'bash', '-lc', spec.command];
  }
  if (environment === 'zsh') return [platform === 'darwin' ? '/bin/zsh' : 'zsh', '-lc', spec.command];
  throw new Error(`No mapped executor for ${environment}`);
}

export function assertExecutionPolicy(environment, policy) {
  if (environment === 'wsl' && policy?.mode !== 'danger-full-access') {
    throw new Error('WSL execution is not supported under a confined Windows sandbox. Select PowerShell for confined work, or use the host\'s existing approval flow for this exact command. No command was executed.');
  }
}

export function environmentText(environment, distribution = '') {
  const descriptions = {
    wsl: `Execution environment: WSL Bash${distribution ? ` (${distribution})` : ' (Windows default distribution)'}. The bash tool runs POSIX source via wsl.exe and bash -lc. File tools and the tool workdir use Windows host paths; Linux paths belong inside command source. WSL is available only in danger-full-access; a confined call fails without execution. Never silently fall back to PowerShell or another distribution.`,
    powershell: 'Execution environment: native Windows PowerShell. Use the pwsh tool and PowerShell syntax, native Windows paths and $env:NAME. This selection takes precedence over older workspace guidance that assumed WSL. The configured sandbox and approval policy still apply.',
    zsh: 'Execution environment: native Zsh. Use the zsh tool with Zsh/POSIX command source. On macOS the executor is /bin/zsh -lc; elsewhere zsh must be installed. File tools and workdir use native host paths. The configured sandbox and approval policy still apply.',
    bash: 'Execution environment: native Bash on macOS/Linux. Use the bash tool with Bash/POSIX command source and native host paths. This is not WSL. The configured sandbox and approval policy still apply.',
  };
  if (!descriptions[environment]) throw new Error(`Unknown environment ${environment}`);
  return descriptions[environment];
}

export function configuredPreset(template, options, platform = process.platform) {
  const environment = resolveEnvironment(options.environment, platform);
  const distribution = normalizeDistribution(options.wslDistribution);
  const preset = structuredClone(template);
  const first = preset.plugins.findIndex(row => row.id === 'tool-bash');
  if (first < 0 || preset.plugins[first + 1]?.id !== 'tool-pwsh') throw new Error('Upstream shell layout changed; review compatibility before loading');
  const executor = {
    id: 'executor',
    name: environment === 'powershell' ? '@deepseek-ai/dsh-pwsh-sandbox'
      : environment === 'bash' ? '@deepseek-ai/dsh-bash-sandbox' : 'dsh-deep-ptc-mode/executor',
    ...(environment === 'wsl' || environment === 'zsh'
      ? { config: { environment, wslDistribution: distribution } } : {}),
  };
  const terminal = environment === 'zsh'
    ? { id: 'tool-zsh', name: 'dsh-deep-ptc-mode/terminal' }
    : { id: environment === 'powershell' ? 'tool-pwsh' : 'tool-bash',
      name: environment === 'powershell' ? '@deepseek-ai/dsh-tool-pwsh' : '@deepseek-ai/dsh-tool-bash' };
  preset.plugins.splice(first, 2, {
    id: 'execution', name: 'cordis:group', group: true, isolate: { shell: true },
    config: [executor, terminal, { id: 'execution-instructions', name: 'dsh-deep-ptc-mode/environment',
      config: { environment, wslDistribution: distribution } }],
  });
  preset.description = `${template.description} 当前环境：${environment}${environment === 'wsl' && distribution ? ` (${distribution})` : ''}`;
  return preset;
}
