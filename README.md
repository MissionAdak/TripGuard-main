# 🛡️ TripGuard — Proactive Travel Resilience Platform

TripGuard is a proactive, vendor-agnostic travel resilience platform. It combines topological graph analysis, pre-departure predictive risk modeling, true net-cost financial ledgers, external booking confirmation ingestion, statutory regulation compliance (DGCA CAR & EU261), and group travel split constraints to monitor and recover multi-modal itineraries seamlessly.

---

## 📋 System Prerequisites

Ensure you have the following installed on your system:

- **Python**: Version `3.10` or higher (`python --version`)
- **Node.js**: Version `18.x` or higher (`node --version`)
- **npm**: Version `9.x` or higher (`npm --version`)

---

## 🚀 How to Run the Project (Step-by-Step)

To run the complete application without any errors, you will run the **Backend** (FastAPI) and the **Frontend** (Vite + React) in two separate terminal windows.

---

### Step 1: Run the Backend (FastAPI)

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. *(Recommended)* Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI backend server:
   ```bash
   python main.py
   ```
   *Alternatively, you can run:*
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

5. **Verification**:
   - Backend API will be live at: `http://localhost:8000`
   - Interactive Swagger API Documentation: `http://localhost:8000/docs`

---

### Step 2: Run the Frontend (React + Vite)

1. Open a **second terminal** and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install the frontend dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. **Open in Browser**:
   - Navigate to: **`http://localhost:5173`**

---

## 🧪 Running Tests & Build Verifications

### 1. Run Backend Automated Unit Tests
To run all 7 core engine unit tests (covering predictive risk, resilience, net cost, booking import, preference learning, claim evidence, and group handling):

```bash
cd backend
python -m pytest test_features.py -v
```

### 2. Verify Frontend TypeScript & Production Build
To ensure zero TypeScript or bundling errors:

```bash
cd frontend
npm run build
```

---

## 🌟 Quick Start Guide in the Web App

1. **Initial Clean State**:
   - When you open `http://localhost:5173`, the application opens in a clean state with zero initial trips.
2. **One-Click Simulation**:
   - Click the **"⚡ Simulate Sample Data to Test"** button on the Dashboard.
   - This populates a full multi-modal itinerary (*Golden Triangle Tour: Mumbai → Delhi → Jaipur*) with flights, trains, hotel stays, and cab transfers.
3. **Explore Proactive Features**:
   - **Predictive Risk Modeling**: Observe historical route delay rates, weather radar forecasts, and vendor reliability scores.
   - **Itinerary Structural Resilience**: Review graph connectivity and Single Points of Failure (SPOF).
   - **Cross-Vendor Booking Ingestion**: Click **"Import External Booking"** to import reservations from Booking.com, Airbnb, Viator, or Expedia.
   - **Disruption Simulation & Recovery**: Go to **Operations / Chaos Simulator**, select a segment (e.g., *Flight Mumbai → Delhi*), inject a delay (e.g. 180 min), and inspect the:
     - **Recommended Resolution Strategy** with actionable steps.
     - **True Net-Cost Ledger** showing carrier refunds and insurance compensations.
     - **AirHelp-Grade Insurance Claim Dossier** with printable and downloadable claim packets.
     - **Group Split Alerts** checking seat availability for all family members.
4. **Reset Anytime**:
   - Click **"Reset Data"** in the top navigation bar at any time to return to the clean empty state.

---

## 📁 Repository Structure

```
TripGuard-main/
├── README.md                      # Setup and execution guide
├── FEATURES_IMPLEMENTED.md        # Comprehensive changelog of features added
├── backend/
│   ├── main.py                    # FastAPI routes and server entry point
│   ├── models.py                  # Pydantic data schemas
│   ├── mock_data.py               # Seed data for testing
│   ├── geocode.py                 # OpenStreetMap/Nominatim geocoding
│   ├── requirements.txt           # Python dependencies
│   ├── test_features.py           # Pytest unit tests for all engines
│   └── engine/
│       ├── predictive_risk.py     # Pre-departure risk scoring engine
│       ├── net_cost.py            # True net cost accounting ledger
│       ├── importer.py            # Cross-vendor confirmation parser
│       ├── resilience.py          # Graph SPOF and resilience score
│       ├── traveler_learning.py   # Adaptive preference learning
│       ├── claim_evidence.py      # Statutory claim evidence dossier engine
│       ├── group_handling.py      # Multi-traveler seat & split constraints
│       └── recovery.py            # Multi-objective recovery plan generator
└── frontend/
    ├── package.json               # Frontend dependencies & scripts
    ├── tsconfig.json              # TypeScript configuration
    ├── vite.config.ts             # Vite configuration with proxy to backend
    └── src/
        ├── App.tsx                # Main routing and navigation
        ├── types.ts               # TypeScript data definitions
        ├── api/client.ts          # API client for backend communication
        ├── components/
        │   ├── TripMap.tsx        # Leaflet interactive route visualizer
        │   ├── ImportBookingModal.tsx
        │   ├── NetCostLedgerModal.tsx
        │   ├── ClaimEvidenceModal.tsx
        │   └── ui/primitives.tsx  # Button (with asChild support), Card, Badge
        └── pages/
            ├── Dashboard.tsx        # Operations and trip overview
            ├── ChaosSimulator.tsx   # Disruption simulator & recovery plans
            └── TravelerDashboard.tsx# Traveler live route and claim view
```

---

## 🛠️ Common Troubleshooting

- **Port 8000 already in use**:
  If port 8000 is occupied, run FastAPI on another port:
  ```bash
  python -m uvicorn main:app --port 8001
  ```
  *(Update `vite.config.ts` proxy target if port is changed).*
- **PowerShell Execution Policy Error on venv activation**:
  Run:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```
- **Browser caching previous state**:
  Click the **"Reset Data"** button in the app header or clear `localStorage` via browser Developer Tools.
