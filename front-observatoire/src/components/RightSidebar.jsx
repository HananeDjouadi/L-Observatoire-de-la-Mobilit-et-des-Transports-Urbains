import React from 'react';
import './RightSidebar.css';

const RightSidebar = ({ 
  selectedStation, 
  logs = [] 
}) => {

  // Generate deterministic 12-bar trend data for the occupancy chart based on station ID
  const getOccupancyTrend = () => {
    if (!selectedStation) return [];
    
    const seed = selectedStation.id;
    const trend = [];
    // 12 bars (one every 2 hours)
    for (let i = 0; i < 12; i++) {
      const hour = i * 2;
      // Determinist variation using sine wave
      const phase = seed * 0.17 + hour * 0.25;
      const wave = Math.sin(phase) * 0.35 + 0.55; // ranges between 0.2 and 0.9
      const value = Math.max(10, Math.min(95, Math.round(wave * 100)));
      // Consider peaks at values > 70%
      const isPeak = value > 70;
      trend.push({ hour: `${hour}h`, value, isPeak });
    }
    return trend;
  };

  const [predictions, setPredictions] = React.useState(null);
  const [activeModel, setActiveModel] = React.useState('arima'); // 'arima', 'rf', 'lstm'
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!selectedStation) {
      setPredictions(null);
      return;
    }

    const fetchPredictions = async () => {
      setLoading(true);
      try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiHost = isLocal ? 'http://127.0.0.1:8000' : '';
        const response = await fetch(`${apiHost}/predict/${selectedStation.id}`);
        if (response.ok) {
          const data = await response.json();
          setPredictions(data);
        } else {
          setPredictions(null);
        }
      } catch (err) {
        console.error("Error fetching predictions:", err);
        setPredictions(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
  }, [selectedStation]);

  const getTrendElement = (preds) => {
    if (!preds || preds.length < 4 || !selectedStation) return null;
    const current = selectedStation.velos;
    const future = preds[3];
    const diff = future - current;

    if (diff > 1) {
      return <span className="trend-badge trend-up">▲ Hausse (+{diff})</span>;
    } else if (diff < -1) {
      return <span className="trend-badge trend-down">▼ Baisse ({diff})</span>;
    } else {
      return <span className="trend-badge trend-flat">● Stabilité</span>;
    }
  };

  const trendBars = getOccupancyTrend();
  const freeDocks = selectedStation ? (selectedStation.places_totales - selectedStation.velos) : 0;

  return (
    <aside className="right-sidebar-container">
      {/* STATION DETAIL SECTION */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">STATION DETAIL</h3>
        
        {selectedStation ? (
          <div className="station-detail-card">
            <div className="detail-header-row">
              <h2 className="detail-station-name">{selectedStation.nom}</h2>
              <span className={`detail-status-badge ${selectedStation.est_active ? 'active' : 'inactive'}`}>
                {selectedStation.est_active ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            
            <div className="detail-station-subtitle">
              Station #{selectedStation.id} • {selectedStation.nmarrond || selectedStation.commune || 'Lyon Métropole'}
            </div>

            <div className="detail-stats-grid">
              <div className="detail-stat-box">
                <span className="detail-stat-label">BIKES</span>
                <div className="detail-stat-numbers">
                  <span className="detail-stat-count">{selectedStation.velos}</span>
                  <span className="detail-stat-divider">/</span>
                  <span className="detail-stat-total">{selectedStation.places_totales}</span>
                </div>
              </div>

              <div className="detail-stat-box">
                <span className="detail-stat-label">DOCKS</span>
                <div className="detail-stat-numbers">
                  <span className="detail-stat-count">{freeDocks}</span>
                  <span className="detail-stat-subtext">FREE</span>
                </div>
              </div>
            </div>

            {/* OCCUPANCY TREND CHART */}
            <div className="occupancy-trend-container">
              <span className="occupancy-title">OCCUPANCY TREND (24H)</span>
              <div className="bar-chart-container">
                {trendBars.map((bar, idx) => (
                  <div key={idx} className="chart-bar-wrapper" title={`${bar.hour}: ${bar.value}% occupancy`}>
                    <div 
                      className={`chart-bar-inner ${bar.isPeak ? 'peak' : 'normal'}`}
                      style={{ height: `${bar.value}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* PREDICTIONS & FORECAST SECTION */}
            <div className="predictions-container">
              <span className="predictions-title">PREDICTIONS & FORECAST (1H)</span>
              
              <div className="model-tabs">
                <button 
                  className={`model-tab-btn ${activeModel === 'arima' ? 'active' : ''}`}
                  onClick={() => setActiveModel('arima')}
                >
                  ARIMA
                </button>
                <button 
                  className={`model-tab-btn ${activeModel === 'rf' ? 'active' : ''}`}
                  onClick={() => setActiveModel('rf')}
                >
                  M.L. (Forêt)
                </button>
                <button 
                  className={`model-tab-btn ${activeModel === 'lstm' ? 'active' : ''}`}
                  onClick={() => setActiveModel('lstm')}
                >
                  LSTM (D.L.)
                </button>
              </div>

              {loading ? (
                <div className="predictions-loading-spinner">
                  <div className="spinner"></div>
                  <span>Inférence en cours...</span>
                </div>
              ) : predictions ? (
                <div className="predictions-content">
                  <div className="trend-summary-row">
                    <span className="trend-label">Tendance :</span>
                    {getTrendElement(predictions[activeModel])}
                  </div>
                  
                  <div className="predictions-timeline">
                    {predictions[activeModel] && predictions[activeModel].map((val, idx) => (
                      <div key={idx} className="timeline-step">
                        <span className="step-time">+{15 * (idx + 1)} min</span>
                        <div className="step-bar-wrapper">
                          <div 
                            className={`step-bar-inner ${activeModel}`}
                            style={{ width: `${(val / predictions.places_totales) * 100}%` }}
                          />
                        </div>
                        <span className="step-value">{val} vélos</span>
                      </div>
                    ))}
                  </div>
                  <div className="prediction-mode-info">
                    Source: {predictions.mode || "Calcul local"}
                  </div>
                </div>
              ) : (
                <div className="predictions-error">Aucune prédiction disponible.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="no-station-selected-msg">
            Select a station to inspect its parameters.
          </div>
        )}
      </div>

      {/* RECENT LOGS SECTION */}
      <div className="sidebar-section logs-section">
        <h3 className="sidebar-section-title">RECENT LOGS</h3>
        <div className="logs-console-wrapper">
          {logs.map((log) => (
            <div key={log.id} className="log-entry-row">
              <div className="log-msg-text">{log.message}</div>
              <div className="log-meta-info">
                <span>{log.time}</span>
                <span className="log-meta-divider">•</span>
                <span>Source: {log.source}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;
