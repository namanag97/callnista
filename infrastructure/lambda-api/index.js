// lambda-api/index.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from 'uuid';

// ------------- Configuration & Setup -------------
const region = process.env.AWS_REGION || 'ap-south-1';
const tableName = process.env.DYNAMODB_TABLE;
const recordingsBucket = process.env.RECORDINGS_BUCKET;

// Initialize clients
const ddbClient = new DynamoDBClient({ region });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({ region });

// ------------- Response Helper -------------
const createResponse = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
    ...headers,
  },
  body: JSON.stringify(body),
});

// ------------- Error Handlers -------------
const handleServiceError = (error, operation, resourceId = null) => {
  const resourceInfo = resourceId ? ` for ${resourceId}` : '';
  console.error(`Error during ${operation}${resourceInfo}:`, error);
  
  // Custom error handling based on error type
  if (error.name === 'ConditionalCheckFailedException') {
    return createResponse(409, { 
      error: `Conflict during ${operation}`,
      message: resourceId ? `Resource ${resourceId} already exists or is in an invalid state` : 'Resource conflict'
    });
  }
  
  return createResponse(500, { 
    error: `Failed to ${operation}`,
    message: error.message
  });
};

const validateRequiredParams = (params, requiredFields) => {
  const missingFields = requiredFields.filter(field => !params[field]);
  if (missingFields.length > 0) {
    return { 
      valid: false, 
      response: createResponse(400, { 
        error: 'Missing required parameters', 
        missingFields 
      })
    };
  }
  return { valid: true };
};

// ------------- DynamoDB Operations -------------
// Removed createCallRecord function as it's now handled directly in handleCreateCall
// to support the expanded schema that matches the orchestrator requirements

const getCallRecord = async (callId) => {
  const params = {
    TableName: tableName,
    Key: { call_id: callId },
  };

  const { Item } = await ddbDocClient.send(new GetCommand(params));
  return Item;
};

