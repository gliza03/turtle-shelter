The Turtle Shelter Project
Web application for managing volunteer events, tracking vest production, and coordinating distribution efforts.
Technical Overview
A full-stack application with PostgreSQL database supporting vest production tracking and event management.
Core Components
Database Schema

13 normalized tables including:

volunteers
events
production_table
distribution_location
vest_inventory
Complete ERD available in documentation



Backend Architecture

Node.js/Express server
RESTful API endpoints
Bcript authentication
Express Session
PostgreSQL database interactions

Frontend Implementation

AI Generated CSS for styling
Responsive design
Interactive data visualization using Tableau

System Requirements

Node.js v18.0+
PostgreSQL 14+
npm v9.0+
Modern web browser supporting ES6+

Installation Steps
# Clone repository
git clone https://github.com/gliza03/turtle-shelter.git

# Install dependencies
cd turtleshelterproject
npm install

# Update database credentials in .env
const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || "awseb-e-p3hejwztvb-stack-awsebrdsdatabase-9dd6rktoa0gk.cz6qkie2wm9u.us-east-1.rds.amazonaws.com",
        user: process.env.RDS_USERNAME || "turtles",
        password: process.env.RDS_PASSWORD || "Turtle414",
        database: process.env.RDS_DB_NAME || "ebdb",
        port: process.env.RDS_PORT || "5432",
        ssl: { rejectUnauthorized: false }
    }
});

# Start development server
code pipeline handled that for us 

API Documentation
// Key endpoints
GET /api/events           // Retrieve event list
POST /api/volunteers      // Register new volunteer
PUT /api/production/:id   // Update production data
GET /api/inventory        // Check vest inventory

Deployment

AWS hosted
PostgreSQL RDS instance
Automated CI/CD pipeline
Regular database backups - created snapshots