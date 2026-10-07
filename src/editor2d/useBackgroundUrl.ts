import { useEffect, useState } from 'react';
import { getDefaultImageStore } from '../persistence/images';

type State = { url: string | null; missing: boolean };

export function useBackgroundUrl(ref: string | undefined): State {
  const [state, setState] = useState<State>({ url: null, missing: false });
  useEffect(() => {
    if (!ref) {
      setState({ url: null, missing: false });
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    getDefaultImageStore()
      .get(ref)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setState({ url: null, missing: true });
          return;
        }
        url = URL.createObjectURL(blob);
        setState({ url, missing: false });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, missing: true });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ref]);
  return state;
}
