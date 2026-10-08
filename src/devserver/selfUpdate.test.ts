import { describe, expect, it } from 'vitest';
import { isTrustedUpdateRequest, runSelfUpdate, type Exec, type ExecResult } from './selfUpdate';

const ok = (stdout = ''): ExecResult => ({ code: 0, stdout, stderr: '' });
const fail = (stderr: string): ExecResult => ({ code: 1, stdout: '', stderr });

// 명령 문자열 → 결과. 호출 순서도 기록한다.
function fakeExec(table: Record<string, ExecResult | ExecResult[]>) {
  const calls: string[] = [];
  const exec: Exec = async (cmd, args) => {
    const key = [cmd, ...args].join(' ');
    calls.push(key);
    const r = table[key];
    if (Array.isArray(r)) return r.shift() ?? ok();
    return r ?? ok();
  };
  return { exec, calls };
}

const OLD = 'aaaaaaa1111111111111111111111111111111111';
const NEW = 'bbbbbbb2222222222222222222222222222222222';

describe('runSelfUpdate', () => {
  it('fast-forwards to the upstream and reports the commit count', async () => {
    const { exec, calls } = fakeExec({
      'git rev-parse --abbrev-ref --symbolic-full-name @{u}': ok('origin/main\n'),
      'git rev-parse HEAD': [ok(`${OLD}\n`), ok(`${NEW}\n`)],
      'git rev-parse @{u}': ok(`${NEW}\n`),
      'git rev-list --count HEAD..@{u}': ok('3\n'),
    });
    expect(await runSelfUpdate(exec)).toEqual({ status: 'updated', from: 'aaaaaaa', to: 'bbbbbbb', commits: 3, depsInstalled: false });
    expect(calls).toContain('git fetch --quiet');
    expect(calls).toContain('git merge --ff-only @{u}');
    expect(calls).not.toContain('npm install');
  });

  it('runs npm install when package files changed', async () => {
    const { exec, calls } = fakeExec({
      'git rev-parse HEAD': [ok(OLD), ok(NEW)],
      'git rev-parse @{u}': ok(NEW),
      'git rev-list --count HEAD..@{u}': ok('1'),
      [`git diff --name-only ${OLD} ${NEW} -- package.json package-lock.json`]: ok('package-lock.json\n'),
    });
    expect(await runSelfUpdate(exec)).toMatchObject({ status: 'updated', depsInstalled: true });
    expect(calls.at(-1)).toBe('npm install');
  });

  it('reports up-to-date without merging', async () => {
    const { exec, calls } = fakeExec({ 'git rev-parse HEAD': ok(OLD), 'git rev-parse @{u}': ok(OLD) });
    expect(await runSelfUpdate(exec)).toEqual({ status: 'up-to-date', head: 'aaaaaaa' });
    expect(calls.some((c) => c.startsWith('git merge'))).toBe(false);
  });

  it('treats local-only commits (nothing behind) as up-to-date', async () => {
    const { exec, calls } = fakeExec({
      'git rev-parse HEAD': ok(NEW),
      'git rev-parse @{u}': ok(OLD),
      'git rev-list --count HEAD..@{u}': ok('0'),
    });
    expect(await runSelfUpdate(exec)).toEqual({ status: 'up-to-date', head: 'bbbbbbb' });
    expect(calls.some((c) => c.startsWith('git merge'))).toBe(false);
  });

  it('refuses when tracked files have uncommitted changes', async () => {
    const { exec, calls } = fakeExec({ 'git status --porcelain --untracked-files=no': ok(' M src/App.tsx\n') });
    expect(await runSelfUpdate(exec)).toEqual({ status: 'dirty' });
    expect(calls).not.toContain('git fetch --quiet');
  });

  it('errors without an upstream branch', async () => {
    const { exec } = fakeExec({ 'git rev-parse --abbrev-ref --symbolic-full-name @{u}': fail('fatal: no upstream') });
    expect(await runSelfUpdate(exec)).toMatchObject({ status: 'error' });
  });

  it('errors when fetch fails', async () => {
    const { exec } = fakeExec({ 'git fetch --quiet': fail('ssh: Could not resolve hostname github.com') });
    const r = await runSelfUpdate(exec);
    expect(r).toMatchObject({ status: 'error' });
    expect(r.status === 'error' && r.message).toContain('Could not resolve hostname');
  });

  it('errors when the branch has diverged', async () => {
    const { exec, calls } = fakeExec({
      'git rev-parse HEAD': ok(OLD),
      'git rev-parse @{u}': ok(NEW),
      'git rev-list --count HEAD..@{u}': ok('2'),
      'git merge --ff-only @{u}': fail('fatal: Not possible to fast-forward, aborting.'),
    });
    expect(await runSelfUpdate(exec)).toMatchObject({ status: 'error' });
    expect(calls).not.toContain('npm install');
  });

  it('errors when npm install fails after the merge', async () => {
    const { exec } = fakeExec({
      'git rev-parse HEAD': [ok(OLD), ok(NEW)],
      'git rev-parse @{u}': ok(NEW),
      'git rev-list --count HEAD..@{u}': ok('1'),
      [`git diff --name-only ${OLD} ${NEW} -- package.json package-lock.json`]: ok('package.json'),
      'npm install': fail('npm ERR! network'),
    });
    const r = await runSelfUpdate(exec);
    expect(r.status === 'error' && r.message).toContain('bbbbbbb');
  });
});

describe('isTrustedUpdateRequest', () => {
  it('accepts same-origin requests with the custom header', () => {
    expect(isTrustedUpdateRequest({ 'x-homefit-update': '1', origin: 'http://localhost:5173', host: 'localhost:5173' })).toBe(true);
    expect(isTrustedUpdateRequest({ 'x-homefit-update': '1', host: 'localhost:5173' })).toBe(true);
  });

  it('rejects cross-origin requests or a missing header', () => {
    expect(isTrustedUpdateRequest({ 'x-homefit-update': '1', origin: 'https://evil.example', host: 'localhost:5173' })).toBe(false);
    expect(isTrustedUpdateRequest({ origin: 'http://localhost:5173', host: 'localhost:5173' })).toBe(false);
    expect(isTrustedUpdateRequest({ 'x-homefit-update': '1', origin: 'null', host: 'localhost:5173' })).toBe(false);
  });
});
