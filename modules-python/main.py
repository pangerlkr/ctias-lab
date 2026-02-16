#!/usr/bin/env python3
import json
import logging

import pandas as pd
import redis
from flask import Flask, jsonify, request
from sklearn.ensemble import IsolationForest

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

redis_client = redis.Redis(host="redis", port=6379, decode_responses=True)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"}), 200


@app.route("/analyze", methods=["POST"])
def analyze_data():
    try:
        data = request.get_json()
        logger.info(f"Received analysis request: {data}")

        # Simple anomaly detection
        if "dataset" in data:
            df = pd.DataFrame(data["dataset"])
            model = IsolationForest(contamination=0.1)
            predictions = model.fit_predict(df)
            anomalies = [i for i, pred in enumerate(predictions) if pred == -1]

            result = {"anomalies": anomalies, "total_analyzed": len(predictions)}

            # Cache result
            redis_client.setex(f"analysis:{data.get('id', 'unknown')}", 3600, json.dumps(result))

            return jsonify(result), 200
        else:
            return jsonify({"error": "No dataset provided"}), 400
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return jsonify({"error": str(e)}), 500
