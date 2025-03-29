// lambda-orchestrator/index.js
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';

/**
 * Extracts additional parameters from various possible sources in the message
 * @param {Object} sqsRecord - The original SQS record
 * @param {Object} s3Event - The parsed S3 event
 * @returns {Object} - Additional parameters to be stored
 */
function extractAdditionalParams(sqsRecord, s3Event) {
  const additionalParams = {};
  
  try {
    // Source 1: Check for custom metadata in S3 object
    if (s3Event?.Records?.[0]?.s3?.object?.userMetadata) {
      Object.assign(additionalParams, s3Event.Records[0].s3.object.userMetadata);
    }
    
    // Source 2: Check for a specific header in S3 object that contains JSON
    const customHeader = s3Event?.Records?.[0]?.s3?.object?.headers?.[CUSTOM_PARAMS_HEADER];
    if (customHeader) {
      try {
        const parsedHeader = JSON.parse(customHeader);
        Object.assign(additionalParams, parsedHeader);
      } catch (e) {
        console.warn("Failed to parse custom header as JSON", { header: CUSTOM_PARAMS_HEADER });
      }
    }
    
    // Source 3: Check for message attributes in the SQS message
    if (sqsRecord.messageAttributes) {
      for (const [key, value] of Object.entries(sqsRecord.messageAttributes)) {
        if (key.startsWith('custom_') && value.dataType === 'String') {
          // Try to parse as JSON first
          try {
            additionalParams[key.substring(7)] = JSON.parse(value.stringValue);
          } catch (e) {
            // If not valid JSON, use the string value directly
            additionalParams[key.substring(7)] = value.stringValue;
          }
        }
      }
    }
    
    // Source 4: Check for a designated JSON field in the message body
    try {
      const messageBody = JSON.parse(sqsRecord.body);
      if (messageBody.additionalParams && typeof messageBody.additionalParams === 'object') {
        Object.assign(additionalParams, messageBody.additionalParams);
      }
    } catch (e) {
      // Ignore parsing errors, already handled in extractS3EventFromSQS
    }
    
    // Log found parameters for debugging
    if (Object.keys(additionalParams).length > 0) {
      console.info("Found additional parameters", { 
        messageId: sqsRecord.messageId,
        params: Object.keys(additionalParams)
      });
    }
  } catch (error) {
    console.warn("Error extracting additional parameters", { 
      error: error.message,
      messageId: sqsRecord.messageId
    });
  }
  
  return additionalParams;
}

// Configuration constants
const REGION = process.env.AWS_REGION || 'ap-south-1';
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;
const TABLE_NAME = process.env.DYNAMODB_TABLE;
const CUSTOM_PARAMS_HEADER = process.env.CUSTOM_PARAMS_HEADER || 'x-amz-meta-additional-params';

// Initialize AWS clients
const sfnClient = new SFNClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION })
);

/**
 * Extracts S3 event from an SQS message, handling various message formats
 * @param {Object} record - SQS message record
 * @returns {Object|null} - Parsed S3 event or null if not found
 */
function extractS3EventFromSQS(record) {
  try {
    const messageBody = JSON.parse(record.body);
    
    // Case 1: S3 event wrapped in SNS notification within SQS
    if (messageBody.Message) {
      try {
        const snsMessage = JSON.parse(messageBody.Message);
        if (snsMessage.Records?.[0]?.eventSource === 'aws:s3') {
          return snsMessage;
        }
      } catch (e) {
        console.warn("Failed to parse SNS message as JSON", { messageId: record.messageId, error: e.message });
      }
    }
    
    // Case 2: Direct S3 event in SQS
    if (messageBody.Records?.[0]?.eventSource === 'aws:s3') {
      return messageBody;
    }
    
    console.warn("No S3 event found in SQS message", { messageId: record.messageId });
    return null;
  } catch (error) {
    console.error("Error parsing SQS message body", { 
      messageId: record.messageId, 
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Creates an initial record in DynamoDB for the call
 * @param {string} callId - Unique ID for the call
 * @param {string} bucketName - S3 bucket name
 * @param {string} objectKey - S3 object key
 * @param {string} eventTime - Time of the S3 event
 * @param {Object} additionalParams - Additional parameters to store in metadata
 * @returns {Promise<boolean>} - Success indicator
 */
async function createInitialRecord(callId, bucketName, objectKey, eventTime, additionalParams = {}) {
  const timestamp = new Date().toISOString();
  
  const item = {
    call_id: callId,
    s3_bucket: bucketName,
    s3_object_key: objectKey,
    status: "Queued",
    upload_timestamp: eventTime || timestamp,
    last_updated_timestamp: timestamp,
    transcription_result: null,
    analysis_result: null,
    error_message: null,
    metadata: additionalParams // Flexible JSON field for future extensibility
  };
  
  try {
    await ddbDocClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(call_id)"
    }));
    
    console.info("DynamoDB record created", { callId, bucket: bucketName, key: objectKey });
    return true;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.warn("Record already exists", { callId });
      return false;
    }
    
    console.error("Failed to create DynamoDB record", { 
      callId, 
      error: error.message,
      stack: error.stack
    });
    throw error; // Rethrow for caller to handle
  }
}