const updateCallStatus = async (callId, status, additionalUpdates = {}) => {
  const timestamp = new Date().toISOString();
  
  // Build the UpdateExpression and ExpressionAttributeValues dynamically
  let updateExpression = "SET #status = :status, #lastUpdated = :lastUpdated";
  const expressionAttributeNames = {
    "#status": "status",
    "#lastUpdated": "last_updated_timestamp"
  };
  
  const expressionAttributeValues = {
    ":status": status,
    ":lastUpdated": timestamp
  };
  
  // Add any additional updates
  Object.entries(additionalUpdates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:value${index}`;
    
    updateExpression += `, ${attrName} = ${attrValue}`;
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = value;
  });
  
  const params = {
    TableName: tableName,
    Key: { call_id: callId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ConditionExpression: "attribute_exists(call_id)",
    ReturnValues: "ALL_NEW"
  };
  
  const { Attributes } = await ddbDocClient.send(new UpdateCommand(params));
  return Attributes;
};

// ------------- S3 Operations -------------
const generateUploadUrl = async (bucket, objectKey, contentType, expiresIn = 900) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};

// ------------- API Handlers -------------
async function handleCreateCall(event) {
  console.log("Handling POST /calls");
  
  try {
    // Parse the request body if provided
    const requestBody = event.body ? JSON.parse(event.body) : {};
    
    // Generate a unique call ID
    const callId = uuidv4();
    
    // Get timestamp for consistency
    const timestamp = new Date().toISOString();
    
    // Create the call record in DynamoDB with expanded schema to match orchestrator
    const params = {
      TableName: tableName,
      Item: {
        call_id: callId,
        status: requestBody.initialStatus || "PendingUpload",
        upload_timestamp: timestamp,
        last_updated_timestamp: timestamp,
        // Additional fields to align with orchestrator schema
        transcription_result: null,
        analysis_result: null,
        error_message: null,
        metadata: requestBody.metadata || {}
      },
      ConditionExpression: "attribute_not_exists(call_id)"
    };

    await ddbDocClient.send(new PutCommand(params));
    console.log(`Created call record ${callId} with expanded schema`);
    
    return createResponse(201, { 
      call_id: callId, 
      message: "Call record created successfully. Use the upload URL endpoint to upload audio." 
    });
  } catch (error) {
    return handleServiceError(error, 'create call record');
  }
}

async function handleGetCall(event) {
  const callId = event.pathParameters?.callId;
  console.log(`Handling GET /calls/${callId}`);
  
  // Validate request
  const validation = validateRequiredParams({ callId }, ['callId']);
  if (!validation.valid) return validation.response;
  
  try {
    const callRecord = await getCallRecord(callId);
    
    if (!callRecord) {
      return createResponse(404, { error: "Call not found", message: `No call record found with ID ${callId}` });
    }
    
    return createResponse(200, callRecord);
  } catch (error) {
    return handleServiceError(error, 'retrieve call', callId);
  }
}

async function handleListCalls(event) {
  console.log("Handling GET /calls");
  
  const queryParams = event.queryStringParameters || {};
  const limit = parseInt(queryParams.limit) || 50;
  const nextToken = queryParams.nextToken 
    ? JSON.parse(Buffer.from(queryParams.nextToken, 'base64').toString())
    : undefined;
  
  try {
    const params = {
      TableName: tableName,
      Limit: limit,
      ...(nextToken && { ExclusiveStartKey: nextToken }),
    };
    
    // Add status filter if provided
    if (queryParams.status) {
      params.FilterExpression = "#status = :status";
      params.ExpressionAttributeNames = { "#status": "status" };
      params.ExpressionAttributeValues = { ":status": queryParams.status };
    }
    
    const { Items, LastEvaluatedKey } = await ddbDocClient.send(new ScanCommand(params));
    
    return createResponse(200, {
      items: Items || [],
      nextToken: LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64') 
        : null,
      count: Items?.length || 0,
      limit
    });
  } catch (error) {
    return handleServiceError(error, 'list calls');
  }
}

async function handleGetUploadUrl(event) {
  const callId = event.pathParameters?.callId;
  const fileName = event.queryStringParameters?.fileName;
  const contentType = event.queryStringParameters?.contentType || 'application/octet-stream';
  
  console.log(`Handling GET /calls/${callId}/upload-url for fileName: ${fileName}`);
  
  // Validate request parameters
  const validation = validateRequiredParams(
    { callId, fileName, recordingsBucket }, 
    ['callId', 'fileName', 'recordingsBucket']
  );
  if (!validation.valid) return validation.response;
  
  // Validate call exists
  try {
    const callRecord = await getCallRecord(callId);
    if (!callRecord) {
      return createResponse(404, { 
        error: "Call not found",
        message: `No call record found with ID ${callId}` 
      });
    }
    
    // Create a structured and predictable object key - match the key pattern expected by orchestrator
    const objectKey = `uploads/${callId}/${fileName}`;
    
    try {
      // Generate the presigned URL
      const signedUrl = await generateUploadUrl(
        recordingsBucket,
        objectKey,
        contentType
      );
      
      // Update the call record with the S3 key and status
      // Also add s3_bucket to match orchestrator's expected schema
      await updateCallStatus(callId, "Uploading", {
        s3_bucket: recordingsBucket,
        s3_object_key: objectKey,
        file_content_type: contentType,
        file_name: fileName,
        // Store metadata that will help the orchestrator identify this call
        metadata: {
          source: "api_upload",
          api_upload_timestamp: new Date().toISOString(),
          content_type: contentType
        }
      });
      
      return createResponse(200, { 
        uploadUrl: signedUrl, 
        objectKey, 
        expiresIn: "15 minutes"
      });
    } catch (error) {
      return handleServiceError(error, 'generate upload URL', callId);
    }
  } catch (error) {
    return handleServiceError(error, 'verify call record', callId);
  }
}

// ------------- Main Router -------------
export const handler = async (event) => {
  console.log("API Event Received:", JSON.stringify(event, null, 2));
  
  // Validate environment configuration
  if (!tableName) {
    console.error("DYNAMODB_TABLE environment variable not set");
    return createResponse(500, { error: "Server misconfiguration", message: "Database configuration missing" });
  }

  const method = event.httpMethod;
  const resource = event.resource;

  try {
    // Route the request to the appropriate handler
    if (resource === "/calls" && method === "POST") {
      return await handleCreateCall(event);
    } else if (resource === "/calls/{callId}" && method === "GET") {
      return await handleGetCall(event);
    } else if (resource === "/calls" && method === "GET") {
      return await handleListCalls(event);
    } else if (resource === "/calls/{callId}/upload-url" && method === "GET") {
      return await handleGetUploadUrl(event);
    } else if (method === "OPTIONS") {
      return createResponse(200, {});
    } else {
      return createResponse(404, { 
        error: "Not Found", 
        message: `The requested resource does not exist: ${method} ${event.path}` 
      });
    }
  } catch (error) {
    console.error("Unhandled error in API handler:", error);
    return createResponse(500, { 
      error: "Internal Server Error", 
      message: "An unexpected error occurred while processing your request"
    });
  }
};