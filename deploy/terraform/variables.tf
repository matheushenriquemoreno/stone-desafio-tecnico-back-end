variable "aws_region" {
  description = "Região AWS onde a API será executada."
  type        = string
}

variable "environment" {
  description = "Nome do ambiente que possuirá os recursos."
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Prefixo usado nos nomes dos recursos IAM e nas tags."
  type        = string
  default     = "stone-api"
}

variable "users_table_name" {
  description = "Nome exato da tabela de usuários."
  type        = string
  default     = "stone_users"
}

variable "products_table_name" {
  description = "Nome exato da tabela de produtos."
  type        = string
  default     = "stone_products"
}

variable "runtime_user_name" {
  description = "Principal IAM exclusivo usado pela API em runtime."
  type        = string
  default     = "stone-api-runtime"
}

variable "tags" {
  description = "Tags adicionais aplicadas aos recursos gerenciados."
  type        = map(string)
  default     = {}
}
