# Analytics API Guide

## Purpose

This document explains how the dashboard can access the analytics results.

Member 6 calculates and prepares the analytics data.

Member 2 connects the frontend dashboard to these endpoints.

## Base URL

The analytics base URL is `/api/analytics`.

## Main Dashboard Endpoint

`GET /api/analytics/dashboard`

This endpoint returns:

- Overview totals
- Operation performance
- Difficulty performance
- Progress trends
- Response-time groups
- Learner statistics
- Top performers
- Recent activity
- Automatic insights

## Available Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard` | Complete dashboard data |
| GET | `/overview` | Main totals |
| GET | `/operations` | Performance by operation |
| GET | `/difficulty` | Performance by difficulty |
| GET | `/trend` | Performance over time |
| GET | `/response-times` | Answer-speed groups |
| GET | `/players` | Learner analytics |
| GET | `/players/:playerName` | One learner's details |
| GET | `/top-performers` | Highest-performing learners |
| GET | `/recent-activity` | Recent game sessions |
| GET | `/insights` | Teacher insights |
| GET | `/report` | Report data |
| GET | `/report?format=html` | Printable report |
| GET | `/export.csv` | CSV export |
| GET | `/status` | Storage status |
| POST | `/sample` | Load sample data |
| DELETE | `/sample` | Remove sample data |

## Filters

The API supports:

- `onlySample=true`
- `includeSample=false`
- `player=Lerato`
- `from=2026-09-01`
- `to=2026-09-30`
- `days=14`
- `limit=5`

Example:

`/api/analytics/dashboard?player=Lerato&days=14`

## Dashboard Response

The dashboard response contains a success value and the calculated analytics sections.

Example fields include:

- `overview`
- `operations`
- `difficulty`
- `trend`
- `responseTimes`
- `players`
- `topPerformers`
- `recentActivity`
- `insights`

## Frontend Handover

Member 2 can request the dashboard data from:

`GET /api/analytics/dashboard`

Member 2 is responsible for displaying the returned values in the dashboard interface.

## Backend Handover

The backend member must register `routes/analytics.js` under `/api/analytics`.

## Sample Data

Sample data can be loaded with:

`POST /api/analytics/sample`

Sample data can be removed with:

`DELETE /api/analytics/sample`

Removing sample data does not remove real game data.

## Security

Before deployment:

- Dashboard endpoints should require authentication
- Reports and exports should be restricted to teachers
- Sample-data endpoints should not be publicly accessible