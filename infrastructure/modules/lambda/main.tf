# IAM Role for Lambda Functions
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for Lambda Functions
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-${var.environment}-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          var.connections_table_arn,
          var.messages_table_arn,
          "${var.messages_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections"
        ]
        Resource = "arn:aws:execute-api:*:*:*/@connections/*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

# Security Group for Lambda
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-${var.environment}-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-sg"
  }
}

# Lambda Function: Connect
resource "aws_lambda_function" "connect" {
  function_name = "${var.project_name}-${var.environment}-connect"
  role          = aws_iam_role.lambda_role.arn
  handler       = "connect.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      CONNECTIONS_TABLE = var.connections_table_name
      MESSAGES_TABLE    = var.messages_table_name
    }
  }
}

# Lambda Function: Disconnect
resource "aws_lambda_function" "disconnect" {
  function_name = "${var.project_name}-${var.environment}-disconnect"
  role          = aws_iam_role.lambda_role.arn
  handler       = "disconnect.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      CONNECTIONS_TABLE = var.connections_table_name
    }
  }
}

# Lambda Function: Send Message
resource "aws_lambda_function" "send_message" {
  function_name = "${var.project_name}-${var.environment}-send-message"
  role          = aws_iam_role.lambda_role.arn
  handler       = "sendMessage.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      CONNECTIONS_TABLE = var.connections_table_name
      MESSAGES_TABLE    = var.messages_table_name
    }
  }
}

# Lambda Function: Get Messages
resource "aws_lambda_function" "get_messages" {
  function_name = "${var.project_name}-${var.environment}-get-messages"
  role          = aws_iam_role.lambda_role.arn
  handler       = "getMessages.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      MESSAGES_TABLE = var.messages_table_name
    }
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "connect" {
  name              = "/aws/lambda/${aws_lambda_function.connect.function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "disconnect" {
  name              = "/aws/lambda/${aws_lambda_function.disconnect.function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "send_message" {
  name              = "/aws/lambda/${aws_lambda_function.send_message.function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "get_messages" {
  name              = "/aws/lambda/${aws_lambda_function.get_messages.function_name}"
  retention_in_days = 14
}
