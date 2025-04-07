
# Teacher-Student Appointment Management System

A web application for managing student appointments with teachers, built with React, Express, and WebSocket for real-time updates.

## Features

- Student appointment booking
- Teacher availability management 
- Real-time updates via WebSocket
- Teacher assignment system
- Questionnaire responses
- Telegram notifications integration
- Statistics and reporting

## Prerequisites

- Node.js
- PostgreSQL database
- A Replit account

## Setup Instructions

1. Fork this project on Replit
2. The environment will automatically install dependencies

### Environment Variables

Set up the following secrets in the Replit Secrets tab:

- `DATABASE_URL`: Your PostgreSQL connection string
- `SESSION_SECRET`: A random string for session encryption
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token (optional, for notifications)

## Running the Application

1. Click the "Run" button in your Repl
2. The application will start on port 5000

## Deployment

To deploy your application with a custom domain:

1. Go to the "Deployments" tab in your Repl
2. Click "Deploy" to create a new deployment
3. To add a custom domain:
   - Click on "Domains" in the deployment settings
   - Click "Link a domain"
   - Enter your domain name
   - Follow the instructions to add the DNS records to your domain registrar:
     - Add an A record pointing to the provided IP
     - Add the TXT record for domain verification
4. Wait for DNS propagation (usually takes a few minutes)
5. Your site will be available at your custom domain with HTTPS enabled

## Project Structure

```
├── client/           # Frontend React application
├── server/           # Backend Express server
├── shared/           # Shared types and schemas
└── package.json      # Project dependencies
```

## Tech Stack

- Frontend: React, TailwindCSS, ShadcnUI
- Backend: Express, WebSocket
- Database: PostgreSQL with Drizzle ORM
- Authentication: Passport.js
- Real-time: WebSocket (ws)

## License

This project is licensed under the MIT License.
