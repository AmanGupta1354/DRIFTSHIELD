import { Component, type ReactNode } from 'react';
import { Button } from '../ui/Controls';
import { Empty } from '../ui/Misc';
import { TriangleAlert } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="glass">
        <Empty icon={TriangleAlert} title="This view hit an unexpected error" hint={this.state.error.message}
          action={<Button variant="neon" onClick={() => { try { localStorage.removeItem('driftshield:v1'); } catch { /* ignore */ } location.reload(); }}>Reset local demo state & reload</Button>} />
      </div>
    );
  }
}
