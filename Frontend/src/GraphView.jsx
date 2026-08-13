import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * GraphView
 * A dependency-free force-directed network graph.
 * Renders accounts as nodes and TRANSFERRED_TO relationships as edges,
 * highlighting flagged accounts and shared-device links.
 *
 * No d3 / react-force-graph needed — just a small physics loop + SVG.
 */
export default function GraphView({ nodes, links }) {
  const containerRef = useRef(null);
  const simNodesRef = useRef([]);
  const rafRef = useRef(null);
  const [, forceRender] = useState(0);
  const [dims, setDims] = useState({ width: 800, height: 520 });
  const [tooltip, setTooltip] = useState(null);
  const dragRef = useRef(null);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const resize = () => setDims({ width: el.clientWidth, height: 520 });
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initialize simulation nodes when data or size changes
  useEffect(() => {
    const { width, height } = dims;
    const existing = new Map(simNodesRef.current.map((n) => [n.id, n]));
    simNodesRef.current = nodes.map((n, i) => {
      const prev = existing.get(n.id);
      if (prev) return { ...prev, ...n };
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      const r = Math.min(width, height) / 3;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * r,
        y: height / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
  }, [nodes, dims.width, dims.height]);

  // Physics loop
  useEffect(() => {
    const { width, height } = dims;

    function tick() {
      const simNodes = simNodesRef.current;
      const byId = new Map(simNodes.map((n) => [n.id, n]));

      // Repulsion between all node pairs
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist2 = dx * dx + dy * dy || 0.01;
          const dist = Math.sqrt(dist2);
          const minDist = 90;
          if (dist < minDist * 4) {
            const force = 1800 / dist2;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (a.dragging !== true) { a.vx += fx; a.vy += fy; }
            if (b.dragging !== true) { b.vx -= fx; b.vy -= fy; }
          }
        }
      }

      // Spring attraction along links
      links.forEach((l) => {
        const a = byId.get(l.source);
        const b = byId.get(l.target);
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const targetLen = 170;
        const force = (dist - targetLen) * 0.02;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (a.dragging !== true) { a.vx += fx; a.vy += fy; }
        if (b.dragging !== true) { b.vx -= fx; b.vy -= fy; }
      });

      // Centering + integration + damping
      simNodes.forEach((n) => {
        if (n.dragging) return;
        n.vx += (width / 2 - n.x) * 0.002;
        n.vy += (height / 2 - n.y) * 0.002;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(30, Math.min(width - 30, n.x));
        n.y = Math.max(30, Math.min(height - 30, n.y));
      });

      forceRender((v) => (v + 1) % 1000000);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [links, dims]);

  const handlePointerDown = useCallback((nodeId) => (e) => {
    e.preventDefault();
    dragRef.current = nodeId;
    const n = simNodesRef.current.find((x) => x.id === nodeId);
    if (n) n.dragging = true;
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const n = simNodesRef.current.find((x) => x.id === dragRef.current);
    if (n) {
      n.x = e.clientX - rect.left;
      n.y = e.clientY - rect.top;
      n.vx = 0;
      n.vy = 0;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragRef.current) {
      const n = simNodesRef.current.find((x) => x.id === dragRef.current);
      if (n) n.dragging = false;
    }
    dragRef.current = null;
  }, []);

  const byId = new Map(simNodesRef.current.map((n) => [n.id, n]));

  return (
    <div className="graph-wrapper" ref={containerRef}>
      <svg
        className="graph-svg"
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
        </defs>

        {/* Edges */}
        {links.map((l, i) => {
          const a = byId.get(l.source);
          const b = byId.get(l.target);
          if (!a || !b) return null;
          const suspicious = Boolean(l.sharedDevice);
          return (
            <g key={i}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={suspicious ? '#f4514f' : '#334155'}
                strokeWidth={suspicious ? 2 : 1.4}
                strokeDasharray={suspicious ? '4 3' : 'none'}
                markerEnd="url(#arrow)"
                opacity={0.85}
              />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 6}
                fill="#94a3b8"
                fontSize="10"
                textAnchor="middle"
              >
                ${l.amount?.toLocaleString?.() ?? l.amount}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {simNodesRef.current.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            onMouseDown={handlePointerDown(n.id)}
            onMouseEnter={() => setTooltip(n)}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: 'grab' }}
          >
            {n.isFlagged && (
              <circle r={20} fill="none" stroke="#f4514f" strokeOpacity={0.35} strokeWidth={6} />
            )}
            <circle
              r={14}
              fill={n.isFlagged ? '#f4514f' : '#4f8cff'}
              stroke="#0b1120"
              strokeWidth={2.5}
            />
            <text
              y={28}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="11"
              fontWeight="600"
            >
              {n.name || n.id}
            </text>
          </g>
        ))}
      </svg>

      <div className="graph-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#4f8cff' }} />
          Monitored
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#f4514f' }} />
          Flagged
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#f4514f', opacity: 0.6 }} />
          Dashed = shared device
        </span>
      </div>

      {tooltip && (
        <div
          className="graph-tooltip"
          style={{ left: tooltip.x + 24, top: tooltip.y - 10 }}
        >
          <div className="tt-title">{tooltip.name || 'Unknown'}</div>
          <div className="tt-row"><span>ID</span><span>{tooltip.id}</span></div>
          <div className="tt-row">
            <span>Status</span>
            <span>{tooltip.isFlagged ? 'High risk' : 'Monitored'}</span>
          </div>
        </div>
      )}
    </div>
  );
}