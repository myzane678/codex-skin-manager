export type ThemeRuntimeState = 'native' | 'pending' | 'applied' | 'compatibility-degraded' | 'recovering';
export type CdpConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';
export type ProxyState = 'disabled' | 'watching' | 'handling-candidate' | 'failed';
export type RecoveryState = 'idle' | 'running' | 'restored' | 'partial' | 'manual-action';

export interface RuntimeState {
  theme: ThemeRuntimeState;
  cdp: CdpConnectionState;
  proxy: ProxyState;
  recovery: RecoveryState;
}

export type RuntimeEvent =
  | { type: 'theme-enabled' }
  | { type: 'theme-disabled' }
  | { type: 'probe-passed'; verified: boolean }
  | { type: 'probe-failed' }
  | { type: 'injection-applied' }
  | { type: 'injection-failed' }
  | { type: 'page-left-welcome' }
  | { type: 'cdp-connecting' }
  | { type: 'cdp-connected' }
  | { type: 'cdp-failed' }
  | { type: 'proxy-enabled' }
  | { type: 'proxy-disabled' }
  | { type: 'recovery-started' }
  | { type: 'recovery-finished'; result: 'restored' | 'partial' | 'manual-action' };

export const nativeRuntimeState: RuntimeState = {
  theme: 'native',
  cdp: 'disconnected',
  proxy: 'disabled',
  recovery: 'idle',
};

export function reduceRuntimeState(state: RuntimeState, event: RuntimeEvent): RuntimeState {
  switch (event.type) {
    case 'theme-enabled':
      return state.theme === 'native' ? { ...state, theme: 'pending' } : state;
    case 'theme-disabled':
      return { ...state, theme: 'native' };
    case 'probe-passed':
      return { ...state, theme: event.verified ? 'applied' : 'applied' };
    case 'probe-failed':
      return { ...state, theme: 'compatibility-degraded' };
    case 'injection-applied':
      return { ...state, theme: 'applied' };
    case 'injection-failed':
      return { ...state, theme: 'compatibility-degraded' };
    case 'page-left-welcome':
      return { ...state, theme: state.theme === 'native' ? 'native' : 'pending' };
    case 'cdp-connecting':
      return { ...state, cdp: 'connecting' };
    case 'cdp-connected':
      return { ...state, cdp: 'connected' };
    case 'cdp-failed':
      return { ...state, cdp: 'failed', theme: state.theme === 'native' ? 'native' : 'compatibility-degraded' };
    case 'proxy-enabled':
      return { ...state, proxy: 'watching' };
    case 'proxy-disabled':
      return { ...state, proxy: 'disabled' };
    case 'recovery-started':
      return { ...state, theme: 'recovering', recovery: 'running' };
    case 'recovery-finished':
      return { ...state, theme: 'native', recovery: event.result };
  }
}
