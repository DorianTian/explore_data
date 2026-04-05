'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-6 rounded-lg border border-border bg-muted/20 text-sm text-muted">
          图表渲染失败：{this.state.error?.message ?? '未知错误'}
        </div>
      );
    }
    return this.props.children;
  }
}
