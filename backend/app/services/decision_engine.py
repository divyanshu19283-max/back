"""
Chartering decision engine.

Turns a forecast (predicted_rate, lower_bound, upper_bound, confidence_score)
plus cargo economics into an actionable recommendation. This is a rule-based
scoring system, not "predicted > current => BUY" — it explicitly weighs:

  - direction and magnitude of expected rate change (pct_change)
  - forecast confidence
  - whether the expected saving clears a risk-adjusted threshold
  - the width of the confidence interval relative to the predicted rate
    (a wide band = high uncertainty = should temper the recommendation
    even if the point estimate looks attractive)

Decision rules (see problem statement section 7):
  - CHARTER_NOW: rates are expected to rise significantly, confidence is
    high, and the projected cost increase (avoided by chartering now)
    clears the risk-adjusted savings threshold.
  - WAIT_MONITOR: forecast is roughly flat / small expected change — no
    strong signal either way, keep watching.
  - WAIT: rates are expected to fall — chartering now would overpay.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict

# thresholds — explicit and documented, not hidden magic numbers
SIGNIFICANT_CHANGE_PCT = 3.0      # >=3% expected move is "significant"
HIGH_CONFIDENCE = 0.75            # >=75% model confidence counted as "high"
RISK_ADJUSTED_SAVING_FLOOR_PCT = 1.5  # expected saving must exceed this
                                        # fraction of current cost, after
                                        # discounting for uncertainty, to
                                        # justify acting now


@dataclass
class CharterDecision:
    recommendation: str          # CHARTER_NOW | WAIT_MONITOR | WAIT
    reason: str
    risk_level: str              # LOW | MEDIUM | HIGH
    confidence: float
    expected_saving: float
    estimated_cost_now: float
    estimated_cost_later: float
    pct_change: float
    risk_adjusted_saving: float

    def as_dict(self):
        return asdict(self)


def _risk_level(confidence: float, band_width_pct: float) -> str:
    if confidence >= 0.85 and band_width_pct <= 6:
        return "LOW"
    if confidence >= 0.65 and band_width_pct <= 12:
        return "MEDIUM"
    return "HIGH"


def evaluate_charter_decision(
    current_rate: float,
    predicted_rate: float,
    lower_bound: float,
    upper_bound: float,
    confidence_score: float,
    cargo_quantity: float,
) -> CharterDecision:
    if current_rate <= 0:
        raise ValueError("current_rate must be positive")

    estimated_cost_now = current_rate * cargo_quantity
    estimated_cost_later = predicted_rate * cargo_quantity
    expected_saving = estimated_cost_later - estimated_cost_now  # positive = rates rising, saved by acting now

    pct_change = (predicted_rate - current_rate) / current_rate * 100
    band_width_pct = (upper_bound - lower_bound) / max(predicted_rate, 1e-6) * 100
    risk = _risk_level(confidence_score, band_width_pct)

    # Discount the raw expected saving by our uncertainty: a wide confidence
    # band means the "true" saving could be much smaller (or negative) than
    # the point estimate suggests, so we shrink it toward the conservative
    # (lower_bound-based) edge, weighted by confidence.
    conservative_future_cost = (
        lower_bound * cargo_quantity if pct_change >= 0 else upper_bound * cargo_quantity
    )
    conservative_saving = conservative_future_cost - estimated_cost_now
    risk_adjusted_saving = confidence_score * expected_saving + (1 - confidence_score) * conservative_saving
    risk_adjusted_saving_pct = risk_adjusted_saving / estimated_cost_now * 100

    if (
        pct_change >= SIGNIFICANT_CHANGE_PCT
        and confidence_score >= HIGH_CONFIDENCE
        and risk_adjusted_saving_pct >= RISK_ADJUSTED_SAVING_FLOOR_PCT
    ):
        recommendation = "CHARTER_NOW"
        reason = (
            f"Rates are projected to rise {pct_change:.1f}% (model confidence "
            f"{confidence_score*100:.0f}%). Risk-adjusted savings from chartering "
            f"now are ~{risk_adjusted_saving_pct:.1f}% of current cost, above the "
            f"{RISK_ADJUSTED_SAVING_FLOOR_PCT}% action threshold."
        )
    elif pct_change <= -SIGNIFICANT_CHANGE_PCT and confidence_score >= HIGH_CONFIDENCE * 0.8:
        recommendation = "WAIT"
        reason = (
            f"Rates are projected to fall {abs(pct_change):.1f}%. Chartering now "
            f"would likely overpay relative to the forecast window; delaying is "
            f"expected to reduce cost."
        )
    else:
        recommendation = "WAIT_MONITOR"
        reason = (
            f"Forecast shows only a {pct_change:+.1f}% expected change, or "
            f"confidence ({confidence_score*100:.0f}%) is too low to act "
            f"decisively. No strong signal to charter now or delay — "
            f"continue monitoring the market."
        )

    return CharterDecision(
        recommendation=recommendation,
        reason=reason,
        risk_level=risk,
        confidence=round(confidence_score, 3),
        expected_saving=round(expected_saving, 2),
        estimated_cost_now=round(estimated_cost_now, 2),
        estimated_cost_later=round(estimated_cost_later, 2),
        pct_change=round(pct_change, 3),
        risk_adjusted_saving=round(risk_adjusted_saving, 2),
    )
