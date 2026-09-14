import { useEffect, useRef, useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';
import { validateFile } from '../../lib/workflow';
import { errorMessage } from '../../api/client';
export default function FileUploader({ onUpload, onSuccess, onBusyChange }) {
  const inFlight = useRef(false);
  const inputRef = useRef(null);
  const [file, setFile] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file?.type.startsWith('image/')) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const choose = (f) => {
    if (!f) return;
    const message = validateFile(f);
    setError(message);
    setFile(message ? null : f);
  };
  async function upload() {
    if (inFlight.current) return;
    if (validateFile(file)) {
      setError(validateFile(file));
      return;
    }
    setBusy(true);
    inFlight.current = true;
    onBusyChange?.(true);
    setError('');
    try {
      const body = new FormData();
      body.append('lrImage', file);
      await onUpload(body, (event) =>
        setProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
      );
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onSuccess?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      onBusyChange?.(false);
      setBusy(false);
      setProgress(0);
    }
  }
  return (
    <div>
      <label
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) choose(e.dataTransfer.files[0]);
        }}
      >
        <UploadCloud size={35} />
        <strong>Drop your signed LR here</strong>
        <span>or click to browse files</span>
        <small>JPG, PNG, WEBP or PDF · Maximum 10 MB</small>
        <input
          ref={inputRef}
          aria-label="LR document"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          disabled={busy}
          onChange={(e) => {
            choose(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </label>
      {file && (
        <div className="file-preview">
          {preview ? <img src={preview} alt="Selected LR preview" /> : <FileText />}
          <span>
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {busy && <progress aria-label="Upload progress" max="100" value={progress} />}
      <button type="button" className="btn" disabled={!file || busy} onClick={upload}>
        {busy ? `Uploading ${progress}%…` : 'Upload document'}
      </button>
    </div>
  );
}
