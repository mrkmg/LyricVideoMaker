export function getFileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

export function stripExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

export function replaceExtension(path: string, extension: string) {
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return `${path.replace(/\.[^\\/.]+$/, "")}${normalizedExtension}`;
}
