# ---
# TomatoModel.py - Tomato Growth (TOMSIM) and Energy Balance Model
# ---
# Description:
# This Python script implements a standalone tomato growth model that reads
# input data from CSV files and outputs results to CSV files. It follows TOMSIM (Heuvelink, 1996)
# with per-step growth & partition, TDVS (truss development stage) integration from FDVR(T, stage),
# and Heuvelink's Richards-derivative form for truss potential growth rate.
#
# Key Features:
# - TOMSIM Growth Model: Complete implementation of Heuvelink's tomato growth model
# - Truss Development: Age-structured fruit cohorts with TDVS progression
# - Energy Balance: Iteratively calculates canopy temperature
# - FvCB Photosynthesis: Joubert 2023 tomato-specific parameters
# - CSV Integration: Reads input from CSV files and outputs results to CSV files
# - Harvest Logic: Automatic harvesting when trusses reach maturity
# ---

import pandas as pd
import numpy as np
import os
import math
import logging
from datetime import datetime, timedelta

from model_informed_greenhouse_dashboard.numerics import solve_scalar_root

# Photon energy conversion (MJ per µmol PAR)
PHOTON_UMOL_TO_MJ = 0.218e-6

# --- Logging Setup ---
try:
    thisModule = os.path.splitext(os.path.basename(__file__))[0]
    log_dir = os.path.dirname(os.path.abspath(__file__))
    log_file_path = os.path.join(log_dir, f"{thisModule}.log")
except NameError:
    thisModule = "TomatoModel"
    log_file_path = f"{thisModule}.log"

logger = logging.getLogger(thisModule)
logger.setLevel(logging.INFO)
if not logger.handlers:
    # Use NullHandler to avoid file locking issues in multiprocessing
    # The parent logger will handle actual logging
    handler = logging.NullHandler()
    logger.addHandler(handler)
    logger.propagate = True  # Allow propagation to parent logger


# --- Utility Functions ---
def check_and_clip_value(value, min_val, max_val, default_val=0):
    """Checks for NaN/inf and clips value to a defined range."""
    if not np.isfinite(value):
        logger.warning(f"Invalid value detected: {value}. Using default: {default_val}")
        return default_val
    return np.clip(value, min_val, max_val)


