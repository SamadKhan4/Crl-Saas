import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './features/auth/AuthContext';
import App from './App';
import './styles.css';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import ConnectionNotice from './components/common/ConnectionNotice';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: (count, error) =>
        count < 1 &&
        error.code !== 'INVALID_RESPONSE' &&
        (!error.response || error.response.status >= 500),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ConnectionNotice />
          <App />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>,
);
