import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado no componente filho:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public handleClearAndReset = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('hsc_centro_medico_consultas_cache_v1');
    } catch {}
    this.handleReset();
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || (this.state.error ? String(this.state.error) : null);

      return (
        <div className="flex flex-1 flex-col items-center justify-center min-h-[50vh] gap-4 p-6 bg-card border border-border/80 rounded-2xl shadow-sm my-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-base font-bold text-foreground">Ocorreu um problema ao carregar o módulo</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {this.props.fallbackMessage || 'Houve uma falha inesperada na renderização deste módulo.'}
            </p>
            {errorMessage && (
              <p className="text-[11px] font-mono text-destructive bg-destructive/5 p-2 rounded-lg border border-destructive/20 break-words mt-2 text-left">
                {errorMessage}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Recarregar Módulo
            </button>
            <button
              onClick={this.handleClearAndReset}
              className="flex items-center gap-2 px-3.5 py-2 bg-muted text-foreground hover:bg-muted/80 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-border/60"
            >
              Limpar Cache e Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

