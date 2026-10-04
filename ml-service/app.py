from __future__ import annotations

import json
import math
import os
import time
import uuid
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBClassifier
except Exception:
    XGBClassifier = None

try:
    from lightgbm import LGBMClassifier
except Exception:
    LGBMClassifier = None

try:
    from catboost import CatBoostClassifier
except Exception:
    CatBoostClassifier = None

try:
    import pymc as pm
except Exception:
    pm = None

SERVICE_VERSION = "edgeforce-ml-service-v55"
MODEL_DIR = Path(os.getenv("MODEL_STORE_DIR", "./model_store")).resolve()
MODEL_DIR.mkdir(parents=True, exist_ok=True)
API_KEY = os.getenv("ML_SERVICE_KEY", "")
MAX_ROWS_PER_GROUP = max(100, int(os.getenv("ML_MAX_ROWS_PER_GROUP", "6000")))
MIN_SAMPLE = max(60, int(os.getenv("ML_MIN_SAMPLE", "100")))
MIN_HOLDOUT = max(15, int(os.getenv("ML_MIN_HOLDOUT", "25")))
PROMOTION_MARGIN = float(os.getenv("ML_PROMOTION_MARGIN", "0.005"))
RANDOM_SEED = int(os.getenv("ML_RANDOM_SEED", "55"))

app = FastAPI(title="EdgeForce ML Tournament Service", version=SERVICE_VERSION)


class TrainingRow(BaseModel):
    occurredAt: str
    features: list[float]
    outcome: int
    marketProbability: float


class TrainingGroup(BaseModel):
    sport: str
    marketKey: str = "*"
    featureNames: list[str]
    rows: list[TrainingRow]


class TrainingRequest(BaseModel):
    schemaVersion: str
    modelVersion: str
    algorithms: list[str] = Field(default_factory=list)
    groups: list[TrainingGroup]


class PredictMarket(BaseModel):
    id: str
    sport: str
    market: str
    featureNames: list[str] = Field(default_factory=list)
    features: list[float] = Field(default_factory=list)


class PredictRequest(BaseModel):
    schemaVersion: str
    markets: list[PredictMarket]


def require_auth(authorization: str | None) -> None:
    if not API_KEY:
        return
    if authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="unauthorized")


def available_algorithms() -> dict[str, bool]:
    return {
        "logistic_l2": True,
        "random_forest": True,
        "hist_gradient_boosting": True,
        "stacking": True,
        "xgboost": XGBClassifier is not None,
        "lightgbm": LGBMClassifier is not None,
        "catboost": CatBoostClassifier is not None,
        "pymc_bayesian_logistic": pm is not None,
    }


def requested_algorithms(requested: list[str]) -> list[str]:
    available = available_algorithms()
    default = [
        "logistic_l2",
        "random_forest",
        "hist_gradient_boosting",
        "xgboost",
        "lightgbm",
        "catboost",
        "stacking",
        "pymc_bayesian_logistic",
    ]
    source = requested or default
    return [name for name in source if available.get(name, False)]


def build_estimator(name: str):
    if name == "logistic_l2":
        return Pipeline([
            ("scale", StandardScaler()),
            ("model", LogisticRegression(
                C=1.0, penalty="l2", solver="lbfgs", max_iter=2500,
                random_state=RANDOM_SEED
            )),
        ])
    if name == "random_forest":
        return RandomForestClassifier(
            n_estimators=350, max_depth=8, min_samples_leaf=8,
            max_features="sqrt", class_weight="balanced_subsample",
            n_jobs=-1, random_state=RANDOM_SEED
        )
    if name == "hist_gradient_boosting":
        return HistGradientBoostingClassifier(
            max_iter=350, learning_rate=0.04, max_leaf_nodes=20,
            l2_regularization=0.15, random_state=RANDOM_SEED
        )
    if name == "xgboost" and XGBClassifier is not None:
        return XGBClassifier(
            n_estimators=450, max_depth=4, learning_rate=0.035,
            subsample=0.85, colsample_bytree=0.85, min_child_weight=5,
            reg_alpha=0.05, reg_lambda=1.2, eval_metric="logloss",
            n_jobs=-1, random_state=RANDOM_SEED
        )
    if name == "lightgbm" and LGBMClassifier is not None:
        return LGBMClassifier(
            n_estimators=450, num_leaves=24, learning_rate=0.035,
            subsample=0.85, colsample_bytree=0.85,
            reg_alpha=0.05, reg_lambda=1.0, verbosity=-1,
            random_state=RANDOM_SEED
        )
    if name == "catboost" and CatBoostClassifier is not None:
        return CatBoostClassifier(
            iterations=450, depth=6, learning_rate=0.035,
            loss_function="Logloss", verbose=False,
            l2_leaf_reg=4.0, random_seed=RANDOM_SEED,
            allow_writing_files=False
        )
    if name == "stacking":
        base = [
            ("lr", build_estimator("logistic_l2")),
            ("rf", build_estimator("random_forest")),
            ("hgb", build_estimator("hist_gradient_boosting")),
        ]
        if XGBClassifier is not None:
            base.append(("xgb", build_estimator("xgboost")))
        return StackingClassifier(
            estimators=base,
            final_estimator=LogisticRegression(max_iter=1500, random_state=RANDOM_SEED),
            stack_method="predict_proba", n_jobs=-1, passthrough=False
        )
    raise ValueError(f"unsupported algorithm: {name}")


