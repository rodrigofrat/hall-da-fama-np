import { google } from 'googleapis';
import { AUX_TABS, CONFIG_CELLS, HISTORY, MAIN_TABS, colIndex } from './sheet-map';
import { mergeColumnRanges, type Grid, type Workbook } from './workbook';

/**
 * Leitura SOMENTE LEITURA via Google Sheets API com conta de serviço.
 * valueRenderOption=FORMATTED_VALUE preserva IDs longos como texto e devolve os
 * valores já calculados pelas fórmulas da planilha.
 */
export async function readWorkbooks(opts: { credentialsJson: string; mainId: string; auxId?: string }) {
  const credentials = JSON.parse(opts.credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const q = (tab: string, range: string) => `'${tab.replace(/'/g, "''")}'!${range}`;
  const requests: { key: string; range: string; startCol: number }[] = [];
  for (const spec of Object.values(MAIN_TABS)) {
    for (const r of spec.ranges) requests.push({ key: spec.tab, range: q(spec.tab, r), startCol: colIndex(r.split(':')[0]) });
  }
  requests.push({ key: CONFIG_CELLS.tab, range: q(CONFIG_CELLS.tab, CONFIG_CELLS.range), startCol: 0 });
  requests.push({ key: HISTORY.tab, range: q(HISTORY.tab, HISTORY.range), startCol: 0 });

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: opts.mainId,
    ranges: requests.map((r) => r.range),
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
    majorDimension: 'ROWS',
  });
  const grouped = new Map<string, { startCol: number; values: any[][] }[]>();
  res.data.valueRanges?.forEach((vr, i) => {
    const req = requests[i];
    if (!grouped.has(req.key)) grouped.set(req.key, []);
    grouped.get(req.key)!.push({ startCol: req.startCol, values: (vr.values ?? []) as any[][] });
  });
  const main: Workbook = { tabs: {} };
  for (const [k, parts] of grouped) main.tabs[k] = mergeColumnRanges(parts);

  let aux: Workbook | null = null;
  if (opts.auxId) {
    const tabs = Object.values(AUX_TABS);
    const meta = await sheets.spreadsheets.get({ spreadsheetId: opts.auxId, fields: 'sheets.properties.title' });
    const existing = new Set(meta.data.sheets?.map((s) => s.properties?.title));
    const present = tabs.filter((t) => existing.has(t));
    aux = { tabs: {} };
    if (present.length) {
      const r = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: opts.auxId,
        ranges: present.map((t) => q(t, 'A:Z')),
        valueRenderOption: 'FORMATTED_VALUE',
      });
      r.data.valueRanges?.forEach((vr, i) => (aux!.tabs[present[i]] = (vr.values ?? []) as Grid));
    }
  }
  return { main, aux };
}
