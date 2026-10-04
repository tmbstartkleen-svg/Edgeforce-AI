# EdgeForce V55 ML Tournament Service

Containerized Python service for heavyweight sport-specific model training and champion inference.

## Algorithms

- L2 logistic regression
- Random Forest
- HistGradientBoosting
- XGBoost
- LightGBM
- CatBoost
- Stacking ensemble
- PyMC Bayesian logistic regression

Unavailable optional libraries are reported by `GET /health` and are never falsely marked active.

## Endpoints

- `GET /health`
- `POST /train` using schema `edgeforce-ml-train-v1`
- `POST /predict` using schema `edgeforce-ml-predict-v1`

Set `ML_SERVICE_KEY` to require Bearer authentication.

## Persistent model storage

Set `MODEL_STORE_DIR` to a persistent volume. The service writes serialized artifacts and champion manifests there. Do not use ephemeral storage in production unless losing trained artifacts on redeploy is acceptable.

## Local container

```bash
docker build -f ml-service/Dockerfile -t edgeforce-ml .
docker run --rm -p 8080:8080 \
  -e ML_SERVICE_KEY=change-me \
  -v edgeforce-models:/data/models \
  edgeforce-ml
```

Then configure EdgeForce:

```
EXPERT_MODEL_SERVICE_URL=http://localhost:8080/predict
EXPERT_MODEL_SERVICE_KEY=change-me
ML_TRAINING_SERVICE_URL=http://localhost:8080/train
ML_TRAINING_SERVICE_KEY=change-me
```

The EdgeForce web/Worker runtime remains separate from this Python service.
