import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { invoicesApi, manifestsApi, quotationsApi, receiptsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { DeliveryManifestSheet, InvoiceSheet, MoneyReceiptSheet, QuotationSheet } from '../components/tms/TransportPrintLayouts';
import TransportPdfDownload from '../components/tms/TransportPdfDownload';
import { ErrorState, Loadingcrleleton, PageHeader } from '../components/common/UI';

export default function TmsPrintPage({ resource }) {
  const { id } = useParams();
  const { user } = useAuth();
  const targetRef = useRef(null);
  const service = resource === 'manifests' ? manifestsApi : resource === 'invoices' ? invoicesApi : resource === 'money-receipts' ? receiptsApi : quotationsApi;
  const query = useQuery({ queryKey: [resource, id], queryFn: () => service.detail(id) });
  if (query.isPending) return <Loadingcrleleton />;
  if (query.isError) return <ErrorState error={errorMessage(query.error)} retry={query.refetch} />;
  const record = query.data.data;
  const title = resource === 'manifests' ? record.manifestNumber : resource === 'invoices' ? record.invoiceNumber : resource === 'money-receipts' ? record.receiptNumber : record.quotationNumber;
  const base = `/${user.role.toLowerCase()}`;
  return <>
    <PageHeader title={title} description={resource === 'manifests' ? 'Delivery manifest format' : resource === 'invoices' ? 'Credit client tax invoice' : resource === 'money-receipts' ? 'Customer payment acknowledgement' : 'CRL rate quotation'}>
      <Link className="btn secondary" to={`${base}/${resource}`}>Back</Link>
      <button className="btn secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>
      <TransportPdfDownload targetRef={targetRef} documentNumber={title} />
    </PageHeader>
    <div className="transport-document-shell" ref={targetRef}>
      {resource === 'manifests'
        ? <DeliveryManifestSheet record={record} kind="manifest" />
        : resource === 'invoices'
          ? <InvoiceSheet invoice={record} />
          : resource === 'money-receipts'
            ? <MoneyReceiptSheet receipt={record} />
          : <QuotationSheet quotation={record} />}
    </div>
  </>;
}
