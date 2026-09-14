import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import { Modal, Loadingcrleleton, ErrorState } from '../common/UI';
export default function DocumentPreview({ shipmentId, document, onClose }) {
  const [url, setUrl] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true,
      objectUrl;
    api
      .get(`/shipments/${shipmentId}/documents/${document.id}/download`, { responseType: 'blob' })
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([response.data], { type: document.mimeType }));
        setUrl(objectUrl);
      })
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [shipmentId, document]);
  return (
    <Modal title={document.originalFileName} onClose={onClose}>
      {error ? (
        <ErrorState error={error} />
      ) : !url ? (
        <Loadingcrleleton />
      ) : (
        <>
          {document.mimeType.startsWith('image/') ? (
            <img className="document-image" alt="Uploaded LR document" src={url} />
          ) : (
            <p>PDF document ready. Download to view it in your preferred PDF viewer.</p>
          )}
          <a className="btn" download={document.originalFileName} href={url}>
            Download document
          </a>
        </>
      )}
    </Modal>
  );
}