class PyMCBayesianLogistic:
    def __init__(self) -> None:
        self.means: np.ndarray | None = None
        self.scales: np.ndarray | None = None
        self.beta: np.ndarray | None = None
        self.intercept = 0.0

    def fit(self, x: np.ndarray, y: np.ndarray):
        if pm is None:
            raise RuntimeError("PyMC is not installed")
        self.means = x.mean(axis=0)
        self.scales = x.std(axis=0)
        self.scales[self.scales < 1e-8] = 1.0
        z = (x - self.means) / self.scales
        draws = max(300, int(os.getenv("PYMC_DRAWS", "500")))
        tune = max(300, int(os.getenv("PYMC_TUNE", "500")))
        with pm.Model() as model:
            alpha = pm.Normal("alpha", 0.0, 1.5)
            beta = pm.Normal("beta", 0.0, 1.0, shape=z.shape[1])
            p = pm.math.sigmoid(alpha + pm.math.dot(z, beta))
            pm.Bernoulli("obs", p=p, observed=y)
            trace = pm.sample(
                draws=draws, tune=tune, chains=2, cores=1,
                random_seed=RANDOM_SEED, progressbar=False,
                target_accept=0.9
            )
        self.intercept = float(trace.posterior["alpha"].mean().values)
        self.beta = np.asarray(trace.posterior["beta"].mean(dim=("chain", "draw")).values, dtype=float)
        return self

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        assert self.means is not None and self.scales is not None and self.beta is not None
        z = (x - self.means) / self.scales
        logits = self.intercept + z @ self.beta
        p = 1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30)))
        return np.column_stack([1.0 - p, p])


def estimator_for(name: str):
    if name == "pymc_bayesian_logistic":
        return PyMCBayesianLogistic()
    return build_estimator(name)


def fit_platt(probabilities: np.ndarray, y: np.ndarray):
    logits = np.log(np.clip(probabilities, 1e-5, 1 - 1e-5) / np.clip(1 - probabilities, 1e-5, 1))
    calibrator = LogisticRegression(C=10.0, solver="lbfgs", max_iter=1000)
    calibrator.fit(logits.reshape(-1, 1), y)
    return calibrator


def calibrated_probability(estimator, calibrator, x: np.ndarray) -> np.ndarray:
    raw = estimator.predict_proba(x)[:, 1]
    logits = np.log(np.clip(raw, 1e-5, 1 - 1e-5) / np.clip(1 - raw, 1e-5, 1))
    return np.clip(calibrator.predict_proba(logits.reshape(-1, 1))[:, 1], 1e-4, 1 - 1e-4)


