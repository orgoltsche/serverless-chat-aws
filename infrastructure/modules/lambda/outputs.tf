output "connect_function_arn" {
  description = "ARN of the connect Lambda function"
  value       = aws_lambda_function.connect.arn
}

output "connect_function_name" {
  description = "Name of the connect Lambda function"
  value       = aws_lambda_function.connect.function_name
}

output "disconnect_function_arn" {
  description = "ARN of the disconnect Lambda function"
  value       = aws_lambda_function.disconnect.arn
}

output "disconnect_function_name" {
  description = "Name of the disconnect Lambda function"
  value       = aws_lambda_function.disconnect.function_name
}

output "send_message_function_arn" {
  description = "ARN of the send message Lambda function"
  value       = aws_lambda_function.send_message.arn
}

output "send_message_function_name" {
  description = "Name of the send message Lambda function"
  value       = aws_lambda_function.send_message.function_name
}

output "get_messages_function_arn" {
  description = "ARN of the get messages Lambda function"
  value       = aws_lambda_function.get_messages.arn
}

output "get_messages_function_name" {
  description = "Name of the get messages Lambda function"
  value       = aws_lambda_function.get_messages.function_name
}
