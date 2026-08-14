# SentinelGraph — Mule Network Fraud Detector

A fraud-investigation dashboard that traverses a graph database to surface accounts moving money in circular chains and sharing devices — the signature pattern of "mule networks" used to launder stolen or scammed funds.

**Live demo:** https://sentinel-graph-alpha.vercel.app
**Backend API:** https://sentinel-graph-uoyz.onrender.com
**Repo:** https://github.com/krupalucky07-cyber/Sentinel-graph

> Note: the backend is hosted on Render's free tier, which spins down after inactivity. The first request after a period of idle time can take 30–60 seconds to respond while it wakes up.

---

## The use case

Money mules are people (often unwitting) whose bank accounts are used to move stolen or scammed funds a few hops away from the original victim, making the money harder to trace. A single mule account is hard to distinguish from a normal one — but a **ring of accounts that pass money in a loop, or that log in from the same device**, is a strong fraud signal.

SentinelGraph lets an investigator open a dashboard, see the live transaction network as a graph, and immediately spot:
- Accounts flagged as high-risk
- Circular transfer chains (A → B → C → A)
- Accounts that share a device or IP — evidence the "different" accounts are actually controlled by the same person

## Why a graph database?

This is a connections problem, not a rows-and-columns problem — which is exactly where a relational database starts to strain and a graph database earns its place.

- **Multi-hop traversal is native, not bolted on.** Finding "accounts that received money, which then sent money to an account sharing a device with the original sender" is a 2+ hop pattern. In SQL this means multiple self-joins against the same `transactions` table, one join per hop, and the query gets harder to write and slower to run as the number of hops grows. In Cypher, it's one readable `MATCH` pattern that mirrors the shape of the fraud ring itself.
- **The interesting query here is a relationship match, not an aggregation.** "Do these two accounts share a device?" is a graph adjacency check (`OPTIONAL MATCH (a1)-[:LOGGED_IN_FROM]->(d)<-[:LOGGED_IN_FROM]-(a2)`), which relational databases handle awkwardly — it requires joining the accounts table to a devices bridge table twice and comparing device IDs, and gets worse as you add more shared attributes (IP, phone number, etc.) to check.
- **Fraud rings grow organically and irregularly.** A relational schema has to decide up front how many "hops" of relationship to support. A graph schema doesn't — a new relationship type (e.g. `SHARED_PHONE_WITH`) or a longer ring is just a longer path pattern, no schema migration required.
- **The output is naturally a graph.** The whole point of the investigation is to *see* the network shape. Querying a graph database and rendering the result as a network diagram is a direct mapping; doing the same from flattened SQL rows means reconstructing the graph structure in application code after the fact.

## Data model

```
        TRANSFERRED_TO             TRANSFERRED_TO
  (Account)───────────────►(Account)───────────────►(Account)
  {id, owner,               {id, owner,               {id, owner,
   balance,                  balance,                  balance,
   isFlagged}                isFlagged}                isFlagged}
      │                          │
      │ LOGGED_IN_FROM           │ LOGGED_IN_FROM
      ▼                          ▼
              (Device) {deviceId, deviceType, os}

      │ USER_IP
      ▼
              (IPAddress) {ip, location}
```

**Nodes**
| Label | Properties |
|---|---|
| `Account` | `id`, `owner`, `balance`, `isFlagged` |
| `Device` | `deviceId`, `deviceType`, `os` |
| `IPAddress` | `ip`, `location` |

**Relationships**
| Type | Direction | Properties |
|---|---|---|
| `TRANSFERRED_TO` | Account → Account | `amount`, `timestamp` |
| `LOGGED_IN_FROM` | Account → Device | — |
| `USER_IP` | Account → IPAddress | — |

## The main query, explained

```cypher
MATCH (a1:Account)-[r:TRANSFERRED_TO]->(a2:Account)
OPTIONAL MATCH (a1)-[:LOGGED_IN_FROM]->(d:Device)<-[:LOGGED_IN_FROM]-(a2)
RETURN
      a1.id AS source_id, a1.owner AS source_name, a1.isFlagged AS source_flagged,
      a2.id AS target_id, a2.owner AS target_name, a2.isFlagged AS target_flagged,
      r.amount AS amount, d.deviceId AS shared_device
```

