# Analytics System

## Purpose

The analytics system measures learner and class performance in the Math Tug-of-War game.

It supports the teacher dashboard and produces a printable class performance report.

## Member Responsibility

This analytics system was developed as the Member 6 contribution for Sprint 3.

The system calculates analytics and prepares report data.

Other responsibilities remain with:
- Member 1: Dashboard user interface
- Member 2: Frontend and backend connection
- Member 4: Permanent database storage
- Backend member: Game and scoring integration

## Current Data Source

The system currently uses sample data and temporary in-memory storage.

This allows the analytics system and report to be tested before the database is available.

The temporary data resets when the server restarts.

## Analytics Provided

The system calculates:
- Total learners
- Total games
- Completed games
- Wins and losses
- Win rate
- Questions answered
- Correct and incorrect answers
- Overall accuracy
- Average response time
- Performance by mathematical operation
- Performance by difficulty level
- Learner performance
- Strongest and weakest operations
- Learner progress trends
- Learners who may need support
- Automatic teacher insights
- Top performers
- Recent game activity

## Mathematical Operations

The system analyses:
- Addition
- Subtraction
- Multiplication
- Division

## Performance Levels

Learner performance is grouped as:
- Strong: 80% or higher
- Developing: 60% to 79%
- Needs support: Below 60%

A learner must answer at least 10 questions before receiving a performance label.

## Sample Data

The sample-data generator creates:
- 6 sample learners
- 30 game sessions
- 360 answered questions
- Different learner strengths and weaknesses
- Different response times
- Wins and losses
- Improving and declining trends

Sample data is marked with `isSample: true` so it can be removed without deleting real data.

## Teacher Report

The report contains:
- Class summary
- Key performance indicators
- Automatic findings
- Operation analysis
- Response-time analysis
- Daily progress
- Learner performance table
- Top performers
- Difficulty analysis
- POPIA reminder

Generate the report with:

```powershell
node .\backend\scripts\generate-sample-report.js