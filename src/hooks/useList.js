import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
export function useDebounce(value, delay = 350) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return result;
}
export function useList(resource, service, extra = {}) {
  const [params, setParams] = useSearchParams();
  const allowed = [
    'page',
    'limit',
    'search',
    'sortBy',
    'sortOrder',
    'status',
    ...(resource === 'payslips' ? ['employeeId', 'salaryMonth'] : []),
    ...(resource === 'shipments'
      ? ['customerId', 'originBranchId', 'destinationBranchId', 'lrNumber', 'dateFrom', 'dateTo']
      : []),
  ];
  const filters = Object.fromEntries([...params].filter(([key]) => allowed.includes(key)));
  const update = (key, value) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      value ? next.set(key, String(value)) : next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  const query = useQuery({
    queryKey: [resource, { ...filters, ...extra }],
    queryFn: () => service.list({ ...filters, ...extra }),
  });
  return {
    query,
    filters,
    update,
    clear: () => setParams({}),
    sort: (key) =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.set('sortBy', key);
        next.set(
          'sortOrder',
          p.get('sortBy') === key && p.get('sortOrder') === 'asc' ? 'desc' : 'asc',
        );
        next.delete('page');
        return next;
      }),
  };
}
