import { useState, useEffect, useRef } from 'react'
import Header from './components/Header';
import MetricsBar from './components/MetricsBar';
import LeftSidebar from './components/LeftSidebar';
import CenterPanel from './components/CenterPanel';
import RightSidebar from './components/RightSidebar';
import './App.css'; // Ton CSS Grid sera ici

// Mock initial data matching the design screenshot with latitude/longitude
const INITIAL_STATIONS = [
  { id: 9012, nom: "Vaise", velos: 18, places_totales: 22, est_active: true, lat: 45.7808, lng: 4.8048 },
  { id: 1001, nom: "Hôtel de Ville", velos: 12, places_totales: 28, est_active: true, lat: 45.7675, lng: 4.8356 },
  { id: 2002, nom: "Bellecour", velos: 22, places_totales: 35, est_active: true, lat: 45.7578, lng: 4.8322 },
  { id: 3003, nom: "Part-Dieu", velos: 5, places_totales: 40, est_active: true, lat: 45.7606, lng: 4.8598 },
  { id: 6004, nom: "Croix-Rousse", velos: 18, places_totales: 18, est_active: true, lat: 45.7742, lng: 4.8306 },
  { id: 6002, nom: "Cité Internationale", velos: 0, places_totales: 22, est_active: false, lat: 45.7852, lng: 4.8524 },
];

