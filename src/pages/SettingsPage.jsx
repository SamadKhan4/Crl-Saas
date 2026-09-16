import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { passwordSchema } from '../schemas';
import { post, setSession, errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { PageHeader, FormField } from '../components/common/UI';
export default function SettingsPage() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(passwordSchema) });
  return (
    <>
      <PageHeader title="Account settings" description="Manage your account security." />
      <section className="panel form-section">
        <h2>{user.name}</h2>
        <p>
          {user.email} · {user.role}
        </p>
        <form
          className="settings-form"
          onSubmit={handleSubmit(async (values) => {
            setError('');
            try {
              await post('/auth/change-password', values);
              setSession(null);
              toast.success('Password changed. Please sign in again.');
            } catch (e) {
              setError(errorMessage(e));
            }
          })}
        >
          <FormField
            label="Current password"
            type="password"
            autoComplete="current-password"
            {...register('currentPassword')}
            error={errors.currentPassword?.message}
          />
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            {...register('newPassword')}
            error={errors.newPassword?.message}
          />
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <p>Use 12–128 characters. Changing your password ends existing sessions.</p>
          <button className="btn" disabled={isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </section>
    </>
  );
}
