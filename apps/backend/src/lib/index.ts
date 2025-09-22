/**
 * Frontend-safe types and utilities from the backend
 * WARNING: This file should only contain what frontend actually needs
 */

// RPC utilities - core functionality for frontend-backend communication
export { createRPC, proxyCall } from '../rpc';

// API interface types - required for type-safe RPC calls
export type { API } from '../api';
export type { AppAPI } from '../api/appApi';

// Session authentication - required for API calls
export * as SessionAuthSign from './SessionAuthSign';

// Error handling types - required for API error handling
export type { MsgErrorOpValues } from '../util/error';

// Prisma types - needed by some frontend components for database models
export type { Prisma } from '@prisma/client';

// ZenStack model metadata - needed for database operations
export type { ModelMeta } from '@zenstackhq/runtime';

// NOTE: Backend service classes are NOT exported to frontend:
// - PrismaService, AuthContext, AIProxyService
// - AppConfigService, AIConfigContext
// These are backend-only implementations