// lambda-update-status/index.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const region = process.env.AWS_REGION || 'ap-south-1';
const tableName = process.env.DYNAMODB_TABLE;
const alarmTopicArn = process.env.ALARM_TOPIC_ARN;

const ddbClient = new DynamoDBClient({ region });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const cloudwatchClient = new CloudWatchClient({ region });
const snsClient = new SNSClient({ region });

/**
 * Updates the status of a call in DynamoDB and emits metrics if an error occurred
 */
export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  
  // Extract parameters from the Step Functions task input
  const { call_id, status, error, transcription_id, analysis_id } = event;
  
  if (!call_id || !status) {
    throw new Error('Missing required parameters: call_id and/or status');
  }
  
  try {
    // Update the DynamoDB record with the new status
    await updateCallStatus(call_id, status, error, transcription_id, analysis_id);
    
    // If there's an error, emit a metric
    if (error) {
      await emitErrorMetric(status, error);
      
      // Send notification for critical errors if SNS topic ARN is provided
      if (alarmTopicArn && (status === 'TranscriptionFailed' || status === 'AnalysisFailed')) {
        await sendErrorNotification(call_id, status, error);
      }
    }
    
    return {
      call_id,
      status,
      updated_at: new Date().toISOString()
    };
  } catch (updateError) {
    console.error('Error updating call status:', updateError);
    throw updateError;
  }
};

/**
 * Updates the call status and optional fields in DynamoDB
 */
async function updateCallStatus(callId, status, error, transcriptionId, analysisId) {
  const timestamp = new Date().toISOString();
  
  // Build update expression and attribute values
  let updateExpression = 'SET #status = :status, last_updated_timestamp = :timestamp';
  const expressionAttributeNames = {
    '#status': 'status'
  };
  const expressionAttributeValues = {
    ':status': status,
    ':timestamp': timestamp
  };
  
  // Add error information if present
  if (error) {
    updateExpression += ', error_message = :error';
    expressionAttributeValues[':error'] = {
      message: error.Cause || error.message || JSON.stringify(error),
      timestamp,
      type: error.Error || 'UnknownError'
    };
  }
  
  // Add transcription_id if present
  if (transcriptionId) {
    updateExpression += ', transcription_id = :transcriptionId';
    expressionAttributeValues[':transcriptionId'] = transcriptionId;
  }
  
  // Add analysis_id if present
  if (analysisId) {
    updateExpression += ', analysis_id = :analysisId';
    expressionAttributeValues[':analysisId'] = analysisId;
  }
  
  const params = {
    TableName: tableName,
    Key: { call_id: callId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  };
  
  try {
    await ddbDocClient.send(new UpdateCommand(params));
    console.log(`Updated status for call_id ${callId} to ${status}`);
  } catch (error) {
    console.error(`Error updating status for call_id ${callId}:`, error);
    throw error;
  }
}

/**
 * Emits CloudWatch metrics for error tracking
 */
async function emitErrorMetric(status, error) {
  try {
    // Emit CloudWatch metric for error tracking
    const params = {
      MetricData: [
        {
          MetricName: 'ProcessingErrors',
          Dimensions: [
            {
              Name: 'ErrorStatus',
              Value: status
            },
            {
              Name: 'ErrorType',
              Value: error.Error || 'UnknownError'
            }
          ],
          Unit: 'Count',
          Value: 1
        }
      ],
      Namespace: 'CallInsight/ErrorMetrics'
    };
    
    await cloudwatchClient.send(new PutMetricDataCommand(params));
    console.log('Emitted error metric to CloudWatch');
  } catch (metricError) {
    // Don't fail the function if metrics emission fails
    console.error('Error emitting CloudWatch metric:', metricError);
  }
}

/**
 * Sends an error notification to SNS
 */
async function sendErrorNotification(callId, status, error) {
  try {
    await snsClient.send(new PublishCommand({
      TopicArn: alarmTopicArn,
      Subject: `CallInsight Processing Error: ${status}`,
      Message: `Error processing call ${callId}: ${JSON.stringify(error)}`
    }));
    console.log('Sent error notification to SNS topic');
  } catch (snsError) {
    console.error('Error sending SNS notification:', snsError);
  }
}