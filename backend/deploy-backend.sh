#!/bin/bash

# Simple AWS Lambda and API Gateway deployment script
# Prerequisites: AWS CLI configured with appropriate permissions

FUNCTION_NAME="fpt-matcher-handler"
API_NAME="fpt-api"
REGION="us-west-2"  # Change as needed
ACCOUNT_ID="074030616636"

echo "Creating deployment artifact..."

# Create a temporary deployment directory
rm -rf ./deploy_temp
mkdir -p ./deploy_temp
mkdir -p ./deploy_temp/src

# Copy source files, package.json, and node_modules
cp -r src/* ./deploy_temp/src/
cp package.json ./deploy_temp/
cp package-lock.json ./deploy_temp/
cp -r node_modules ./deploy_temp/

# Create zip from deployment directory
rm -rf ./artifacts
sleep 1
mkdir -p ./artifacts
cd deploy_temp
zip -r ../artifacts/lambda.zip .
cd ..

# Clean up temporary directory
rm -rf ./deploy_temp

echo "Deploying to AWS Lambda..."

# Check if function exists
aws lambda get-function --function-name $FUNCTION_NAME --region $REGION > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "Updating existing function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://artifacts/lambda.zip \
        --region $REGION
else
    echo "Creating new function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs22.x \
        --role arn:aws:iam::074030616636:role/lambda-execution-role \
        --handler src/therapistMatcher.handler \
        --timeout 10 \
        --zip-file fileb://artifacts/lambda.zip \
        --region $REGION
    
    # echo "Note: Replace YOUR_ACCOUNT_ID with your actual AWS account ID"
    # echo "and ensure the lambda-execution-role exists with appropriate permissions"
fi

echo "Lambda deployment complete!"

# API Gateway setup
echo "Setting up API Gateway..."

# Create or get API Gateway
API_ID=$(aws apigateway get-rest-apis --region $REGION --query "items[?name=='$API_NAME'].id" --output text)

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
    echo "Creating new API Gateway..."
    API_ID=$(aws apigateway create-rest-api \
        --name $API_NAME \
        --description "API for FPT matcher" \
        --region $REGION \
        --query 'id' --output text)
    echo "Created API with ID: $API_ID"
else
    echo "Using existing API with ID: $API_ID"
fi

# Load environment variables
  if [ -f ".env" ]; then
      export $(cat .env | xargs)
  fi

# Create or get API key
if [ -n "$API_GATEWAY_KEY" ]; then
    echo "Setting up API key protection..."
    
    # Create API key if it doesn't exist
    API_KEY_ID=$(aws apigateway get-api-keys \
        --region $REGION \
        --query "items[?name=='fpt-api-key'].id" --output text)
    
    if [ -z "$API_KEY_ID" ] || [ "$API_KEY_ID" == "None" ]; then
        echo "Creating API key..."
        API_KEY_ID=$(aws apigateway create-api-key \
            --name fpt-api-key \
            --description "API key for FPT Matcher" \
            --enabled \
            --value "$API_GATEWAY_KEY" \
            --region $REGION \
            --query 'id' --output text)
        echo "Created API key with ID: $API_KEY_ID"
    else
        echo "Using existing API key with ID: $API_KEY_ID"
    fi
    
    # Create usage plan if it doesn't exist
    USAGE_PLAN_ID=$(aws apigateway get-usage-plans \
        --region $REGION \
        --query "items[?name=='fpt-usage-plan'].id" --output text)
    
    if [ -z "$USAGE_PLAN_ID" ] || [ "$USAGE_PLAN_ID" == "None" ]; then
        echo "Creating usage plan..."
        USAGE_PLAN_ID=$(aws apigateway create-usage-plan \
            --name fpt-usage-plan \
            --description "Usage plan for FPT API" \
            --throttle burstLimit=100,rateLimit=50 \
            --quota limit=1000,period=DAY \
            --region $REGION \
            --query 'id' --output text)
        echo "Created usage plan with ID: $USAGE_PLAN_ID"
    else
        echo "Using existing usage plan with ID: $USAGE_PLAN_ID"
    fi
else
    echo "No API key provided, exiting script"
    exit 1
fi

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?path==`/`].id' --output text)

# Create resource for /matcher (if it doesn't exist)
RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart==`matcher`].id' --output text)

if [ -z "$RESOURCE_ID" ] || [ "$RESOURCE_ID" == "None" ]; then
    echo "Creating /matcher resource..."
    RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $ROOT_RESOURCE_ID \
        --path-part matcher \
        --region $REGION \
        --query 'id' --output text)
fi

# Create OPTIONS method for CORS preflight (if it doesn't exist)
aws apigateway get-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --region $REGION > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "Creating OPTIONS method for CORS..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION
fi

# Create or update POST method
aws apigateway get-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --region $REGION > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "Creating POST method..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method POST \
        --authorization-type NONE \
        --api-key-required \
        --region $REGION
else
    echo "Updating existing POST method..."
    # Update existing method to require API key
    aws apigateway update-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method POST \
        --patch-operations op=replace,path=/apiKeyRequired,value=true \
        --region $REGION
fi

# Set up CORS integration for OPTIONS method
echo "Setting up CORS integration for OPTIONS method..."
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --region $REGION \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}'

# Set up OPTIONS method response
echo "Setting up OPTIONS method response..."
aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-models '{"application/json": "Empty"}' \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": false, "method.response.header.Access-Control-Allow-Methods": false, "method.response.header.Access-Control-Allow-Origin": false}' \
    --region $REGION

# Set up OPTIONS integration response  
aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'", "method.response.header.Access-Control-Allow-Methods": "'"'"'GET,POST,OPTIONS'"'"'", "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"}' \
    --region $REGION

# Set up Lambda integration for POST method
echo "Setting up Lambda integration for POST method..."
LAMBDA_URI="arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME/invocations"

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri $LAMBDA_URI \
    --region $REGION

# Add Lambda permission for API Gateway to invoke function
echo "Adding Lambda invoke permissions..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-invoke-$RANDOM \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*" \
    --region $REGION 2>/dev/null || echo "Permission might already exist"

# Deploy API
echo "Deploying API..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --region $REGION

# Associate API key with usage plan if API key is configured
if [ -n "$API_GATEWAY_KEY" ]; then
    echo "Associating API key with usage plan..."

    # Check current usage plan configuration
    CURRENT_STAGES=$(aws apigateway get-usage-plan \
        --usage-plan-id $USAGE_PLAN_ID \
        --region $REGION \
        --query 'apiStages[].{apiId:apiId,stage:stage}' \
        --output json)

    echo "Current usage plan stages: $CURRENT_STAGES"

    # Check if this API stage is already in the usage plan
    STAGE_EXISTS=$(echo $CURRENT_STAGES | grep -c "\"apiId\": \"$API_ID\"" || true)

    if [ "$STAGE_EXISTS" -eq 0 ]; then
        echo "Adding API stage to usage plan..."
        # First, update the usage plan to include the API stage
        aws apigateway update-usage-plan \
            --usage-plan-id $USAGE_PLAN_ID \
            --patch-operations "op=add,path=/apiStages,value=$API_ID:prod" \
            --region $REGION
        echo "API stage added to usage plan"
    else
        echo "API stage already in usage plan"
    fi

    # Verify the usage plan now has the API stage
    UPDATED_STAGES=$(aws apigateway get-usage-plan \
        --usage-plan-id $USAGE_PLAN_ID \
        --region $REGION \
        --query 'apiStages[].{apiId:apiId,stage:stage}' \
        --output json)

    echo "Updated usage plan stages: $UPDATED_STAGES"

    # Then associate the API key with the usage plan
    aws apigateway create-usage-plan-key \
        --usage-plan-id $USAGE_PLAN_ID \
        --key-id $API_KEY_ID \
        --key-type API_KEY \
        --region $REGION 2>/dev/null || echo "API key might already be associated"

    echo "API key protection enabled. Requests must include 'x-api-key' header."
fi

echo ""
echo "==== DEPLOYMENT COMPLETE ===="
echo "API Gateway URL: https://$API_ID.execute-api.$REGION.amazonaws.com/prod/matcher"

if [ -n "$API_GATEWAY_KEY" ]; then
    echo "Test with: curl -X POST https://$API_ID.execute-api.$REGION.amazonaws.com/prod/matcher -H 'Content-Type: application/json' -H 'x-api-key: $API_GATEWAY_KEY' -d '{\"name\":\"Test Client\",\"email\":\"test@example.com\",\"phone\":\"555-0123\",\"primary-concerns\":[\"anxiety\"],\"therapy-goals\":\"stress management\",\"previous-therapy\":\"none\",\"therapy-approach\":\"CBT\",\"session-frequency\":\"weekly\"}'"
fi