/** Resolve public assets against the app document, including GitHub Pages subpaths. */
export function assetUrl(relativePath: string): string {
  return new URL(import.meta.env.BASE_URL + relativePath, document.baseURI).href;
}
