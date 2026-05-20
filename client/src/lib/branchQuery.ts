export function withBranchId(path: string, branchId: string | null): string {
  if (!branchId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}branchId=${branchId}`;
}
