import json
import asyncio
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from aiokafka import AIOKafkaConsumer
import mysql.connector

app = FastAPI(title="API Observatoire Mobilité")

# Fonction pour se connecter à la base
def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="observatoire_velov"
    )


# Autorisation pour que ton site React puisse se connecter
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/velov")
async def flux_velov(websocket: WebSocket):
    # 1. On décroche le téléphone quand React appelle
    await websocket.accept()
    print("React vient de se connecter au flux temps réel !")

    # 2. On écoute le NOUVEAU topic (le propre !)
    consumer = AIOKafkaConsumer(
        "lyon-velov-propre", # donne propre
        bootstrap_servers="localhost:9092",
        auto_offset_reset="latest", # On veut que le direct 
        value_deserializer=lambda m: json.loads(m.decode("utf-8"))
    )
    
    await consumer.start()

    try:
        # 3. La boucle de diffusion
        async for message in consumer:
            # On récupère les données qui sont deja nettoyées
            stations_propres = message.value
            
            # 4. On balance tout directement vers React !
            await websocket.send_json(stations_propres)
            print("Lot propre diffusé sur le WebSocket !")
            
    except Exception as e:
        print(f"La ligne a été coupée : {e}")
    finally:
        await consumer.stop()

@app.get("/stations/fermees")
async def get_stations_fermees():
    # 1. On se connecte
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True) # dictionary=True permet de recevoir les données en JSON
    
    # 2. On exécute la requête SQL
    # On cherche les stations avec est_active = 0
    query = "SELECT * FROM stations_historique WHERE est_active = 0"
    cursor.execute(query)
    stations = cursor.fetchall()
    
    # 3. On ferme tout et on renvoie
    cursor.close()
    conn.close()
    return stations