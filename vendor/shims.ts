// Minimal stand-ins for doocs/md internal helpers used by vendored files.
export const asAlertRenderer = (fn: any) => fn
export const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
