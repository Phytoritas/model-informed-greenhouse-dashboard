# RTR Calibration Window Selection

## Purpose
- Record which good-production windows were enabled for the concept-demo RTR calibration pass.

## Method
- The sample CSVs only expose environment history, not yield or harvest annotations.
- For this repository pass, windows were selected heuristically from fully covered daily RTR points.
- Candidate windows were ranked by rolling fit quality after the existing daily quality filters:
  - higher `R²`
  - lower `MAE`
  - contiguous coverage
  - avoidance of obvious dataset edges or partial trailing days

## Selected Windows
- Tomato: `2024-08-06` to `2024-08-26`
  - 21-day window
  - fitted line: `T24 = 18.553 + 0.7913 × radiation sum`
  - fit quality: `R² 0.9831`, `MAE 0.1017°C`
- Cucumber: `2021-04-15` to `2021-05-12`
  - 28-day requested window, 27 quality-filtered days retained
  - fitted line: `T24 = 18.132 + 0.3099 × radiation sum`
  - fit quality: `R² 0.8973`, `MAE 0.2542°C`

## Limitation
- These windows are suitable for a concept/demo calibration because the repository does not yet carry explicit yield, stress, or grower-approved good-production labels.
- Replace them when crop-performance annotations become available.
