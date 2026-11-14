# Campus FoodConnect

Intelligent Surplus Food Tracking and Redistribution System — frontend demo.

A production-quality React + Vite + Tailwind CSS application that connects campus canteens with nearby NGOs and food distribution centers.

## Features

- Role-based dashboards: Canteen Coordinator, NGO / Distribution Center, Collection Volunteer, Campus Administrator
- Surplus food listing with safety fields and draft support (localStorage)
- Intelligent matching UI with score breakdown (demand 35%, capacity 25%, travel 25%, urgency 15%)
- 15-minute travel-time eligibility filter (demo travel times — not live routing)
- Leaflet map with canteen and center markers
- Charts (Recharts): surplus trends, category mix, redistribution
- Food waste analytics with redistribution rate and estimated impact metrics
- OTP-style pickup verification for volunteers
- Responsive layout (sidebar + mobile nav)

## Tech stack

- React 19 (functional components)
- Vite
- Tailwind CSS v4
- React Router DOM
- Lucide React
- Recharts
- Sonner (toasts)
- React Leaflet + Leaflet
- Context API + localStorage

## Quick start

```bash
cd foodconnect
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Demo logins

| Role | Email | Password |
|------|-------|----------|
| Canteen Coordinator | canteen@campus.edu | canteen123 |
| Distribution Center / NGO | ngo@hopekitchen.org | ngo123 |
| Collection Volunteer | volunteer@campus.edu | volunteer123 |
| Campus Administrator | admin@campus.edu | admin123 |

Or use **Quick demo login** buttons on the sign-in page.

## Project structure

```
src/
  components/     # StatCard, Sidebar, StatusBadge, ProtectedRoute, …
  context/        # AuthContext, FoodContext
  data/           # mockData.js
  layouts/        # DashboardLayout
  pages/          # Landing, Login, Register, dashboards, Matching, Analytics
  utils/          # matchingAlgorithm.js, validation.js
  App.jsx
  main.jsx
  index.css
```

## Matching algorithm (frontend demo)

1. Submit surplus food  
2. Validate form fields (safety remains **pending** until checks complete)  
3. Rank centers with travel time ≤ 15 minutes  
4. Score = 0.35×Demand + 0.25×Capacity + 0.25×Travel + 0.15×Urgency  
5. Accept / reject; fallback keeps listing available  

Travel times in mock data are **illustrative only**. They are not live GPS or routing results.

## Backend readiness

API-shaped context methods and mock data are isolated so you can later swap in:

- Node.js + Express REST APIs  
- SQLite  
- Real road-routing for travel times  
- Auth tokens  

Without rewriting the UI.

## Build

```bash
npm run build
npm run preview
```

## License

Educational / demo use.
