import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

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

// Pages 주소가 https://jyp90.github.io/sn-house-interior/ 라서 build·preview만 base를 붙인다. dev·Vitest·e2e(5180)는 '/'(배포 설계 §6)
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/sn-house-interior/' : '/',
  plugins: [react(), homePreset()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
}));
