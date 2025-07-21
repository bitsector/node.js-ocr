# AWS Security Review Practice Environment

[![CI/CD Pipeline](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/actions/workflows/ci-cd.yml)

> **Note**: Replace `YOUR_USERNAME/YOUR_REPO_NAME` in the badge URL above with your actual GitHub repository path.

This Terraform configuration creates a complete AWS infrastructure for practicing security reviews, featuring a modern Node.js 22 application stack.

## 🏗️ Architecture

- **VPC**: Custom VPC with public/private subnets across 2 AZs
- **Elastic Beanstalk**: Node.js 22 application environment (Latest LTS)
- **Aurora MySQL**: Database cluster in private subnets
- **Redis**: ElastiCache cluster for caching
- **Security Groups**: Tiered network access controls
- **IAM Roles**: Proper service permissions

## 🆕 Updated Features

- **Node.js 22**: Latest LTS version with improved performance
- **Modern Platform**: Amazon Linux 2023 with latest security updates
- **Enhanced Monitoring**: Built-in performance tracking
- **Graceful Deployment**: Better error handling and shutdown procedures

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured with appropriate credentials
- Terraform >= 1.0 installed
- Sufficient AWS permissions for creating VPC, RDS, ElastiCache, EB, IAM resources

### 1. Initialize Terraform
```bash
terraform init
```

### 2. Plan the Deployment
```bash
terraform plan
```

### 3. Deploy Infrastructure
```bash
terraform apply
```

This will take 10-15 minutes as AWS provisions all resources.

### 4. Get Infrastructure Info
```bash
terraform output
```

## 📋 What Gets Created

### Networking
- **VPC**: 10.0.0.0/16
- **Public Subnets**: 10.0.1.0/24, 10.0.2.0/24 (for Elastic Beanstalk)
- **Private Subnets**: 10.0.3.0/24, 10.0.4.0/24 (for database/Redis)
- **Internet Gateway**: For public internet access
- **Route Tables**: Properly configured routing

### Security Groups
- **Elastic Beanstalk SG**: HTTP/HTTPS from internet
- **Database SG**: MySQL access only from EB instances
- **Redis SG**: Redis access only from EB instances

### Database
- **Aurora MySQL 8.0**: Encrypted cluster in private subnets
- **DB Instance**: db.t3.medium for adequate performance

### Cache
- **Redis 7.1**: Single-node cluster in private subnets
- **Node Type**: cache.t3.micro for cost efficiency

### Application Platform
- **Elastic Beanstalk**: Node.js 18 on Amazon Linux 2023
- **IAM Roles**: Proper service and instance roles
- **Environment Variables**: Database and Redis connection info

## 🔧 Configuration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | us-east-1 | AWS region for deployment |
| `app_name` | security-review-app | Application name prefix |
| `environment` | security-review-env | Environment name |
| `vpc_cidr` | 10.0.0.0/16 | VPC CIDR block |
| `db_username` | admin | Database master username |
| `db_password` | TempPassword123! | Database master password |
| `db_name` | securityreviewdb | Database name |

## 🔍 Security Practice Points

This environment intentionally includes misconfigurations for practice:

❌ **Security Issues to Find:**
- Database password stored in plain text
- Default VPC security group rules
- Missing encryption on Redis
- No VPC Flow Logs
- Overly broad security group rules
- Default backup retention settings
- No multi-factor authentication
- Missing CloudTrail logging
- No monitoring/alerting

✅ **Good Practices Included:**
- Aurora encryption at rest
- Database in private subnets
- Security groups with source restrictions
- IAM roles instead of access keys
- Separate subnets for different tiers

## 📊 Cost Estimation

Daily cost (approximate):
- Aurora db.t3.medium: ~$1.90/day
- Redis cache.t3.micro: ~$0.48/day
- Elastic Beanstalk (t3.micro): ~$0.24/day
- **Total**: ~$2.62/day

## 🧹 Cleanup

When you're done practicing:

```bash
terraform destroy
```

This will remove ALL resources and stop billing.

## 📝 Next Steps

1. **Deploy Application**: Create a Node.js app and deploy to Elastic Beanstalk
2. **Setup Amplify**: Configure frontend hosting
3. **Security Review**: Practice identifying and fixing security issues
4. **Add Monitoring**: CloudWatch, VPC Flow Logs, CloudTrail

## 🔗 Useful Commands

```bash
# Check Terraform state
terraform state list

# Import existing resources (if needed)
terraform import aws_vpc.main vpc-xxxxxxxxx

# Format Terraform files
terraform fmt

# Validate configuration
terraform validate

# Show current state
terraform show
```

## 🚨 Important Notes

- **This is for PRACTICE only** - Don't use in production without security hardening
- **Change the database password** before any real use
- **Monitor costs** - remember to destroy when done
- **Review security groups** - they're intentionally permissive for learning
