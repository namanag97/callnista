// lambda-transcribe/index.js
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import https from 'https';
import { Writable } from 'stream';

const region = process.env.AWS_REGION || 'ap-south-1';
const s3Client = new S3Client({ region });
const ddbClient = new DynamoDBClient({ region });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const secretsClient = new SecretsManagerClient({ region });

const tableName = process.env.DYNAMODB_TABLE;
const elevenLabsSecretArn = process.env.ELEVENLABS_SECRET_ARN;

let elevenLabsApiKey = null; // Cache the key

// --- Helper to get stream data into a buffer ---
async function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

// --- Helper to get secret ---
async function getElevenLabsKey() {
    if (elevenLabsApiKey) {
        return elevenLabsApiKey;
    }
    if (!elevenLabsSecretArn) {
         throw new Error("ELEVENLABS_SECRET_ARN environment variable not set.");
    }
    try {
        console.log("Fetching ElevenLabs API key from Secrets Manager...");
        const command = new GetSecretValueCommand({ SecretId: elevenLabsSecretArn });
        const data = await secretsClient.send(command);
        if (data.SecretString) {
            // Assuming the secret stores the key directly as a string
            // If it's JSON, parse it: const secret = JSON.parse(data.SecretString); elevenLabsApiKey = secret.apiKey;
            elevenLabsApiKey = data.SecretString;
            console.log("Successfully fetched and cached ElevenLabs API key.");
            return elevenLabsApiKey;
        } else {
             // Handle binary secret if needed
             throw new Error("SecretString not found for ElevenLabs API key.");
        }
    } catch (error) {
        console.error("Error fetching secret from Secrets Manager:", error);
        throw error; // Re-throw to indicate failure
    }
}

// --- Status constants ---
const STATUS = {
    READING: "reading",
    ALREADY_TRANSCRIBED: "already_transcribed",
    PREPARING: "preparing_to_send",
    TRANSCRIBING: "transcribing",
    RETRYING: "retrying",
    TRANSCRIBED: "transcribed"
};

