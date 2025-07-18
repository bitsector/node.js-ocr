# Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "elastic_beanstalk_environment_url" {
  description = "URL of the Elastic Beanstalk environment"
  value       = aws_elastic_beanstalk_environment.main.cname
}

output "elastic_beanstalk_environment_name" {
  description = "Name of the Elastic Beanstalk environment"
  value       = aws_elastic_beanstalk_environment.main.name
}

output "elastic_beanstalk_application_name" {
  description = "Name of the Elastic Beanstalk application"
  value       = aws_elastic_beanstalk_application.main.name
}

output "aurora_cluster_endpoint" {
  description = "Aurora cluster endpoint"
  value       = aws_rds_cluster.main.endpoint
}

output "aurora_cluster_reader_endpoint" {
  description = "Aurora cluster reader endpoint"
  value       = aws_rds_cluster.main.reader_endpoint
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis cluster port"
  value       = aws_elasticache_cluster.main.cache_nodes[0].port
}

output "security_groups" {
  description = "Security group IDs"
  value = {
    elastic_beanstalk = aws_security_group.elastic_beanstalk.id
    database          = aws_security_group.database.id
    redis             = aws_security_group.redis.id
  }
}

output "database_info" {
  description = "Database connection information"
  value = {
    endpoint = aws_rds_cluster.main.endpoint
    port     = aws_rds_cluster.main.port
    name     = var.db_name
    username = var.db_username
  }
  sensitive = false
}

output "infrastructure_summary" {
  description = "Summary of created infrastructure"
  value = {
    region                     = var.aws_region
    vpc_id                     = aws_vpc.main.id
    elastic_beanstalk_url      = aws_elastic_beanstalk_environment.main.cname
    aurora_endpoint            = aws_rds_cluster.main.endpoint
    redis_endpoint             = aws_elasticache_cluster.main.cache_nodes[0].address
    application_name           = aws_elastic_beanstalk_application.main.name
    environment_name           = aws_elastic_beanstalk_environment.main.name
  }
}
