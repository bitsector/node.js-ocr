# CI/CD Pipeline Setup

This project uses GitHub Actions for continuous integration and deployment to AWS Elastic Beanstalk.

## Required Repository Secrets

To enable the CI/CD pipeline, you need to configure the following secrets in your GitHub repository:

### Go to: Repository Settings → Secrets and variables → Actions → New repository secret

### AWS Authentication Secrets:
- **`AWS_ACCESS_KEY_ID`**: Your AWS access key ID
- **`AWS_SECRET_ACCESS_KEY`**: Your AWS secret access key  
- **`AWS_REGION`**: AWS region (e.g., `us-east-1`)

### AWS Resource Configuration:
- **`S3_DEPLOYMENT_BUCKET`**: S3 bucket for deployment packages (e.g., `aws-beanstalk-sandbox-deployments`)
- **`EB_APPLICATION_NAME`**: Elastic Beanstalk application name (e.g., `aws-beanstalk-sandbox`)
- **`EB_ENVIRONMENT_NAME`**: Elastic Beanstalk environment name (e.g., `aws-beanstalk-sandbox-env`)

## How to Get AWS Credentials

### Option 1: Create IAM User (Recommended for CI/CD)

1. **Go to AWS Console → IAM → Users → Create User**
2. **User name**: `github-actions-cicd`
3. **Attach policies**:
   - `AWSElasticBeanstalkFullAccess`
   - `AmazonS3FullAccess` (or create custom policy for your specific bucket)

4. **Create access key**:
   - Go to user → Security credentials → Create access key
   - Choose "Application running outside AWS"
   - Save the Access Key ID and Secret Access Key

### Option 2: Use Your Current Credentials
If you're already using AWS CLI locally:
```bash
# View your current credentials
aws configure list

# Get your access key ID (first 4 characters shown)
aws configure get aws_access_key_id

# Get your region
aws configure get region
```

## Your Current Values (based on Terraform setup):

Based on your current infrastructure, these should be your secret values:

```
AWS_REGION=us-east-1
S3_DEPLOYMENT_BUCKET=aws-beanstalk-sandbox-deployments
EB_APPLICATION_NAME=aws-beanstalk-sandbox
EB_ENVIRONMENT_NAME=aws-beanstalk-sandbox-env
```

## Pipeline Stages

1. **Lint**: ESLint code quality checks
2. **Security Scan**: npm audit + dependency updates check
3. **Build**: Creates deployment package
4. **E2E Tests**: Placeholder for end-to-end tests
5. **Deploy**: Deploys to AWS Elastic Beanstalk (only on main branch)

## Triggering the Pipeline

- **Push to `main`**: Full pipeline including deployment
- **Push to `develop`**: Build and test only (no deployment)
- **Pull Requests to `main`**: Build and test only

## Pipeline Features

- ✅ Automatic version labeling with timestamp + git SHA
- ✅ Deployment artifact storage
- ✅ Health check verification after deployment
- ✅ Deployment status monitoring
- ✅ Rollback-ready (previous versions remain in S3)
