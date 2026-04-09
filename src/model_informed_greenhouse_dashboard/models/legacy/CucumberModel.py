# ---
# CucumberModel.py - Integrated Cucumber Growth and Energy Balance Model
# ---
# Description:
# This Python script implements a standalone cucumber growth model that reads
# input data from CSV files and outputs results to CSV files. It integrates a detailed
# FvCB photosynthesis model with a dynamic energy balance model.
#
# Key Features:
# - Energy Balance: Iteratively calculates canopy temperature by balancing radiation, sensible heat,
#   and latent heat fluxes.
# - FvCB Photosynthesis: Simulates leaf-level photosynthesis based on environmental conditions.
# - Dynamic Growth: Models cucumber growth (leaves, nodes, dry matter) based on photosynthesis.
# - CSV Integration: Reads input from CSV files and outputs results to CSV files.
#
# Note: The aerodynamic resistance (r_ah) calculation uses a simplified empirical formula suitable
# for controlled greenhouse environments, rather than the Monin-Obukhov stability theory.
# ---

import pandas as pd
import numpy as np
import os
import logging
from datetime import datetime, timedelta

from model_informed_greenhouse_dashboard.numerics import solve_scalar_root

# --- Logging Setup ---
try:
    thisModule = os.path.splitext(os.path.basename(__file__))[0]
    log_dir = os.path.dirname(os.path.abspath(__file__))
    log_file_path = os.path.join(log_dir, f"{thisModule}.log")
except NameError:
    thisModule = "CucumberModel"
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


def gompertz_growth(t, a, b, c):
    """Calculates the Gompertz growth function for leaf area."""
    if c == 0:
        return 0
    return a * np.exp(-np.exp(-(t - b) / c))