function App() {
  const [metrics, setMetrics] = useState({
    totalBikes: 107,
    activeStations: 10,
    totalStations: 12,
    closedStations: 2,
    avgDockLoad: 39
  });

  const [stations, setStations] = useState(INITIAL_STATIONS);
  const [selectedStationId, setSelectedStationId] = useState(9012);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [capacityThreshold, setCapacityThreshold] = useState({ min: 0, max: 40 });
  const [pipeline, setPipeline] = useState({
    topic: 'velov.events.raw',
    sink: 'postgres/stations',
    lag: '242 ms',
    brokers: '3 / 3 up'
  });

  // Chargement initial de toutes les stations de Lyon (Grand Lyon API)
  useEffect(() => {
    const loadInitialStations = async () => {
      try {
        const response = await fetch("https://data.grandlyon.com/fr/datapusher/ws/rdata/jcd_jcdecaux.jcdvelov/all.json?maxfeatures=-1&start=1");
        const data = await response.json();
        if (data && data.values) {
          const allStations = data.values.map(s => {
            const nomBrut = s.name || '';
            const nomPropre = nomBrut.includes('-') ? nomBrut.split('-', 2)[1].trim() : nomBrut;
            return {
              id: s.number,
              nom: nomPropre,
              velos: s.available_bikes || 0,
              places_totales: s.bike_stands || 0,
              est_active: s.status === 'OPEN',
              lat: s.lat,
              lng: s.lng
            };
          });

          // Tri par nom pour la barre de recherche
          allStations.sort((a, b) => a.nom.localeCompare(b.nom));

          setStations(allStations);

          // Calcul des métriques réelles au chargement
          const totalBikes = allStations.reduce((sum, s) => sum + s.velos, 0);
          const activeCount = allStations.filter(s => s.est_active).length;
          const closedCount = allStations.length - activeCount;
          const totalDocksUsed = allStations.reduce((sum, s) => sum + s.velos, 0);
          const totalStands = allStations.reduce((sum, s) => sum + s.places_totales, 0);
          const avgDockLoad = totalStands > 0 ? Math.round((totalDocksUsed / totalStands) * 100) : 0;

          setMetrics({
            totalBikes,
            activeStations: activeCount,
            totalStations: allStations.length,
            closedStations: closedCount,
            avgDockLoad
          });

          // Sélectionner la première par défaut
          if (allStations.length > 0) {
            setSelectedStationId(allStations[0].id);
          }
        }
      } catch (err) {
        console.error("Erreur lors du chargement initial :", err);
      }
    };

    loadInitialStations();
  }, []);

  // Center Panel States
  const [viewMode, setViewMode] = useState('map');
  const [replayTime, setReplayTime] = useState(0); // hours from now (-24 to 0)
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);

  // Dynamic logs state populated with initial entries
  const [logs, setLogs] = useState([
    { id: 1, message: 'STATION_UPD 5003 (Vieux Lyon) -> 7 bikes available', time: '22:20:53', source: 'Kafka/rt-bikes' },
    { id: 2, message: 'STATION_UPD 6004 (Foch) -> 17 bikes available', time: '22:20:53', source: 'Kafka/rt-bikes' },
    { id: 3, message: 'STATION_UPD 3012 (Saxe-Gambetta) -> 2 bikes available', time: '22:20:51', source: 'Kafka/rt-bikes' },
    { id: 4, message: 'STATION_UPD 6004 (Foch) -> 19 bikes available', time: '22:20:51', source: 'Kafka/rt-bikes' },
    { id: 5, message: 'STATION_UPD 5003 (Vieux Lyon) -> 6 bikes available', time: '22:20:50', source: 'Kafka/rt-bikes' }
  ]);

  // Playback timer for historical timeline
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setReplayTime(prev => {
          if (prev >= 0) return -24; // loop back
          return prev + 1;
        });
      }, 1000);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying]);

  // Connexion WebSocket temps réel connectée à FastAPI
  useEffect(() => {
    let ws;
    let reconnectTimeout;

    const connectWS = () => {
      ws = new WebSocket('ws://127.0.0.1:8000/ws/velov');

      ws.onopen = () => {
        console.log("Connecté au serveur WebSocket de l'Observatoire !");
        setPipeline(prev => ({ ...prev, brokers: '3 / 3 up (Live)' }));
      };

      ws.onmessage = (event) => {
        try {
          const freshData = JSON.parse(event.data);
          if (Array.isArray(freshData)) {
            setStations(prev => {
              const updated = prev.map(s => {
                const live = freshData.find(item => item.id === s.id);
                if (live) {
                  // Si le nombre de vélos change, on écrit un log dans la console
                  if (live.velos !== s.velos) {
                    const time = new Date().toLocaleTimeString();
                    const newLog = {
                      id: Date.now() + Math.random(),
                      message: `STATION_UPD ${live.id} (${live.nom}) -> ${live.velos} bikes available`,
                      time,
                      source: 'Kafka/rt-bikes'
                    };
                    setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 12)]);
                  }
                  return { ...s, ...live };
                }
                return s;
              });

              // Ajout des nouvelles stations temps réel non présentes initialement
              freshData.forEach(live => {
                const exists = updated.some(s => s.id === live.id);
                if (!exists) {
                  updated.push({
                    ...live,
                    lat: 45.75 + (Math.random() - 0.5) * 0.04,
                    lng: 4.85 + (Math.random() - 0.5) * 0.04
                  });
                }
              });

              // Recalcul des métriques globales en temps réel
              const totalBikes = updated.reduce((sum, s) => sum + s.velos, 0);
              const activeCount = updated.filter(s => s.est_active).length;
              const closedCount = updated.length - activeCount;
              const totalSts = updated.length;
              const totalDocksUsed = updated.reduce((sum, s) => sum + s.velos, 0);
              const totalStands = updated.reduce((sum, s) => sum + s.places_totales, 0);
              const avgDockLoad = totalStands > 0 ? Math.round((totalDocksUsed / totalStands) * 100) : 0;

              setMetrics({
                totalBikes,
                activeStations: activeCount,
                totalStations: totalSts,
                closedStations: closedCount,
                avgDockLoad
              });

              return updated;
            });
          }
        } catch (err) {
          console.error("Erreur parsing WebSocket :", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket déconnecté, reconnexion dans 5 secondes...");
        setPipeline(prev => ({ ...prev, brokers: '3 / 3 up (Offline)' }));
        reconnectTimeout = setTimeout(connectWS, 5000);
      };

      ws.onerror = (err) => {
        console.error("Erreur WebSocket :", err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Dynamically modify bike numbers when scrubbing timeline to simulate historical traffic
  const getHistoricalStations = () => {
    if (replayTime === 0) return stations;
    return stations.map(s => {
      if (!s.est_active) return s;
      const phase = s.id * 0.13;
      const wave = Math.sin((replayTime * 0.25) + phase);
      const maxVar = Math.floor(s.places_totales * 0.3);
      const diff = Math.round(wave * maxVar);
      let simulatedBikes = s.velos + diff;
      if (simulatedBikes < 0) simulatedBikes = 0;
      if (simulatedBikes > s.places_totales) simulatedBikes = s.places_totales;
      return { ...s, velos: simulatedBikes };
    });
  };

  const processedStations = getHistoricalStations();

  // Apply filters to stations
  const filteredStations = processedStations.filter(s => {
    // 1. Search Query filter
    const matchesSearch = s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toString().includes(searchQuery);
    if (!matchesSearch) return false;

    // 2. Capacity threshold
    if (s.places_totales < capacityThreshold.min || s.places_totales > capacityThreshold.max) return false;

    // 3. Instant Query filters
    if (filterType === 'closed') return !s.est_active;
    if (filterType === 'high_demand') {
      const fill = s.places_totales > 0 ? (s.velos / s.places_totales) * 100 : 0;
      return s.est_active && fill >= 90;
    }
    if (filterType === 'empty') return s.est_active && s.velos === 0;

    return true;
  });

  // Identify currently selected station object
  const selectedStation = processedStations.find(s => s.id === selectedStationId) || processedStations[0];

  return (
    <div className="dashboard-grid">
      <Header />
      <MetricsBar
        totalBikes={metrics.totalBikes}
        activeStations={metrics.activeStations}
        totalStations={metrics.totalStations}
        closedStations={metrics.closedStations}
        avgDockLoad={metrics.avgDockLoad}
      />

      <div className="main-content" style={{ padding: '0 16px', boxSizing: 'border-box' }}>
        <LeftSidebar
          filterType={filterType}
          setFilterType={setFilterType}
          pipeline={pipeline}
          capacityThreshold={capacityThreshold}
          setCapacityThreshold={setCapacityThreshold}
          stations={filteredStations}
          selectedStationId={selectedStationId}
          setSelectedStationId={setSelectedStationId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <CenterPanel
          viewMode={viewMode}
          setViewMode={setViewMode}
          stations={filteredStations}
          selectedStationId={selectedStationId}
          setSelectedStationId={setSelectedStationId}
          replayTime={replayTime}
          setReplayTime={setReplayTime}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
        />

        <RightSidebar
          selectedStation={selectedStation}
          logs={logs}
        />
      </div>
    </div>
  );
}

export default App;