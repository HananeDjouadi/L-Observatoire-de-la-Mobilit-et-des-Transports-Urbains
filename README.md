# L'Observatoire de la Mobilité et des Transports Urbains

## Description du projet
Ce projet est une plateforme de **Data Streaming et Analytics en temps réel** conçue pour observer, analyser et prédire la mobilité urbaine (disponibilité des vélos en libre-service Vélo'v) dans la métropole de Lyon. 

Le système ingère en continu les flux de données officiels de la métropole, nettoie et enrichit les données en temps réel via Apache Kafka, stocke l'historique dans une base MySQL, et diffuse les mises à jour en direct via WebSockets vers un tableau de bord React. Il intègre également des fonctionnalités de prédiction statistique (ARIMA, Random Forest, LSTM) pour estimer la disponibilité future des vélos.

---

## Architecture Technique (Pipeline de Données)

```
[ Grand Lyon API (Vélo'v) ]
           │ (polling périodique)
           ▼
     [ producer.py ] (Producteur Kafka)
           │
           ▼  (Flux brut : topic 'lyon-velov-flux')
     [ Apache Kafka (Docker) ]
           │
           ▼
     [ consumer.py ] (Consommateur & Nettoyage)
      ├── Nettoie les noms, filtre les stations inactives
      ├── Calcule le pourcentage de remplissage en temps réel
      ├── Insère les clichés dans la table MySQL 'stations_historique'
      └── Propulse le flux propre dans le topic 'lyon-velov-propre'
           │
           ▼
     [ api.py (FastAPI Backend) ] 
      ├── Serveur WebSocket (ws://127.0.0.1:8000/ws/velov)
      └── Endpoint prédictions (GET /predict/{station_id})
           │
           ▼ (Mises à jour en direct)
     [ React Frontend (Vite) ]
      └── Tableau de bord interactif (Cartes, Tableaux, Graphiques, Thèmes)
```

---

## Structure du Projet

* `producer.py` : Récupère les données Vélo'v toutes les minutes et les publie brutes sur Kafka.
* `consumer.py` : Reçoit les messages bruts, calcule le taux de remplissage, filtre les stations, écrit les clichés historiques dans MySQL et publie les données propres sur Kafka.
* `api.py` : Serveur FastAPI servant les connexions WebSockets pour le Frontend et hébergeant les routes de prédiction.
* `prediction/modele_statistique.ipynb` : Carnet Jupyter (Notebook) permettant d'extraire l'historique SQL d'une station et d'entraîner/comparer les modèles de prédiction (ARIMA, Random Forest, LSTM).
* `front-observatoire/` : Code source du Frontend React.
  * `src/components/Header.jsx` : En-tête avec horloge et sélecteur de thème glissant moderne.
  * `src/components/MetricsBar.jsx` : Synthèse globale du réseau en temps réel (vélos, stations actives/fermées, remplissage moyen).
  * `src/components/LeftSidebar.jsx` : Filtres rapides, contrôle du lag Kafka, barre de recherche et liste des stations.
  * `src/components/CenterPanel.jsx` : Cartographie Leaflet interactive (avec marqueurs réactifs) et vue liste tabulaire.
  * `src/components/RightSidebar.jsx` : Détail de la station sélectionnée, graphiques d'occupation récents et terminal de logs en direct.

---

## Configuration requise
* **Python 3.10+** (environnement virtuel recommandé)
* **Docker & Docker Desktop** (pour exécuter Kafka)
* **MySQL Database** (ex: Laragon, XAMPP, WAMP ou Docker)
* **Node.js & npm** (pour le frontend React)

---

## Installation et Démarrage

### 1. Base de Données MySQL
Démarrez votre serveur MySQL local et créez une base de données nommée `observatoire_velov` :
```sql
CREATE DATABASE observatoire_velov;
```
La table `stations_historique` sera automatiquement créée lors du premier lancement de `consumer.py`.

### 2. Infrastructure Apache Kafka (Docker)
Dans la racine du projet, lancez Kafka en arrière-plan :
```bash
docker-compose up -d
```

### 3. Environnement Python (Backend & Traitement)
Installez les dépendances du projet :
```bash
pip install -r requirements.txt
```
*(ou installez individuellement : `pip install kafka-python-ng requests python-dotenv mysql-connector-python fastapi uvicorn pandas jinja2`)*

### 4. Lancement du Pipeline de Streaming
Ouvrez trois terminaux distincts :

* **Terminal 1 :** Lancer le producteur (ingestion) :
  ```bash
  python producer.py
  ```
* **Terminal 2 :** Lancer le consommateur (nettoyage & base de données) :
  ```bash
  python consumer.py
  ```
* **Terminal 3 :** Lancer le serveur API (WebSocket & Routes de Prédiction) :
  ```bash
  uvicorn api:app --reload --port 8000
  ```

### 5. Lancement de l'Interface Utilisateur (Frontend)
Dans un nouveau terminal :
```bash
cd front-observatoire
npm install
npm run dev
```
Ouvrez ensuite votre navigateur sur [http://localhost:5173](http://localhost:5173).

---

## Prédictions et Modèles Statistiques

Le dossier `/prediction` contient le Notebook Jupyter `modele_statistique.ipynb`. 
1. Lancez votre serveur Jupyter ou utilisez l'extension VS Code Jupyter.
2. Exécutez le notebook pour charger les données réelles stockées dans MySQL par votre consommateur.
3. Comparez les modèles prédictifs ARIMA, Random Forest et LSTM.
4. L'API FastAPI expose la route `GET /predict/{station_id}` pour intégrer vos modèles entraînés et renvoyer les prédictions comparatives en temps réel sur l'interface.