# --- Main Model Class ---
class CucumberModel:
    def __init__(self):
        """Initializes the integrated cucumber growth and energy balance model."""
        logger.info("Initializing CucumberModel")

        # --- Growth Model Parameters (from Cucumber.py) ---
        self.initial_nodes = 3
        self.threshold_before = 26.3
        self.threshold_after = 15.6
        self.reproductive_node_threshold = 15
        self.SLA = 0.025
        self.plant_density_per_m2 = 1.72
        self.gompertz_a, self.gompertz_b, self.gompertz_c = 582.06, 45.33, 45.31
        self.leaf_area_conversion_factor = self.plant_density_per_m2 / 10000
        self.partitioning_veg_before = 1.0
        self.partitioning_fruit_before = 0.0
        self.pruning_threshold = 18
        self.target_leaf_count = 15
        self.leaf_dimension = 0.15  # Characteristic leaf dimension (width) in meters

        # --- Energy Balance Constants ---
        self.rho_a = 1.225  # Air density (kg m^-3)
        self.c_p = 1004  # Specific heat of air (J kg^-1 K^-1)
        self.gamma = 67  # Psychrometric constant (Pa K^-1)
        self.sigma = 5.67e-8  # Stefan-Boltzmann constant
        self.lambda_v = 2.45e6  # Latent heat of vaporization (J kg^-1)
        self.alpha_c = 0.15  # Canopy albedo for shortwave radiation
        self.emissivity_c = 0.98  # Canopy emissivity for longwave radiation
        self.W_TO_UMOL_CONVERSION = 4.6

        # --- FvCB Model Parameters ---
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
            "rank_5": {
                "Vcmax_25": 77.91,
                "Jmax_25": 132.45,
                "Rd_25": 0.63,
                "theta": 0.71,
            },
            "rank_10": {
                "Vcmax_25": 74.35,
                "Jmax_25": 126.40,
                "Rd_25": 0.35,
                "theta": 0.76,
            },
            "rank_else": {
                "Vcmax_25": 63.82,
                "Jmax_25": 108.50,
                "Rd_25": 0.56,
                "theta": 0.88,
            },
        }

        # --- Initialize State Variables ---
        self.reset_state()

    def reset_state(self):
        """Resets all state variables to initial conditions."""
        self.start_date = datetime(2021, 2, 23)
        self.last_calc_time = None
        self.current_date = self.start_date.date()
        self.nodes = self.initial_nodes
        self.remaining_leaves = self.initial_nodes
        self.leaves_info = []
        self.thermal_time_sum = 0.0
        self.cumulative_thermal_time = 0.0
        self.vegetative_dw = 1.16
        self.fruit_dw = 0.0
        self.part_veg = self.partitioning_veg_before
        self.part_fruit = self.partitioning_fruit_before
        self.daily_temp_accumulator = []
        self.T_c = 293.15
        self.T_a = 293.15
        self.H = 0.0
        self.LE = 0.0
        self.r_ah = 50.0
        self.r_b = 50.0
        self.LAI = 0.1
        self.f_c = 0.1
        self.convergence_status_Tc = False
        self.co2_flux_g_m2_s = 0.0
        self.dt_seconds = 0.0
        
        # Canopy stomatal conductance (for UI/diagnostics)
        self.last_gsw_canopy = 0.0  # m/s, last calculated canopy conductance

        for i in range(1, self.initial_nodes + 1):
            self.leaves_info.append(
                {"Leaf Number": i, "Date": self.start_date.date(), "Thermal Time": 0}
            )

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
        - pruning_threshold: Pruning threshold (optional, default 18)
        - target_leaf_count: Target leaf count (optional, default 15)
        - reproductive_node_threshold: Reproductive node threshold (optional, default 15)
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
            if "pruning_threshold" not in df.columns:
                df["pruning_threshold"] = 18
            if "target_leaf_count" not in df.columns:
                df["target_leaf_count"] = 15
            if "reproductive_node_threshold" not in df.columns:
                df["reproductive_node_threshold"] = 15

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
        self.pruning_threshold = int(
            check_and_clip_value(row["pruning_threshold"], 1, 100, 18)
        )
        self.target_leaf_count = int(
            check_and_clip_value(row["target_leaf_count"], 1, 100, 15)
        )
        self.reproductive_node_threshold = int(
            check_and_clip_value(row["reproductive_node_threshold"], 5, 100, 15)
        )
        self.Ci = self.u_CO2 * 0.7

    def get_current_outputs(self, current_time):
        """Get current model outputs as a dictionary."""
        transpiration_rate_g_s_m2 = (
            self.LE / self.lambda_v * 1000 if self.lambda_v > 0 else 0
        )
        transpiration_amount_g_m2 = transpiration_rate_g_s_m2 * self.dt_seconds

        return {
            "datetime": current_time,
            "LAI": check_and_clip_value(self.LAI, 0, 100, 0.1),
            "T_canopy_C": check_and_clip_value(self.T_c - 273.15, -50, 100, 20),
            "total_dry_weight_g_m2": check_and_clip_value(
                self.vegetative_dw + self.fruit_dw, 0, 1e6, 0
            ),
            "sensible_heat_W_m2": check_and_clip_value(self.H, -2000, 2000, 0),
            "latent_heat_W_m2": check_and_clip_value(self.LE, -2000, 2000, 0),
            "transpiration_g_m2": check_and_clip_value(
                transpiration_amount_g_m2, 0, 1e6, 0
            ),
            "energy_balance_converged": float(self.convergence_status_Tc),
            "node_count": float(self.nodes),
            "remaining_leaves": float(self.remaining_leaves),
            "fruit_dry_weight_g_m2": check_and_clip_value(self.fruit_dw, 0, 1e6, 0),
            "vegetative_dry_weight_g_m2": check_and_clip_value(
                self.vegetative_dw, 0, 1e6, 0
            ),
            "co2_flux_g_m2_s": check_and_clip_value(self.co2_flux_g_m2_s, -1, 1, 0),
            "fractional_cover": check_and_clip_value(self.f_c, 0, 1, 0.1),
            "thermal_time_sum": self.thermal_time_sum,
            "cumulative_thermal_time": self.cumulative_thermal_time,
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
            "node_count": np.nan,
            "remaining_leaves": np.nan,
            "fruit_dry_weight_g_m2": np.nan,
            "vegetative_dry_weight_g_m2": np.nan,
            "co2_flux_g_m2_s": np.nan,
            "fractional_cover": np.nan,
            "thermal_time_sum": np.nan,
            "cumulative_thermal_time": np.nan,
        }

    # ----------------------------------------
    # Core Simulation Logic (from original model)
    # ----------------------------------------

    def run_timestep_calculations(self, dt_seconds, current_time):
        """Orchestrates the calculations for a single timestep."""
        # Store dt_seconds for later use (transpiration calculation, etc.)
        self.dt_seconds = dt_seconds
        
        sim_date = current_time.date()

        if sim_date > self.current_date:
            self.update_daily_growth(sim_date)
            self.current_date = sim_date

        self.LAI = self.calculate_current_lai()
        self.f_c = self.calculate_vegetation_cover()

        self.solve_coupled_energy_balance()

        total_gross_photosynthesis_rate_umol, _, _ = (
            self.calculate_canopy_photosynthesis(self.T_c)
        )
        instantaneous_respiration_rate_g_ch2o = (
            self.calculate_instantaneous_respiration(self.T_c)
        )

        p_gross_g_co2 = total_gross_photosynthesis_rate_umol * 1e-6 * 44.01
        r_g_co2 = instantaneous_respiration_rate_g_ch2o * (44.01 / 30.03)
        self.co2_flux_g_m2_s = p_gross_g_co2 - r_g_co2

        self.daily_temp_accumulator.append((self.T_a, dt_seconds))

        gross_ch2o_prod_g = (
            total_gross_photosynthesis_rate_umol * 1e-6 * 30.03
        ) * dt_seconds
        respiration_loss_g = instantaneous_respiration_rate_g_ch2o * dt_seconds
        net_ch2o = gross_ch2o_prod_g - respiration_loss_g
        dry_matter_prod = max(0, net_ch2o / 1.45)

        veg_prod = dry_matter_prod * self.part_veg
        fruit_prod = dry_matter_prod * self.part_fruit
        self.vegetative_dw += veg_prod
        self.fruit_dw += fruit_prod

    def update_daily_growth(self, sim_date):
        """Performs a full daily update for growth, partitioning, etc."""
        logger.info(f"Performing daily update for {sim_date}")
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

        daily_growing_temp = max(0, avg_temp_c - 10)
        self.cumulative_thermal_time += daily_growing_temp
        self.thermal_time_sum += daily_growing_temp
        threshold = (
            self.threshold_before
            if self.nodes < self.reproductive_node_threshold
            else self.threshold_after
        )

        while self.thermal_time_sum > threshold:
            self.nodes += 1
            self.remaining_leaves += 1
            self.thermal_time_sum -= threshold
            self.leaves_info.append(
                {
                    "Leaf Number": self.nodes,
                    "Date": sim_date,
                    "Thermal Time": self.cumulative_thermal_time,
                }
            )
            logger.info(f"New node added. Total nodes: {self.nodes}")

        removed_veg_dw = self.perform_leaf_pruning()

        if self.nodes < self.reproductive_node_threshold:
            self.part_veg = self.partitioning_veg_before
            self.part_fruit = self.partitioning_fruit_before
        else:
            part_fruit_calc = 0.00786 * avg_temp_c + 0.2886
            self.part_fruit = check_and_clip_value(part_fruit_calc, 0, 1, 0.6)
            self.part_veg = 1 - self.part_fruit

        self.vegetative_dw = max(0, self.vegetative_dw - removed_veg_dw)
        self.fruit_dw = max(0, self.fruit_dw)

    def perform_leaf_pruning(self):
        """Checks if leaf pruning is needed and calculates the DW of removed leaves."""
        removed_dw = 0
        if self.remaining_leaves > self.pruning_threshold:
            leaves_to_remove_count = self.remaining_leaves - self.target_leaf_count
            if leaves_to_remove_count > 0:
                logger.info(f"Pruning {leaves_to_remove_count} leaves.")
                removed_leaves_info = self.leaves_info[:leaves_to_remove_count]
                total_removed_leaf_area_cm2 = sum(
                    gompertz_growth(
                        self.cumulative_thermal_time - leaf["Thermal Time"],
                        self.gompertz_a,
                        self.gompertz_b,
                        self.gompertz_c,
                    )
                    for leaf in removed_leaves_info
                )
                removed_area_m2 = total_removed_leaf_area_cm2 / 10000
                removed_dw = removed_area_m2 / self.SLA
                self.leaves_info = self.leaves_info[leaves_to_remove_count:]
                self.remaining_leaves -= leaves_to_remove_count
                logger.info(f"Removed {removed_dw:.2f}g of vegetative DW from pruning.")
        return removed_dw

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
                logger.debug(f"Energy balance converged. T_c: {self.T_c:.2f} K")
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

        # Simplified resistance calculations for greenhouse environment
        # Boundary layer resistance for a single leaf (s/m)
        self.r_b = 70 / self.u**0.5 if self.u > 0 else 500
        # Aerodynamic resistance for the canopy (s/m)
        self.r_ah = 50 * (self.leaf_dimension / self.u) ** 0.5 if self.u > 0 else 5000

        Rn = self.calculate_net_radiation(t_c_k)
        H = self.calculate_sensible_heat(t_c_k)
        LE = self.calculate_canopy_latent_heat(t_c_k)

        residual = Rn - H - LE
        return residual

    def calculate_net_radiation(self, t_c_k):
        """Calculates net radiation on the canopy."""
        par_wm2 = self.u_PAR / self.W_TO_UMOL_CONVERSION
        r_sw_abs = par_wm2 * (1 - self.alpha_c) * self.f_c

        # Calculate air emissivity based on relative humidity and air temperature
        emissivity_air_calc = 0.7 + 5.95e-6 * (self.RH * 100) * np.exp(1500 / self.T_a)
        emissivity_air = np.clip(
            emissivity_air_calc, 0, 1.0
        )  # Ensure emissivity remains within the physical range [0, 1]

        r_lw_in = emissivity_air * self.sigma * self.T_a**4
        r_lw_out = self.emissivity_c * self.sigma * t_c_k**4
        r_net = r_sw_abs + r_lw_in - r_lw_out
        return r_net

    def calculate_sensible_heat(self, t_c_k):
        """Calculates sensible heat flux (H)."""
        if self.r_ah <= 1e-9:
            return 0
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
            return 0

        _, _, gsw_canopy = self.calculate_canopy_photosynthesis(t_c_k)
        if gsw_canopy <= 1e-9:
            return 0

        r_sc = 1 / gsw_canopy
        r_c = r_sc + self.r_b
        denominator = self.r_ah + r_c
        if denominator <= 1e-9:
            return 0

        le = (self.rho_a * self.c_p / self.gamma) * (vpd / denominator)
        return max(0, le)

    def calculate_instantaneous_respiration(self, t_c_k):
        """Calculates instantaneous maintenance respiration rate in g[CH2O]/m2/s."""
        t_c_c = t_c_k - 273.15
        rm_veg_day = 0.033 * (2 ** ((t_c_c - 25) / 10))
        rm_fruit_day = 0.015 * (2 ** ((t_c_c - 25) / 10))
        seconds_in_day = 24 * 3600
        rm_veg_sec = rm_veg_day / seconds_in_day
        rm_fruit_sec = rm_fruit_day / seconds_in_day
        total_rm_g_s = self.vegetative_dw * rm_veg_sec + self.fruit_dw * rm_fruit_sec
        return total_rm_g_s

    # ----------------------------------------
    # Canopy Structure and Photosynthesis Calculations
    # ----------------------------------------
    def calculate_current_lai(self):
        """Calculates LAI at the current moment based on leaf info."""
        total_leaf_area = (
            sum(
                gompertz_growth(
                    self.cumulative_thermal_time - leaf["Thermal Time"],
                    self.gompertz_a,
                    self.gompertz_b,
                    self.gompertz_c,
                )
                for leaf in self.leaves_info[-self.remaining_leaves :]
            )
            if self.remaining_leaves > 0 and self.leaves_info
            else 0
        )
        return total_leaf_area * self.leaf_area_conversion_factor

    def calculate_vegetation_cover(self):
        """Calculates fractional vegetation cover (f_c) from LAI."""
        k_ext = 0.8
        f_c = 1 - np.exp(-k_ext * self.LAI)
        return check_and_clip_value(f_c, 0.01, 1.0, 0.1)

    def calculate_canopy_photosynthesis(self, t_c_k):
        """Calculates total canopy gross photosynthesis rate and conductance layer by layer."""
        total_gross_a = 0
        total_gsw = 0
        lai_above = 0

        active_leaves = (
            self.leaves_info[-self.remaining_leaves :]
            if self.remaining_leaves > 0 and self.leaves_info
            else []
        )
        if not active_leaves:
            return 0, 0, 0

        for i, leaf in enumerate(reversed(active_leaves)):
            rank = i + 1
            leaf_age_thermal = self.cumulative_thermal_time - leaf["Thermal Time"]
            leaf_area_cm2 = gompertz_growth(
                leaf_age_thermal, self.gompertz_a, self.gompertz_b, self.gompertz_c
            )
            lai_leaf = leaf_area_cm2 * self.leaf_area_conversion_factor

            par_total_wm2 = self.u_PAR / self.W_TO_UMOL_CONVERSION
            par_leaf_wm2 = par_total_wm2 * np.exp(-0.8 * lai_above)
            par_leaf_umol = par_leaf_wm2 * self.W_TO_UMOL_CONVERSION

            if rank <= 5:
                p = self.rank_params["rank_5"]
            elif rank <= 10:
                p = self.rank_params["rank_10"]
            else:
                p = self.rank_params["rank_else"]

            A, Rd, gsw = self.calculate_leaf_fvcb(t_c_k, par_leaf_umol, p, self.Ci)
            gross_a = A + Rd

            total_gross_a += gross_a * lai_leaf
            total_gsw += gsw * lai_leaf
            lai_above += lai_leaf

        self.last_gsw_canopy = total_gsw
        return total_gross_a, 0, total_gsw

    def calculate_leaf_fvcb(self, T_K, PARi, p, Ci_initial):
        """
        Calculates single leaf photosynthesis (A), respiration (Rd), and stomatal
        conductance (gsw) using the FvCB model, with an iterative loop to converge on Ci.
        """
        R, V_Ha, J_Ha, V_S, J_S, V_Hd, J_Hd, oxygen, a = (
            self.fcvb_params[k]
            for k in ("R", "V_Ha", "J_Ha", "V_S", "J_S", "V_Hd", "J_Hd", "O", "a")
        )
        Vcmax_25, Jmax_25, Rd_25, theta = (
            p[k] for k in ("Vcmax_25", "Jmax_25", "Rd_25", "theta")
        )

        gammastar = 42.75 * np.exp(37830 * (T_K - 298) / (298 * R * T_K))
        Kc = 404.9 * np.exp(79430 * (T_K - 298) / (298 * R * T_K))
        Ko = 278.4 * np.exp(36380 * (T_K - 298) / (298 * R * T_K))
        T_C = T_K - 273.15
        Rd = Rd_25 * 2 ** ((T_C - 25) / 10)

        par_dependency = (31 + (69 / (1 + np.exp(-0.005 * (PARi - 350))))) / 100
        vc_temp_factor = np.exp(V_Ha * (T_C - 25) / ((25 + 237.15) * R * T_K))
        vc_deactivation_num = 1 + np.exp((V_S - V_Hd) / (298.15 * R))
        vc_deactivation_den = 1 + np.exp((V_S - V_Hd) / (T_K * R))
        Vc = (
            Vcmax_25
            * par_dependency
            * vc_temp_factor
            * (vc_deactivation_num / vc_deactivation_den)
        )

        j_temp_factor = np.exp(J_Ha * (T_C - 25) / ((25 + 237.15) * R * T_K))
        j_deactivation_num = 1 + np.exp((J_S - J_Hd) / (298.15 * R))
        j_deactivation_den = 1 + np.exp((J_S - J_Hd) / (T_K * R))
        Jmax = Jmax_25 * j_temp_factor * (j_deactivation_num / j_deactivation_den)

        j_sqrt_term = (a * PARi + Jmax) ** 2 - 4 * theta * a * PARi * Jmax
        J = (a * PARi + Jmax - np.sqrt(max(0, j_sqrt_term))) / (2 * theta)

        Ci = Ci_initial
        A = 0
        for _ in range(100):
            A_rubisco = (Vc * (Ci - gammastar) / (Ci + Kc * (1 + oxygen / Ko))) - Rd
            A_rubp = (J * (Ci - gammastar) / (4 * Ci + 8 * gammastar)) - Rd
            A = max(0, min(A_rubisco, A_rubp))

            h_frac = self.RH
            gsw_mol = (
                ((A * 8.376 * h_frac) / self.u_CO2) + 0.045 if self.u_CO2 > 0 else 0.045
            )
            gsw_mol = max(1e-9, gsw_mol)
            gsc_mol = gsw_mol / 1.6

            Ci_new = self.u_CO2 - A / gsc_mol if gsc_mol > 1e-9 else Ci
            if abs(Ci_new - Ci) < 0.001:
                break
            Ci = Ci_new

        P_air = 101325.0
        gsw_ms = gsw_mol * (R * T_K / P_air)
        return A, Rd, gsw_ms

    def get_current_sim_time(self, time_step_hours):
        """Helper method to get current simulation time (for compatibility)."""
        return self.start_date + timedelta(hours=time_step_hours)


