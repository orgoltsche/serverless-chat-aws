output "websocket_endpoint" {
  description = "WebSocket API endpoint URL"
  value       = "${aws_apigatewayv2_api.websocket.api_endpoint}/${aws_apigatewayv2_stage.main.name}"
}

output "api_id" {
  description = "WebSocket API ID"
  value       = aws_apigatewayv2_api.websocket.id
}
