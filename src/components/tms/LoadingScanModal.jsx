import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { middleMileApi } from '../../api/services';
import { errorMessage } from '../../api/client';
import { idOf } from '../../lib/workflow';
import { ErrorState, Modal, StatCard } from '../common/UI';

export default function LoadingScanModal({ tally, onClose, onScanned }) {
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState('');
  const detail = useQuery({ queryKey: ['loading-tally', idOf(tally)], queryFn: () => middleMileApi.tallies.detail(idOf(tally)) });
  const current = detail.data?.data || tally;
  const scanned = new Set((current.items || []).flatMap((item) => item.scannedBarcodes || []));
  const scan = useMutation({
    mutationFn: () => middleMileApi.scanTally(idOf(tally), barcode.trim()),
    onSuccess: async () => { setBarcode(''); setError(''); await detail.refetch(); onScanned(); },
    onError: (reason) => setError(errorMessage(reason)),
  });
  return <Modal title={`Scan ${tally.tallyNumber}`} onClose={onClose}>
    <div className="stats-grid"><StatCard label="LRs" value={current.totalLrs} /><StatCard label="Expected Packages" value={current.totalPackages} /><StatCard label="Scanned" value={scanned.size} /></div>
    <p>Scan or type the barcode printed on each package label, including its package suffix. Each package must be scanned separately.</p>
    {detail.isError ? <ErrorState error={errorMessage(detail.error)} retry={detail.refetch} /> : <div>
      <strong>Expected package barcodes</strong>
      {detail.isPending ? <p>Loading barcodes…</p> : <ul>{(current.packages || []).map((unit) => <li key={unit.barcode}><code>{unit.barcode}</code> — {scanned.has(unit.barcode) ? 'Scanned' : 'Pending'}</li>)}</ul>}
    </div>}
    <form onSubmit={(event) => { event.preventDefault(); setError(''); scan.mutate(); }}>
      <div className="form-grid"><label className="full-span">Package Barcode<input required autoFocus value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder={current.packages?.[0]?.barcode || 'LRNUMBER-01OF3'} /></label></div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="modal-footer"><button type="button" className="btn secondary" onClick={onClose}>Close</button><button className="btn" disabled={scan.isPending || !barcode.trim()}>{scan.isPending ? 'Scanning…' : 'Scan Package'}</button></div>
    </form>
  </Modal>;
}
