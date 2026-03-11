export function isBlobUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('blob:');
}

export async function objectUrlToDataUrl(objectUrl: string): Promise<string> {
  const response = await fetch(objectUrl);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to convert image URL.'));
    reader.readAsDataURL(blob);
  });
}

export async function toPersistableImageUrl(url: string): Promise<string> {
  if (!isBlobUrl(url)) return url;
  return objectUrlToDataUrl(url);
}

export async function toPersistableImageUrls(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map((url) => toPersistableImageUrl(url)));
}