# --- Main Model Class ---
class TomatoModel:
    def __init__(self):
        """Initializes the integrated tomato growth and energy balance model."""
        logger.info("Initializing TomatoModel (per-step + Heuvelink PGR + FDVR)")

        # --- Modes / Toggles ---
        self.photosyn_mode = "fvcb_canopy"  # or "tomsim_canopy"
        self.use_age_structured_sink = True  # Heuvelink original path

        # --- Energy Balance Constants ---
        self.rho_a = 1.225
        self.c_p = 1004
        self.gamma = 67
        self.sigma = 5.67e-8
        self.lambda_v = 2.45e6
        self.alpha_c = 0.15
        self.emissivity_c = 0.98
        self.W_TO_UMOL_CONVERSION = 4.6

        # Characteristic leaf dimension (m) for resistances
        self.leaf_dimension = 0.15
        # Canopy extinction coefficient (diffuse-equivalent per TOMSIM card)
        self.k_ext = 0.72

        # --- FvCB parameters (leaf-scale)
        self.fcvb_params = {
            "V_Ha": 91185,
            "R": 8.314,
            "V_S": 650,
            "V_Hd": 202900,
            "J_Ha": 79500,
            "J_S": 650,
            "J_Hd": 201000,
            "O": 210,
            "a": 0.3,
            "default_theta": 0.7,
        }
        self.rank_params = {
            "rank_else": {
                "Vcmax_25": 99.25,
                "Jmax_25": 190.68,
                "Rd_25": 1.00,
                "theta": 0.88,
            }
        }

        # Joubert 2023 tomato leaf FvCB (steady-state) parameters
        self.joubert_params = {
            "Vcmax": 99.25,  # umol m^-2 s^-1
            "Jmax": 190.68,  # umol m^-2 s^-1
            "Rd": 1.0,  # umol m^-2 s^-1
            "theta_J": 0.41,  # unitless
            "gamma_J": 0.9,  # unitless
            # Arrhenius forms (kJ-based)
            "c1": 19.02,  # Gamma*
            "dHa1_kJ": 37.83,
            "c2": 12.3772,  # Ko (kPa)
            "dHa2_kJ": 23.72,
            "c3": 37.96,  # Kc (umol mol^-1)
            "dHa3_kJ": 79.43,
            "R1_kJ": 0.008314,
            "O_i_kPa": 21.0,
        }

        # --- TOMSIM Parameters ---
        self.MAINT_25C = {"lv": 0.03, "st": 0.015, "rt": 0.01, "fr": 0.01}
        self.ASR = {"lv": 1.39, "st": 1.45, "rt": 1.39, "fr": 1.37}
        self.Q10_maint = 2.0
        self.f_Rm_RGR = 33.0

        # --- Plant Density Parameters ---
        self.plants_per_m2 = 1.836091  # Default: 1 plant per m²
        self.shoots_per_plant = 1.0  # Default: 1 shoot per plant
        self.shoots_per_m2 = (
            self.plants_per_m2 * self.shoots_per_plant
        )  # Derived parameter

        # Vegetative sink strength per shoot (g d^-1), TOMSIM convention
        self.veg_sink_g_d_per_shoot = 2.8
        # Fruit/truss parameters
        self.n_f = 2  # fruits per truss (pruned)
        # Heuvelink (Richards) PGR params (absolute truss PGR for 1 fruit)
        self.pgr_params = {"a": 0.138, "b": 4.34, "c": 0.278, "d": 1.31}
        # TDVS bounds (TOMSIM original uses 0–1 end at harvest)
        self.tdvs_min = 0.0
        self.tdvs_max = 1.0
        # Harvest threshold per truss (g DM) - realistic value for mature truss
        # Typical: 4-6 fruits * 15-20g DM each = 60-120g DM per truss
        self.harvest_truss_dm_g = 80.0  # Use conservative threshold to avoid premature harvest
        # LAI ceiling
        self.LAI_max = 3.0
        # Root share: 15% of shoot ⇒ 0.15/1.15 of total vegetative
        self.root_frac_of_total_veg = 0.15 / 1.15
        # Reserve CH2O pool (g CH2O m^-2) for sink saturation rule
        self.reserve_ch2o_g = 0.0
        # FR(T) valid range guard (18–23 °C validated in data)
        self.fr_T_min_valid = 18.0
        self.fr_T_max_valid = 23.0
        self.fr_clamp_to_valid = False
        # Optional per-cohort Nf queue for upcoming trusses
        self.pending_n_fruits = []

        # --- Initialize State Variables ---
        self.reset_state()

    def reset_state(self):
        """Resets all state variables to initial conditions."""
        self.start_date = datetime(2021, 2, 23)
        self.last_calc_time = None
        self.current_date = self.start_date.date()

        # Masses (g DM m^-2)
        self.W_lv = 50.0
        self.W_st = 20.0
        self.W_rt = 10.0
        self.W_fr = 0.0
        self.W_fr_harvested = 0.0

        # SLA initialization (m2 g^-1): 266 + 88 sin(2π(DoY+68)/365) [cm2 g^-1]
        init_doy = self.start_date.timetuple().tm_yday
        sla_cm2_per_g = 266.0 + 88.0 * np.sin(2 * np.pi * (init_doy + 68) / 365.0)
        self.SLA = max(0.0001, sla_cm2_per_g / 10000.0)
        self.LAI = self.W_lv * self.SLA

        # Environment & EB state
        self.T_c = 293.15
        self.T_a = 293.15
        self.H = 0.0
        self.LE = 0.0
        self.r_ah = 50.0
        self.r_b = 50.0
        self.f_c = 0.1
        self.convergence_status_Tc = False
        self.co2_flux_g_m2_s = 0.0
        self.dt_seconds = 0.0

        # Daily accumulators (for diagnostics & ε)
        self.daily_temp_accumulator = []
        self.daily_gross_ch2o_g = 0.0
        self.daily_par_umol_in_sum = 0.0
        self.daily_par_umol_int_sum = 0.0
        self.daily_dW_total = 0.0
        self.daily_transpiration_g = 0.0  # per-step dW accumulate for ε
        self.last_daily_dW_total = 0.0
        self.last_daily_epsilon = 0.0
        self.recent_total_dm_history = []
        self.last_RGR = 0.03

        # Transpiration (diagnostics)
        self.daily_transpiration_g = 0.0  # g m^-2, accumulate during the day
        self.last_daily_transpiration_g = 0.0  # g m^-2, previous day's total
        
        # Canopy stomatal conductance (for UI/diagnostics)
        self.last_gsw_canopy = 0.0  # m/s, last calculated canopy conductance

        # Truss development state (E_truss_rate) - use original FR-based creation (no pre-seeding)
        self.truss_count = 0
        self._truss_fraction_acc = 0.0
        # Cohorts: list of dicts with keys {"tdvs", "n_fruits", "w_fr_cohort", "active"}
        self.truss_cohorts = []

    def load_input_data(self, csv_file_path):
        """
        Load input data from CSV file.
        Expected columns:
        - datetime: Date and time (YYYY-MM-DD HH:MM:SS format)
        - T_air_C: Air temperature (°C)
        - PAR_umol: PAR radiation (μmol m-2 s-1)
        - CO2_ppm: CO2 concentration (ppm)
        - RH_percent: Relative humidity (%)
        - wind_speed_ms: Wind speed (m/s)
        - n_fruits_per_truss: Number of fruits per truss (optional, default 4)
        """
        try:
            df = pd.read_csv(csv_file_path)
            logger.info(f"Loaded input data from {csv_file_path}")

            # Convert datetime column
            df["datetime"] = pd.to_datetime(df["datetime"])

            # Check required columns
            required_columns = [
                "datetime",
                "T_air_C",
                "PAR_umol",
                "CO2_ppm",
                "RH_percent",
                "wind_speed_ms",
            ]
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {missing_columns}")

            # Add optional columns with default values if not present
            if "n_fruits_per_truss" not in df.columns:
                df["n_fruits_per_truss"] = 4

            return df

        except Exception as e:
            logger.error(f"Error loading input data: {e}")
            raise

    def run_simulation(self, input_df, output_csv_path=None):
        """
        Run the complete simulation using input data from DataFrame.
        Returns a DataFrame with simulation results.
        """
        logger.info("Starting CSV simulation")

        # Reset state for new simulation
        self.reset_state()

        # Prepare results list
        results = []

        # Set start date from first data point
        if not input_df.empty:
            self.start_date = input_df.iloc[0]["datetime"]
            self.current_date = self.start_date.date()
            self.last_calc_time = self.start_date

        # Process each timestep
        for idx, row in input_df.iterrows():
            try:
                # Calculate time step
                current_time = row["datetime"]
                if idx == 0:
                    dt_seconds = 3600.0  # Assume 1 hour for first timestep
                else:
                    dt_seconds = (current_time - self.last_calc_time).total_seconds()

                self.dt_seconds = dt_seconds

                # Update inputs from CSV row
                self.update_inputs_from_row(row)

                # Run timestep calculations
                self.run_timestep_calculations(dt_seconds, current_time)

                # Store results
                result_row = self.get_current_outputs(current_time)
                results.append(result_row)

                self.last_calc_time = current_time

                if idx % 100 == 0:  # Log progress every 100 steps
                    logger.info(f"Processed {idx+1}/{len(input_df)} timesteps")

            except Exception as e:
                logger.error(f"Error processing timestep {idx}: {e}")
                # Add error row with NaN values
                error_row = self.get_error_outputs(current_time)
                results.append(error_row)

        # Convert results to DataFrame
        results_df = pd.DataFrame(results)

        # Save to CSV if path provided
        if output_csv_path:
            results_df.to_csv(output_csv_path, index=False)
            logger.info(f"Results saved to {output_csv_path}")

        logger.info("CSV simulation completed")
        return results_df

    def update_inputs_from_row(self, row):
        """Update model inputs from a CSV row."""
        self.T_a = float(check_and_clip_value(row["T_air_C"], -50, 100, 20)) + 273.15
        self.u_PAR = float(check_and_clip_value(row["PAR_umol"], 0, 3000, 0))
        self.u_CO2 = float(check_and_clip_value(row["CO2_ppm"], 300, 2000, 400))
        self.RH = float(check_and_clip_value(row["RH_percent"], 0, 100, 70)) / 100.0
        self.u = float(check_and_clip_value(row["wind_speed_ms"], 0.01, 10, 0.1))
        self.n_f = int(check_and_clip_value(row["n_fruits_per_truss"], 1, 12, 4))
        self.Ci = self.u_CO2 * 0.7

    def get_current_outputs(self, current_time):
        """Get current model outputs as a dictionary."""
        transpiration_rate_g_s_m2 = (
            (self.LE / self.lambda_v * 1000) if self.lambda_v > 0 else 0.0
        )
        transpiration_amount_g_m2 = transpiration_rate_g_s_m2 * self.dt_seconds

        return {
            "datetime": current_time,
            "LAI": check_and_clip_value(self.LAI, 0, 100, 0.1),
            "T_canopy_C": check_and_clip_value(self.T_c - 273.15, -50, 100, 20),
            "total_dry_weight_g_m2": check_and_clip_value(
                self.W_lv + self.W_st + self.W_rt + self.W_fr, 0, 1e6, 0
            ),
            "sensible_heat_W_m2": check_and_clip_value(self.H, -2000, 2000, 0),
            "latent_heat_W_m2": check_and_clip_value(self.LE, -2000, 2000, 0),
            "transpiration_g_m2": check_and_clip_value(
                transpiration_amount_g_m2, 0, 1e6, 0
            ),
            "energy_balance_converged": float(self.convergence_status_Tc),
            "n_fruits_per_truss": float(self.n_f),
            "leaf_dry_weight_g_m2": check_and_clip_value(self.W_lv, 0, 1e6, 0),
            "fruit_dry_weight_g_m2": check_and_clip_value(self.W_fr, 0, 1e6, 0),
            "stem_dry_weight_g_m2": check_and_clip_value(self.W_st, 0, 1e6, 0),
            "root_dry_weight_g_m2": check_and_clip_value(self.W_rt, 0, 1e6, 0),
            "co2_flux_g_m2_s": check_and_clip_value(self.co2_flux_g_m2_s, -1, 1, 0),
            "crop_efficiency": check_and_clip_value(self._calculate_current_epsilon(), 0, 10, 0),
            "truss_count": float(self.truss_count),
            "transpiration_rate_g_s_m2": check_and_clip_value(
                transpiration_rate_g_s_m2, 0, 1e6, 0
            ),
            "daily_transpiration_mm": check_and_clip_value(
                self.last_daily_transpiration_g / 1000.0, 0, 1e6, 0
            ),
            "current_transpiration_mm": check_and_clip_value(
                self.daily_transpiration_g / 1000.0, 0, 1e6, 0
            ),
            "harvested_fruit_g_m2": check_and_clip_value(
                self.W_fr_harvested, 0, 1e7, 0
            ),
            "fractional_cover": check_and_clip_value(self.f_c, 0, 1, 0.1),
            "SLA_m2_g": self.SLA,
            "active_trusses": self._count_active_trusses(),
        }

    def get_error_outputs(self, current_time):
        """Get error outputs (NaN values) when calculation fails."""
        return {
            "datetime": current_time,
            "LAI": np.nan,
            "T_canopy_C": np.nan,
            "total_dry_weight_g_m2": np.nan,
            "sensible_heat_W_m2": np.nan,
            "latent_heat_W_m2": np.nan,
            "transpiration_g_m2": np.nan,
            "energy_balance_converged": 0.0,
            "n_fruits_per_truss": np.nan,
            "leaf_dry_weight_g_m2": np.nan,
            "fruit_dry_weight_g_m2": np.nan,
            "stem_dry_weight_g_m2": np.nan,
            "root_dry_weight_g_m2": np.nan,
            "co2_flux_g_m2_s": np.nan,
            "crop_efficiency": np.nan,
            "truss_count": np.nan,
            "transpiration_rate_g_s_m2": np.nan,
            "daily_transpiration_mm": np.nan,
            "current_transpiration_mm": np.nan,
            "harvested_fruit_g_m2": np.nan,
            "fractional_cover": np.nan,
            "SLA_m2_g": np.nan,
            "active_trusses": np.nan,
        }

    # ----------------------------------------
    # Core Simulation Logic (from original model)
    # ----------------------------------------

    def run_timestep_calculations(self, dt_seconds, current_time):
        """Orchestrates the calculations for a single timestep."""
        # Store dt_seconds for later use (transpiration calculation, etc.)
        self.dt_seconds = dt_seconds
        
        sim_date = current_time.date()

        # Daily boundary: diagnostics (no growth move), SLA update, FR-based truss creation, ε calc
        if sim_date > self.current_date:
            self.update_daily_boundary(sim_date)
            self.current_date = sim_date

        # Update LAI and vegetation cover for energy balance/photosynthesis
        self.LAI = self.calculate_current_lai()
        self.f_c = self.calculate_vegetation_cover()

        # Solve energy balance
        self.solve_coupled_energy_balance()

        # Compute instantaneous canopy gross photosynthesis and respiration
        total_gross_photosynthesis_rate_umol, _, _ = (
            self.calculate_canopy_photosynthesis(self.T_c)
        )
        instantaneous_rm_g_ch2o = self.calculate_instantaneous_respiration(self.T_c)

        # Net canopy CO2 flux (g CO2 m^-2 s^-1)
        p_gross_g_co2 = total_gross_photosynthesis_rate_umol * 1e-6 * 44.01
        r_g_co2 = instantaneous_rm_g_ch2o * (44.01 / 30.03)
        self.co2_flux_g_m2_s = p_gross_g_co2 - r_g_co2

        # Accumulate day totals for ε and diagnostics
        self.daily_temp_accumulator.append((self.T_a, dt_seconds))
        gross_ch2o_prod_g = (
            total_gross_photosynthesis_rate_umol * 1e-6 * 30.03
        ) * dt_seconds
        self.daily_gross_ch2o_g += max(0.0, gross_ch2o_prod_g)
        self.daily_par_umol_in_sum += max(0.0, self.u_PAR) * dt_seconds
        par_int_umol_s = max(
            0.0, self.u_PAR * (1.0 - np.exp(-self.k_ext * max(0.0, self.LAI)))
        )
        self.daily_par_umol_int_sum += par_int_umol_s * dt_seconds

        # Transpiration step accumulation (g m^-2)
        transpiration_rate_g_s_m2 = (
            (self.LE / self.lambda_v * 1000) if self.lambda_v > 0 else 0.0
        )
        if transpiration_rate_g_s_m2 < 0.0:
            transpiration_rate_g_s_m2 = 0.0
        self.daily_transpiration_g += transpiration_rate_g_s_m2 * dt_seconds

        # --- Per-step growth allocation (TOMSIM style on timestep) ---
        # Effective maintenance respiration (g CH2O m^-2 s^-1)
        rm_base_g_s = self.calculate_instantaneous_respiration(self.T_c)
        rgr_used = getattr(self, "last_RGR", 0.03)
        rm_eff_factor = 1.0 - np.exp(-self.f_Rm_RGR * max(0.0, rgr_used))
        rm_eff_g_s = rm_base_g_s * rm_eff_factor

        net_ch2o_step_g = max(0.0, gross_ch2o_prod_g - rm_eff_g_s * dt_seconds)

        # ---- Cohort TDVS update with FDVR (per step) ----
        T_C = self.T_a - 273.15
        for c in self.truss_cohorts:
            if not c.get("active", True):
                continue
            c["tdvs"] = self._advance_tdvs_with_fdvr(c["tdvs"], T_C, dt_seconds)
            if c["tdvs"] >= self.tdvs_max:
                c["active"] = False

        # Partition fractions from sink strengths (Heuvelink original absolute units)
        if self.use_age_structured_sink:
            per_truss_sinks_gd = self._compute_per_truss_sinks_gd()
            S_fr_g_d = sum(per_truss_sinks_gd)
        else:
            # Fallback: count active trusses (simple), scale by a nominal single-fruit peak PGR
            active_trusses = self._count_active_trusses()
            nominal_singlefruit_pgr = 1.0  # g d^-1 placeholder
            S_fr_g_d = active_trusses * self.n_f * nominal_singlefruit_pgr
            per_truss_sinks_gd = []  # No individual sinks available in this mode

        S_veg_g_d = max(1e-9, float(self.veg_sink_g_d_per_shoot * self.shoots_per_m2))
        S_total_g_d = S_fr_g_d + S_veg_g_d
        if S_total_g_d > 1e-9:
            F_fr_total = S_fr_g_d / S_total_g_d
        else:
            F_fr_total = 0.0

        F_veg_total = 1.0 - F_fr_total
        # Root = 15% of shoot ⇒ 0.15/1.15 of total vegetative (Heuvelink)
        F_rt = F_veg_total * self.root_frac_of_total_veg
        F_shoot = F_veg_total - F_rt
        # Leaf:stem within shoot = 7:3
        F_lv = F_shoot * 0.7
        F_st = F_shoot * 0.3

        # Conversion efficiency Cf (per-step, using current partition)
        denom_cf = (
            self.ASR["lv"] * F_lv
            + self.ASR["st"] * F_st
            + self.ASR["rt"] * F_rt
            + self.ASR["fr"] * F_fr_total
        )
        C_f = 1.0 / denom_cf if denom_cf > 1e-12 else 0.0

        # --- Sink saturation + reserve CH2O rule ---
        S_total_dm_d = S_fr_g_d + S_veg_g_d
        cap_dm_step = S_total_dm_d * (dt_seconds / 86400.0)
        if C_f <= 1e-12:
            required_ch2o_for_cap = float("inf")
            allowed_dm_by_supply = 0.0
        else:
            # CH2O supply this step = net + reserves
            ch2o_supply = max(0.0, net_ch2o_step_g + self.reserve_ch2o_g)
            required_ch2o_for_cap = cap_dm_step / C_f
            allowed_dm_by_supply = C_f * ch2o_supply
        if allowed_dm_by_supply >= cap_dm_step:
            dW_total_step = cap_dm_step
            used_ch2o = 0.0 if C_f <= 1e-12 else required_ch2o_for_cap
            self.reserve_ch2o_g = max(0.0, ch2o_supply - used_ch2o)
        else:
            dW_total_step = allowed_dm_by_supply
            self.reserve_ch2o_g = 0.0
        if dW_total_step > 0.0:
            self.W_lv = max(0.0, self.W_lv + dW_total_step * F_lv)
            self.W_st = max(0.0, self.W_st + dW_total_step * F_st)
            self.W_rt = max(0.0, self.W_rt + dW_total_step * F_rt)

            # --- Fruit DM partitioning to cohorts ---
            dW_fr_total_step = dW_total_step * F_fr_total
            if (
                dW_fr_total_step > 0
                and S_fr_g_d > 1e-9
                and self.use_age_structured_sink
            ):
                for i, cohort in enumerate(self.truss_cohorts):
                    # Distribute growth only to active cohorts that have a sink
                    if cohort.get("active", True) and i < len(per_truss_sinks_gd):
                        truss_sink_share = per_truss_sinks_gd[i] / S_fr_g_d
                        dW_cohort = dW_fr_total_step * truss_sink_share
                        cohort["w_fr_cohort"] += dW_cohort
            elif dW_fr_total_step > 0:
                # Fallback for non-structured sink mode: add to total fruit weight
                # This mode is not compatible with harvesting individual trusses.
                self.W_fr += dW_fr_total_step

            # Update total fruit weight by summing up individual truss weights
            if self.use_age_structured_sink:
                self.W_fr = sum(c.get("w_fr_cohort", 0.0) for c in self.truss_cohorts)

            # Update LAI immediately with current SLA
            self.LAI = self.W_lv * self.SLA

            # Enforce LAI ceiling by defoliation (removing excess leaf DM)
            if self.LAI > self.LAI_max and self.SLA > 1e-9:
                excess_lai = self.LAI - self.LAI_max
                excess_w_lv = excess_lai / self.SLA
                self.W_lv -= excess_w_lv  # Remove excess leaf mass from the system
                self.LAI = self.LAI_max  # Set LAI to the ceiling value

            # Accumulate per-day for ε & RGR calc
            self.daily_dW_total += dW_total_step

            # Legacy/compat fields
            self.part_veg = F_veg_total
            self.part_fruit = F_fr_total
            self.vegetative_dw = self.W_lv + self.W_st + self.W_rt
            self.fruit_dw = self.W_fr

        # Immediate harvest: remove any matured/inactive cohorts at the timestep
        # to avoid unrealistically large single-day harvest spikes.
        matured_indices = []
        harvested_now = 0.0
        for idx, cohort in enumerate(self.truss_cohorts):
            tdvs = cohort.get("tdvs", 0.0)
            is_active = cohort.get("active", True)
            if (not is_active) or (tdvs >= self.tdvs_max):
                harvested_now += max(0.0, cohort.get("w_fr_cohort", 0.0))
                matured_indices.append(idx)
        if matured_indices:
            # Remove matured cohorts from oldest to newest indexes
            for i in reversed(matured_indices):
                del self.truss_cohorts[i]
            self.W_fr_harvested += harvested_now
            # Recompute remaining total fruit dry mass
            self.W_fr = sum(c.get("w_fr_cohort", 0.0) for c in self.truss_cohorts)
            logger.info(
                f"Step-harvested {harvested_now:.2f} g DM of fruit. Total harvested: {self.W_fr_harvested:.2f} g."
            )

    def update_daily_boundary(self, sim_date):
        """Called when date changes. Updates SLA, truss creation by FR(T), ε and RGR, and resets day accumulators.
        No direct redistribution of growth here (per-step already applied)."""
        logger.info(f"Daily boundary update: {sim_date}")

        # Mean daily temperature (for FR and diagnostics)
        total_duration = sum(item[1] for item in self.daily_temp_accumulator)
        if total_duration > 0:
            weighted_temp_sum = sum(
                item[0] * item[1] for item in self.daily_temp_accumulator
            )
            avg_temp_k = weighted_temp_sum / total_duration
        else:
            avg_temp_k = self.T_a
        avg_temp_c = avg_temp_k - 273.15
        self.daily_temp_accumulator = []

        # SLA and LAI update (seasonal function)
        doy = sim_date.timetuple().tm_yday
        sla_cm2_per_g = 266.0 + 88.0 * np.sin(2 * np.pi * (doy + 68) / 365.0)
        self.SLA = max(0.0001, sla_cm2_per_g / 10000.0)
        self.LAI = self.W_lv * self.SLA

        # Update RGR (5-day log-slope) for next day's Rm,eff
        current_total_dm = self.W_lv + self.W_st + self.W_rt + self.W_fr
        self.recent_total_dm_history.append(current_total_dm)
        if (
            len(self.recent_total_dm_history) >= 6
            and self.recent_total_dm_history[-6] > 0
        ):
            RGR = (
                np.log(
                    self.recent_total_dm_history[-1] / self.recent_total_dm_history[-6]
                )
                / 5.0
            )
        elif (
            len(self.recent_total_dm_history) >= 2
            and self.recent_total_dm_history[-2] > 0
        ):
            RGR = (
                np.log(
                    self.recent_total_dm_history[-1] / self.recent_total_dm_history[-2]
                )
                / 1.0
            )
        else:
            RGR = 0.03
        self.last_RGR = max(0.0, RGR)

        # Truss appearance & cohort creation by FR = -0.2903 + 0.1454 ln(T_mean_C)
        T_mean_C = max(1.0, avg_temp_c)
        # Clamp T to validated FR(T) range (18–23 °C) if enabled
        T_for_FR = (
            min(T_mean_C, self.fr_T_max_valid) if self.fr_clamp_to_valid else T_mean_C
        )
        fr = -0.2903 + 0.1454 * math.log(max(1.0, T_for_FR))
        fr = max(0.0, fr)
        self._truss_fraction_acc += fr
        new_trusses = 0
        while self._truss_fraction_acc >= 1.0:
            self.truss_count += 1
            new_trusses += 1
            self._truss_fraction_acc -= 1.0
            # New cohort with TDVS=0, active
            # New cohort with TDVS=0, active (allow per-cohort Nf via pending queue)
            if self.pending_n_fruits:
                try:
                    nfr = int(max(0, self.pending_n_fruits.pop(0)))
                except Exception:
                    nfr = int(self.n_f)
            else:
                nfr = int(self.n_f)
            self.truss_cohorts.append(
                {
                    "tdvs": 0.0,
                    "n_fruits": nfr,
                    "w_fr_cohort": 0.0,
                    "active": True,
                    "mult": self.shoots_per_m2,
                }
            )

        # Daily boundary harvest safeguard (should be near-zero due to step-harvest)
        # This retains compatibility if any matured cohorts slipped through.
        cohorts_to_keep = []
        harvested_dm_today = 0.0
        for cohort in self.truss_cohorts:
            tdvs = cohort.get("tdvs", 0.0)
            is_active = cohort.get("active", True)
            if (not is_active) or (tdvs >= self.tdvs_max):
                harvested_dm_today += max(0.0, cohort.get("w_fr_cohort", 0.0))
            else:
                cohorts_to_keep.append(cohort)
        if harvested_dm_today > 0.0:
            self.W_fr_harvested += harvested_dm_today
            self.truss_cohorts = cohorts_to_keep
            self.W_fr = sum(c.get("w_fr_cohort", 0.0) for c in self.truss_cohorts)
            logger.info(f"Daily boundary harvested {harvested_dm_today:.2f} g DM of fruit.")

        # Metrics: daily crop efficiency ε (g DM per MJ PAR intercepted)
        I_int_MJ = self.daily_par_umol_int_sum * PHOTON_UMOL_TO_MJ
        self.last_daily_dW_total = self.daily_dW_total
        self.last_daily_epsilon = (
            0.0 if I_int_MJ <= 1e-9 else (self.daily_dW_total / I_int_MJ)
        )
        # Transpiration (daily summary)
        self.last_daily_transpiration_g = self.daily_transpiration_g

        # Reset daily accumulators
        self.daily_gross_ch2o_g = 0.0
        self.daily_par_umol_in_sum = 0.0
        self.daily_par_umol_int_sum = 0.0
        self.daily_dW_total = 0.0

    # --- Generative sink helpers (Heuvelink original)
    def _compute_generative_sink_absolute_gd(self):
        """Compute total generative sink (g d^-1) by summing N_f * PGR_Richards(TDVS) over active trusses."""
        total_g_d = 0.0
        for c in self.truss_cohorts:
            if not c.get("active", True):
                continue
            tdvs = c.get("tdvs", 0.0)
            if tdvs <= self.pgr_params["c"]:
                continue
            pgr_singlefruit = self._pgr_richards_raw(tdvs)
            if pgr_singlefruit <= 0:
                continue
            mult = c.get(
                "mult", 1.0
            )  # For backward compatibility with existing cohorts
            total_g_d += mult * c.get("n_fruits", self.n_f) * pgr_singlefruit
        return max(0.0, total_g_d)

    def _compute_per_truss_sinks_gd(self):
        """Compute generative sink (g d^-1) for each active truss cohort."""
        sinks = []
        for c in self.truss_cohorts:
            if not c.get("active", True):
                sinks.append(0.0)
                continue
            tdvs = c.get("tdvs", 0.0)
            if tdvs <= self.pgr_params["c"]:
                sinks.append(0.0)
                continue
            pgr_singlefruit = self._pgr_richards_raw(tdvs)
            if pgr_singlefruit <= 0:
                sinks.append(0.0)
                continue
            mult = c.get(
                "mult", 1.0
            )  # For backward compatibility with existing cohorts
            truss_sink = mult * c.get("n_fruits", self.n_f) * pgr_singlefruit
            sinks.append(truss_sink)
        return sinks

    # (Pre-seeded truss initialization removed to use original FR-based creation)

    def _calculate_current_epsilon(self):
        """Calculate real-time crop efficiency (epsilon) based on current day's accumulated data.
        
        Returns:
            Current epsilon (g DM / MJ PAR) for today so far
        """
        # Calculate accumulated PAR intercepted today (in MJ)
        I_int_MJ = self.daily_par_umol_int_sum * PHOTON_UMOL_TO_MJ
        
        # If very little light accumulated, use a very small threshold
        if I_int_MJ <= 1e-9:
            # Return last day's epsilon or a typical starting value
            return self.last_daily_epsilon if self.last_daily_epsilon > 0 else 0.0
        
        # Calculate current epsilon from today's accumulated dry matter and PAR
        current_epsilon = self.daily_dW_total / I_int_MJ
        
        # Log for debugging if epsilon is unusually low
        if current_epsilon < 0.1 and self.daily_dW_total > 0:
            logger.debug(f"Low epsilon: {current_epsilon:.4f}, dW={self.daily_dW_total:.2f} g, PAR_int={I_int_MJ:.4f} MJ")
        
        return max(0.0, min(current_epsilon, 10.0))  # Cap at reasonable max value

    def _pgr_richards_raw(self, tdvs):
        """Heuvelink truss potential growth rate (per single fruit) based on published formula.
        Returns g d^-1 per fruit (truss PGR is N_f × this).
        This implements the formula as published in Heuvelink, 1996, Annals of Botany, Eq. 5.
        """
        a = float(self.pgr_params.get("a", 0.138))
        b = float(self.pgr_params.get("b", 4.34))
        c = float(self.pgr_params.get("c", 0.278))
        d = float(self.pgr_params.get("d", 1.31))

        if d == 1.0:
            return 0.0

        z = b * (tdvs - c)

        # Guard against overflow for large z
        try:
            e_z = math.exp(z)
        except OverflowError:
            e_z = float("inf")

        # To avoid recomputing exp(-z)
        if e_z == 0:
            e_neg_z = float("inf")
        else:
            e_neg_z = 1.0 / e_z

        # Numerator: a * b * (1 + exp(-b(tdvs-c)))^(1/(1-d))
        base = 1.0 + e_neg_z
        exponent = 1.0 / (1.0 - d)
        numerator = a * b * (base**exponent)

        # Denominator: (d-1) * (exp(b(tdvs-c)) + 1)
        denominator = (d - 1.0) * (e_z + 1.0)

        if denominator == 0.0:
            return 0.0

        pgr = numerator / denominator

        return max(0.0, float(pgr))

    def set_truss_n_f(self, idx, n_fruits):
        """Set fruit count for an existing cohort (0-based index)."""
        if 0 <= idx < len(self.truss_cohorts):
            self.truss_cohorts[idx]["n_fruits"] = int(max(0, n_fruits))

    def bulk_set_truss_n_f(self, values, order="oldest"):
        """Assign fruit counts to multiple existing cohorts.
        order="oldest" assigns from first cohort; order="recent" from most recent backward.
        """
        if not values:
            return
        idxs = (
            range(len(self.truss_cohorts))
            if order == "oldest"
            else reversed(range(len(self.truss_cohorts)))
        )
        for i, v in zip(idxs, values):
            self.truss_cohorts[i]["n_fruits"] = int(max(0, v))

    def queue_truss_n_f(self, values):
        """Queue fruit counts for upcoming new cohorts created by FR(T)."""
        if values:
            self.pending_n_fruits.extend(int(max(0, v)) for v in values)

    def _count_active_trusses(self):
        return sum(1 for c in self.truss_cohorts if c.get("active", True))

    def _advance_tdvs_with_fdvr(self, tdvs, T_C, dt_s):
        """Advance TDVS by integrating FDVR(T, TDVS) over dt (seconds). Heuvelink polynomial/log form.
        T_C in °C, dt_s in seconds.
        Returns clamped TDVS in [tdvs_min, tdvs_max]."""
        # Avoid log of non-positive
        T_ref = 20.0
        T_ratio = max(T_C, 0.1) / T_ref
        ln_term = math.log(T_ratio)  # can be negative if T<T_ref
        # Polynomial in current stage
        fdvr = 0.0181 + ln_term * (
            0.0392 - 0.213 * tdvs + 0.451 * tdvs * tdvs - 0.240 * tdvs * tdvs * tdvs
        )
        tdvs_next = tdvs + fdvr * (dt_s / 86400.0)
        if tdvs_next < self.tdvs_min:
            tdvs_next = self.tdvs_min
        if tdvs_next > self.tdvs_max:
            tdvs_next = self.tdvs_max
        return tdvs_next

    # ----------------------------------------
    # Energy Balance Calculation
    # ----------------------------------------
    def solve_coupled_energy_balance(self):
        """
        Solves the fully coupled energy balance equation to find the canopy temperature (T_c).
        This uses a bounded scalar root solver to find the energy-balance residual zero.
        """
        initial_guess = self.T_a
        try:
            solution = solve_scalar_root(
                self._energy_balance_residual,
                float(initial_guess),
                lower_bound=float(self.T_a) - 20.0,
                upper_bound=float(self.T_a) + 20.0,
            )
            if solution.success:
                self.T_c = float(solution.root)
                self.convergence_status_Tc = True
                self.H = self.calculate_sensible_heat(self.T_c)
                self.LE = self.calculate_canopy_latent_heat(self.T_c)
            else:
                logger.warning(
                    "Energy balance solver failed: %s. Falling back to T_c = T_a.",
                    solution.message,
                )
                self.T_c = self.T_a
                self.convergence_status_Tc = False
                self.H = 0.0
                self.LE = self.calculate_canopy_latent_heat(self.T_a)
        except Exception as e:
            logger.error(f"Error during energy balance solving: {e}", exc_info=True)
            self.T_c = self.T_a
            self.convergence_status_Tc = False
            self.H = 0.0
            self.LE = self.calculate_canopy_latent_heat(self.T_a)

    def _energy_balance_residual(self, t_c_k_guess):
        """
        This helper function calculates the energy balance residual (Rn - H - LE)
        for a given guess of canopy temperature (t_c_k_guess).
        """
        if isinstance(t_c_k_guess, (list, tuple)):
            t_c_k = float(t_c_k_guess[0])
        else:
            try:
                t_c_k = float(t_c_k_guess[0])
            except Exception:
                t_c_k = float(t_c_k_guess)
        # Resistances
        self.r_b = 70 / self.u**0.5 if self.u > 0 else 500
        self.r_ah = 50 * (self.leaf_dimension / self.u) ** 0.5 if self.u > 0 else 5000

        Rn = self.calculate_net_radiation(t_c_k)
        H = self.calculate_sensible_heat(t_c_k)
        LE = self.calculate_canopy_latent_heat(t_c_k)
        return Rn - H - LE

    def calculate_net_radiation(self, t_c_k):
        """Calculates net radiation on the canopy."""
        par_wm2 = self.u_PAR / self.W_TO_UMOL_CONVERSION
        r_sw_abs = par_wm2 * (1 - self.alpha_c) * self.f_c
        emissivity_air_calc = 0.7 + 5.95e-6 * (self.RH * 100) * np.exp(1500 / self.T_a)
        emissivity_air = np.clip(emissivity_air_calc, 0, 1.0)
        r_lw_in = emissivity_air * self.sigma * self.T_a**4
        r_lw_out = self.emissivity_c * self.sigma * t_c_k**4
        return r_sw_abs + r_lw_in - r_lw_out

    def calculate_sensible_heat(self, t_c_k):
        """Calculates sensible heat flux (H)."""
        if self.r_ah <= 1e-9:
            return 0.0
        return self.rho_a * self.c_p * (t_c_k - self.T_a) / self.r_ah

    def calculate_canopy_latent_heat(self, t_c_k):
        """Calculates total canopy latent heat flux (LE)."""
        e_sat_tc = (
            0.6108
            * np.exp((17.27 * (t_c_k - 273.15)) / (t_c_k - 273.15 + 237.3))
            * 1000
        )
        e_sat_ta = (
            0.6108
            * np.exp((17.27 * (self.T_a - 273.15)) / (self.T_a - 273.15 + 237.3))
            * 1000
        )
        e_a = e_sat_ta * self.RH
        vpd = e_sat_tc - e_a
        if vpd < 0:
            return 0.0

        _, _, gsw_canopy = self.calculate_canopy_photosynthesis(t_c_k)
        if gsw_canopy <= 1e-9:
            return 0.0

        r_sc = 1 / gsw_canopy
        r_c = r_sc + self.r_b
        denominator = self.r_ah + r_c
        if denominator <= 1e-9:
            return 0.0

        le = (self.rho_a * self.c_p / self.gamma) * (vpd / denominator)
        return max(0.0, le)

    # ----------------------------------------
    # Photosynthesis & LAI Calculations
    # ----------------------------------------
    def calculate_current_lai(self):
        """Calculates LAI at the current moment based on leaf dry weight and SLA."""
        return max(0.0, self.W_lv * self.SLA)

    def calculate_vegetation_cover(self):
        """Calculates fractional vegetation cover (f_c) from LAI."""
        f_c = 1 - np.exp(-self.k_ext * self.LAI)
        return check_and_clip_value(f_c, 0.01, 1.0, 0.1)

    def calculate_canopy_photosynthesis(self, t_c_k):
        """Calculates total canopy gross photosynthesis rate and conductance."""
        if self.LAI <= 1e-9:
            return 0.0, 0.0, 0.0

        if self.photosyn_mode == "tomsim_canopy":
            # Negative-exponential canopy response (requires α and Pgc,max parameters)
            alpha = 0.02  # umol CO2 per umol photon (example; calibrate)
            Pgc_max = 40.0  # umol m^-2 s^-1 (example; calibrate)
            Pg = Pgc_max * (1.0 - np.exp(-alpha * max(0.0, self.u_PAR)))
            A_leaf, Rd_leaf, gsw = self.calculate_leaf_fvcb(t_c_k, self.u_PAR, self.Ci)
            return Pg, 0.0, gsw

        # Default: multi-layer FvCB
        total_gross_a = 0.0
        total_gsw = 0.0
        lai_above = 0.0
        N_layers = 10
        lai_layer = self.LAI / N_layers
        par_total_wm2 = self.u_PAR / self.W_TO_UMOL_CONVERSION
        k_ext = self.k_ext
        for _ in range(N_layers):
            par_layer_wm2 = par_total_wm2 * np.exp(
                -k_ext * (lai_above + 0.5 * lai_layer)
            )
            par_layer_umol = par_layer_wm2 * self.W_TO_UMOL_CONVERSION
            A, Rd, gsw = self.calculate_leaf_fvcb(t_c_k, par_layer_umol, self.Ci)
            gross_a = A + Rd
            total_gross_a += gross_a * lai_layer
            total_gsw += gsw * lai_layer
            lai_above += lai_layer
        self.last_gsw_canopy = total_gsw
        return total_gross_a, 0.0, total_gsw

    def calculate_leaf_fvcb(self, T_K, PARi, Ci_initial):
        """
        Calculates single leaf photosynthesis using Joubert 2023 tomato FvCB parameterization.
        """
        # Joubert 2023 tomato FvCB parameterization.
        jp = self.joubert_params
        Vcmax = jp["Vcmax"]
        Jmax = jp["Jmax"]
        Rd = jp["Rd"]
        theta_J = jp["theta_J"]
        gamma_J = jp["gamma_J"]
        c1 = jp["c1"]
        dHa1 = jp["dHa1_kJ"]
        c2 = jp["c2"]
        dHa2 = jp["dHa2_kJ"]
        c3 = jp["c3"]
        dHa3 = jp["dHa3_kJ"]
        R1 = jp["R1_kJ"]
        Oi_kPa = jp["O_i_kPa"]

        gamma_star = math.exp(c1 - (dHa1 / (R1 * T_K)))
        Ko = math.exp(c2 - (dHa2 / (R1 * T_K)))  # kPa
        Kc = math.exp(c3 - (dHa3 / (R1 * T_K)))  # umol mol^-1

        J_arg = Jmax + theta_J * PARi
        disc = J_arg * J_arg - 4.0 * Jmax * gamma_J * theta_J * PARi
        disc = max(0.0, disc)
        J = (J_arg - math.sqrt(disc)) / (2.0 * gamma_J)

        Ci = max(1e-6, Ci_initial)
        A = 0.0
        for _ in range(100):
            Wc = Vcmax * (Ci / (Ci + Kc * (1.0 + Oi_kPa / max(1e-9, Ko))))
            Wj = J / (4.0 + 8.0 * (gamma_star / max(1e-6, Ci)))
            A_lim = min(Wc, Wj)
            A = max(0.0, A_lim * (1.0 - (gamma_star / max(1e-6, Ci))) - Rd)

            h_frac = self.RH
            gsw_mol = (
                (((A * 26.85 * h_frac) / self.u_CO2) + 0.019)
                if self.u_CO2 > 0
                else 0.019
            )
            gsw_mol = max(1e-9, gsw_mol)
            gsc_mol = gsw_mol / 1.6
            Ci_new = self.u_CO2 - A / gsc_mol if gsc_mol > 1e-9 else Ci
            if abs(Ci_new - Ci) < 0.001:
                break
            Ci = Ci_new

        P_air = 101325.0
        R_gas = self.fcvb_params["R"]
        gsw_ms = gsw_mol * (R_gas * T_K / P_air)
        return A, Rd, gsw_ms

    def calculate_instantaneous_respiration(self, t_c_k):
        """Calculates instantaneous maintenance respiration rate in g[CH2O]/m2/s."""
        t_c_c = t_c_k - 273.15
        q10 = self.Q10_maint ** ((t_c_c - 25.0) / 10.0)
        rm_day = (
            self.W_lv * self.MAINT_25C["lv"] * q10
            + self.W_st * self.MAINT_25C["st"] * q10
            + self.W_rt * self.MAINT_25C["rt"] * q10
            + self.W_fr * self.MAINT_25C["fr"] * q10
        )
        seconds_in_day = 24 * 3600
        return rm_day / seconds_in_day

    def get_current_sim_time(self, time_step_hours):
        """Helper method to get current simulation time (for compatibility)."""
        return self.start_date + timedelta(hours=time_step_hours)

    def set_plant_density(
        self, plants_per_m2=None, shoots_per_plant=None, shoots_per_m2=None
    ):
        """
        Set plant density parameters.

        Parameters:
        - plants_per_m2: Number of plants per square meter
        - shoots_per_plant: Number of shoots per plant
        - shoots_per_m2: Number of shoots per square meter (derived if not provided)

        The relationship shoots_per_m2 = plants_per_m2 × shoots_per_plant is always maintained.
        If shoots_per_m2 is provided directly, it takes precedence and plants_per_m2 is adjusted.
        """
        if shoots_per_m2 is not None:
            # Direct setting of shoots_per_m2
            self.shoots_per_m2 = float(shoots_per_m2)
            if shoots_per_plant is not None:
                self.shoots_per_plant = float(shoots_per_plant)
                self.plants_per_m2 = (
                    self.shoots_per_m2 / self.shoots_per_plant
                    if self.shoots_per_plant > 0
                    else 0.0
                )
            elif plants_per_m2 is not None:
                self.plants_per_m2 = float(plants_per_m2)
                self.shoots_per_plant = (
                    self.shoots_per_m2 / self.plants_per_m2
                    if self.plants_per_m2 > 0
                    else 0.0
                )
            # If only shoots_per_m2 is provided, keep existing plants_per_m2 and shoots_per_plant ratio
        else:
            # Setting via plants_per_m2 and/or shoots_per_plant
            if plants_per_m2 is not None:
                self.plants_per_m2 = float(plants_per_m2)
            if shoots_per_plant is not None:
                self.shoots_per_plant = float(shoots_per_plant)
            # Update derived parameter
            self.shoots_per_m2 = self.plants_per_m2 * self.shoots_per_plant

        logger.info(
            f"Plant density updated: {self.plants_per_m2:.2f} plants/m², "
            f"{self.shoots_per_plant:.2f} shoots/plant, {self.shoots_per_m2:.2f} shoots/m²"
        )


