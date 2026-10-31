import { useEffect, useRef } from 'react';
import { desktop } from '../services/library';

export function useDesktopClose(flush: () => Promise<void>, reportError: (error: unknown) => void) {
  const latest = useRef({ flush, reportError });
  latest.current = { flush, reportError };

  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let closing = false;
    let unlisten: (() => void) | undefined;
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      if (disposed) return;
      const window = getCurrentWindow();
      const stop = await window.onCloseRequested(event => {
        event.preventDefault();
        if (closing) return;
        closing = true;
        void latest.current.flush()
          .then(() => window.destroy())
          .catch(error => latest.current.reportError(`Não foi possível salvar antes de fechar. Tente novamente. ${String(error)}`))
          .finally(() => { closing = false; });
      });
      if (disposed) stop();
      else unlisten = stop;
    }).catch(error => latest.current.reportError(error));
    return () => { disposed = true; unlisten?.(); };
  }, []);
}
