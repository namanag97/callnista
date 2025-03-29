// lambda-analyze/index.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import https from 'https'; // Using built-in https for OpenAI API call

const region = process.env.AWS_REGION || 'ap-south-1';
const ddbClient = new DynamoDBClient({ region });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const secretsClient = new SecretsManagerClient({ region });

const tableName = process.env.DYNAMODB_TABLE;
const openAiSecretArn = process.env.OPENAI_SECRET_ARN;
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o"; // Use env var or default

let openAiApiKey = null; // Cache the key

// --- Helper to get secret ---
async function getOpenAiKey() {
    if (openAiApiKey) {
        return openAiApiKey;
    }
    if (!openAiSecretArn) {
         throw new Error("OPENAI_SECRET_ARN environment variable not set.");
    }
    try {
        console.log("Fetching OpenAI API key from Secrets Manager...");
        const command = new GetSecretValueCommand({ SecretId: openAiSecretArn });
        const data = await secretsClient.send(command);
        if (data.SecretString) {
            // Assuming the secret stores the key directly as a string
            openAiApiKey = data.SecretString;
            console.log("Successfully fetched and cached OpenAI API key.");
            return openAiApiKey;
        } else {
             throw new Error("SecretString not found for OpenAI API key.");
        }
    } catch (error) {
        console.error("Error fetching OpenAI secret:", error);
        throw error;
    }
}

// --- Helper to update DynamoDB ---
async function updateDynamoDB(callId, status, analysisResult = null, errorMessage = null) {
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

    if (analysisResult !== null) {
        updateExpression += ", #anal_attr = :anal_val";
        expressionAttributeNames['#anal_attr'] = 'analysis_result';
        // Store analysis result as a map (DynamoDB Document Client handles conversion)
        expressionAttributeValues[':anal_val'] = analysisResult;
    }

    if (errorMessage !== null) {
        updateExpression += ", #err_attr = :err_val";
        expressionAttributeNames['#err_attr'] = 'error_message';
        expressionAttributeValues[':err_val'] = errorMessage;
    } else {
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
        throw new Error(`DynamoDB update failed: ${error.message}`);
    }
}

// --- Helper to get transcript from DynamoDB ---
async function getTranscriptFromDb(callId) {
    console.log(`Fetching transcript from DynamoDB for ${callId}`);
    const params = {
        TableName: tableName,
        Key: { call_id: callId },
        ProjectionExpression: "transcription_result", // Only get the transcript field
    };
    try {
        const { Item } = await ddbDocClient.send(new GetCommand(params));
        if (Item && Item.transcription_result) {
            console.log("Transcript found in DynamoDB.");
            // transcription_result is likely stored as a JSON string from the previous step
            return Item.transcription_result;
        } else {
            console.error(`Transcription result not found in DynamoDB for call_id ${callId}`);
            throw new Error("Transcription not found in database");
        }
    } catch (error) {
        console.error(`Error fetching transcript from DynamoDB for ${callId}:`, error);
        throw error;
    }
}

