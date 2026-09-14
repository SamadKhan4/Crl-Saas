import { Provider, useDispatch, useSelector, useStore } from 'react-redux';
import { createAppStore, sessionChanged, sessionReady } from '../../store';
import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  authenticateDemo,
  logoutSession,
  onSessionChange,
  refreshSession,
  setSession,
} from '../../api/client';
import { writeStorage } from '../../lib/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [store] = useState(createAppStore);
  return <Provider store={store}><SessionBridge>{children}</SessionBridge></Provider>;
}

function SessionBridge({ children }) {
  const { user, loading } = useSelector((state) => state.session);
  const dispatch = useDispatch();
  const store = useStore();
  const cache = useQueryClient();

  useEffect(() => {
    onSessionChange((next) => {
      if (!next || store.getState().session.user?.id !== next.id) cache.clear();
      dispatch(sessionChanged(next));
    });
    let active = true;
    const restoreSession = async () => {
      let shouldRestore = false;
      try {
        shouldRestore = window.localStorage.getItem('crl-remember') === 'true';
      } catch {
        // Storage can be blocked; the secure refresh cookie is only used when
        // the user explicitly chose to stay signed in.
      }
      if (!shouldRestore) {
        if (active) setSession(null);
        if (active) dispatch(sessionReady());
        return;
      }
      try {
        const session = await refreshSession();
        if (active) setSession(session);
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) dispatch(sessionReady());
      }
    };
    void restoreSession();
    return () => {
      active = false;
      onSessionChange(() => {});
    };
  }, [cache, dispatch, store]);

  const login = async (values, remember) => {
    const session = await authenticateDemo(values);
    cache.clear();
    writeStorage('localStorage', 'crl-remember', String(remember));
    setSession(session);
  };
  const logout = async () => {
    writeStorage('localStorage', 'crl-remember', null);
    cache.clear();
    await logoutSession();
  };
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
