output "users_table_name" {
  description = "Nome da tabela de usuários para USERS_TABLE_NAME."
  value       = aws_dynamodb_table.users.name
}

output "products_table_name" {
  description = "Nome da tabela de produtos para PRODUCTS_TABLE_NAME."
  value       = aws_dynamodb_table.products.name
}

output "users_table_arn" {
  description = "ARN da tabela de usuários."
  value       = aws_dynamodb_table.users.arn
}

output "products_table_arn" {
  description = "ARN da tabela de produtos."
  value       = aws_dynamodb_table.products.arn
}

output "runtime_user_name" {
  description = "Nome do principal IAM usado pela API."
  value       = aws_iam_user.runtime.name
}

output "runtime_user_arn" {
  description = "ARN do principal IAM usado pela API."
  value       = aws_iam_user.runtime.arn
}
