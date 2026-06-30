import json
from kafka import KafkaConsumer, KafkaProducer

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
    
    mon_producteur_kafka = KafkaProducer(
        bootstrap_servers=["localhost:9092"],
        value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8")
    )

    print("Connecté ! En attente de nouvelles données...")
    print("-" * 50)

    # Cette boucle écoute le serveur Kafka en permanence
    for message in consumer:
        stations_brutes = message.value
        offset = message.offset
        
        print(f"\n[Lot Kafka - Offset N°{offset}] Analyse de {len(stations_brutes)} stations brutes...")
        
        stations_propres = []
        
        for station in stations_brutes:
            # NETTOYAGE DU NOM
            nom_brut = station.get('name', '')
            # On coupe au niveau du premier tiret si présent
            nom_propre = nom_brut.split('-', 1)[1].strip() if '-' in nom_brut else nom_brut

            # On force la conversion en entier numérique, et si c'est vide, on met 0
            velos = int(station.get('available_bikes') or 0)
            places_totales = int(station.get('bike_stands') or 0)
            
            # CONSERVATION DU STATUT
            statut_brut = station.get('status', 'UNKNOWN')
            # On crée un petit booléen très pratique pour conditionner l'affichage plus tard
            est_active = (statut_brut == 'OPEN')
            
            # On protège la division par zéro (très fréquent sur les stations en travaux ou hors service)
            if places_totales > 0:
                taux_remplissage = (velos / places_totales) * 100
            else:
                taux_remplissage = 0.0
            
            # CRÉATION DU NOUVEL OBJET
            stations_propres.append({
                "id": station.get('number'),
                "nom": nom_propre,
                "est_active": est_active,
                "velos": velos,
                "places_totales": places_totales,
                "remplissage_pct": round(taux_remplissage, 1)
            })

        # 4. On envoie la liste nettoyée dans le NOUVEAU topic Kafka
        mon_producteur_kafka.send("lyon-velov-propre", stations_propres)
            
        print(f"[Offset N°{offset}] {len(stations_propres)} stations nettoyées et envoyées dans 'lyon-velov-propre' !")

except Exception as e:
    print(f"Erreur du Consumer : {e}")