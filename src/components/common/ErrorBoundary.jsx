import { Component } from 'react';
import { useLocation } from 'react-router-dom';
export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(previous) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="empty" role="alert">
        <h2>This page could not be displayed</h2>
        <p>
          Try this page again, or reload to get the latest application files. Unsaved form entries
          may need to be entered again.
        </p>
        <div className="actions">
          <button className="btn" onClick={() => this.setState({ failed: false })}>
            Try page again
          </button>
          <button className="btn secondary" onClick={() => window.location.reload()}>
            Reload application
          </button>
          <a className="btn secondary" href="/">
            Go to home
          </a>
        </div>
      </section>
    );
  }
}
export function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}
