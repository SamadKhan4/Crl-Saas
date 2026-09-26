import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import {
  Package,
  Truck,
  PackageCheck,
  Files,
  CheckCheck,
  Archive,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { useAuth } from '../features/auth/AuthContext';
import { dashboardApi, shipmentsApi, reportsApi } from '../api/services';
import { errorMessage } from '../api/client';
import {
  PageHeader,
  StatCard,
  Loadingcrleleton,
  ErrorState,
  EmptyState,
} from '../components/common/UI';
import ShipmentTable from '../components/shipment/ShipmentTable';
import { selectOperationStage } from '../store';
const colors = [
  '#8b9aa9',
  '#569be2',
  '#e6ae43',
  '#a691d9',
  '#69b8a2',
  '#187761',
  '#657489',
  '#ca8188',
];
function BookingTrend() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  const from = start.toISOString();
  const query = useQuery({
    queryKey: ['reports', 'booking-trend', from],
    queryFn: () => reportsApi.list({ dateFrom: from }),
  });
  const days = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return {
      key: day.toLocaleDateString('en-CA'),
      day: day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      shipments: 0,
    };
  });
  for (const shipment of query.data?.data || []) {
    const day = days.find(
      (item) => item.key === new Date(shipment.createdAt).toLocaleDateString('en-CA'),
    );
    if (day) day.shipments++;
  }
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Shipments over time</h2>
          <p>Daily bookings from the shipment report</p>
        </div>
        <span className="subtle-tag">Last 30 days</span>
      </div>
      {query.isPending ? (
        <Loadingcrleleton />
      ) : query.isError ? (
        <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={days} margin={{ left: 0, right: 25, top: 15, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf1" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} minTickGap={35} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="shipments"
              name="Bookings"
              stroke="#187761"
              fill="#e4f1e9"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
export default function DashboardPage() {
  const { user } = useAuth(),
    admin = user.role === 'ADMIN',
    base = `/${user.role.toLowerCase()}`;
  const dispatch = useDispatch();
  const operationStage = useSelector((state) => state.workspace.operationStage);
  const operationStages = [
    ['FM', 'First Mile', 'Pickup request, agent, LR and PRS', PackageCheck],
    ['MM', 'Middle Mile', 'Hub, manifest and transit movement', Truck],
    ['LM', 'Last Mile', 'Receiving, delivery and POD', CheckCheck],
  ];
  const summary = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.summary });
  const recent = useQuery({
    queryKey: ['shipments', { limit: 6 }],
    queryFn: () => shipmentsApi.list({ limit: 6 }),
  });
  const pending = useQuery({
    queryKey: ['shipments', { status: 'LR_IMAGE_UPLOADED', limit: 4 }],
    queryFn: () => shipmentsApi.list({ status: 'LR_IMAGE_UPLOADED', limit: 4 }),
  });
  const data = summary.data?.data;
  const cards = [
    [admin ? 'Total shipments' : 'My branch shipments', 'totalShipments', Package],
    ['In transit', 'inTransit', Truck],
    ['Received', 'received', PackageCheck],
    ['Pending verification', 'lrImageUploaded', Files],
    ['Completed', 'completed', CheckCheck],
    ['Closed', 'closed', Archive],
  ];
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const distribution = data
    ? [
        ['Booked', 'booked'],
        ['In transit', 'inTransit'],
        ['Received', 'received'],
        ['Pending verification', 'lrImageUploaded'],
        ['LR verified', 'lrImageVerified'],
        ['Completed', 'completed'],
        ['Closed', 'closed'],
        ['Cancelled', 'cancelled'],
      ].map(([name, key]) => ({ name, value: data[key] }))
    : [];
  return (
    <>
      <PageHeader
        title={
          admin
            ? 'Operations overview'
            : user.role === 'MANAGER'
              ? 'Branch management overview'
              : 'Your daily workspace'
        }
        description={`Welcome back, ${user.name?.split(' ')[0]}. Here’s where things stand today.`}
      >
        <Link className="btn" to={`${base}/shipments/create`}>
          <Plus size={18} /> Create new LR
        </Link>
      </PageHeader>
      <section className="mile-selector" aria-labelledby="mile-selector-title">
        <div className="mile-selector-heading">
          <span className="eyebrow">OPERATIONS WORKSPACE</span>
          <h2 id="mile-selector-title">Choose your operation</h2>
          <p>Select a mile to show only its operations in the sidebar.</p>
        </div>
        <div className="mile-selector-actions">
          {operationStages.map(([code, name, description, Icon]) => (
            <button
              key={code}
              type="button"
              className={`mile-selector-button ${operationStage === code ? 'is-active' : ''}`}
              aria-pressed={operationStage === code}
              onClick={() => dispatch(selectOperationStage(code))}
            >
              <span className="mile-selector-icon">
                <Icon size={22} />
              </span>
              <span>
                <strong>{`${name} (${code})`}</strong>
                <em>{description}</em>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </section>
      <div className="overview-banner">
        <div>
          <span className="eyebrow">
            {admin ? 'YOUR NETWORK, CONNECTED' : 'READY FOR THE NEXT MILE'}
          </span>
          <h2>A clear view. A smoother journey.</h2>
          <p>
            {admin
              ? 'Keep your branches aligned and every shipment moving.'
              : 'Book, receive, and manage your branch shipments in one place.'}
          </p>
        </div>
        <div className="banner-art" aria-hidden="true">
          <Package size={32} />
          <span />
          <Truck size={40} />
          <span />
          <PackageCheck size={32} />
        </div>
      </div>
      {summary.isPending ? (
        <Loadingcrleleton />
      ) : summary.isError ? (
        <ErrorState error={errorMessage(summary.error)} retry={summary.refetch} />
      ) : (
        <>
          <div className="stats-grid">
            {cards.map(([name, key, Icon]) => (
              <StatCard key={key} label={name} value={data[key]} icon={Icon} />
            ))}
          </div>
          <div className="stats-grid">
            <StatCard label="Boxes" value={data.totalBoxes} />
            <StatCard label="Out for delivery" value={data.outForDeliveryBoxes} />
            <StatCard label="Delivered boxes" value={data.deliveredBoxes} />
            <StatCard label="Exceptions" value={data.exceptionBoxes} />
            <StatCard label="Revenue" value={money(data.revenue)} />
            <StatCard label="Expense" value={money(data.expense)} />
            <StatCard label="Margin" value={money(data.margin)} />
            <StatCard label="Outstanding" value={money(data.outstanding)} />
          </div>
          <div className="daily-strip">
            <span>
              <b>{data.todayShipments}</b> booked today
            </span>
            <span>
              <b>{data.monthlyShipments}</b> this month
            </span>
            <span>
              <b>{data.received}</b> awaiting LR upload
            </span>
            <span>
              <b>{data.cancelled}</b> cancelled
            </span>
          </div>
          {!admin && (
            <div className="quick-actions">
              {user.role === 'MANAGER' && (
                <Link className="btn secondary" to={`${base}/receive`}>
                  Receive parcel <ArrowUpRight size={16} />
                </Link>
              )}
              <Link className="btn secondary" to={`${base}/shipments`}>
                Find shipment <ArrowUpRight size={16} />
              </Link>
              {user.role === 'MANAGER' && (
                <Link className="btn secondary" to={`${base}/shipments?status=RECEIVED`}>
                  Upload LR image <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
          )}
          <div className="chart-grid">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Shipment status</h2>
                  <p>Your current operational mix</p>
                </div>
                <span className="subtle-tag">All time</span>
              </div>
              {distribution.some((d) => d.value) ? (
                <div className="donut-layout">
                  <ResponsiveContainer width="100%" height={215}>
                    <PieChart>
                      <Pie
                        data={distribution}
                        dataKey="value"
                        innerRadius={65}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {distribution.map((d, i) => (
                          <Cell key={d.name} fill={colors[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="chart-legend">
                    {distribution.map((d, i) => (
                      <div key={d.name}>
                        <i style={{ background: colors[i] }} />
                        <span>{d.name}</span>
                        <b>{d.value}</b>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Your network starts here"
                  description="Shipment data will appear after your first booking."
                />
              )}
            </section>
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>{admin ? 'Branch activity' : 'Booking activity'}</h2>
                  <p>
                    {admin ? 'Shipments by origin branch' : 'Today compared with the current month'}
                  </p>
                </div>
              </div>
              {(admin ? data.branchWise.length : data.monthlyShipments) > 0 ? (
                <ResponsiveContainer width="100%" height={225}>
                  <BarChart
                    data={
                      admin
                        ? data.branchWise
                        : [
                            { branch: 'Today', count: data.todayShipments },
                            { branch: 'This month', count: data.monthlyShipments },
                          ]
                    }
                    margin={{ left: -20, right: 15, top: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf1" />
                    <XAxis
                      dataKey="branch"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="Shipments"
                      fill="#187761"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No activity yet"
                  description="Bookings will appear here as they are created."
                />
              )}
            </section>
          </div>
        </>
      )}
      {admin && <BookingTrend />}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent shipments</h2>
            <p>The latest movement across your workspace</p>
          </div>
          <Link className="table-action" to={`${base}/shipments`}>
            View all <ArrowUpRight size={16} />
          </Link>
        </div>
        {recent.isPending ? (
          <Loadingcrleleton />
        ) : recent.isError ? (
          <ErrorState error={errorMessage(recent.error)} retry={recent.refetch} />
        ) : (
          <ShipmentTable compact base={base} rows={recent.data.data} />
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{admin ? 'Pending LR verifications' : 'Awaiting verification'}</h2>
            <p>Documents ready for administrator review</p>
          </div>
          <Link className="table-action" to={`${base}/documents`}>
            Open documents <ArrowUpRight size={16} />
          </Link>
        </div>
        {pending.isPending ? (
          <Loadingcrleleton />
        ) : pending.isError ? (
          <ErrorState error={errorMessage(pending.error)} retry={pending.refetch} />
        ) : (
          <ShipmentTable compact base={base} rows={pending.data.data} />
        )}
      </section>
    </>
  );
}
