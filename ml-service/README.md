# EdgeForce V59 ML Tournament Service

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
- `POST /retire` using schema `edgeforce-ml-retire-v1`
- `POST /predict` using schema `edgeforce-ml-predict-v1`

Set `ML_SERVICE_KEY` to require Bearer authentication.

## Persistent model storage

Set `MODEL_STORE_DIR` to a persistent volume. The service writes serialized artifacts and champion manifests there. Do not use ephemeral storage in production unless losing trained artifacts on redeploy is acceptable.

## Local container

```bash
docker build -f ml-service/Dockerfile -t edgeforce-ml .
docker run --rm -p 8080:10000 \
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
ML_RETIRE_SERVICE_URL=http://localhost:8080/retire
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
ML_RETIRE_SERVICE_URL=https://<service>.onrender.com/retire
```

Then call EdgeForce `POST /api/ml/activate`. V56 will health-check, verify the prediction schema, run the tournament, and only report `ACTIVE` if at least one champion is promoted.


## V57 deployment automation

The root workflow `.github/workflows/deploy-ml-service.yml` can deploy and verify this service after Edgeforce verification succeeds.

Preferred credentials:
- `RENDER_API_KEY`
- `RENDER_ML_SERVICE_ID`

Fallback:
- `RENDER_ML_DEPLOY_HOOK_URL`

Shared runtime values:
- `RENDER_ML_SERVICE_BASE_URL`
- `ML_SERVICE_KEY`
- `ML_ACTIVATION_SECRET`
- `EDGEFORCE_PRODUCTION_URL`

The API path requests an exact commit deployment. The service exposes Render's `RENDER_GIT_COMMIT` and related runtime metadata from `/health`, allowing `scripts/ml-service-doctor.mjs` to verify the container that is actually running.

After service verification, V57 ensures the Edgeforce production runtime has the ML endpoints and credentials, runs the existing hardened Edgeforce production deployment, executes the ML activation workflow, and records `/api/ml/deploy-attest`.

A healthy service with no promoted champion is reported as `READY_AWAITING_EVIDENCE`, not `ACTIVE`.


## V59 champion retirement

V59 adds authenticated `POST /retire`.

The endpoint accepts:
- sport
- market key
- exact service model ID
- retirement reason

It refuses retirement when the requested model ID no longer matches the active champion manifest. A successful retirement archives the manifest under `MODEL_STORE_DIR/retired` before removing the active manifest. The serialized `.joblib` artifact remains on persistent storage for audit and future analysis.

Edgeforce calls this endpoint only after the live drift monitor records repeated critical degradation with new settled evidence.
