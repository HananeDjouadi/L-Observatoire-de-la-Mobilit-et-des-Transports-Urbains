import React from 'react';
import './MetricsBar.css';

const MetricsBar = ({ 
  totalBikes = 111, 
  activeStations = 10, 
  totalStations = 12, 
  closedStations = 2, 
  avgDockLoad = 39 
}) => {
  return (
    <div className="metrics-bar-container">
      <div className="metric-item">
        <span className="metric-label">TOTAL FLEET AVAILABILITY</span>
        <div className="metric-value-row">
          <span className="metric-number">{totalBikes}</span>
          <span className="metric-trend positive">+12% / hr</span>
        </div>
      </div>
      
      <div className="metric-item">
        <span className="metric-label">ACTIVE STATIONS</span>
        <div className="metric-value-row">
          <span className="metric-number">{activeStations}</span>
          <span className="metric-total">/ {totalStations}</span>
        </div>
      </div>

      <div className="metric-item">
        <span className="metric-label">CLOSED STATIONS</span>
        <div className="metric-value-row">
          <span className="metric-number negative">{closedStations}</span>
          <span className="metric-subtext negative">Station Outage</span>
        </div>
      </div>

      <div className="metric-item">
        <span className="metric-label">AVG. DOCK LOAD</span>
        <div className="metric-value-row">
          <span className="metric-number">{avgDockLoad}%</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsBar;
