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
