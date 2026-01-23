terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "serverless-chat-terraform-state-eu-central-1"
    key            = "terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr
}

# DynamoDB Module
module "dynamodb" {
  source = "./modules/dynamodb"

  project_name = var.project_name
  environment  = var.environment
}

# Cognito Module
module "cognito" {
  source = "./modules/cognito"

  project_name = var.project_name
  environment  = var.environment
}

# Lambda Module
module "lambda" {
  source = "./modules/lambda"

  project_name           = var.project_name
  environment            = var.environment
  connections_table_name = module.dynamodb.connections_table_name
  messages_table_name    = module.dynamodb.messages_table_name
  connections_table_arn  = module.dynamodb.connections_table_arn
  messages_table_arn     = module.dynamodb.messages_table_arn
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids

  depends_on = [module.vpc, module.dynamodb]
}

# API Gateway WebSocket Module
module "api_gateway" {
  source = "./modules/api-gateway"

  project_name             = var.project_name
  environment              = var.environment
  connect_lambda_arn       = module.lambda.connect_function_arn
  disconnect_lambda_arn    = module.lambda.disconnect_function_arn
  send_message_lambda_arn  = module.lambda.send_message_function_arn
  get_messages_lambda_arn  = module.lambda.get_messages_function_arn
  connect_lambda_name      = module.lambda.connect_function_name
  disconnect_lambda_name   = module.lambda.disconnect_function_name
  send_message_lambda_name = module.lambda.send_message_function_name
  get_messages_lambda_name = module.lambda.get_messages_function_name
  cognito_user_pool_arn    = module.cognito.user_pool_arn

  depends_on = [module.lambda, module.cognito]
}

# Frontend Hosting Module
module "frontend_hosting" {
  source = "./modules/frontend-hosting"

  project_name = var.project_name
  environment  = var.environment
}
