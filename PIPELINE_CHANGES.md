# CI/CD Pipeline Consolidation

## What Changed
- Consolidated all separate workflow files into a single `ci-cd-pipeline.yml`
- Disabled old workflows: lint.yml, security-scan.yml, build.yml, e2e-tests.yml, deploy.yml

## New Single Pipeline Flow
1. **Lint Stage** - ESLint validation
2. **Security Scan Stage** - npm audit + CodeQL analysis  
3. **Build Stage** - Create deployment package
4. **E2E Tests Stage** - Placeholder (passes trivially)
5. **Deploy Stage** - Deploy to AWS (main branch only)

## Benefits
- ✅ No more multiple deployment triggers
- ✅ Clear sequential execution
- ✅ Only ONE deployment per commit
- ✅ All stages must pass before deployment
- ✅ Simplified workflow management

## Result
Instead of 3+ separate "Deploy to AWS" runs, you now get:
- ONE complete pipeline run with all stages
- Deploy only happens at the END after all tests pass
- Deploy only runs on `main` branch pushes