# --- Example Usage and Main Function ---
def create_sample_input_csv(filename="sample_cucumber_input.csv", days=30):
    """Creates a sample input CSV file for testing."""
    # Create hourly data for specified number of days
    start_date = datetime(2021, 2, 23)
    dates = [start_date + timedelta(hours=i) for i in range(days * 24)]

    # Generate sample environmental data
    data = []
    for i, dt in enumerate(dates):
        hour = dt.hour
        day_of_year = dt.timetuple().tm_yday

        # Simulate daily temperature cycle
        T_air = (
            22
            + 8 * np.sin(2 * np.pi * (hour - 6) / 24)
            + 2 * np.sin(2 * np.pi * day_of_year / 365)
        )

        # Simulate PAR with day/night cycle
        if 6 <= hour <= 18:
            PAR = 800 + 400 * np.sin(np.pi * (hour - 6) / 12) * np.sin(
                2 * np.pi * day_of_year / 365 + np.pi / 2
            )
        else:
            PAR = 0

        # Other environmental variables
        CO2 = 400 + 50 * np.sin(2 * np.pi * hour / 24)  # CO2 variation
        RH = 70 + 20 * np.sin(2 * np.pi * (hour - 12) / 24)  # RH variation
        wind_speed = 0.5 + 0.3 * np.random.random()  # Random wind speed

        data.append(
            {
                "datetime": dt.strftime("%Y-%m-%d %H:%M:%S"),
                "T_air_C": round(T_air, 1),
                "PAR_umol": round(max(0, PAR), 0),
                "CO2_ppm": round(CO2, 1),
                "RH_percent": round(np.clip(RH, 30, 95), 1),
                "wind_speed_ms": round(wind_speed, 2),
                "pruning_threshold": 18,
                "target_leaf_count": 15,
                "reproductive_node_threshold": 15,
            }
        )

    df = pd.DataFrame(data)
    df.to_csv(filename, index=False)
    print(f"Sample input CSV created: {filename}")
    return filename