// --- Helper to update DynamoDB ---
async function updateDynamoDB(callId, status, transcriptionResult = null, errorMessage = null) {
    const timestamp = new Date().toISOString();
    let updateExpression = "SET #status_attr = :status_val, #ts_attr = :ts_val";
    const expressionAttributeNames = {
        '#status_attr': 'status',
        '#ts_attr': 'last_updated_timestamp'
    };
    const expressionAttributeValues = {
        ':status_val': status,
        ':ts_val': timestamp
    };

    if (transcriptionResult !== null) {
        updateExpression += ", #tr_attr = :tr_val";
        expressionAttributeNames['#tr_attr'] = 'transcription_result';
        // Store entire JSON response
        expressionAttributeValues[':tr_val'] = transcriptionResult;
    }

    if (errorMessage !== null) {
        updateExpression += ", #err_attr = :err_val";
        expressionAttributeNames['#err_attr'] = 'error_message';
        expressionAttributeValues[':err_val'] = errorMessage;
    } else {
        // Ensure error message is removed on non-error updates
        updateExpression += " REMOVE #err_attr";
        expressionAttributeNames['#err_attr'] = 'error_message';
    }

    const params = {
        TableName: tableName,
        Key: { call_id: callId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "NONE",
    };

    try {
        console.log(`Updating DynamoDB for ${callId} to status ${status}`);
        await ddbDocClient.send(new UpdateCommand(params));
        console.log(`Successfully updated DynamoDB for ${callId}`);
    } catch (error) {
        console.error(`Error updating DynamoDB for ${callId}:`, error);
        throw new Error(`DynamoDB update failed: ${error.message}`); // Throw to signal failure
    }
}

// --- Function to call ElevenLabs API ---
async function callElevenLabs(audioBuffer, apiKey) {
    // .aac files are supported by ElevenLabs API directly, no conversion needed
    console.log(`Proceeding with audio transcription. Audio buffer size: ${audioBuffer.length} bytes`);
    
    // --- Make API Call ---
    const options = {
        method: 'POST',
        hostname: 'api.elevenlabs.io',
        path: '/v1/speech-to-text',
        headers: {
            'Accept': 'application/json',
            'xi-api-key': apiKey,
            'Content-Type': 'audio/aac',  // .aac content type
            'Content-Length': Buffer.byteLength(audioBuffer),
        },
        timeout: 180000, // 3 minutes timeout
    };

    // Add query parameters for diarization and other features
    options.path += '?model_id=scribe_v1&language_code=hin&tag_audio_events=true&diarize=true';

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            console.log(`ElevenLabs API Status Code: ${res.statusCode}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log("ElevenLabs API call successful.");
                    try {
                         // Validate that response is JSON
                         const jsonResponse = JSON.parse(responseBody);
                         console.log("Response validated as JSON");
                         resolve(responseBody);  // Return full JSON string for storage
                    } catch (parseError) {
                        console.error("ElevenLabs response was not valid JSON:", parseError);
                        reject(new Error(`ElevenLabs returned invalid JSON: ${parseError.message}`));
                    }
                } else {
                    console.error(`ElevenLabs API Error: Status ${res.statusCode}, Body: ${responseBody}`);
                    reject(new Error(`ElevenLabs API failed with status ${res.statusCode}: ${responseBody}`));
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Problem with ElevenLabs request: ${e.message}`);
            reject(new Error(`ElevenLabs request failed: ${e.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            console.error('ElevenLabs request timed out');
            reject(new Error('ElevenLabs request timed out'));
        });

        // Write audio data to request body
        req.write(audioBuffer);
        req.end();
        console.log("Sending request to ElevenLabs...");
    });
}


export const handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    // Input validation (expecting from Step Functions)
    const { call_id, s3_bucket_name, s3_object_key } = event;
    if (!call_id || !s3_bucket_name || !s3_object_key) {
        console.error("Missing required input fields: call_id, s3_bucket_name, s3_object_key");
        // Cannot update status without call_id, throw error for Step Functions
        throw new Error("Missing required input fields");
    }

    try {
        // 1. Update status to READING - Starting to read from S3
        await updateDynamoDB(call_id, STATUS.READING);

        // 2. Get API Key (ensure it's fetched before S3 download for efficiency)
        const apiKey = await getElevenLabsKey();

        // 3. Fetch audio from S3
        console.log(`Fetching audio from s3://${s3_bucket_name}/${s3_object_key}`);
        const getObjectCommand = new GetObjectCommand({
            Bucket: s3_bucket_name,
            Key: s3_object_key,
        });
        const s3Response = await s3Client.send(getObjectCommand);
        const audioBuffer = await streamToBuffer(s3Response.Body);
        console.log(`Successfully fetched ${audioBuffer.length} bytes from S3.`);

        // 4. Update status to PREPARING - Audio fetched, preparing to send to ElevenLabs
        await updateDynamoDB(call_id, STATUS.PREPARING);

        // 5. Call ElevenLabs API for transcription
        try {
            // Update status to TRANSCRIBING before making the API call
            await updateDynamoDB(call_id, STATUS.TRANSCRIBING);
            
            const transcriptionResultJson = await callElevenLabs(audioBuffer, apiKey);
            console.log("Transcription successful.");

            // 6. Update status to TRANSCRIBED and store result
            await updateDynamoDB(call_id, STATUS.TRANSCRIBED, transcriptionResultJson);
            
        } catch (apiError) {
            // If API call fails, set status to RETRYING and attempt again
            console.warn(`API call failed, retrying: ${apiError.message}`);
            await updateDynamoDB(call_id, STATUS.RETRYING, null, apiError.message);
            
            // Second attempt
            try {
                const transcriptionResultJson = await callElevenLabs(audioBuffer, apiKey);
                console.log("Transcription successful on second attempt.");
                await updateDynamoDB(call_id, STATUS.TRANSCRIBED, transcriptionResultJson);
            } catch (retryError) {
                // If retry also fails, throw the error to be caught by outer catch block
                throw retryError;
            }
        }

        // Return necessary data for the next step
        return {
            status: "Success",
            call_id: call_id
        };

    } catch (error) {
        console.error(`Transcription failed for call_id ${call_id}:`, error);
        // On complete failure, we keep the last status (should be RETRYING if API failed twice)
        try {
            await updateDynamoDB(call_id, STATUS.RETRYING, null, error.message || "Unknown transcription error");
        } catch (dbError) {
            console.error(`Failed to update DynamoDB status after primary error for ${call_id}:`, dbError);
            // The original error is more important to propagate
        }
        // Re-throw the original error so Step Functions catches the failure
        throw error;
    }
};