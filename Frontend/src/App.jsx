import React, { useState, useEffect } from 'react';
import './App.css';
import GraphView from './GraphView';

export default function App() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('graph'); // 'graph' | 'table'

  const fetchGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/detect-fraud');
      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Failed to connect to CognoDB backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const flaggedCount = data.nodes?.filter((n) => n.isFlagged).length || 0;
  const sharedDeviceCount = data.links?.filter((l) => l.sharedDevice).length || 0;
  const totalAmount = data.links?.reduce((sum, l) => sum + (l.amount || 0), 0) || 0;

  return (
    <div className="dashboard-container">
      <header className="header">
        <div className="header-title">
          <h1>
            <span className="status-dot" />
            Sentinel Graph Fraud Detector
          </h1>
          <p>Live CognoDB mule network traversal</p>
        </div>
        <div className="header-actions">
          <button onClick={fetchGraphData} className="refresh-btn" disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh Graph'}
          </button>
        </div>
      </header>

      {/* ERROR STATE */}
      {error && (
        <div className="state-card error-card">
          <h3>Connection Error</h3>
          <p>{error}</p>
          <p className="subtext">Ensure your FastAPI backend and CognoDB Cloud database are reachable.</p>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && !error && (
        <div className="state-card loading-card">
          <div className="spinner"></div>
          <p>Traversing graph relationships in CognoDB Cloud…</p>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && data.nodes?.length === 0 && (
        <div className="state-card empty-card">
          <h3>No Fraud Rings Detected</h3>
          <p>No circular transactions or shared device clusters were found in the current dataset.</p>
        </div>
      )}

      {/* DATA DASHBOARD STATE */}
      {!loading && !error && data.nodes?.length > 0 && (
        <main>
          <div className="stat-strip">
            <div className="stat-pill">
              <div className="stat-value">{data.nodes.length}</div>
              <div className="stat-label">Accounts</div>
            </div>
            <div className="stat-pill danger">
              <div className="stat-value">{flaggedCount}</div>
              <div className="stat-label">Flagged</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value">{data.links?.length || 0}</div>
              <div className="stat-label">Transfers</div>
            </div>
            <div className="stat-pill danger">
              <div className="stat-value">{sharedDeviceCount}</div>
              <div className="stat-label">Shared-device links</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value">${totalAmount.toLocaleString()}</div>
              <div className="stat-label">Total volume</div>
            </div>
          </div>

          <div className="view-tabs">
            <button
              className={`view-tab ${view === 'graph' ? 'active' : ''}`}
              onClick={() => setView('graph')}
            >
              Network Graph
            </button>
            <button
              className={`view-tab ${view === 'table' ? 'active' : ''}`}
              onClick={() => setView('table')}
            >
              Table View
            </button>
          </div>

          {view === 'graph' && (
            <section className="section-card">
              <h2>
                Mule Network Traversal
                <span className="count-badge">{data.nodes.length} nodes · {data.links?.length || 0} edges</span>
              </h2>
              <GraphView nodes={data.nodes} links={data.links} />
            </section>
          )}

          {view === 'table' && (
            <>
              <section className="section-card">
                <h2>
                  Flagged Accounts
                  <span className="count-badge">{data.nodes.length}</span>
                </h2>
                <div className="node-grid">
                  {data.nodes.map((node) => (
                    <div key={node.id} className={`node-card ${node.isFlagged ? 'flagged' : ''}`}>
                      <span className="badge">{node.isFlagged ? 'HIGH RISK' : 'MONITORED'}</span>
                      <h4>{node.name || 'Unknown User'}</h4>
                      <code>{node.id}</code>
                    </div>
                  ))}
                </div>
              </section>

              <section className="section-card">
                <h2>
                  Detected Suspicious Transfers
                  <span className="count-badge">{data.links?.length || 0}</span>
                </h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sender</th>
                      <th>Recipient</th>
                      <th>Amount</th>
                      <th>Shared Device Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.links?.map((link, idx) => (
                      <tr key={idx}>
                        <td><code>{link.source}</code></td>
                        <td><code>{link.target}</code></td>
                        <td className="amount">${link.amount ? link.amount.toLocaleString() : '0'}</td>
                        <td>
                          {link.sharedDevice ? (
                            <span className="risk-tag">{link.sharedDevice}</span>
                          ) : (
                            <span className="clean-tag">Standard Transfer</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </main>
      )}
    </div>
  );
}