// --- Function to call OpenAI API ---
async function callOpenAI(textToAnalyze, apiKey) {
    const analysisPrompts = {
        sentiment: `Analyze the sentiment of the following call transcript. Classify it as Positive, Negative, or Neutral. Transcript:\n\n${textToAnalyze}`,
        category: `Categorize the main topic of the following call transcript (e.g., Sales Inquiry, Support Request, Billing Issue, Other). Transcript:\n\n${textToAnalyze}`,
        summary: `Provide a concise one-sentence summary of the following call transcript:\n\n${textToAnalyze}`
    };

    const results = {};
    const requestBodyBase = {
        model: openAiModel,
        max_tokens: 100, // Adjust token limit per analysis type if needed
        temperature: 0.3, // Lower temperature for more deterministic classification/summary
    };

    const options = {
        method: 'POST',
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000, // 1 minute timeout
    };

    for (const [analysisType, prompt] of Object.entries(analysisPrompts)) {
        console.log(`Performing analysis: ${analysisType}...`);
        const requestBody = JSON.stringify({
            ...requestBodyBase,
            messages: [
                { "role": "system", "content": `You are an AI assistant performing call analysis. Respond concisely.` },
                { "role": "user", "content": prompt }
            ]
        });

        const responseContent = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseBody = '';
                console.log(`OpenAI API Status (${analysisType}): ${res.statusCode}`);
                res.setEncoding('utf8');
                res.on('data', (chunk) => { responseBody += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const parsedBody = JSON.parse(responseBody);
                            if (parsedBody.choices && parsedBody.choices[0] && parsedBody.choices[0].message) {
                                resolve(parsedBody.choices[0].message.content.trim());
                            } else {
                                reject(new Error(`Unexpected OpenAI response structure: ${responseBody}`));
                            }
                        } catch (e) {
                            reject(new Error(`Failed to parse OpenAI JSON response: ${e.message}`));
                        }
                    } else {
                        reject(new Error(`OpenAI API failed with status ${res.statusCode}: ${responseBody}`));
                    }
                });
            });

            req.on('error', (e) => reject(new Error(`OpenAI request failed: ${e.message}`)));
            req.on('timeout', () => { req.destroy(); reject(new Error('OpenAI request timed out')); });
            req.write(requestBody);
            req.end();
        });

        results[analysisType] = responseContent;
        console.log(`Result (${analysisType}): ${responseContent}`);
    } // end for loop

    return results;
}


export const handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    const call_id = event?.call_id; // Get call_id from input event
    // Transcript data might be passed directly from Transcribe step
    let transcriptJsonString = event?.transcript_data_string;

    if (!call_id) {
        console.error("Missing 'call_id' in input event.");
        throw new Error("Missing 'call_id'");
    }

    try {
        // 1. Get OpenAI API Key
        const apiKey = await getOpenAiKey();

        // 2. Get Transcript (from event or DB)
        if (!transcriptJsonString) {
            console.log("Transcript not in event payload, fetching from DB...");
            transcriptJsonString = await getTranscriptFromDb(call_id);
        } else {
             console.log("Using transcript passed directly in event payload.");
        }

        // 3. Extract text content (assuming transcriptJsonString is the JSON from ElevenLabs)
        let textContent = '';
        try {
            const transcriptData = JSON.parse(transcriptJsonString);
             // TODO: Adjust this key based on the ACTUAL structure of your ElevenLabs JSON response
            textContent = transcriptData.full_text || transcriptData.text || JSON.stringify(transcriptData); // Best guess
             if (!textContent || typeof textContent !== 'string' || textContent.trim().length === 0) {
                 throw new Error("Extracted text content is empty or invalid.");
             }
             console.log("Extracted text content for analysis.");
        } catch (parseError) {
             console.error(`Failed to parse or extract text from transcript JSON: ${parseError}`);
             throw new Error(`Invalid transcript format: ${parseError.message}`);
        }


        // 4. Call OpenAI for analysis
        const analysisResult = await callOpenAI(textContent, apiKey);
        console.log("Analysis successful:", JSON.stringify(analysisResult));

        // 5. Update status to Completed and store result
        await updateDynamoDB(call_id, "Completed", analysisResult);

        // Return success (Step Functions typically just needs the task to not fail)
        return {
            status: "Success",
            call_id: call_id
        };

    } catch (error) {
        console.error(`Analysis failed for call_id ${call_id}:`, error);
        try {
            // Attempt to update DB status to Failed
            await updateDynamoDB(call_id, "Failed", null, error.message || "Unknown analysis error");
        } catch (dbError) {
            console.error(`Failed to update DynamoDB to Failed status after primary error for ${call_id}:`, dbError);
        }
        throw error; // Re-throw original error for Step Functions
    }
};