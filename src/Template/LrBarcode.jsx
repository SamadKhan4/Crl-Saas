import { useLayoutEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function LrBarcode({ value, className = '' }) {
  const barcodeRef = useRef(null);
  const lrNumber = String(value || '').trim();

  useLayoutEffect(() => {
    if (!barcodeRef.current || !lrNumber) return;

    JsBarcode(barcodeRef.current, lrNumber, {
      format: 'CODE128',
      width: 1.6,
      height: 34,
      margin: 0,
      marginTop: 2,
      marginBottom: 2,
      marginLeft: 16,
      marginRight: 16,
      background: '#ffffff',
      lineColor: '#000000',
      displayValue: true,
      text: lrNumber,
      font: 'Arial',
      fontSize: 12,
      textMargin: 3,
    });
  }, [lrNumber]);

  if (!lrNumber) return <strong className={className}>-</strong>;

  return (
    <svg
      ref={barcodeRef}
      className={className}
      role="img"
      aria-label={`Barcode for LR ${lrNumber}`}
    />
  );
}
