import { describe, it, expect } from 'vitest';
import {
  createAppStore,
  selectOperationStage,
  sessionChanged,
  sessionReady,
  toggleSidebar,
} from '../store';
describe('Redux session and workspace state', () => {
  it('stores only the public user profile and clears workspace state on logout', () => {
    const store = createAppStore();
    store.dispatch(
      sessionChanged({
        id: 'one',
        name: 'Manager',
        role: 'MANAGER',
        accessToken: 'secret',
        password: 'secret',
        status: 'ACTIVE',
      }),
    );
    store.dispatch(sessionReady());
    store.dispatch(toggleSidebar());
    store.dispatch(selectOperationStage('MM'));
    expect(store.getState().session.loading).toBe(false);
    expect(JSON.stringify(store.getState())).not.toContain('secret');
    expect(store.getState().workspace.sidebarCollapsed).toBe(true);
    expect(store.getState().workspace.operationStage).toBe('MM');
    store.dispatch(sessionChanged(null));
    expect(store.getState().session.user).toBeNull();
    expect(store.getState().workspace.sidebarCollapsed).toBe(false);
    expect(store.getState().workspace.operationStage).toBeNull();
  });
  it('isolates stores between app mounts', () => {
    const first = createAppStore(),
      second = createAppStore();
    first.dispatch(sessionChanged({ name: 'Admin', role: 'ADMIN' }));
    expect(second.getState().session.user).toBeNull();
  });
});
