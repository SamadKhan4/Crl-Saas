export default function GstPayer({ value }) {
  return <div style={{ display: 'flex', gap: 10, padding: '4px 6px', fontSize: 9, color: '#000' }}>
    {['TRANSPORTER', 'CUSTOMER'].map((payer) => <span key={payer} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 10, height: 10, border: '1px solid #000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{value === payer ? '✓' : ''}</span>
      Pay by {payer === 'TRANSPORTER' ? 'transporter' : 'customer'}
    </span>)}
  </div>;
}
