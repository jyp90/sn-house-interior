import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { isTrustedUpdateRequest, runSelfUpdate, UPDATE_PATH, type Exec } from './src/devserver/selfUpdate';

// 우리 집 프리셋·문서 링크(private/, git 제외)는 로컬 dev 서버에서만 넘긴다. 빌드·테스트·E2E(HOMEFIT_SAMPLE=1)는 항상 null(스펙 §15.1, §15.4)
function homePreset(): Plugin {
  const id = 'virtual:home-preset';
  const resolved = `\0${id}`;
  const linksId = 'virtual:doc-links';
  const linksResolved = `\0${linksId}`;
  let enabled = false;
  let root = '';
  return {
    name: 'homefit-home-preset',
    configResolved(config) {
      root = config.root;
      enabled = config.command === 'serve' && config.mode !== 'test' && !process.env.VITEST && process.env.HOMEFIT_SAMPLE !== '1';
    },
    resolveId: (source) => (source === id ? resolved : source === linksId ? linksResolved : undefined),
    load(loadId) {
      if (loadId === linksResolved) {
        const links = resolve(root, 'private/doc-links.local.json');
        return enabled && existsSync(links) ? `export { default } from ${JSON.stringify(links)};` : 'export default null;';
      }
      if (loadId !== resolved) return;
      const plan = resolve(root, 'private/our-home.local.json');
      const image = resolve(root, 'private/home-floorplan.jpg');
      if (!enabled || !existsSync(plan)) return 'export default null;';
      const imageImport = existsSync(image) ? `import imageUrl from ${JSON.stringify(`${image}?url`)};` : 'const imageUrl = null;';
      return `import plan from ${JSON.stringify(plan)};\n${imageImport}\nexport default { plan, imageUrl };`;
    },
  };
}

// 「업데이트」 버튼: 원격 코드를 받아 dev 서버를 다시 시작한다(스펙 §18). serve 전용이라 빌드·Pages에는 없다
function selfUpdate(): Plugin {
  let running = false;
  const boot = Date.now(); // 설정을 다시 읽으며 재시작하면 새 값이 된다. 클라이언트가 재시작 완료를 알아보는 데 쓴다
  return {
    name: 'homefit-self-update',
    apply: 'serve',
    configureServer(server) {
      const cwd = server.config.root;
      const exec: Exec = (cmd, args) =>
        new Promise((done) => {
          execFile(cmd, args, { cwd, timeout: 5 * 60_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
            done({ code, stdout: String(stdout), stderr: String(stderr || (err && !stderr ? err.message : '')) });
          });
        });
      server.middlewares.use(UPDATE_PATH, (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        if (req.method === 'GET') return send(200, { boot });
        if (req.method !== 'POST') return send(405, { status: 'error', message: 'POST만 허용' });
        if (!isTrustedUpdateRequest(req.headers)) return send(403, { status: 'error', message: '허용되지 않은 요청입니다.' });
        if (running) return send(409, { status: 'error', message: '이미 업데이트 중입니다.' });
        running = true;
        runSelfUpdate(exec)
          .then((result) => {
            send(200, { ...result, boot });
            if (result.status === 'updated') {
              server.config.logger.info(`[self-update] ${result.from} → ${result.to}, 서버 재시작`, { timestamp: true });
              setTimeout(() => void server.restart(result.depsInstalled), 200);
            }
          })
          .catch((e: unknown) => send(500, { status: 'error', message: String(e) }))
          .finally(() => {
            running = false;
          });
      });
    },
  };
}


// Pages 주소가 https://jyp90.github.io/sn-house-interior/ 라서 build·preview만 base를 붙인다. dev·Vitest·e2e(5180)는 '/'(배포 설계 §6)
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/sn-house-interior/' : '/',
  plugins: [react(), homePreset(), selfUpdate()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
}));
