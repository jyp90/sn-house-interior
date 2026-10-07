function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG를 만들지 못했습니다'))), 'image/png'),
  );
}

export async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG를 이미지로 만들지 못했습니다'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없습니다');
    ctx.drawImage(img, 0, 0, width, height);
    return await toPngBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function canvasWithHeader(source: HTMLCanvasElement, lines: string[]): Promise<Blob> {
  const k = Math.max(1, Math.round(source.width / (source.clientWidth || source.width)));
  const header = (16 + lines.length * 28) * k;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height + header;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없습니다');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#1f2328' : '#6b7280';
    ctx.font = i === 0 ? `bold ${20 * k}px sans-serif` : `${15 * k}px sans-serif`;
    ctx.fillText(line, 16 * k, (30 + i * 28) * k);
  });
  ctx.drawImage(source, 0, header);
  return toPngBlob(canvas);
}
