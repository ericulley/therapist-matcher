#!/bin/bash

# S3 deployment script for frontend
# Prerequisites: AWS CLI configured with appropriate permissions

# To deploy changes, run $ ./deploy.sh

BUCKET_NAME="frog-point-therapy"
REGION="us-west-2"
SOURCE_DIR="./src"
CLOUDFRONT_DISTRIBUTION_ID="EWXGGDNJOH216"

echo "Deploying frontend to S3..."

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory $SOURCE_DIR does not exist!"
    exit 1
fi

# Sync the src directory to S3 bucket
echo "Syncing $SOURCE_DIR to s3://$BUCKET_NAME/..."
aws s3 sync "$SOURCE_DIR" "s3://$BUCKET_NAME/" \
    --region "$REGION" \
    --delete \
    --exclude "*.DS_Store"

if [ $? -eq 0 ]; then
    echo ""
    echo "S3 sync complete. Invalidating CloudFront cache..."

    # Create CloudFront invalidation to clear cache
    aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/*"

    if [ $? -eq 0 ]; then
        echo ""
        echo "==== DEPLOYMENT COMPLETE ===="
        echo "Files deployed to: s3://$BUCKET_NAME/"
        echo "CloudFront cache invalidated"
        echo "URL: https://matcher.frogpointtherapy.com/index.html"
    else
        echo ""
        echo "WARNING: S3 sync succeeded but CloudFront invalidation failed!"
        echo "You may need to manually invalidate the cache in the AWS Console."
        exit 1
    fi
else
    echo "Deployment failed!"
    exit 1
fi
