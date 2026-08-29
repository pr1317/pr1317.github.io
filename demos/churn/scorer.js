/*
 * Browser-side scoring for the churn model.
 *
 * The Python pipeline is: engineer features -> median/mode impute -> scale the
 * numerics -> one-hot the categoricals -> logistic regression. Every one of
 * those steps is arithmetic, so the same numbers reproduce here exactly. The
 * fitted parameters live in model.js, written by scripts/export_web_model.py.
 *
 * tests/test_web_scorer.js checks this file against the Python model's own
 * predictions, so the two cannot silently drift apart.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ChurnScorer = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NEGATIVE = ["No", "No phone service", "No internet service"];
  var SERVICE_COLUMNS = [
    "PhoneService", "MultipleLines", "InternetService", "OnlineSecurity",
    "OnlineBackup", "DeviceProtection", "TechSupport", "StreamingTV",
    "StreamingMovies"
  ];

  function tenureBand(tenure) {
    if (tenure <= 6) return "0-6m";
    if (tenure <= 12) return "6-12m";
    if (tenure <= 24) return "1-2y";
    if (tenure <= 48) return "2-4y";
    return "4y+";
  }

  /* Mirror of src/churn/features.py :: engineer */
  function engineer(input) {
    var row = {};
    Object.keys(input).forEach(function (key) { row[key] = input[key]; });

    var tenure = Number(row.tenure) || 0;
    var monthly = Number(row.MonthlyCharges) || 0;
    var total = Number(row.TotalCharges);
    if (!isFinite(total)) total = monthly * tenure;

    // pandas divides by NaN for tenure 0, then fills with MonthlyCharges.
    row.avg_monthly_spend = tenure > 0 ? total / tenure : monthly;
    row.charge_delta = monthly - row.avg_monthly_spend;
    row.services_count = SERVICE_COLUMNS.reduce(function (count, column) {
      return count + (NEGATIVE.indexOf(String(row[column])) === -1 ? 1 : 0);
    }, 0);
    row.tenure_years = tenure / 12.0;
    row.is_new_customer = tenure <= 6 ? 1 : 0;
    row.has_premium_support =
      (row.TechSupport === "Yes" || row.OnlineSecurity === "Yes") ? 1 : 0;
    row.tenure_band = tenureBand(tenure);
    row.TotalCharges = total;
    row.tenure = tenure;
    row.MonthlyCharges = monthly;
    row.SeniorCitizen = Number(row.SeniorCitizen) || 0;
    return row;
  }

  /* Mirror of the fitted ColumnTransformer. */
  function designVector(row, model) {
    var vector = [];

    model.numeric_features.forEach(function (name, i) {
      var value = Number(row[name]);
      if (!isFinite(value)) value = model.numeric_fill[i];
      vector.push((value - model.numeric_mean[i]) / model.numeric_scale[i]);
    });

    model.categorical_features.forEach(function (name, i) {
      var value = row[name];
      if (value === undefined || value === null || value === "") {
        value = model.categorical_fill[i];
      }
      var categories = model.categories[i];
      categories.forEach(function (category) {
        // handle_unknown="ignore" means an unseen level is all zeros.
        vector.push(String(value) === String(category) ? 1 : 0);
      });
    });

    return vector;
  }

  function predictProbability(input, model) {
    model = model || (typeof window !== "undefined" ? window.CHURN_MODEL : null);
    if (!model) throw new Error("model not loaded");

    var vector = designVector(engineer(input), model);
    if (vector.length !== model.coefficients.length) {
      throw new Error(
        "design vector has " + vector.length + " columns but the model has " +
        model.coefficients.length + " coefficients"
      );
    }

    var z = model.intercept;
    for (var i = 0; i < vector.length; i++) {
      z += vector[i] * model.coefficients[i];
    }
    return 1 / (1 + Math.exp(-z));
  }

  /* Per-feature contribution to the log-odds, for the "why" panel. */
  function contributions(input, model) {
    model = model || (typeof window !== "undefined" ? window.CHURN_MODEL : null);
    var row = engineer(input);
    var vector = designVector(row, model);
    var items = [];
    var index = 0;

    model.numeric_features.forEach(function (name) {
      items.push({ name: name, value: row[name], effect: vector[index] * model.coefficients[index] });
      index += 1;
    });

    model.categorical_features.forEach(function (name, i) {
      model.categories[i].forEach(function (category) {
        if (vector[index] === 1) {
          items.push({
            name: name + " = " + category,
            value: category,
            effect: model.coefficients[index]
          });
        }
        index += 1;
      });
    });

    return items.sort(function (a, b) { return Math.abs(b.effect) - Math.abs(a.effect); });
  }

  return {
    engineer: engineer,
    designVector: designVector,
    predictProbability: predictProbability,
    contributions: contributions,
    tenureBand: tenureBand
  };
});
