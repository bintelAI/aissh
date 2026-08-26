interface ElectronBridge {
  isElectron: boolean;
  getBackendPort: () => Promise<number>;
  saveConfiguration: (suggestedName: string, contents: string) => Promise<{ canceled: boolean; path?: string }>;
}

interface Window {
  electron?: ElectronBridge;
}
