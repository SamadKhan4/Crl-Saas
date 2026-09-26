import { configureStore, createSlice } from '@reduxjs/toolkit';

const sessionSlice = createSlice({
  name: 'session',
  initialState: { user: null, loading: true },
  reducers: {
    sessionChanged(state, action) {
      const user = action.payload;
      state.user = user
        ? Object.fromEntries(
            ['id', '_id', 'name', 'email', 'role', 'status', 'branchId', 'employeeCode']
              .filter((key) => user[key] !== undefined)
              .map((key) => [key, user[key]]),
          )
        : null;
    },
    sessionReady(state) {
      state.loading = false;
    },
  },
});
const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: { sidebarCollapsed: false, operationStage: null },
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    expandSidebar(state) {
      state.sidebarCollapsed = false;
    },
    selectOperationStage(state, action) {
      state.operationStage = ['FM', 'MM', 'LM'].includes(action.payload) ? action.payload : null;
    },
  },
  extraReducers: (builder) =>
    builder.addCase(sessionSlice.actions.sessionChanged, (state, action) => {
      if (!action.payload) {
        state.sidebarCollapsed = false;
        state.operationStage = null;
      }
    }),
});
export const { sessionChanged, sessionReady } = sessionSlice.actions;
export const { toggleSidebar, expandSidebar, selectOperationStage } = workspaceSlice.actions;
// Access tokens remain in the API client's memory; credentials are never stored in Redux.
export const createAppStore = () =>
  configureStore({
    reducer: { session: sessionSlice.reducer, workspace: workspaceSlice.reducer },
    devTools: import.meta.env.DEV,
  });
