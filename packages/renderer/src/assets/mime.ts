export function getMimeType(path: string): string {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".png")) {
    return "image/png";
  }
  if (lowerPath.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowerPath.endsWith(".gif")) {
    return "image/gif";
  }

  return "image/jpeg";
}

export function getExtensionSuffix(path: string): string {
  const match = /\.[^./\\]+$/.exec(path);
  return match ? match[0] : "";
}