# --- Example Usage and Main Function ---
def create_sample_input_csv(filename="sample_tomato_input.csv", days=90):
    """Creates a sample input CSV file for testing tomato model."""
    # Create hourly data for specified number of days
    start_date = datetime(2021, 2, 23)
    dates = [start_date + timedelta(hours=i) for i in range(days * 24)]

    # Generate sample environmental data
    data = []
    for i, dt in enumerate(dates):
        hour = dt.hour
        day_of_year = dt.timetuple().tm_yday

        # Simulate daily temperature cycle (slightly warmer for tomatoes)
        T_air = (
            24
            + 6 * np.sin(2 * np.pi * (hour - 6) / 24)
            + 3 * np.sin(2 * np.pi * day_of_year / 365)
        )

        # Simulate PAR with day/night cycle (higher intensity for tomatoes)
        if 6 <= hour <= 18:
            PAR = 1000 + 500 * np.sin(np.pi * (hour - 6) / 12) * np.sin(
                2 * np.pi * day_of_year / 365 + np.pi / 2
            )
        else:
            PAR = 0

        # Other environmental variables
        CO2 = 400 + 100 * np.sin(2 * np.pi * hour / 24)  # CO2 variation
        RH = 65 + 25 * np.sin(2 * np.pi * (hour - 12) / 24)  # RH variation
        wind_speed = 0.3 + 0.4 * np.random.random()  # Random wind speed
        n_fruits = 4  # Standard 4 fruits per truss

        data.append(
            {
                "datetime": dt.strftime("%Y-%m-%d %H:%M:%S"),
                "T_air_C": round(T_air, 1),
                "PAR_umol": round(max(0, PAR), 0),
                "CO2_ppm": round(CO2, 1),
                "RH_percent": round(np.clip(RH, 30, 95), 1),
                "wind_speed_ms": round(wind_speed, 2),
                "n_fruits_per_truss": n_fruits,
            }
        )

    df = pd.DataFrame(data)
    df.to_csv(filename, index=False)
    print(f"Sample tomato input CSV created: {filename}")
    return filename


