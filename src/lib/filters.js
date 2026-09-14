// Date pickers represent local calendar days; include the entire selected last day.
export function dateRangeParams(params = {}) {
  const result = { ...params };
  for (const key of ['dateFrom', 'dateTo']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params[key] || '')) continue;
    const [year, month, day] = params[key].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (key === 'dateTo') date.setHours(23, 59, 59, 999);
    result[key] = date.toISOString();
  }
  return result;
}
