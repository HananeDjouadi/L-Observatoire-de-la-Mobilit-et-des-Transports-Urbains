import { useState, useEffect } from 'react'
import './App.css'

function App() {
  // Nos deux variables d'état : le statut de la connexion, et la liste des stations
  const [status, setStatus] = useState("🟡 Connexion en cours...")
  const [stations, setStations] = useState([])

  useEffect(() => {
    // 1. On appelle l'API Python
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/velov")

    ws.onopen = () => {
      setStatus("🟢 Connecté au flux temps réel ! En attente de Kafka...")
    }

    // 2. À CHAQUE FOIS que Python parle, on met à jour notre état React
    ws.onmessage = (event) => {
      const donneesPropres = JSON.parse(event.data)
      console.log("📦 Données reçues du WebSocket :", donneesPropres)
      setStations(donneesPropres)
      setStatus("🟢 Connecté et données reçues en direct !")
    }

    ws.onerror = () => {
      setStatus("🔴 Erreur de connexion au serveur")
    }

    ws.onclose = () => {
      setStatus("⚫ Le serveur Python a raccroché")
    }

    // 3. Règle d'or de React : on raccroche proprement si on quitte la page
    return () => {
      ws.close()
    }
  }, []) // Le tableau vide [] signifie qu'on se connecte une seule fois au démarrage

  return (
    <div>
      <h1>🚲 Observatoire Mobilité Velo'v</h1>
      <h2>Statut : {status}</h2>
      
      {/* On affiche un petit résumé dynamique */}
      {stations.length > 0 && (
        <p>Nous surveillons actuellement <strong>{stations.length}</strong> stations en temps réel.</p>
      )}

      {/* On boucle sur les 5 premières stations pour vérifier que la donnée est bien là */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "30px" }}>
        {stations.slice(0, 5).map((station) => (
          <div key={station.id} style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px", width: "250px" }}>
            <h3>{station.nom}</h3>
            <p>Disponibilité : {station.velos} / {station.places_totales} vélos</p>
            <p>Taux de remplissage : <strong>{station.remplissage_pct}%</strong></p>
            <p>Statut : {station.est_active ? "✅ Ouverte" : "❌ Fermée"}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App