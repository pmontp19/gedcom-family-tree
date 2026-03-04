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
  const pendingRef = useRef<{
    resolve: (positions: NodePosition[]) => void;
    reject: (err: Error) => void;
  } | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/layout.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<LayoutResponse>) => {
      if (e.data.type === 'layout-result' && pendingRef.current) {
        pendingRef.current.resolve(e.data.positions);
        pendingRef.current = null;
      }
    };

    worker.onerror = (err) => {
      if (pendingRef.current) {
        pendingRef.current.reject(new Error(err.message));
        pendingRef.current = null;
      }
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
      pendingRef.current = { resolve, reject };
      const msg: LayoutRequest = { type: 'layout', graph: serializeGraph(graph) };
      workerRef.current.postMessage(msg);
    });
  }, []);

  return { runLayout };
}
