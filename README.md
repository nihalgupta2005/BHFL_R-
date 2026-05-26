# DeskFlow — Support Ticket Triage Board

A full-stack MERN (MongoDB, Express, React, Node.js) application designed to triage customer support tickets. The application features strict workflow transition rules, time-based SLA monitoring, derived metrics computed dynamically, and an interactive Kanban-style board UI with drag-and-drop capabilities.

---

## 🚀 Deployed Links
*   **Live Frontend (Netlify):** [https://deskflow-portal-nihal.netlify.app](https://deskflow-portal-nihal.netlify.app)
*   **GitHub Repository:** [https://github.com/nihalgupta2005/BHFL_R-](https://github.com/nihalgupta2005/BHFL_R-)

---

## 🛠️ Tech Stack
*   **Frontend:** React, Vite, Vanilla CSS (Modern aesthetic with glassmorphism, responsive grid, and custom UI variables)
*   **Backend:** Node.js, Express.js (REST API, input validation, custom transition engine, CORS middleware)
*   **Database:** MongoDB, Mongoose (Document-based schema, dynamic schema virtuals for real-time calculation)

---

## ✨ Features & Business Rules

### 1. Board Columns & Ticket Management
The portal displays a Kanban board divided into four workflow statuses:
*   **Open** (initial status for new tickets)
*   **In Progress** (work started)
*   **Resolved** (issue fixed; logs resolution timestamp)
*   **Closed** (ticket finalized)

### 2. Strict State Transition Logic (Enforced on Frontend & Backend)
Transitions are strictly governed to maintain process integrity:
*   **Forward Transitions:** Tickets must progress one step at a time (e.g., `Open` ➔ `In Progress` ➔ `Resolved` ➔ `Closed`). Skipping steps (e.g., direct `Open` ➔ `Resolved`) is blocked and returns a `400 Bad Request`.
*   **Backward Transitions:** Reverting status is allowed, but strictly only **one step backward** at a time (e.g., `Resolved` ➔ `In Progress`). Reopening to a non-adjacent state is blocked.
*   **Timestamp Updates:** Transitioning to `Resolved` automatically sets the `resolvedAt` timestamp. Reverting a ticket back to `In Progress` or `Open` automatically clears `resolvedAt`.

### 3. Dynamic Priority-based SLAs (Service Level Agreements)
Response time targets vary by priority:
*   **Urgent:** 1 Hour
*   **High:** 4 Hours
*   **Medium:** 24 Hours
*   **Low:** 72 Hours

Two derived fields are computed dynamically at read-time:
*   `ageMinutes`: The total minutes elapsed since ticket creation. For resolved or closed tickets, the timer stops at the resolution time (`resolvedAt - createdAt`).
*   `slaBreached`: A boolean flag that evaluates to `true` if the ticket is unresolved beyond its priority limit, or if it was resolved after the limit.

### 4. Interactive Frontend
*   **Drag and Drop:** Move cards between columns. Valid moves trigger updates immediately; invalid transitions snap back and display an error banner.
*   **Stats Strip:** Displays overall aggregates, ticket counts per status, and total active SLA breaches.
*   **Real-time Filters:** Filter by priority, or isolate SLA-breached tickets.
*   **Ticket Submission:** A clean, responsive form modal with full front-and-back email and field validations.

---

## 📦 Project Structure
```text
Bajaj_Round1/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx         # Main React application & Board components
│   │   ├── index.css       # Core design system and layout styling
│   │   └── main.jsx
│   ├── vite.config.js
│   ├── .env                # Frontend environment config
│   └── package.json
├── models/
│   └── Ticket.js           # Mongoose Schema with virtuals (ageMinutes, slaBreached)
├── server.js               # Express application and route handlers
├── .gitignore              # Files excluded from Git
├── package.json            # Root Node dependencies & start scripts
└── README.md               # Documentation (this file)
```

---

## ⚙️ Local Setup Instructions

### Prerequisites
*   Node.js (v18+)
*   MongoDB running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas URI

### 1. Backend Setup
1. From the project root, install backend dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the root folder:
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/ticket_system
   ```
3. Start the backend server:
   ```bash
   npm run dev
   ```
   *The backend will start on [http://localhost:5000](http://localhost:5000).*

### 2. Frontend Setup
1. Navigate to the `client/` folder:
   ```bash
   cd client
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `client/` folder:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
4. Start the frontend Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will run locally on [http://localhost:5173](http://localhost:5173).*
