import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../features/auth/AuthContext';
import { actionsFor, idOf } from '../../lib/workflow';
import { shipmentsApi } from '../../api/services';
import { post, errorMessage } from '../../api/client';
import { shipmentFields } from '../../schemas';
import { Modal, FormField, StatusBadge } from '../common/UI';
import FileUploader from '../forms/FileUploader';
import { copyText } from '../../lib/clipboard';
const names = {
  edit: 'Edit shipment',
  dispatch: 'Mark in transit',
  cancel: 'Cancel shipment',
  receive: 'Receive parcel',
  upload: 'Upload LR',
  verify: 'Verify document',
  reject: 'Reject document',
  complete: 'Complete shipment',
  close: 'Close shipment',
  'upload-token': 'Create customer upload link',
  override: 'Admin correction',
};
export default function ShipmentActions({ shipment, only }) {
  const { user } = useAuth();
  const [action, setAction] = useState('');
  const allowed = actionsFor(shipment, user).filter((a) => !only || only.includes(a));
  return (
    <>
      <div className="actions">
        {allowed.map((a) => (
          <button
            key={a}
            className={`btn ${a === 'cancel' || a === 'edit' || a === 'upload-token' ? 'secondary' : ''}`}
            onClick={() => setAction(a)}
          >
            {names[a]}
          </button>
        ))}
        {!only && user.role === 'ADMIN' && (
          <button className="btn secondary" onClick={() => setAction('override')}>
            Admin correction
          </button>
        )}
      </div>
      {action && (
        <ActionModal
          key={action}
          action={action}
          shipment={shipment}
          onClose={() => setAction('')}
        />
      )}
    </>
  );
}
function ActionModal({ action, shipment, onClose }) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [link, setLink] = useState('');
  const editing = action === 'edit' || action === 'override';
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm({
    resolver: editing ? zodResolver(shipmentFields) : undefined,
    defaultValues: editing
      ? {
          senderName: shipment.senderName,
          receiverName: shipment.receiverName,
          receiverMobile: shipment.receiverMobile || '',
          packageCount: shipment.packageCount,
          weightKg: shipment.weightKg,
          description: shipment.description || '',
          expectedDeliveryDate: shipment.expectedDeliveryDate?.slice(0, 10) || '',
        }
      : { location: shipment.currentLocation || '', remarks: '' },
  });
  const [reason, setReason] = useState('');
  function invalidate() {
    for (const key of ['shipments', 'shipment', 'history', 'dashboard', 'reports', 'documents'])
      cache.invalidateQueries({ queryKey: [key] });
  }
  function success() {
    invalidate();
    toast.success(`${names[action]} successful`);
    onClose();
  }
  async function submit(values) {
    if (editing) {
      const cleared = ['receiverMobile', 'expectedDeliveryDate'].find(
        (key) => shipment[key] && values[key] === undefined,
      );
      if (cleared) {
        setFieldError(cleared, {
          message: 'This field cannot be cleared. Enter a replacement value.',
        });
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const id = idOf(shipment);
      if (editing) {
        if (action === 'override')
          await shipmentsApi.action(id, 'admin-override', { changes: values, reason });
        else await shipmentsApi.update(id, values);
      } else if (action === 'upload-token') {
        const result = await shipmentsApi.action(id, 'lr-upload-token');
        setLink(`${window.location.origin}/upload-lr/${result.data.token}`);
        toast.success(`Link expires in ${result.data.expiresInMinutes} minutes`);
        return;
      } else {
        let endpoint = action,
          body = {};
        if (action === 'dispatch' || action === 'cancel') {
          endpoint = 'status';
          body = {
            status: action === 'dispatch' ? 'IN_TRANSIT' : 'CANCELLED',
            location: values.location,
            remarks: values.remarks,
          };
        }
        if (action === 'receive') body = { location: values.location, remarks: values.remarks };
        if (action === 'verify' || action === 'reject') {
          endpoint = 'lr-image/verify';
          body = { status: action === 'verify' ? 'VERIFIED' : 'REJECTED', remarks: values.remarks };
        }
        await shipmentsApi.action(id, endpoint, body);
      }
      success();
    } catch (e) {
      setError(errorMessage(e));
      invalidate();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={names[action]} onClose={() => !busy && onClose()}>
      <div className="action-context">
        <strong>{shipment.lrNumber}</strong>
        <StatusBadge status={shipment.currentStatus} />
        <p>
          {shipment.originBranchId?.name} → {shipment.destinationBranchId?.name}
        </p>
      </div>
      {action === 'upload' ? (
        <FileUploader
          onBusyChange={setBusy}
          onUpload={(body, onUploadProgress) =>
            post(`/shipments/${idOf(shipment)}/lr-image`, body, { onUploadProgress })
          }
          onSuccess={success}
        />
      ) : link ? (
        <div className="field">
          <label htmlFor="upload-link">One-time customer upload link</label>
          <input id="upload-link" readOnly value={link} />
          <button
            className="btn"
            onClick={() =>
              copyText(link)
                .then(() => toast.success('Link copied'))
                .catch(() => toast.error('Unable to copy link'))
            }
          >
            Copy link
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit)}>
          {editing ? (
            <>
              <div className="form-grid">
                {[
                  ['senderName', 'Consignor name', 'text'],
                  ['receiverName', 'Consignee name', 'text'],
                  ['receiverMobile', 'Consignee mobile', 'text'],
                  ['packageCount', 'Packages', 'number'],
                  ['weightKg', 'Weight (kg)', 'number'],
                  ['expectedDeliveryDate', 'Expected delivery', 'date'],
                  ['description', 'Description', 'text'],
                ].map(([key, caption, type]) => (
                  <FormField
                    key={key}
                    label={caption}
                    type={type}
                    step={key === 'weightKg' ? 'any' : undefined}
                    {...register(key)}
                    error={errors[key]?.message}
                  />
                ))}
              </div>
              {action === 'override' && (
                <FormField
                  label="Reason for correction"
                  name="reason"
                  required
                  minLength={8}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
            </>
          ) : (
            <>
              {['dispatch', 'cancel', 'receive'].includes(action) && (
                <FormField
                  label={action === 'receive' ? 'Receiving location' : 'Location'}
                  required
                  minLength={2}
                  maxLength={120}
                  {...register('location')}
                />
              )}
              {['dispatch', 'cancel', 'receive', 'verify', 'reject'].includes(action) && (
                <FormField
                  label={action === 'reject' ? 'Rejection reason' : 'Remarks'}
                  required={['verify', 'reject'].includes(action)}
                  minLength={['verify', 'reject'].includes(action) ? 2 : undefined}
                  maxLength={500}
                  {...register('remarks')}
                />
              )}
              <p>
                Confirm this action for <b>{shipment.lrNumber}</b>.{' '}
                {action === 'receive' && `Receiving branch: ${shipment.destinationBranchId?.name}.`}{' '}
                {action === 'close' && 'This is the final step of the shipment workflow.'}
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="modal-footer">
            <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button className="btn" disabled={busy}>
              {busy ? 'Saving…' : `Confirm ${names[action].toLowerCase()}`}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
