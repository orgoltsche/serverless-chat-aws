output "websocket_api_endpoint" {
  description = "WebSocket API endpoint URL"
  value       = module.api_gateway.websocket_endpoint
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito App Client ID"
  value       = module.cognito.client_id
}

output "frontend_url" {
  description = "CloudFront distribution URL for frontend"
  value       = module.frontend_hosting.cloudfront_url
}

output "frontend_bucket" {
  description = "S3 bucket name for frontend deployment"
  value       = module.frontend_hosting.bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for frontend cache invalidation"
  value       = module.frontend_hosting.cloudfront_distribution_id
}
