import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 우리 집 프리셋(private/, git 제외)은 로컬 dev 서버에서만 넘긴다. 빌드·테스트·E2E(HOMEFIT_SAMPLE=1)는 항상 null(스펙 §15.1)
function homePreset(): Plugin {
  const id = 'virtual:home-preset';
  const resolved = `\0${id}`;
  let enabled = false;
  let root = '';
  return {
    name: 'homefit-home-preset',
    configResolved(config) {
      root = config.root;
      enabled = config.command === 'serve' && config.mode !== 'test' && !process.env.VITEST && process.env.HOMEFIT_SAMPLE !== '1';
    },
    resolveId: (source) => (source === id ? resolved : undefined),
    load(loadId) {
      if (loadId !== resolved) return;
      const plan = resolve(root, 'private/our-home.local.json');
      const image = resolve(root, 'private/home-floorplan.jpg');
      if (!enabled || !existsSync(plan)) return 'export default null;';
      const imageImport = existsSync(image) ? `import imageUrl from ${JSON.stringify(`${image}?url`)};` : 'const imageUrl = null;';
      return `import plan from ${JSON.stringify(plan)};\n${imageImport}\nexport default { plan, imageUrl };`;
    },
  };
}

export default defineConfig({
  plugins: [react(), homePreset()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
