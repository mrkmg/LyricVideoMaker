export function createBoundedOutputBuffer(maxBytes: number) {
  let totalBytes = 0;
  let chunks: Buffer[] = [];

  return {
    append(chunk: Buffer) {
      if (maxBytes <= 0 || chunk.length === 0) {
        return;
      }

      if (chunk.length >= maxBytes) {
        chunks = [chunk.subarray(chunk.length - maxBytes)];
        totalBytes = chunks[0].length;
        return;
      }

      chunks.push(chunk);
      totalBytes += chunk.length;

      while (totalBytes > maxBytes && chunks.length > 0) {
        const overflow = totalBytes - maxBytes;
        const oldest = chunks[0];
        if (oldest.length <= overflow) {
          chunks.shift();
          totalBytes -= oldest.length;
          continue;
        }

        chunks[0] = oldest.subarray(overflow);
        totalBytes -= overflow;
      }
    },
    toString() {
      return Buffer.concat(chunks).toString("utf8").trim();
    }
  };
}
