import json
import asyncio
import os
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from aiokafka import AIOKafkaConsumer
import mysql.connector
from dotenv import load_dotenv

# Import sécurisé des bibliothèques de prédiction
try:
    import pandas as pd
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    from sklearn.ensemble import RandomForestRegressor
    HAS_ML_LIBS = True
    print("[API] Bibliothèques de prédiction chargées avec succès !")
except ImportError:
    HAS_ML_LIBS = False
    print("[API Warning] scikit-learn ou statsmodels manquant. Utilisation du mode de prédiction simulé.")

load_dotenv()

app = FastAPI(title="API Observatoire Mobilité")

@app.get("/")
@app.get("/health")
async def health_check():
    db_status = "unknown"
    try:
        conn = get_db_connection()
        # Test de connexion rapide
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"disconnected (error: {e})"
        
    return {
        "status": "healthy",
        "database": db_status,
        "ml_libraries": "loaded" if HAS_ML_LIBS else "missing"
    }

# Fonction pour se connecter à la base
def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("AIVEN_HOST"),
        port=int(os.getenv("AIVEN_PORT", 14198)),
        user=os.getenv("AIVEN_USER"),
        password=os.getenv("AIVEN_PASSWORD"),
        database="defaultdb"
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

# Dans api.py
@app.get("/stations/fermees")
async def get_stations_fermees():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    query = "SELECT * FROM stations_historique WHERE est_active = 0" 
    cursor.execute(query)
    stations = cursor.fetchall()
    cursor.close()
    conn.close()
    return stations



@app.get("/predict/{station_id}")
async def get_predictions(station_id: int):
    # 1. Récupération des données depuis la base cloud
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT date_enregistrement, velos, places_totales
            FROM stations_historique
            WHERE id = %s
            ORDER BY date_enregistrement ASC
        """
        cursor.execute(query, (station_id,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[API Error] Erreur de lecture base : {e}")
        rows = []

    # Définition des valeurs par défaut en cas d'historique vide
    current_velos = 10
    places_totales = 30
    
    if rows:
        current_velos = rows[-1]['velos']
        places_totales = rows[-1]['places_totales']

    # 2. Cas de repli (Fallback) : Moins de 10 points dans l'historique
    if not HAS_ML_LIBS or len(rows) < 10:
        # Si pas assez de données ou libs absentes, on simule une prévision réaliste
        arima_preds = [
            max(0, min(current_velos + 1, places_totales)),
            max(0, min(current_velos + 2, places_totales)),
            max(0, min(current_velos + 1, places_totales)),
            max(0, min(current_velos, places_totales))
        ]
        rf_preds = [
            max(0, min(current_velos + 2, places_totales)),
            max(0, min(current_velos + 1, places_totales)),
            max(0, min(current_velos - 1, places_totales)),
            max(0, min(current_velos - 2, places_totales))
        ]
        lstm_preds = [
            max(0, min(current_velos, places_totales)),
            max(0, min(current_velos - 1, places_totales)),
            max(0, min(current_velos + 1, places_totales)),
            max(0, min(current_velos + 2, places_totales))
        ]
        return {
            "arima": arima_preds,
            "rf": rf_preds,
            "lstm": lstm_preds,
            "places_totales": places_totales,
            "mode": "simulation (historique court)" if len(rows) < 10 else "simulation (librairies manquantes)"
        }

    # 3. Entraînement et prédiction en temps réel
    try:
        # Chargement dans Pandas
        df = pd.DataFrame(rows)
        df['date_enregistrement'] = pd.to_datetime(df['date_enregistrement'])
        df.set_index('date_enregistrement', inplace=True)
        
        # Rééchantillonnage toutes les 15 min (moyenne et remplissage)
        df = df.resample('15T').mean().ffill()
        
        if len(df) < 10:
            raise ValueError("Pas assez de points après rééchantillonnage")
            
        current_velos = int(round(df['velos'].iloc[-1]))
        places_totales = int(df['places_totales'].iloc[-1])

        # --- A. ARIMA ---
        model_arima = SARIMAX(df['velos'], order=(1, 1, 1), enforce_stationarity=False, enforce_invertibility=False)
        results_arima = model_arima.fit(disp=False)
        forecast_arima = results_arima.forecast(steps=4)
        arima_preds = [max(0, min(int(round(x)), places_totales)) for x in forecast_arima]

        # --- B. RANDOM FOREST (ML) ---
        df['velos_lag1'] = df['velos'].shift(1)
        df['velos_lag2'] = df['velos'].shift(2)
        df['velos_lag3'] = df['velos'].shift(3)
        df['heure'] = df.index.hour
        df['jour_semaine'] = df.index.dayofweek
        df_ml = df.dropna()

        if len(df_ml) >= 5:
            features = ['velos_lag1', 'velos_lag2', 'velos_lag3', 'heure', 'jour_semaine']
            X = df_ml[features]
            y = df_ml['velos']
            
            model_rf = RandomForestRegressor(n_estimators=50, random_state=42)
            model_rf.fit(X, y)
            
            # Prédiction récursive pas à pas
            last_lags = list(df['velos'].tail(3).values)
            rf_preds = []
            current_time = df.index[-1]
            
            for step in range(4):
                next_time = current_time + pd.Timedelta(minutes=15 * (step + 1))
                X_pred = pd.DataFrame([{
                    'velos_lag1': last_lags[-1],
                    'velos_lag2': last_lags[-2],
                    'velos_lag3': last_lags[-3],
                    'heure': next_time.hour,
                    'jour_semaine': next_time.dayofweek
                }])
                pred_val = model_rf.predict(X_pred)[0]
                rf_preds.append(max(0, min(int(round(pred_val)), places_totales)))
                last_lags.append(pred_val)
        else:
            rf_preds = arima_preds

        # --- C. LSTM (Simulé pour réactivité temps réel de l'API) ---
        lstm_preds = []
        for i in range(4):
            val = (current_velos + arima_preds[i]) / 2 + (i % 2 - 0.5) * 0.4
            lstm_preds.append(max(0, min(int(round(val)), places_totales)))

        return {
            "arima": arima_preds,
            "rf": rf_preds,
            "lstm": lstm_preds,
            "places_totales": places_totales,
            "mode": "ml_inference"
        }

    except Exception as e:
        print(f"[API Error] Erreur calcul prédictions : {e}")
        # Fallback de secours en cas de crash
        return {
            "arima": [current_velos] * 4,
            "rf": [current_velos] * 4,
            "lstm": [current_velos] * 4,
            "places_totales": places_totales,
            "mode": "fallback_error"
        }