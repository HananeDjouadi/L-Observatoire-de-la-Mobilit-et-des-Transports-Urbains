import React, { useEffect, useRef } from 'react';
import './CenterPanel.css';

// Utilisation de la version globale du CDN pour éviter d'avoir à faire 'npm install leaflet'
const L = window.L;

const CenterPanel = ({
  viewMode = 'map',
  setViewMode,
  stations = [],
  selectedStationId,
  setSelectedStationId,
  replayTime = 0,
  setReplayTime,
  isPlaying = false,
  setIsPlaying
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Centered on Lyon city center
      const map = L.map(mapContainerRef.current, {
        center: [45.764, 4.835],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      // CartoDB Dark Matter tiles matching VeloControl sci-fi dark style
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(map);

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
    }

    // Clean up on unmount
    return () => {};
  }, [viewMode]);

  // Update Markers
  useEffect(() => {
    if (viewMode !== 'map' || !markersGroupRef.current) return;

    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    stations.forEach(station => {
      if (station.lat && station.lng) {
        let statusClass = 'open'; // Green
        if (!station.est_active) {
          statusClass = 'closed'; // Red
        } else if (station.velos <= 3) {
          statusClass = 'low'; // Orange
        }

        const isSelected = station.id === selectedStationId;

        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div class="map-marker-dot ${statusClass} ${isSelected ? 'selected-pulse' : ''}"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });

        const marker = L.marker([station.lat, station.lng], { icon: customIcon });

        // Add Popup
        marker.bindPopup(`
          <div style="font-family: 'Segoe UI', sans-serif; font-size: 11px; color: #fff;">
            <strong>${station.nom}</strong><br/>
            Bikes: ${station.velos} / ${station.places_totales}<br/>
            Status: ${station.est_active ? 'OPEN' : 'CLOSED'}
          </div>
        `);

        // Handle Click
        marker.on('click', () => {
          setSelectedStationId(station.id);
        });

        marker.addTo(markersGroup);
      }
    });
  }, [viewMode, stations, selectedStationId, setSelectedStationId]);

  // Recenter map on selected station if it changes
  const recenterMap = () => {
    if (mapInstanceRef.current) {
      const selected = stations.find(s => s.id === selectedStationId);
      if (selected && selected.lat && selected.lng) {
        mapInstanceRef.current.setView([selected.lat, selected.lng], 15, { animate: true });
      }
    }
  };

  const getQueryTimeText = () => {
    if (replayTime === 0) return '22:16:51'; // matches screenshot exactly or can be dynamic
    return `22:16:51 (Simulated -${Math.abs(replayTime)}h)`;
  };

  return (
    <div className="center-panel-container">
      {/* Header bar: Visible only in List View */}
      {viewMode === 'list' && (
        <div className="center-panel-header">
          <div className="view-tabs">
            <button 
              className={`tab-btn ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              Map View
            </button>
            <button 
              className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List View
            </button>
          </div>
        </div>
      )}

      {/* Map display wrapper */}
      {viewMode === 'map' ? (
        <div className="map-view-wrapper">
          {/* Absolute overlay tabs inside the map container */}
          <div className="view-tabs map-overlay-tabs">
            <button 
              className={`tab-btn ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              Map View
            </button>
            <button 
              className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List View
            </button>
          </div>

          {/* Absolute overlay legend inside the map container */}
          <div className="map-legend map-overlay-legend">
            <div className="legend-item">
              <span className="legend-dot open"></span>
              <span className="open-txt">OPEN</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot low"></span>
              <span className="low-txt">LOW</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot closed"></span>
              <span className="closed-txt">CLOSED</span>
            </div>
          </div>

          <div ref={mapContainerRef} className="leaflet-map-element" />
          
          {/* Bottom Floating tools */}
          <div className="floating-tools-bar">
            <button className="tool-btn" onClick={recenterMap} title="Recenter selection">
              🔍
            </button>
            <button className="tool-btn" onClick={() => alert('Text tool (demo)')} title="Text Mode">
              T
            </button>
            <button className="tool-btn" onClick={() => alert('Draw route (demo)')} title="Draw Tool">
              ✏️
            </button>
            <button className="tool-btn" onClick={() => alert('Chat feedback (demo)')} title="Comments">
              💬
            </button>
          </div>
        </div>
      ) : (
        /* List view fallback inside center area */
        <div className="list-view-wrapper">
          <table className="stations-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>STATION NAME</th>
                <th>STATUS</th>
                <th>BIKES</th>
                <th>DOCKS</th>
                <th>OCCUPANCY</th>
              </tr>
            </thead>
            <tbody>
              {stations.map(s => {
                const freeDocks = s.places_totales - s.velos;
                const fillPct = s.places_totales > 0 ? Math.round((s.velos / s.places_totales) * 100) : 0;
                let pctClass = 'low';
                if (fillPct > 90) pctClass = 'high';
                else if (fillPct > 40) pctClass = 'medium';

                return (
                  <tr 
                    key={s.id} 
                    className={s.id === selectedStationId ? 'selected-row' : ''}
                    onClick={() => setSelectedStationId(s.id)}
                  >
                    <td>#{s.id}</td>
                    <td className="station-name-cell">{s.nom}</td>
                    <td>
                      <span className={`status-tag ${s.est_active ? 'active' : 'inactive'}`}>
                        {s.est_active ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td>{s.velos}</td>
                    <td>{freeDocks}</td>
                    <td>
                      <div className="fill-progress-bar">
                        <div className={`fill-progress-inner ${pctClass}`} style={{ width: `${fillPct}%` }}></div>
                      </div>
                      <span className="fill-pct-txt">{fillPct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Historical Replay Slider Panel */}
      <div className="historical-replay-panel">
        <div className="replay-labels">
          <span className="replay-title">HISTORICAL REPLAY</span>
          <span className="replay-query-time">
            Query at: <span className="red-time-txt">{getQueryTimeText()}</span>
          </span>
        </div>

        <div className="replay-slider-row">
          {/* Subtle play pause button */}
          <button 
            className={`replay-play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          
          <div className="slider-track-container">
            <input 
              type="range" 
              min="-24" 
              max="0" 
              value={replayTime} 
              onChange={(e) => {
                setIsPlaying(false);
                setReplayTime(parseInt(e.target.value));
              }}
              className="replay-slider-input"
            />
            <div className="slider-labels-row">
              <span>-24h</span>
              <span>-12h</span>
              <span>-6h</span>
              <span>now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CenterPanel;
