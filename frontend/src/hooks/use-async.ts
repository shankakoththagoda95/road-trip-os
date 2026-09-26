import { type DependencyList, useCallback, useEffect, useState } from 'react';

import { errorMessage } from '@/api/client';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; error: unknown }
  | { status: 'success'; data: T };

/**
 * Run an async loader when `deps` change; `reload` runs it again.
 * `load` returning undefined (e.g. inputs not ready) keeps it loading.
 */
export function useAsync<T>(
  load: () => Promise<T> | undefined,
  deps: DependencyList,
) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const promise = load();

    if (!promise) {
      return;
    }

    let cancelled = false;

    promise
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'success', data });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: 'error', message: errorMessage(error), error });
        }
      });

    return () => {
      cancelled = true;
    };
    // `load` is recreated every render; callers list its inputs in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return [state, reload] as const;
}
