import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const DYNAMODB_DOCUMENT_CLIENT = Symbol('DYNAMODB_DOCUMENT_CLIENT');

export type DocumentClient = DynamoDBDocumentClient;
