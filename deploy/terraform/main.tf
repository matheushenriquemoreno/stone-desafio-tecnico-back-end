locals {
  common_tags = merge(
    {
      Application = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags,
  )
}

resource "aws_dynamodb_table" "users" {
  name         = var.users_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = local.common_tags
}

resource "aws_dynamodb_table" "products" {
  name         = var.products_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = local.common_tags
}

data "aws_iam_policy_document" "runtime" {
  statement {
    sid    = "ReadinessAndCatalogAccess"
    effect = "Allow"

    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:GetItem",
      "dynamodb:Scan",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
    ]

    resources = [
      aws_dynamodb_table.users.arn,
      aws_dynamodb_table.products.arn,
    ]
  }
}

resource "aws_iam_user" "runtime" {
  name = var.runtime_user_name
  path = "/stone/"

  tags = local.common_tags
}

resource "aws_iam_user_policy" "runtime" {
  name   = "${var.project_name}-runtime"
  user   = aws_iam_user.runtime.name
  policy = data.aws_iam_policy_document.runtime.json
}
