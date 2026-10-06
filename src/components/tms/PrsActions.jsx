import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pickupRunSheetsApi } from '../../api/services';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../features/auth/AuthContext';
import { idOf } from '../../lib/workflow';

export default function PrsActions({ prs }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const action = useMutation({
    mutationFn: (decision) => decision
      ? pickupRunSheetsApi.review(idOf(prs), { decision, remarks })
      : pickupRunSheetsApi.dispatch(idOf(prs)),
    onSuccess: () => {
      toast.success('PRS updated');
      cache.invalidateQueries({ queryKey: ['pickup-run-sheets'] });
      cache.invalidateQueries({ queryKey: ['pickup-run-sheet', idOf(prs)] });
      cache.invalidateQueries({ queryKey: ['pickup-requests'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  if (prs.status === 'CANCELLED') return null;
  if (prs.approvalStatus === 'PENDING' && ['ADMIN', 'MANAGER'].includes(user.role)) return (
    <div>
      <input aria-label={`Approval remarks ${prs.prsNumber}`} placeholder="Approval remarks" maxLength={500} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
      <button type="button" className="text-btn" disabled={action.isPending || remarks.trim().length < 2} onClick={() => action.mutate('APPROVED')}>Approve rate</button>
      <button type="button" className="text-btn" disabled={action.isPending || remarks.trim().length < 2} onClick={() => action.mutate('REJECTED')}>Reject rate</button>
    </div>
  );
  if (prs.status === 'DISPATCHED') return null;
  return <button type="button" className="text-btn" disabled={action.isPending || !prs.pickupRequestIds?.length || ['PENDING', 'REJECTED'].includes(prs.approvalStatus)} onClick={() => action.mutate()}>Dispatch PRS</button>;
}