/**
 * Starts a Step Functions execution for processing the call
 * @param {string} callId - Unique ID for the call
 * @param {string} bucketName - S3 bucket name
 * @param {string} objectKey - S3 object key
 * @param {Object} additionalParams - Additional parameters to include in the input
 * @returns {Promise<string>} - Execution ARN
 */
async function startStepFunctionExecution(callId, bucketName, objectKey, additionalParams = {}) {
  const input = {
    call_id: callId,
    s3_bucket_name: bucketName,
    s3_object_key: objectKey,
    metadata: additionalParams
  };
  
  const executionName = `call-${callId}-${Date.now()}`;
  
  try {
    const response = await sfnClient.send(new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      name: executionName,
      input: JSON.stringify(input)
    }));
    
    console.info("Step Functions execution started", { 
      callId, 
      executionArn: response.executionArn,
      executionName
    });
    
    return response.executionArn;
  } catch (error) {
    console.error("Failed to start Step Functions execution", { 
      callId, 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Process a single SQS record
 * @param {Object} record - SQS message record
 * @returns {Promise<void>}
 */
async function processSQSRecord(record) {
  console.info("Processing SQS record", { messageId: record.messageId });
  
  // Extract S3 event
  const s3Event = extractS3EventFromSQS(record);
  if (!s3Event?.Records?.length) {
    console.warn("Skipping record - no valid S3 event found", { messageId: record.messageId });
    return;
  }
  
  // Extract S3 object information
  const s3Record = s3Event.Records[0];
  const eventTime = s3Record.eventTime;
  const bucketName = s3Record.s3.bucket.name;
  const objectKey = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '));
  
  // Extract any additional parameters from the message body or custom attributes
  const additionalParams = extractAdditionalParams(record, s3Event);
  
  console.info("Extracted S3 information", { bucket: bucketName, key: objectKey, eventTime });
  
  // Generate unique ID for this call
  const callId = uuidv4();
  
  // Create initial database record
  const recordCreated = await createInitialRecord(callId, bucketName, objectKey, eventTime, additionalParams);
  if (!recordCreated) {
    console.warn("Skipping workflow execution - record creation failed", { callId });
    return;
  }
  
  // Start Step Functions workflow
  await startStepFunctionExecution(callId, bucketName, objectKey, additionalParams);
}

/**
 * Lambda handler function
 * @param {Object} event - SQS event containing records
 * @returns {Promise<void>}
 */
export const handler = async (event) => {
  console.info("Received SQS event", { recordCount: event.Records?.length });
  
  // Validate environment variables
  if (!STATE_MACHINE_ARN || !TABLE_NAME) {
    const error = new Error("Missing required environment variables: STATE_MACHINE_ARN or DYNAMODB_TABLE");
    console.error("Fatal configuration error", { error: error.message });
    throw error;
  }
  
  // Process all records
  const results = await Promise.allSettled(
    event.Records.map(record => processSQSRecord(record))
  );
  
  // Count and log results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.info("Completed processing batch", { 
    total: event.Records.length,
    successful,
    failed
  });
  
  // Report failures in detail
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error("Failed processing record", {
        index,
        messageId: event.Records[index]?.messageId,
        reason: result.reason?.message,
        stack: result.reason?.stack
      });
    }
  });
  
  // Throw error if any processing failed to trigger retry or DLQ as needed
  if (failed > 0) {
    throw new Error(`Failed to process ${failed} out of ${event.Records.length} messages`);
  }
};