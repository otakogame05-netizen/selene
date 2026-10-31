export type ImportStatus = 'added' | 'existing' | 'failed';
export interface ImportItem { name: string; status: ImportStatus; bookId: string | null; title: string | null; message: string }
export interface ImportReport { items: ImportItem[] }
export const importStatusLabels: Record<ImportStatus, string> = { added: 'Adicionado', existing: 'Já existente', failed: 'Falhou' };

export function importSummary(report: ImportReport) {
  const counts = { added: 0, existing: 0, failed: 0, total: report.items.length };
  for (const item of report.items) counts[item.status] += 1;
  return counts;
}

export function filterImportItems(report: ImportReport, status: ImportStatus | 'all') {
  return report.items.filter(item => status === 'all' || item.status === status);
}