This does two things in a single pass:

1. **First hop (`MATCH`)**: finds every transfer between two accounts.
2. **Second hop (`OPTIONAL MATCH`)**: for that same pair, checks whether they've *also* logged in from the same device — a completely separate relationship type, traversed as a second hop from each account to a shared `Device` node. `OPTIONAL MATCH` means transfers without a shared device still show up (as ordinary transfers), while those that do share a device are flagged with the device ID.

This is the "query a relational database would find awkward" requirement: it's a 2-hop traversal that combines two unrelated relationship types (`TRANSFERRED_TO` and `LOGGED_IN_FROM`) into one pattern match — in SQL this needs a join on the transactions table plus a self-join on a device-login table, matched on device ID, which turns into a much less readable query as more shared attributes are added.

The query is parameter-free (no user input reaches it), so there's no injection surface, and it runs through the official `neo4j` Python driver rather than any raw string formatting.

## Application & UI

- **Network graph view** — a force-directed, draggable node/edge visualization (built from scratch with SVG, no external graph library) showing accounts as nodes and transfers as edges. Flagged accounts glow red; shared-device links render as dashed red edges.
- **Table view** — the same data as a sortable account list and transfer table, for anyone who prefers rows to a graph.
- **Loading, empty, and error states** — a spinner while querying CognoDB, a clear empty-state message when no fraud rings exist in the dataset, and a descriptive error card (with the underlying error message) if the backend or database is unreachable.
- **Stat strip** — account count, flagged count, transfer count, shared-device link count, and total transfer volume at a glance.

## Tech stack

- **Backend**: FastAPI (Python), official `neo4j` driver over Bolt, connecting to CognoDB Cloud
- **Frontend**: React (Vite), plain SVG for the graph visualization — no charting/graph library dependency
- **Database**: CognoDB Cloud (openCypher over Bolt 5.x)
- **Hosting**: Render (backend), Vercel (frontend)

## Project structure

```
sentinel-graph/
├── backend/
│   ├── main.py            # FastAPI app, CognoDB connection, /api/detect-fraud endpoint
│   ├── seed.py             # Clears and seeds sample fraud-ring data
│   ├── requirements.txt
│   └── .env                # COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD (not committed)
├── Frontend/
│   ├── src/
│   │   ├── App.jsx          # Main dashboard: fetch, states, tabs, stats
│   │   ├── GraphView.jsx    # Force-directed network graph (SVG)
│   │   ├── App.css
│   │   └── main.jsx
│   └── .env                 # VITE_API_URL (not committed)
└── README.md
```

## Running it locally

### 1. Set up CognoDB Cloud
1. Sign up at [console.cognodb.com](https://console.cognodb.com/signup) (free, no card required)
2. Create a free (c0) instance and pick a region
3. Save the connection URI (`bolt+s://...`) and the generated password for the `cognodb` user

### 2. Backend
```bash
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```
COGNODB_URI=bolt+s://<your-instance-id>.databases.cognodb.com
COGNODB_USER=cognodb
COGNODB_PASSWORD=<your-password>
```

Seed sample data, then run the API:
```bash
python3 seed.py
python3 main.py
```
Backend runs at `http://localhost:8000`.

### 3. Frontend
```bash
cd Frontend
npm install
```

Create `Frontend/.env`:
```
VITE_API_URL=http://localhost:8000
```

```bash
npm run dev
```
Frontend runs at `http://localhost:5173`.

## Screenshots

**Network Graph view:**
<img width="1440" height="900" alt="Network graph showing a fraud ring" src="https://github.com/user-attachments/assets/40b0a2ba-a116-4e86-9546-6320e4f1bc4e"/>

**Table view:**
<img width="1440" height="900" alt="Table view of flagged accounts and transfers" src="https://github.com/user-attachments/assets/54a43f6f-daca-444f-b678-8c2ca23b1384"/>

## Deployment notes

- Backend is deployed on **Render** as a Python web service, reading `COGNODB_URI`, `COGNODB_USER`, and `COGNODB_PASSWORD` from Render's environment variables (never committed to the repo).
- Frontend is deployed on **Vercel**, with `VITE_API_URL` set to the Render backend URL at build time.
- CORS on the backend explicitly allowlists the deployed Vercel origin alongside local dev origins.
