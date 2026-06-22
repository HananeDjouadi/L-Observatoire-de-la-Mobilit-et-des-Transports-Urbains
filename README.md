# L'Observatoire de la Mobilité et des Transports Urbains

## Description du projet
Ce projet est une plateforme de **Data Streaming en temps réel** conçue pour observer et analyser la mobilité urbaine dans la métropole de Lyon. 

L'objectif actuel est de capter, d'ingérer et de traiter en continu les données des stations Vélo'v (vélos en libre-service) afin de préparer un flux de données propre et exploitable pour un futur tableau de bord interactif.

## Architecture Technique (Pipeline de Données)
L'architecture repose sur des principes de découplage et de traitement à la volée (Stream Processing) :

1. **Source des données :** API Open Data de la Métropole de Lyon (Web Service temps réel).
2. **Ingestion (Producer) :** Un script Python qui interroge l'API à intervalles réguliers et propulse la donnée brute dans le système de messagerie.
3. **Message Broker :** **Apache Kafka** (déployé sous Docker avec l'image officielle en mode KRaft). Il encaisse la charge et assure la résilience du flux de données via le topic `lyon-velov-flux`.
4. **Traitement (Consumer) :** Un script Python qui s'abonne au flux Kafka et effectue un nettoyage à la volée :
   - Filtrage des stations inactives (`CLOSED`).
   - Nettoyage et formatage des chaînes de caractères (noms des stations).
   - Calcul de métriques enrichies (pourcentage de remplissage en temps réel).

## Prérequis
Pour faire tourner ce projet sur votre machine locale, vous avez besoin de :
* **Python 3.x**
* **Docker Desktop** (pour faire tourner l'infrastructure Kafka)

## Installation et Démarrage

**1. Lancement de l'infrastructure Kafka**
Dans un terminal, montez le conteneur Docker en arrière-plan :
```bash
docker-compose up -d 
```

**2.Installation des dépendances Python**
Activez votre environnement virtuel (venv) et installez les paquets requis :
```bash
pip install kafka-python requests python-dotenv
```

**3. Démarrage du Pipeline de Streaming**
Ouvrez deux terminaux distincts (avec l'environnement virtuel activé sur les deux).

Dans le Terminal 1, lancez le Producteur (récupération des données) :
```bash
python producer.py
```
Dans le Terminal 2, lancez le Consommateur (nettoyage et affichage) :
```bash
python consumer.py
```