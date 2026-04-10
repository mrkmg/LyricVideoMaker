export interface PreviewQueueSessionState<TSession> {
  key: string;
  session: TSession;
}

export interface PreviewQueueRenderResult<TResponse> {
  response: TResponse;
  sessionKey: string;
  reusedSession: boolean;
}

export interface PreviewRenderQueueOptions<TRequest, TSession, TResponse> {
  createSession(request: TRequest): Promise<PreviewQueueSessionState<TSession>>;
  disposeSession(session: PreviewQueueSessionState<TSession>): Promise<void>;
  getSessionKey(request: TRequest): string;
  render(
    session: PreviewQueueSessionState<TSession>,
    request: TRequest
  ): Promise<PreviewQueueRenderResult<TResponse>>;
}

interface PendingBatch<TRequest, TResponse> {
  request: TRequest;
  waiters: Array<{
    resolve: (value: TResponse) => void;
    reject: (error: unknown) => void;
  }>;
}

export function createLatestOnlyPreviewRenderQueue<TRequest, TSession, TResponse>(
  options: PreviewRenderQueueOptions<TRequest, TSession, TResponse>
) {
  let sessionState: PreviewQueueSessionState<TSession> | null = null;
  let activeBatch: PendingBatch<TRequest, TResponse> | null = null;
  let queuedBatch: PendingBatch<TRequest, TResponse> | null = null;
  let activeLoop: Promise<void> | null = null;

  return {
    async render(request: TRequest): Promise<TResponse> {
      return await new Promise<TResponse>((resolve, reject) => {
        if (activeBatch) {
          if (queuedBatch) {
            queuedBatch.request = request;
            queuedBatch.waiters.push({ resolve, reject });
            return;
          }

          queuedBatch = {
            request,
            waiters: [{ resolve, reject }]
          };
          return;
        }

        activeBatch = {
          request,
          waiters: [{ resolve, reject }]
        };
        activeLoop ??= drainQueue();
      });
    },
    async dispose() {
      const pending = queuedBatch;
      queuedBatch = null;
      activeBatch = null;

      const disposeError = new Error("Preview queue disposed.");
      for (const waiter of pending?.waiters ?? []) {
        waiter.reject(disposeError);
      }

      if (activeLoop) {
        await activeLoop.catch(() => undefined);
      }

      if (sessionState) {
        await options.disposeSession(sessionState);
        sessionState = null;
      }
    }
  };

  async function drainQueue() {
    try {
      while (activeBatch) {
        const batch = activeBatch;

        try {
          const targetKey = options.getSessionKey(batch.request);
          if (!sessionState || sessionState.key !== targetKey) {
            if (sessionState) {
              await options.disposeSession(sessionState);
            }
            sessionState = await options.createSession(batch.request);
          }

          const result = await options.render(sessionState, batch.request);
          for (const waiter of batch.waiters) {
            waiter.resolve(result.response);
          }
        } catch (error) {
          if (sessionState) {
            await options.disposeSession(sessionState).catch(() => undefined);
            sessionState = null;
          }
          for (const waiter of batch.waiters) {
            waiter.reject(error);
          }
        }

        activeBatch = queuedBatch;
        queuedBatch = null;
      }
    } finally {
      activeLoop = null;
    }
  }
}
