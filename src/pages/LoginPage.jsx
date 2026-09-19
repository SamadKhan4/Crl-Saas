import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ShieldCheck, Truck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { loginSchema } from '../schemas';
import { roleHome } from '../routes/Guards';
import { FormField, Loadingcrleleton } from '../components/common/UI';
import { Brand } from '../components/layout/AppLayout';
import { errorMessage } from '../api/client';
export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [show, setShow] = useState(false),
    [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });
  if (loading) return <Loadingcrleleton />;
  if (user && user.status === 'ACTIVE')
    return <Navigate to={roleHome(user.role)} replace />;
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-message">
          <span className="eyebrow">EVERY SHIPMENT. EVERY MILE.</span>
          <h1>
            Your operations.
            <br />
            Moving forward.
          </h1>
          <p>
            One connected workspace for your branches, shipments, and the people who keep them
            moving.
          </p>
          <div className="route-art" aria-hidden="true">
            <div className="route-node">
              ORIGIN<span>Booking confirmed</span>
            </div>
            <div className="route-line">
              <Truck size={36} />
            </div>
            <div className="route-node">
              DESTINATION<span>Delivered with care</span>
            </div>
          </div>
        </div>
        <div className="login-assurance">
          <ShieldCheck size={19} /> Secure access for the crl  team
        </div>
      </section>
      <section className="login-form-side">
        <Link to="/track" className="tracking-link">
          Track a shipment <ArrowRight size={17} />
        </Link>
        <div className="login-form">
          <span className="eyebrow">WELCOME TO crl </span>
          <h2>Good to have you back.</h2>
          <p>Sign in to your transport workspace.</p>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError('');
              try {
                await login(values);
              } catch (e) {
                setError(errorMessage(e));
              }
            })}
          >
            <FormField
              label="Work email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              {...register('email')}
              error={errors.email?.message}
            />
            <div className="password-field">
              <FormField
                label="Password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                {...register('password')}
                error={errors.password?.message}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={show ? 'Hide password' : 'Show password'}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <button className="btn full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in to workspace'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-help">Need access? Contact your crl  administrator.</div>
        </div>
        <small className="login-copyright">
          CRL Transport Management System · Internal team access
        </small>
      </section>
    </div>
  );
}
