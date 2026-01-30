#!/usr/bin/env python3
import json
import logging
from flask import Flask, request, jsonify
from sklearn.ensemble import IsolationForest
import pandas as pd
import redis

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

redis_client = redis.Redis(host='redis', port=6379, decode_responses=True)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'}), 200

@app.route('/analyze', methods=['POST'])
def analyze_data():
    try:
        data = request.get_json()
        logger.info(f"Received analysis request: {data}")
        
        # Simple anomaly detection
        if 'dataset' in data:
            df = pd.DataFrame(data['dataset'])
            iso_forest = IsolationForest(contamination=0.1)
            anomalies = iso_forest.fit_predict(df)
            
            result = {
                'anomaly_count': int(sum(anomalies == -1)),
                'normal_count': int(sum(anomalies == 1)),
                'anomalies': anomalies.tolist()
            }
            return jsonify(result), 200
        
        return jsonify({'error': 'No dataset provided'}), 400
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
