import os
import time
import json
import requests
from dotenv import load_dotenv
from kafka import KafkaProducer

# 1. Chargement de la configuration de sécurité
load_dotenv()
API_KEY = os.getenv("GRANDLYON_API_KEY")

# Configuration de Kafka
KAFKA_BROKER = "localhost:9092"
TOPIC_NAME = "lyon-velov-flux"

# Fonction pour sérialiser nos données JSON en octets (format requis par Kafka)
def json_serializer(data):
    return json.dumps(data).encode("utf-8")

# 2. Initialisation du Producer Kafka
try:
    producer = KafkaProducer(
        bootstrap_servers=[KAFKA_BROKER],
        value_serializer=json_serializer
    )
    print("[Producer] Connecté à Apache Kafka avec succès !")
except Exception as e:
    print(f"[Producer] Impossible de se connecter à Kafka : {e}")
    print("Note : Le script va s'exécuter mais ne pourra pas envoyer les données tant que Kafka n'est pas démarré.")
    producer = None

# 3. Fonction principale d'aspiration et de transfert
def fetch_and_send_to_kafka():
    url = "https://data.grandlyon.com/fr/datapusher/ws/rdata/jcd_jcdecaux.jcdvelov/all.json?maxfeatures=-1&start=1&filename=stations-velo-v-metropole-lyon-disponibilites-temps-reel"
    
    # On applique la clé API si elle existe dans le .env, sinon mode public
    headers = {}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
        
    try:
        # Appel à l'API Data Grand Lyon
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        raw_data = response.json()
        
        # Extraction de la liste des stations
        stations = raw_data.get("values", [])
        
        if producer:
            # On envoie tout le bloc de données dans notre "Topic" Kafka
            producer.send(TOPIC_NAME, value=stations)
            producer.flush() # Force l'envoi des paquets
            print(f"[Streaming] {len(stations)} stations Vélo'v injectées dans le topic '{TOPIC_NAME}' à {time.strftime('%H:%M:%S')}")
        else:
            print(f"[Mode Dégradé] API OK ({len(stations)} stations lues) mais Kafka est hors ligne.")

    except requests.exceptions.RequestException as e:
        print(f"Erreur lors de la récupération des données de Lyon : {e}")

if __name__ == "__main__":
    print("Démarrage du flux de données urbaines...")
    
    # Boucle infinie pour simuler le temps réel (toutes les minutes)
    while True:
        fetch_and_send_to_kafka()
        print("Attente de 60 secondes avant le prochain checkpoint...\n")
        time.sleep(60)