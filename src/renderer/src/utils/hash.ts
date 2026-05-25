/**
 * 计算文件路径的 SHA-256 哈希（取前 16 位 hex）
 * 用作 electron-store 的 key，避免完整路径
 */
export async function hashFilePath(filePath: string): Promise<string> {
  const data = new TextEncoder().encode(filePath)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}
