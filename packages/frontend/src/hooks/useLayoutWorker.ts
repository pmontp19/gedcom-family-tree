import { useRef, useCallback, useEffect } from 'react';
import type { GraphData } from '@/visualization/dag-builder';
import type { LayoutRequest, LayoutResponse, NodePosition, SerializableGraphData } from '@/visualization/worker-types';

function serializeGraph(graph: GraphData): SerializableGraphData {
  return {
    nodes: graph.nodes,
    links: graph.links,
    familyEntries: Array.from(graph.families.entries()),
  };
}

export function useLayoutWorker() {
  const workerRef = useRef<Worker | null>(null);
  // Keyed by request id: a second layout must not take the first one's answer.
  const pendingRef = useRef(new Map<number, {
    resolve: (positions: NodePosition[]) => void;
    reject: (err: Error) => void;
  }>());
  const seqRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/layout.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<LayoutResponse>) => {
      const pending = pendingRef.current.get(e.data.id);
      if (e.data.type === 'layout-result' && pending) {
        pendingRef.current.delete(e.data.id);
        pending.resolve(e.data.positions);
      }
    };

    worker.onerror = (err) => {
      // An uncaught worker error carries no request id: fail everything waiting.
      for (const pending of pendingRef.current.values()) pending.reject(new Error(err.message));
      pendingRef.current.clear();
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const runLayout = useCallback((graph: GraphData): Promise<NodePosition[]> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }
      const id = ++seqRef.current;
      pendingRef.current.set(id, { resolve, reject });
      const msg: LayoutRequest = { type: 'layout', id, graph: serializeGraph(graph) };
      workerRef.current.postMessage(msg);
    });
  }, []);

  return { runLayout };
}