def calibration_error(probabilities: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    total = len(y)
    if total == 0:
        return 0.0
    error = 0.0
    for i in range(bins):
        low, high = i / bins, (i + 1) / bins
        mask = (probabilities >= low) & (probabilities < high if i < bins - 1 else probabilities <= high)
        n = int(mask.sum())
        if n:
            error += abs(float(probabilities[mask].mean()) - float(y[mask].mean())) * n
    return error / total


def market_metrics(probabilities: np.ndarray, y: np.ndarray) -> dict[str, float]:
    p = np.clip(probabilities, 1e-4, 1 - 1e-4)
    return {
        "brier": float(brier_score_loss(y, p)),
        "logLoss": float(log_loss(y, np.column_stack([1 - p, p]), labels=[0, 1])),
        "accuracy": float(accuracy_score(y, (p >= 0.5).astype(int))),
        "calibrationError": float(calibration_error(p, y)),
    }


def feature_importance(estimator, feature_names: list[str]) -> dict[str, float]:
    model = estimator
    if isinstance(estimator, Pipeline):
        model = estimator.named_steps.get("model", estimator)
    values: np.ndarray | None = None
    if hasattr(model, "feature_importances_"):
        values = np.asarray(model.feature_importances_, dtype=float)
    elif hasattr(model, "coef_"):
        coef = np.asarray(model.coef_, dtype=float)
        values = np.abs(coef[0] if coef.ndim > 1 else coef)
    elif isinstance(model, PyMCBayesianLogistic) and model.beta is not None:
        values = np.abs(model.beta)
    if values is None or len(values) != len(feature_names):
        return {}
    pairs = sorted(zip(feature_names, values.tolist()), key=lambda item: item[1], reverse=True)
    return {name: float(value) for name, value in pairs}


def hyperparameters(estimator) -> dict[str, Any]:
    if hasattr(estimator, "get_params"):
        raw = estimator.get_params(deep=False)
        clean: dict[str, Any] = {}
        for key, value in raw.items():
            if isinstance(value, (str, int, float, bool, type(None))):
                clean[key] = value
        return clean
    return {}


def train_candidate(name: str, group: TrainingGroup) -> tuple[dict[str, Any], Any]:
    rows = sorted(group.rows, key=lambda row: row.occurredAt)[-MAX_ROWS_PER_GROUP:]
    if len(rows) < MIN_SAMPLE:
        raise ValueError(f"insufficient sample: {len(rows)}/{MIN_SAMPLE}")

    x = np.asarray([row.features for row in rows], dtype=float)
    y = np.asarray([row.outcome for row in rows], dtype=int)
    market = np.asarray([row.marketProbability for row in rows], dtype=float)
    if x.ndim != 2 or x.shape[1] != len(group.featureNames):
        raise ValueError("feature shape does not match featureNames")
    if len(np.unique(y)) < 2:
        raise ValueError("training group has only one outcome class")

    train_end = max(1, int(len(rows) * 0.70))
    calibration_end = max(train_end + 1, int(len(rows) * 0.85))
    train_x, train_y = x[:train_end], y[:train_end]
    cal_x, cal_y = x[train_end:calibration_end], y[train_end:calibration_end]
    hold_x, hold_y = x[calibration_end:], y[calibration_end:]
    hold_market = market[calibration_end:]
    if len(hold_y) < MIN_HOLDOUT or len(np.unique(train_y)) < 2 or len(np.unique(cal_y)) < 2:
        raise ValueError("insufficient chronological calibration/holdout diversity")

    estimator = estimator_for(name)
    started = time.time()
    estimator.fit(train_x, train_y)
    cal_raw = np.clip(estimator.predict_proba(cal_x)[:, 1], 1e-4, 1 - 1e-4)
    calibrator = fit_platt(cal_raw, cal_y)
    hold_prob = calibrated_probability(estimator, calibrator, hold_x)

    hold = market_metrics(hold_prob, hold_y)
    baseline = market_metrics(hold_market, hold_y)
    brier_skill = 1.0 - hold["brier"] / baseline["brier"] if baseline["brier"] > 0 else 0.0
    composite = (
        brier_skill * 2.0
        + (baseline["logLoss"] - hold["logLoss"]) * 0.8
        - hold["calibrationError"] * 0.5
    )
    eligible = (
        brier_skill >= 0.01
        and hold["logLoss"] <= baseline["logLoss"] + 0.005
        and hold["calibrationError"] <= 0.12
    )

    model_id = f"{group.sport.lower().replace(' ', '-')}-{group.marketKey.lower().replace(' ', '-')}-{name}-{uuid.uuid4().hex[:10]}"
    artifact = {
        "serviceVersion": SERVICE_VERSION,
        "modelId": model_id,
        "sport": group.sport,
        "marketKey": group.marketKey,
        "algorithm": name,
        "featureNames": group.featureNames,
        "estimator": estimator,
        "calibrator": calibrator,
    }
    artifact_path = MODEL_DIR / f"{model_id}.joblib"
    joblib.dump(artifact, artifact_path, compress=3)

    result = {
        "algorithm": name,
        "serviceModelId": model_id,
        "artifactUri": str(artifact_path),
        "sampleSize": len(rows),
        "trainSize": len(train_y),
        "calibrationSize": len(cal_y),
        "holdoutSize": len(hold_y),
        "holdoutBrier": hold["brier"],
        "holdoutLogLoss": hold["logLoss"],
        "holdoutAccuracy": hold["accuracy"],
        "marketBaselineBrier": baseline["brier"],
        "marketBaselineLogLoss": baseline["logLoss"],
        "brierSkillScore": brier_skill,
        "calibrationError": hold["calibrationError"],
        "compositeScore": composite,
        "eligible": eligible,
        "featureImportance": feature_importance(estimator, group.featureNames),
        "hyperparameters": hyperparameters(estimator),
        "trainingSeconds": time.time() - started,
    }
    return result, artifact


def champion_manifest_path(sport: str, market_key: str) -> Path:
    key = f"{sport.lower().replace(' ', '-')}-{market_key.lower().replace(' ', '-')}"
    return MODEL_DIR / f"champion-{key}.json"


def save_champion(sport: str, market_key: str, candidate: dict[str, Any]) -> None:
    manifest = {
        "sport": sport,
        "marketKey": market_key,
        "algorithm": candidate["algorithm"],
        "serviceModelId": candidate["serviceModelId"],
        "artifactUri": candidate["artifactUri"],
        "compositeScore": candidate["compositeScore"],
        "brierSkillScore": candidate["brierSkillScore"],
        "updatedAt": time.time(),
        "serviceVersion": SERVICE_VERSION,
    }
    champion_manifest_path(sport, market_key).write_text(json.dumps(manifest, indent=2))


def load_champion(sport: str, market_key: str) -> dict[str, Any] | None:
    exact = champion_manifest_path(sport, market_key)
    broad = champion_manifest_path(sport, "*")
    path = exact if exact.exists() else broad
    if not path.exists():
        return None
    return json.loads(path.read_text())


def load_artifact(model_id: str) -> dict[str, Any]:
    path = MODEL_DIR / f"{model_id}.joblib"
    if not path.exists():
        raise FileNotFoundError(model_id)
    return joblib.load(path)


@app.get("/health")
def health():
    return {
        "ok": True,
        "serviceVersion": SERVICE_VERSION,
        "modelStore": str(MODEL_DIR),
        "algorithms": available_algorithms(),
    }


@app.post("/train")
def train(req: TrainingRequest, authorization: str | None = Header(default=None)):
    require_auth(authorization)
    if req.schemaVersion != "edgeforce-ml-train-v1":
        raise HTTPException(status_code=400, detail="unsupported schemaVersion")

    algorithms = requested_algorithms(req.algorithms)
    groups_out: list[dict[str, Any]] = []
    for group in req.groups:
        candidates: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        for name in algorithms:
            try:
                candidate, _ = train_candidate(name, group)
                candidates.append(candidate)
            except Exception as exc:
                errors.append({"algorithm": name, "error": str(exc)[:500]})

        eligible = sorted(
            [candidate for candidate in candidates if candidate["eligible"]],
            key=lambda row: (row["compositeScore"], row["brierSkillScore"]),
            reverse=True,
        )
        champion = eligible[0] if eligible else None
        challenger = eligible[1] if len(eligible) > 1 else None
        if champion:
            champion["role"] = "CHAMPION"
            save_champion(group.sport, group.marketKey, champion)
        if challenger:
            challenger["role"] = "CHALLENGER"
        for candidate in candidates:
            candidate.setdefault("role", "HELD")
            if candidate["eligible"] and candidate["role"] == "HELD":
                candidate["role"] = "MONITORED"

        groups_out.append({
            "sport": group.sport,
            "marketKey": group.marketKey,
            "featureNames": group.featureNames,
            "candidates": candidates,
            "champion": champion,
            "challenger": challenger,
            "errors": errors,
        })

    return {
        "ok": True,
        "schemaVersion": "edgeforce-ml-train-result-v1",
        "serviceVersion": SERVICE_VERSION,
        "algorithmsAvailable": available_algorithms(),
        "groups": groups_out,
    }


@app.post("/predict")
def predict(req: PredictRequest, authorization: str | None = Header(default=None)):
    require_auth(authorization)
    if req.schemaVersion != "edgeforce-ml-predict-v1":
        raise HTTPException(status_code=400, detail="unsupported schemaVersion")

    predictions: list[dict[str, Any]] = []
    warnings: list[str] = []
    cache: dict[str, dict[str, Any]] = {}

    for market in req.markets:
        champion = load_champion(market.sport, market.market)
        if not champion:
            warnings.append(f"no champion for {market.sport}/{market.market}")
            continue
        model_id = champion["serviceModelId"]
        try:
            artifact = cache.get(model_id)
            if artifact is None:
                artifact = load_artifact(model_id)
                cache[model_id] = artifact
            if artifact["featureNames"] != market.featureNames:
                warnings.append(f"feature contract mismatch for {market.id}")
                continue
            x = np.asarray([market.features], dtype=float)
            p = float(calibrated_probability(artifact["estimator"], artifact["calibrator"], x)[0])
            confidence = min(
                0.97,
                max(0.20, 0.58 + max(-0.10, float(champion.get("brierSkillScore", 0))) * 1.7),
            )
            predictions.append({
                "marketId": market.id,
                "probability": p,
                "confidence": confidence,
                "model": champion["algorithm"],
                "version": model_id,
                "serviceModelId": model_id,
            })
        except Exception as exc:
            warnings.append(f"{market.id}: {str(exc)[:240]}")

    return {
        "ok": True,
        "schemaVersion": "edgeforce-ml-predict-result-v1",
        "serviceVersion": SERVICE_VERSION,
        "modelVersion": SERVICE_VERSION,
        "predictions": predictions,
        "warnings": warnings[:100],
    }
