# GitHub Repository Secrets for CI/CD Pipeline

This document lists all the repository secrets you need to configure for the GitHub Actions CI/CD pipeline to work with your AWS Elastic Beanstalk deployment.

## Required Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → Repository secrets

### AWS Authentication
```
AWS_ACCESS_KEY_ID
```
- **Value**: Your AWS IAM user access key ID
- **Example**: `AKIAIOSFODNN7EXAMPLE`
- **How to get**: Create IAM user with Elastic Beanstalk and S3 permissions

```
AWS_SECRET_ACCESS_KEY
```
- **Value**: Your AWS IAM user secret access key
- **Example**: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`
- **How to get**: Generated when creating IAM user access key

```
AWS_REGION
```
- **Value**: Your AWS region where resources are deployed
- **Example**: `us-east-1`
- **Current value**: `us-east-1` (based on your Terraform configuration)

### Elastic Beanstalk Configuration
```
EB_APPLICATION_NAME
```
- **Value**: Your Elastic Beanstalk application name
- **Current value**: `aws-beanstalk-sandbox` (from your Terraform)

```
EB_ENVIRONMENT_NAME
```
- **Value**: Your Elastic Beanstalk environment name
- **Current value**: `aws-beanstalk-sandbox-env` (from your Terraform)

### S3 Deployment Bucket
```
S3_DEPLOYMENT_BUCKET
```
- **Value**: Your S3 bucket name for deployment artifacts
- **Current value**: `aws-beanstalk-sandbox-deployments` (from your setup)

## IAM User Permissions

Your IAM user needs these AWS managed policies:
1. `AWSElasticBeanstalkFullAccess`
2. `AmazonS3FullAccess` (or more restrictive S3 policy for your deployment bucket)

Or create a custom policy with these permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "elasticbeanstalk:*",
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": "*"
        }
    ]
}
```

## Workflow Files Created

The CI/CD pipeline is split into separate workflow files:

1. **`.github/workflows/lint.yml`** - ESLint code quality checks
2. **`.github/workflows/security-scan.yml`** - Security scanning with npm audit & CodeQL
3. **`.github/workflows/build.yml`** - Build and package the application
4. **`.github/workflows/e2e-tests.yml`** - End-to-end tests (placeholder for now)
5. **`.github/workflows/deploy.yml`** - Deploy to AWS Elastic Beanstalk

## Pipeline Behavior

- **All workflows** run on push/PR to `main` and `develop` branches
- **Deployment** only happens on `main` branch pushes
- **Workflows run in parallel** for faster feedback
- **Each workflow is independent** and can be maintained separately

## Setup Checklist

- [ ] Create IAM user with required permissions
- [ ] Add all 6 repository secrets listed above
- [ ] Test pipeline by pushing to `develop` branch first
- [ ] Deploy to production by merging to `main` branch

## Current Values (from your setup)

Based on your Terraform configuration:
- Region: `us-east-1`
- Application: `aws-beanstalk-sandbox`
- Environment: `aws-beanstalk-sandbox-env`
- S3 Bucket: `aws-beanstalk-sandbox-deployments`
