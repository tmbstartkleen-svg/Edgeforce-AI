# EdgeForce V56 ML Tournament Service

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
- `POST /promote` using schema `edgeforce-ml-promote-v1`
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

Then configure EdgeForce after deployment:

```
ML_PREDICTION_SERVICE_URL=http://localhost:8080/predict
ML_PREDICTION_SERVICE_KEY=change-me
ML_TRAINING_SERVICE_URL=http://localhost:8080/train
ML_TRAINING_SERVICE_KEY=change-me
ML_PROMOTION_SERVICE_URL=http://localhost:8080/promote
```

The EdgeForce web/Worker runtime remains separate from this Python service.


## Render deployment

The repository root includes `render.yaml` for the V56 production service. It defines:
- Docker web service
- Ohio region
- `2c-8g` compute plan
- `/health` health check
- persistent disk mounted at `/data/models`
- one service instance
- secret `ML_SERVICE_KEY`

After Render deploys the service, configure EdgeForce with:

```
ML_HEALTH_SERVICE_URL=https://<service>.onrender.com/health
ML_PREDICTION_SERVICE_URL=https://<service>.onrender.com/predict
ML_PREDICTION_SERVICE_KEY=<same ML_SERVICE_KEY>
ML_TRAINING_SERVICE_URL=https://<service>.onrender.com/train
ML_TRAINING_SERVICE_KEY=<same ML_SERVICE_KEY>
ML_PROMOTION_SERVICE_URL=https://<service>.onrender.com/promote
```

Then call EdgeForce `POST /api/ml/activate`. V56 will health-check, verify the prediction schema, run the tournament, and only report `ACTIVE` if at least one champion is promoted.
