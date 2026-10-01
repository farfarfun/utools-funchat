export {};

declare global {
  interface Window {
    saveFile?: (options: unknown, data: unknown, encoding: string) => Promise<void>;
  }

  var utools: any;
}
