# Connections Table - stores active WebSocket connections
resource "aws_dynamodb_table" "connections" {
  name         = "${var.project_name}-${var.environment}-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-connections"
  }
}

# Messages Table - stores chat messages
resource "aws_dynamodb_table" "messages" {
  name         = "${var.project_name}-${var.environment}-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roomId"
  range_key    = "sortKey"

  attribute {
    name = "roomId"
    type = "S"
  }

  attribute {
    name = "sortKey"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    range_key       = "sortKey"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-messages"
  }
}
