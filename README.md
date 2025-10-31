# Therapist Matcher
### Frog Point Therapy

## Description

The Therapist Matcher is an intelligent matching system that helps connect new clients with the most suitable therapist at Frog Point Therapy. The application uses AWS Bedrock AI to analyze client questionnaire responses and match them with therapists based on specializations, therapy approaches, availability, and client needs.

### Architecture

- **Frontend**: Static HTML/CSS/JavaScript application hosted on AWS S3 and served via CloudFront
- **Backend**: AWS Lambda function with API Gateway integration
- **AI Engine**: AWS Bedrock Runtime for intelligent therapist matching
- **API Security**: API Gateway with API key authentication

### Features

- Client questionnaire form capturing:
  - Contact information (name, email, phone, location)
  - Primary mental health concerns
  - Therapy goals and preferences
  - Previous therapy experience
  - Preferred therapy approach and session frequency
- AI-powered therapist matching based on client needs
- Secure API communication with key-based authentication
- CloudFront CDN for fast, global content delivery

## Prerequisites

Before deploying, ensure you have:

- AWS CLI installed and configured with appropriate credentials
- AWS account with permissions for:
  - Lambda function creation/updates
  - API Gateway management
  - S3 bucket operations
  - CloudFront distribution management
- Node.js and npm installed (for backend dependencies)

## Backend Deployment

The backend consists of an AWS Lambda function that processes client questionnaires and returns therapist matches using AWS Bedrock AI.

### Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with your API Gateway key:
   ```bash
   API_GATEWAY_KEY=your-api-key-here
   ```

### Deploy

Run the deployment script:
```bash
./deploy-backend.sh
```

This script will:
- Package the Lambda function with all dependencies
- Create or update the Lambda function (`fpt-matcher-handler`)
- Set up API Gateway with CORS support
- Configure API key authentication
- Create usage plans and rate limiting
- Deploy the API to the `prod` stage

After deployment, you'll receive:
- API Gateway URL: `https://{api-id}.execute-api.us-west-2.amazonaws.com/prod/matcher`
- Test curl command with your API key

### Configuration

The backend deployment script uses these default values (configurable in `deploy-backend.sh`):
- **Function Name**: `fpt-matcher-handler`
- **API Name**: `fpt-api`
- **Region**: `us-west-2`
- **Runtime**: Node.js 22.x
- **Timeout**: 10 seconds

## Frontend Deployment

The frontend is a static web application hosted on AWS S3 and distributed via CloudFront.

### Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Update the API endpoint in `src/scripts.js` if needed (should match your backend API Gateway URL)

### Deploy

Make the deployment script executable and run it:
```bash
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

This script will:
- Sync the `src/` directory to the S3 bucket (`frog-point-therapy`)
- Delete any removed files from S3
- Invalidate CloudFront cache to ensure latest changes are served
- Provide the public URL for the application

After deployment, the application will be available at:
**https://matcher.frogpointtherapy.com/views.html**

### Configuration

The frontend deployment script uses these values (configurable in `deploy-frontend.sh`):
- **S3 Bucket**: `frog-point-therapy`
- **Region**: `us-west-2`
- **CloudFront Distribution**: `EWXGGDNJOH216`

## Testing

To test the backend API directly:

```bash
curl -X POST https://{api-id}.execute-api.us-west-2.amazonaws.com/prod/matcher \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: your-api-key-here' \
  -d '{
    "name": "Test Client",
    "email": "test@example.com",
    "phone": "555-0123",
    "location": "Portland, OR",
    "primary-concerns": ["anxiety"],
    "therapy-goals": "stress management",
    "previous-therapy": "none",
    "therapy-approach": "CBT",
    "session-frequency": "weekly"
  }'
```

## Project Structure

```
therapist-matcher/
├── backend/
│   ├── src/
│   │   ├── therapistMatcher.js       # Lambda handler function
│   │   └── therapist-profiles.md     # Therapist information database
│   ├── deploy-backend.sh             # Backend deployment script
│   ├── package.json                  # Node.js dependencies
│   └── artifacts/                    # Generated deployment packages
├── frontend/
│   ├── src/
│   │   ├── views.html               # Client questionnaire form
│   │   ├── scripts.js               # Frontend logic
│   │   └── styles.css               # Application styling
│   └── deploy-frontend.sh           # Frontend deployment script
└── README.md
```

## Development

### Local Testing

To test the Lambda function locally, you can use the AWS SAM CLI or invoke it directly with Node.js by creating a test harness.

### Updating Therapist Profiles

Edit `backend/src/therapist-profiles.md` and redeploy the backend:
```bash
cd backend
./deploy-backend.sh
```

### Updating Frontend

Make changes to files in `frontend/src/` and redeploy:
```bash
cd frontend
./deploy-frontend.sh
```

## Security

- API requests require an API key via the `x-api-key` header
- CORS is configured to allow cross-origin requests
- Usage plans enforce rate limiting (50 req/sec burst, 100 req/sec steady, 1000 req/day quota)
- CloudFront provides DDoS protection and SSL/TLS encryption

## Legal

Copyright © 2025 Frog Point Therapy. All rights reserved.

