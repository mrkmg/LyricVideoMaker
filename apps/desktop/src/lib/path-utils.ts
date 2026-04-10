export function getFileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

export function stripExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}
