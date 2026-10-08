declare module 'virtual:home-preset' {
  const preset: import('./persistence/homePreset').HomePresetSource | null;
  export default preset;
}
