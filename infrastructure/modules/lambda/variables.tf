variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "connections_table_name" {
  description = "Name of the connections DynamoDB table"
  type        = string
}

variable "messages_table_name" {
  description = "Name of the messages DynamoDB table"
  type        = string
}

variable "connections_table_arn" {
  description = "ARN of the connections DynamoDB table"
  type        = string
}

variable "messages_table_arn" {
  description = "ARN of the messages DynamoDB table"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}
