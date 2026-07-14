# L'Observatoire de la Mobilité et des Transports Urbains (VeloControl Lyon)

## Description du projet
Ce projet est une plateforme de **Data Ingestion, Streaming et Analytics en temps réel** conçue pour observer, analyser et prédire la mobilité urbaine (disponibilité des vélos en libre-service Vélo'v) dans la métropole de Lyon. 

Le système propose une architecture hybride :
1. **Un flux temps réel local** : Ingestions en continu des données Vélo'v via un producteur Kafka, traitement/nettoyage par un consommateur et diffusion instantanée par WebSockets vers un tableau de bord React.
2. **Un collecteur cloud autonome (24h/24 & 7j/7)** : Un workflow planifié via **GitHub Actions** appelle l'API du Grand Lyon toutes les 15 minutes et sauvegarde l'état dans une base de données cloud **Aiven MySQL** gratuite. Une purge automatique supprime les enregistrements de plus de 14 jours pour garantir un stockage maîtrisé et 100% gratuit.

---

## Architecture Technique (Pipeline de Données)

```
[ En local (Présentation temps réel) ]
  [ Grand Lyon API (Vélo'v) ] ──(1 min)──► [ producer.py ] ──► [ Kafka Topic (brut) ]
                                                                     │
  [ Aiven MySQL Cloud ( defaultdb ) ] ◄──(cliché SQL)── [ consumer.py (Kafka Clean) ]
                │                                                    │
                ▼                                                    ▼
  [ api.py (FastAPI Backend) ] ◄────────(WebSocket propre)────────────┘
        ├── Serveur WebSocket (ws://127.0.0.1:8000/ws/velov)
        └── Endpoint prédictions (GET /predict/{station_id}) ◄── [ Modèles ARIMA / Random Forest ]
                │
                ▼ (Mises à jour UI)
  [ React Frontend (Vite) ] ◄── (Auto Light/Dark mode selon l'heure)

[ Dans le Cloud (Collecte d'historique 24h/24h) ]
  [ GitHub Actions Workflow ] ──(15 min)──► [ collect_snapshot.py ] ──► [ Aiven MySQL Cloud ]
                                                                                │
                                                                       (Purge auto 14 jours)
```

---

## Structure du Projet

### 📂 Pipeline & Serveurs (Racine)
* `producer.py` : Interroge l'API Vélo'v toutes les minutes et pousse les flux bruts dans le topic Kafka local `lyon-velov-flux`.
* `consumer.py` : Consomme le flux brut, calcule le remplissage, insère l'historique dans la base cloud Aiven, et pousse le flux propre dans `lyon-velov-propre`.
* `collect_snapshot.py` : Script exécuté dans le cloud par GitHub Actions pour insérer un cliché toutes les 15 minutes et purger l'historique de plus de 14 jours.
* `api.py` : Serveur FastAPI gérant le flux WebSocket en temps réel et l'endpoint `/predict/{station_id}`.
* `requirements.txt` : Liste des dépendances Python requises.
* `.env` : Fichier local contenant les variables d'environnement (identifiants Aiven) sécurisé et exclu de Git.

### 📂 Carnets de Modélisation (`/prediction`)
* `prediction/modele_statistique.ipynb` : Analyse des corrélations (ACF/PACF), Train/Test Split (80/20) et entraînement du modèle statistique **ARIMA/SARIMAX** avec intervalle de confiance.
* `prediction/modele_ml.ipynb` : Modèle de Machine Learning **Random Forest Regressor** avec ingénierie de caractéristiques temporelles (lags de vélos $t-1, t-2, t-3$, heure de la journée, jour de la semaine) et calcul de l'importance des variables.
* `prediction/modele_dl.ipynb` : Modèle de Deep Learning **LSTM (Long Short-Term Memory)** avec Keras/TensorFlow, préparant des fenêtres de séquences 3D et entraînant le réseau récurrent.

### 📂 Tableau de Bord (`/front-observatoire`)
* `front-observatoire/` : Application SPA React (Vite).
  * `src/components/Header.jsx` : Entête dynamique affichant l'horloge et commutateur de thème jour/nuit (thème automatique : clair la journée, sombre après 18h).
  * `src/components/MetricsBar.jsx` : Métriques clés en temps réel (flotte totale, stations actives/fermées, dock load moyen).
  * `src/components/CenterPanel.jsx` : Cartographie Leaflet interactive réactive et vue liste tabulaire.
  * `src/components/RightSidebar.jsx` : Profil détaillé de station, graphiques d'occupation 24h et **module de prédictions à 1h interactif** (ARIMA, Forêt Aléatoire, LSTM).

---

## Configuration de la Base Cloud Aiven MySQL

Pour faire tourner le projet localement et connecter votre code à la base cloud, créez un fichier nommé **`.env`** à la racine de votre projet avec le format suivant :
```ini
AIVEN_HOST=mysql-velov-velovlyon.h.aivencloud.com
AIVEN_PORT=14198
AIVEN_USER=avnadmin
AIVEN_PASSWORD=VotreMotDePasseAiven
```
*(Le fichier `.env` est automatiquement ignoré par `.gitignore` pour éviter toute fuite de mot de passe).*

---

## Installation et Démarrage Local

### 1. Cloner et installer les packages Python
Dans votre terminal (environnement virtuel activé) :
```bash
# Installer toutes les dépendances (Backend, Stats & ML)
pip install -r requirements.txt
```
*(Note : Si vous avez des limitations de longueur de chemin sur Windows pour installer TensorFlow, ce dernier est désactivé par défaut dans le requirements.txt. Les modèles ARIMA et Random Forest tourneront en direct tandis que la courbe LSTM s'exécutera en mode simulation).*

### 2. Démarrer Kafka (Docker)
Assurez-vous que Docker Desktop est ouvert, puis lancez les conteneurs :
```bash
docker-compose up -d
```

### 3. Exécuter le Pipeline de Streaming
Ouvrez trois terminaux pour démarrer vos serveurs locaux :
* **Terminal 1** : Lancement du producteur (pousse sur Kafka) :
  ```bash
  python producer.py
  ```
* **Terminal 2** : Lancement du consommateur (filtre & insère dans Aiven) :
  ```bash
  python consumer.py
  ```
* **Terminal 3** : Lancement du serveur API FastAPI (WebSocket & Prédictions) :
  ```bash
  uvicorn api:app --reload --port 8000
  ```

### 4. Lancer le Tableau de Bord React
Dans un quatrième terminal :
```bash
cd front-observatoire
npm install
npm run dev
```
Ouvrez votre navigateur sur [http://localhost:5173](http://localhost:5173). Vous pouvez maintenant inspecter les stations, voir le temps réel s'activer, et comparer les prédictions des 3 modèles en direct !
