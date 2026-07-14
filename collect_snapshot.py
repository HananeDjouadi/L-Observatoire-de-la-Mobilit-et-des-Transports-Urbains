import os
import requests
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

def collect_and_store():
    # 1. Charger les variables d'environnement (GitHub Secrets ou .env local)
    host = os.environ.get("AIVEN_HOST")
    port = os.environ.get("AIVEN_PORT")
    user = os.environ.get("AIVEN_USER")
    password = os.environ.get("AIVEN_PASSWORD")
    database = "defaultdb"  # Nom de la base par défaut sur Aiven

    if not all([host, port, user, password]):
        print("[Erreur] Les identifiants Aiven ne sont pas complets dans l'environnement.")
        return

    # 2. Se connecter à Aiven MySQL
    print(f"Connexion à Aiven MySQL ({host}:{port})...")
    try:
        db = mysql.connector.connect(
            host=host,
            port=int(port),
            user=user,
            password=password,
            database=database
        )
        cursor = db.cursor()
    except Exception as e:
        print(f"[Erreur] Connexion impossible : {e}")
        return

    # 3. S'assurer que la table historique existe avec le bon schéma (clé primaire requise par Aiven)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stations_historique (
        record_id INT AUTO_INCREMENT PRIMARY KEY,
        id INT,
        nom VARCHAR(255),
        est_active TINYINT(1),
        velos INT,
        places_totales INT,
        remplissage_pct FLOAT,
        date_enregistrement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    db.commit()
    print("Table 'stations_historique' vérifiée/créée.")

    # 4. Appeler l'API de Lyon
    url = "https://data.grandlyon.com/fr/datapusher/ws/rdata/jcd_jcdecaux.jcdvelov/all.json?maxfeatures=-1&start=1&filename=stations-velo-v-metropole-lyon-disponibilites-temps-reel"
    print("Récupération des données Vélo'v depuis data.grandlyon.com...")
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        raw_data = response.json()
        stations_brutes = raw_data.get("values", [])
        print(f"{len(stations_brutes)} stations récupérées.")
    except Exception as e:
        print(f"[Erreur] API Lyon inaccessible : {e}")
        db.close()
        return

    # 5. Nettoyer et structurer les données
    batch_data = []
    for station in stations_brutes:
        # Nettoyage du nom
        nom_brut = station.get('name', '')
        nom_propre = nom_brut.split('-', 1)[1].strip() if '-' in nom_brut else nom_brut

        # Nettoyage des valeurs numériques
        velos = int(station.get('available_bikes') or 0)
        places_totales = int(station.get('bike_stands') or 0)
        
        # Statut de la station
        statut_brut = station.get('status', 'UNKNOWN')
        est_active = (statut_brut == 'OPEN')
        
        # Pourcentage de remplissage
        if places_totales > 0:
            taux_remplissage = (velos / places_totales) * 100
        else:
            taux_remplissage = 0.0
            
        batch_data.append((
            int(station.get('number')),
            nom_propre,
            int(est_active),
            velos,
            places_totales,
            round(taux_remplissage, 1)
        ))

    # 6. Insertion groupée (très rapide : évite les aller-retours réseau individuels)
    if batch_data:
        sql = """INSERT INTO stations_historique 
                 (id, nom, est_active, velos, places_totales, remplissage_pct) 
                 VALUES (%s, %s, %s, %s, %s, %s)"""
        try:
            cursor.executemany(sql, batch_data)
            db.commit()
            print(f"[Succès] {len(batch_data)} enregistrements insérés avec succès sur Aiven MySQL !")
        except Exception as e:
            print(f"[Erreur] Échec de l'insertion : {e}")
            db.rollback()

        # 7. Nettoyage automatique des données de plus de 14 jours
        try:
            delete_sql = "DELETE FROM stations_historique WHERE date_enregistrement < NOW() - INTERVAL 14 DAY"
            cursor.execute(delete_sql)
            db.commit()
            print("[Nettoyage] Données de plus de 14 jours purgées.")
        except Exception as e:
            print(f"[Avertissement] Nettoyage échoué : {e}")

    cursor.close()
    db.close()

if __name__ == "__main__":
    collect_and_store()
