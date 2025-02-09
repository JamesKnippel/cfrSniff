# eCFR Analyzer

A web application for analyzing Federal Regulations data, focusing on agency title comparisons and historical word counts.

## Features

- View agency hierarchies and their CFR references
- Analyze historical word counts since 2017
- Track changes in agency titles over time
- Interactive visualizations using D3.js
- Modern UI with Angular Material

## Project Structure

```
cfrSniff/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── services/
│   │   └── main.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── components/
    │   │   ├── models/
    │   │   └── services/
    │   └── main.ts
    └── package.json
```

## Setup Instructions

### Backend Setup

1. Create a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend Setup

1. Install Node.js dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Angular development server:
   ```bash
   ng serve
   ```

3. Open your browser and navigate to `http://localhost:4200`

## API Endpoints

- `GET /api/agencies` - Get all agencies and their references
- `GET /api/historical-word-counts` - Get historical word counts
- `GET /api/agency/{agency_slug}/titles` - Get titles for a specific agency
- `GET /api/agency/{agency_slug}/changes` - Get historical changes for an agency
- `GET /api/title/{title_number}/word-count` - Get word count for a specific title

## Development

- Backend: FastAPI with async support for efficient API calls
- Frontend: Angular 17 with standalone components and signals
- Data Visualization: D3.js for interactive charts
- UI Components: Angular Material

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request