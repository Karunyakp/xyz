import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles.css';
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="onboarding">
        <h1>Something needs a fresh start.</h1>
        <p>{this.state.error.message}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload PLANORA
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