def main():
    """Main function to demonstrate usage."""
    print("Tomato 모델 시작")

    # 여기서 실제 데이터 파일명으로 변경하세요
    input_file = "Tomato_Env.csv"  # ← 이 부분을 실제 파일명으로 변경

    # 샘플 데이터는 실제 데이터가 없을 때만 생성
    if not os.path.exists(input_file):
        print(f"입력 파일 '{input_file}'을 찾을 수 없습니다.")
        print("샘플 데이터를 생성하시겠습니까? (y/n): ", end="")
        if input().lower().startswith("y"):
            create_sample_input_csv("sample_tomato_input.csv", days=90)
            input_file = "sample_tomato_input.csv"
        else:
            print("프로그램을 종료합니다.")
            return

    # Initialize model
    model = TomatoModel()

    try:
        # Load input data
        print(f"입력 데이터를 로드합니다: {input_file}")
        input_df = model.load_input_data(input_file)
        print(f"로드된 데이터 포인트: {len(input_df)}개")

        # Run simulation
        print("시뮬레이션을 실행합니다...")
        output_file = "tomato_simulation_results.csv"
        results_df = model.run_simulation(input_df, output_file)

        # Display summary
        print("\n=== 시뮬레이션 결과 요약 ===")
        print(f"총 시뮬레이션 시간: {len(results_df)}시간")
        print(f"최종 LAI: {results_df['LAI'].iloc[-1]:.2f}")
        print(
            f"최종 총 건물중: {results_df['total_dry_weight_g_m2'].iloc[-1]:.2f} g/m²"
        )
        print(
            f"최종 과실 건물중: {results_df['fruit_dry_weight_g_m2'].iloc[-1]:.2f} g/m²"
        )
        print(f"최종 수확량: {results_df['harvested_fruit_g_m2'].iloc[-1]:.2f} g/m²")
        print(f"최종 트러스 수: {results_df['truss_count'].iloc[-1]:.0f}")
        print(
            f"에너지 밸런스 수렴률: {results_df['energy_balance_converged'].mean()*100:.1f}%"
        )
        print(
            f"평균 작물 효율성: {results_df['crop_efficiency'].mean():.3f} g DM/MJ PAR"
        )
        print(f"\n결과가 저장되었습니다: {output_file}")

    except Exception as e:
        print(f"오류 발생: {e}")
        logger.error(f"Main function error: {e}", exc_info=True)


if __name__ == "__main__":
    main()
