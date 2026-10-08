declare module 'virtual:home-preset' {
  const preset: import('./persistence/homePreset').HomePresetSource | null;
  export default preset;
}

declare module 'virtual:doc-links' {
  const links: unknown;
  export default links;
}
