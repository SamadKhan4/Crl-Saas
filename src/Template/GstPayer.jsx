export default function GstPayer({ value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: 6, minHeight: 26, padding: '6px', boxSizing: 'border-box', borderBottom: '1px solid #888', fontSize: 9, lineHeight: '12px', color: '#000' }}>
      {['TRANSPORTER', 'CUSTOMER'].map((payer) => (
        <span key={payer} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{ position: 'relative', top: 4, width: 10, height: 10, flexShrink: 0, boxSizing: 'border-box', border: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, lineHeight: '8px', fontWeight: 700 }}>{value === payer ? 'X' : ''}</span>
          <span style={{ lineHeight: '12px', whiteSpace: 'nowrap' }}>Pay by {payer === 'TRANSPORTER' ? 'transporter' : 'customer'}</span>
        </span>
      ))}
    </div>
  );
}
