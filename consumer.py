import json
from kafka import KafkaConsumer

def json_deserializer(data):
    # L'opération inverse du Producer : on traduit les octets de Kafka en dictionnaire Python
    return json.loads(data.decode("utf-8"))

print("[Consumer] Démarrage et connexion à Kafka...")

try:
    # Initialisation de notre lecteur
    consumer = KafkaConsumer(
        "lyon-velov-flux", # On s'abonne EXACTEMENT à la même boîte aux lettres
        bootstrap_servers=["localhost:9092"],
        auto_offset_reset="earliest", # Ordre magique : "Si j'ai raté des messages, redonne-moi tout depuis le début"
        value_deserializer=json_deserializer
    )
    
    print("Connecté ! En attente de nouvelles données...")
    print("-" * 50)

    # Cette boucle écoute le serveur Kafka en permanence
    for message in consumer:
        stations = message.value
        offset = message.offset
        
        print(f"[Lecture Kafka] Lot reçu ! Offset N°{offset}")
        
        if stations:
            print(f"Il y a {len(stations)} stations dans ce lot. Les voici :")
            
            for station_test in stations: 
                nom = station_test.get('name')
                velos = station_test.get('available_bikes')
                places = station_test.get('bike_stands')
                print(f"{nom} : {velos} / {places} vélos dispos")
                
            print("-" * 50)

except Exception as e:
    print(f"Erreur du Consumer : {e}")