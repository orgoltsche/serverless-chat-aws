variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "connect_lambda_arn" {
  description = "ARN of the connect Lambda function"
  type        = string
}

variable "disconnect_lambda_arn" {
  description = "ARN of the disconnect Lambda function"
  type        = string
}

variable "send_message_lambda_arn" {
  description = "ARN of the send message Lambda function"
  type        = string
}

variable "get_messages_lambda_arn" {
  description = "ARN of the get messages Lambda function"
  type        = string
}

variable "connect_lambda_name" {
  description = "Name of the connect Lambda function"
  type        = string
}

variable "disconnect_lambda_name" {
  description = "Name of the disconnect Lambda function"
  type        = string
}

variable "send_message_lambda_name" {
  description = "Name of the send message Lambda function"
  type        = string
}

variable "get_messages_lambda_name" {
  description = "Name of the get messages Lambda function"
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  type        = string
}
