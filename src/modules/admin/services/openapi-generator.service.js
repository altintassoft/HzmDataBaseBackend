/**
 * OpenAPI Generator Service
 * 
 * Purpose: Auto-generate Swagger/OpenAPI 3.0 documentation from api_resources metadata
 * Week: 4 (Scale + Documentation)
 * 
 * Features:
 * - Reads api_resources and api_resource_fields from database
 * - Generates OpenAPI 3.0 specification
 * - Auto-updates when resources change
 * - Supports JSON and YAML output
 */

const { pool } = require('../../../core/config/database');
const logger = require('../../../core/logger');

class OpenAPIGeneratorService {
  /**
   * Generate OpenAPI 3.0 specification from database metadata
   * @returns {Object} OpenAPI 3.0 spec
   */
  async generateSpec() {
    try {
      // Fetch enabled resources
      const resources = await this._fetchResources();
      
      // Build OpenAPI spec
      const spec = {
        openapi: '3.0.3',
        info: {
          title: 'HZM Database API',
          version: '1.0.0',
          description: 'Auto-generated API documentation from metadata',
          contact: {
            name: 'HZM Soft',
            email: 'ozgurhzm@hzmsoft.com',
            url: 'https://hzmdatabase.netlify.app'
          }
        },
        servers: [
          {
            url: 'https://hzmdatabasebackend-production.up.railway.app/api/v1',
            description: 'Production server'
          },
          {
            url: 'http://localhost:3000/api/v1',
            description: 'Development server'
          }
        ],
        security: [
          {
            ApiKeyAuth: [],
            ApiPasswordAuth: [],
            EmailAuth: []
          }
        ],
        paths: {},
        components: {
          securitySchemes: {
            ApiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key',
              description: 'API Key (from users table)'
            },
            ApiPasswordAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Password',
              description: 'API Password (from users table)'
            },
            EmailAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-Email',
              description: 'User email'
            }
          },
          schemas: {}
        }
      };

      // Generate paths and schemas for each resource
      for (const resource of resources) {
        const paths = this._generateResourcePaths(resource);
        const schema = this._generateResourceSchema(resource);
        
        Object.assign(spec.paths, paths);
        spec.components.schemas[this._capitalize(resource.resource)] = schema;
      }

      return spec;
    } catch (error) {
      logger.error('OpenAPI spec generation failed:', error);
      throw error;
    }
  }

  /**
   * Fetch enabled resources from database
   * @private
   */
  async _fetchResources() {
    const query = `
      SELECT 
        r.resource,
        r.schema_name,
        r.table_name,
        r.description,
        r.is_readonly,
        r.auth_profile,
        r.require_hmac,
        r.rate_limit_profile,
        json_agg(
          json_build_object(
            'column_name', f.column_name,
            'readable', f.readable,
            'writable', f.writable,
            'required', f.required,
            'data_type', f.data_type,
            'description', f.description
          ) ORDER BY 
            CASE 
              WHEN f.column_name = 'id' THEN 1
              WHEN f.column_name LIKE '%_id' THEN 2
              WHEN f.column_name LIKE '%_at' THEN 99
              ELSE 50
            END,
            f.column_name
        ) as fields
      FROM api_resources r
      LEFT JOIN api_resource_fields f ON f.resource = r.resource
      WHERE r.is_enabled = true
      GROUP BY r.resource, r.schema_name, r.table_name, r.description, r.is_readonly, r.auth_profile, r.require_hmac, r.rate_limit_profile
      ORDER BY r.resource;
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Generate OpenAPI paths for a resource
   * @private
   */
  _generateResourcePaths(resource) {
    const resourceName = resource.resource;
    const ResourceName = this._capitalize(resourceName);
    const paths = {};

    // GET /data/{resource} - List
    paths[`/data/${resourceName}`] = {
      get: {
        tags: [ResourceName],
        summary: `List ${resourceName}`,
        description: resource.description || `Retrieve a list of ${resourceName}`,
        'x-auth-profile': resource.auth_profile || 'EITHER',
        'x-require-hmac': resource.require_hmac || false,
        'x-rate-limit-profile': resource.rate_limit_profile || 'standard',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
            description: 'Page number'
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
            description: 'Items per page'
          },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string' },
            description: 'Sort field (prefix with - for DESC)'
          },
          {
            name: 'select',
            in: 'query',
            schema: { type: 'string' },
            description: 'Comma-separated list of fields to return'
          }
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: `#/components/schemas/${ResourceName}` }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          403: { description: 'Resource disabled or permission denied' },
          404: { description: 'Resource not found' }
        }
      }
    };

    // POST /data/{resource} - Create
    if (!resource.is_readonly) {
      paths[`/data/${resourceName}`].post = {
        tags: [ResourceName],
        summary: `Create ${resourceName}`,
        description: `Create a new ${resourceName} record`,
        'x-auth-profile': resource.auth_profile || 'EITHER',
        'x-require-hmac': resource.require_hmac || false,
        'x-rate-limit-profile': resource.rate_limit_profile || 'standard',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${ResourceName}Input` }
            }
          }
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: `#/components/schemas/${ResourceName}` }
                  }
                }
              }
            }
          },
          400: { description: 'Validation error' },
          403: { description: 'Resource disabled or permission denied' }
        }
      };
    }

    // GET /data/{resource}/{id} - Get by ID
    paths[`/data/${resourceName}/{id}`] = {
      get: {
        tags: [ResourceName],
        summary: `Get ${resourceName} by ID`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: `${ResourceName} ID`
          }
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: `#/components/schemas/${ResourceName}` }
                  }
                }
              }
            }
          },
          404: { description: 'Not found' }
        }
      }
    };

    // PUT /data/{resource}/{id} - Update
    if (!resource.is_readonly) {
      paths[`/data/${resourceName}/{id}`].put = {
        tags: [ResourceName],
        summary: `Update ${resourceName}`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${ResourceName}Input` }
            }
          }
        },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: `#/components/schemas/${ResourceName}` }
                  }
                }
              }
            }
          },
          404: { description: 'Not found' }
        }
      };

      // DELETE /data/{resource}/{id} - Delete
      paths[`/data/${resourceName}/{id}`].delete = {
        tags: [ResourceName],
        summary: `Delete ${resourceName}`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          200: {
            description: 'Deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          404: { description: 'Not found' }
        }
      };
    }

    // GET /data/{resource}/count - Count
    paths[`/data/${resourceName}/count`] = {
      get: {
        tags: [ResourceName],
        summary: `Count ${resourceName}`,
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    };

    return paths;
  }

  /**
   * Generate OpenAPI schema for a resource
   * @private
   */
  _generateResourceSchema(resource) {
    const fields = resource.fields || [];
    const properties = {};
    const required = [];
    const inputProperties = {};
    const inputRequired = [];

    for (const field of fields) {
      if (field.column_name) {
        const propertyDef = {
          type: this._mapDataType(field.data_type),
          description: field.description || field.column_name
        };

        // Add to main schema (readable fields)
        if (field.readable) {
          properties[field.column_name] = propertyDef;
        }

        // Add to input schema (writable fields)
        if (field.writable) {
          inputProperties[field.column_name] = propertyDef;
          if (field.required) {
            inputRequired.push(field.column_name);
          }
        }

        // Mark as required in main schema
        if (field.required) {
          required.push(field.column_name);
        }
      }
    }

    // Main schema (for responses)
    const mainSchema = {
      type: 'object',
      properties,
      ...(required.length > 0 && { required })
    };

    // Input schema (for requests)
    const inputSchema = {
      type: 'object',
      properties: inputProperties,
      ...(inputRequired.length > 0 && { required: inputRequired })
    };

    // Register input schema
    const ResourceName = this._capitalize(resource.resource);
    if (!resource.is_readonly) {
      // Store input schema separately (will be added to components.schemas)
      this._inputSchemas = this._inputSchemas || {};
      this._inputSchemas[`${ResourceName}Input`] = inputSchema;
    }

    return mainSchema;
  }

  /**
   * Map PostgreSQL data types to OpenAPI types
   * @private
   */
  _mapDataType(pgType) {
    if (!pgType) return 'string';
    
    const typeMap = {
      'integer': 'integer',
      'bigint': 'integer',
      'smallint': 'integer',
      'serial': 'integer',
      'bigserial': 'integer',
      'numeric': 'number',
      'decimal': 'number',
      'real': 'number',
      'double precision': 'number',
      'boolean': 'boolean',
      'bool': 'boolean',
      'json': 'object',
      'jsonb': 'object',
      'array': 'array',
      'timestamp': 'string',
      'timestamptz': 'string',
      'date': 'string',
      'time': 'string',
      'uuid': 'string'
    };

    return typeMap[pgType.toLowerCase()] || 'string';
  }

  /**
   * Capitalize first letter
   * @private
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Generate spec with input schemas included
   * @returns {Object} Complete OpenAPI spec
   */
  async generateCompleteSpec() {
    const spec = await this.generateSpec();
    
    // Add input schemas
    if (this._inputSchemas) {
      Object.assign(spec.components.schemas, this._inputSchemas);
    }
    
    return spec;
  }
}

module.exports = new OpenAPIGeneratorService();

