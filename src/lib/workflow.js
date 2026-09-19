export const statuses = [
  'BOOKED',
  'IN_TRANSIT',
  'RECEIVED',
  'LR_IMAGE_UPLOADED',
  'LR_IMAGE_VERIFIED',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
];
export const label = (value) =>
  String(value || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace('Lr ', 'LR ');
export const idOf = (value) => (typeof value === 'object' ? value?.id || value?._id : value);
export const date = (value) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
export function actionsFor(shipment, user) {
  if (!shipment || !user || user.status !== 'ACTIVE') return [];
  if (user.role === 'EMPLOYEE') return [];
  const admin = user.role === 'ADMIN';
  if (!admin && user.role !== 'MANAGER') return [];
  const origin =
      admin || (!!idOf(user.branchId) && idOf(user.branchId) === idOf(shipment.originBranchId)),
    destination =
      admin ||
      (!!idOf(user.branchId) && idOf(user.branchId) === idOf(shipment.destinationBranchId));
  switch (shipment.currentStatus) {
    case 'BOOKED':
      return origin ? ['edit', 'dispatch', 'cancel'] : [];
    case 'IN_TRANSIT':
      return [...(destination ? ['receive'] : []), ...(origin ? ['cancel'] : [])];
    case 'RECEIVED':
      return destination ? ['upload', 'upload-token'] : [];
    case 'LR_IMAGE_UPLOADED':
      return admin || (user.role === 'MANAGER' && destination) ? ['verify', 'reject'] : [];
    case 'LR_IMAGE_VERIFIED':
      return destination ? ['complete'] : [];
    case 'COMPLETED':
      return admin || (user.role === 'MANAGER' && destination) ? ['close'] : [];
    default:
      return [];
  }
}
export function validateFile(file) {
  if (!file) return 'Choose a file to upload.';
  if (
    !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) ||
    !/\.(jpe?g|png|webp|pdf)$/i.test(file.name)
  )
    return 'Choose a JPG, PNG, WEBP or PDF file.';
  if (file.size > 10 * 1024 * 1024) return 'File must be 10 MB or smaller.';
  if (file.size === 0) return 'The selected file is empty.';
  return '';
}
