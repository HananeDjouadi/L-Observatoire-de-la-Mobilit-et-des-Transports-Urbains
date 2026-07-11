import React from 'react';
import './LeftSidebar.css';

const LeftSidebar = ({
  filterType = 'all',
  setFilterType,
  pipeline = { topic: 'velov.events.raw', sink: 'postgres/stations', lag: '242 ms', brokers: '3 / 3 up' },
  capacityThreshold = { min: 0, max: 40 },
  setCapacityThreshold,
  autoRefreshRate = '2.2s',
  stations = [],
  selectedStationId,
  setSelectedStationId,
  searchQuery = '',
  setSearchQuery
}) => {
  return (
    <aside className="left-sidebar-container">
      {/* INSTANT QUERY */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">INSTANT QUERY</h3>
        <div className="query-filters">
          <button
            className={`filter-btn ${filterType === 'closed' ? 'active' : ''}`}
            onClick={() => setFilterType(filterType === 'closed' ? 'all' : 'closed')}
          >
            Closed stations now
          </button>
          <button
            className={`filter-btn ${filterType === 'high_demand' ? 'active' : ''}`}
            onClick={() => setFilterType(filterType === 'high_demand' ? 'all' : 'high_demand')}
          >
            High demand (&gt;90% full)
          </button>
          <button
            className={`filter-btn ${filterType === 'empty' ? 'active' : ''}`}
            onClick={() => setFilterType(filterType === 'empty' ? 'all' : 'empty')}
          >
            Empty stations
          </button>
          <button
            className="filter-btn reset-btn"
            onClick={() => {
              setFilterType('all');
              if (setSearchQuery) setSearchQuery('');
              if (setCapacityThreshold) setCapacityThreshold({ min: 0, max: 40 });
            }}
          >
            Reset filter
          </button>
        </div>
      </div>

      {/* KAFKA PIPELINE */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">KAFKA PIPELINE</h3>
        <div className="pipeline-stats">
          <div className="pipeline-row">
            <span className="pipeline-label">topic</span>
            <span className="pipeline-value">{pipeline.topic}</span>
          </div>
          <div className="pipeline-row">
            <span className="pipeline-label">sink</span>
            <span className="pipeline-value">{pipeline.sink}</span>
          </div>
          <div className="pipeline-row">
            <span className="pipeline-label">lag</span>
            <span className="pipeline-value active-green">{pipeline.lag}</span>
          </div>
          <div className="pipeline-row">
            <span className="pipeline-label">brokers</span>
            <span className="pipeline-value active-green">{pipeline.brokers}</span>
          </div>
        </div>
      </div>

      {/* GLOBAL FILTERS */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">GLOBAL FILTERS</h3>
        <div className="global-filters">
          <span className="filter-item-label">Capacity Threshold</span>

          {/* Custom Dual Sliders or Range Inputs for Capacity */}
          <div className="capacity-range-inputs">
            <input
              type="range"
              min="0"
              max="50"
              value={capacityThreshold.min}
              onChange={(e) => setCapacityThreshold({ ...capacityThreshold, min: parseInt(e.target.value) || 0 })}
              className="capacity-slider"
            />
            <div className="capacity-range-labels">
              <span>Min: {capacityThreshold.min} slots</span>
            </div>
          </div>

          <div className="refresh-rate-row">
            <span className="filter-item-label">Auto-refresh rate</span>
            <span className="refresh-value">{autoRefreshRate}</span>
          </div>
        </div>
      </div>

      {/* STATION LIST */}
      <div className="sidebar-section station-list-section">
        <h3 className="sidebar-section-title">STATION LIST</h3>
        <input
          type="text"
          placeholder="Search stations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sidebar-search-input"
        />
        <div className="sidebar-station-list">
          {stations.map(station => (
            <div
              key={station.id}
              className={`sidebar-station-item ${station.id === selectedStationId ? 'selected' : ''}`}
              onClick={() => setSelectedStationId(station.id)}
            >
              <div className="station-name-group">
                <span className={`station-indicator-dot ${station.est_active ? 'active' : 'inactive'}`}></span>
                <span className="station-name">{station.nom}</span>
              </div>
              <span className="station-availability">
                {station.velos}/{station.places_totales}
              </span>
            </div>
          ))}
          {stations.length === 0 && (
            <div className="no-stations-found">No stations match filters</div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default LeftSidebar;