def main():
    """Main function to demonstrate usage."""
    print("Cucumber 모델 시작")

    # 여기서 실제 데이터 파일명으로 변경하세요
    input_file = "Cucumber_Env.csv"  # ← 이 부분을 실제 파일명으로 변경

    # 샘플 데이터는 실제 데이터가 없을 때만 생성
    if not os.path.exists(input_file):
        print(f"입력 파일 '{input_file}'을 찾을 수 없습니다.")
        print("샘플 데이터를 생성하시겠습니까? (y/n): ", end="")
        if input().lower().startswith("y"):
            create_sample_input_csv("sample_cucumber_input.csv", days=30)
            input_file = "sample_cucumber_input.csv"
        else:
            print("프로그램을 종료합니다.")
            return

    # Initialize model
    model = CucumberModel()

    try:
        # Load input data
        print(f"입력 데이터를 로드합니다: {input_file}")
        input_df = model.load_input_data(input_file)
        print(f"로드된 데이터 포인트: {len(input_df)}개")

        # Run simulation
        print("시뮬레이션을 실행합니다...")
        output_file = "cucumber_simulation_results.csv"
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
        print(f"최종 노드 수: {results_df['node_count'].iloc[-1]:.0f}")
        print(
            f"에너지 밸런스 수렴률: {results_df['energy_balance_converged'].mean()*100:.1f}%"
        )
        print(f"\n결과가 저장되었습니다: {output_file}")

    except Exception as e:
        print(f"오류 발생: {e}")
        logger.error(f"Main function error: {e}", exc_info=True)


if __name__ == "__main__":
    main()
