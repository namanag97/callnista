# infrastructure

This project contains source code and supporting files for a serverless application that you can deploy with the SAM CLI. It includes the following files and folders.

- hello-world - Code for the application's Lambda function.
- events - Invocation events that you can use to invoke the function.
- hello-world/tests - Unit tests for the application code. 
- template.yaml - A template that defines the application's AWS resources.

The application uses several AWS resources, including Lambda functions and an API Gateway API. These resources are defined in the `template.yaml` file in this project. You can update the template to add AWS resources through the same deployment process that updates your application code.

If you prefer to use an integrated development environment (IDE) to build and test your application, you can use the AWS Toolkit.  
The AWS Toolkit is an open source plug-in for popular IDEs that uses the SAM CLI to build and deploy serverless applications on AWS. The AWS Toolkit also adds a simplified step-through debugging experience for Lambda function code. See the following links to get started.

* [CLion](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [GoLand](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [IntelliJ](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [WebStorm](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [Rider](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [PhpStorm](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [PyCharm](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [RubyMine](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [DataGrip](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [VS Code](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/welcome.html)
* [Visual Studio](https://docs.aws.amazon.com/toolkit-for-visual-studio/latest/user-guide/welcome.html)

## Deploy the sample application

The Serverless Application Model Command Line Interface (SAM CLI) is an extension of the AWS CLI that adds functionality for building and testing Lambda applications. It uses Docker to run your functions in an Amazon Linux environment that matches Lambda. It can also emulate your application's build environment and API.

To use the SAM CLI, you need the following tools.

* SAM CLI - [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
* Node.js - [Install Node.js 18](https://nodejs.org/en/), including the NPM package management tool.
* Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community)

To build and deploy your application for the first time, run the following in your shell:

```bash
sam build
sam deploy --guided
```

The first command will build the source of your application. The second command will package and deploy your application to AWS, with a series of prompts:

* **Stack Name**: The name of the stack to deploy to CloudFormation. This should be unique to your account and region, and a good starting point would be something matching your project name.
* **AWS Region**: The AWS region you want to deploy your app to.
* **Confirm changes before deploy**: If set to yes, any change sets will be shown to you before execution for manual review. If set to no, the AWS SAM CLI will automatically deploy application changes.
* **Allow SAM CLI IAM role creation**: Many AWS SAM templates, including this example, create AWS IAM roles required for the AWS Lambda function(s) included to access AWS services. By default, these are scoped down to minimum required permissions. To deploy an AWS CloudFormation stack which creates or modifies IAM roles, the `CAPABILITY_IAM` value for `capabilities` must be provided. If permission isn't provided through this prompt, to deploy this example you must explicitly pass `--capabilities CAPABILITY_IAM` to the `sam deploy` command.
* **Save arguments to samconfig.toml**: If set to yes, your choices will be saved to a configuration file inside the project, so that in the future you can just re-run `sam deploy` without parameters to deploy changes to your application.

You can find your API Gateway Endpoint URL in the output values displayed after deployment.

## Use the SAM CLI to build and test locally

Build your application with the `sam build` command.

```bash
infrastructure$ sam build
```

The SAM CLI installs dependencies defined in `hello-world/package.json`, creates a deployment package, and saves it in the `.aws-sam/build` folder.

Test a single function by invoking it directly with a test event. An event is a JSON document that represents the input that the function receives from the event source. Test events are included in the `events` folder in this project.

Run functions locally and invoke them with the `sam local invoke` command.

```bash
infrastructure$ sam local invoke HelloWorldFunction --event events/event.json
```

The SAM CLI can also emulate your application's API. Use the `sam local start-api` to run the API locally on port 3000.

```bash
infrastructure$ sam local start-api
infrastructure$ curl http://localhost:3000/
```

The SAM CLI reads the application template to determine the API's routes and the functions that they invoke. The `Events` property on each function's definition includes the route and method for each path.

```yaml
      Events:
        HelloWorld:
          Type: Api
          Properties:
            Path: /hello
            Method: get
```

## Add a resource to your application
The application template uses AWS Serverless Application Model (AWS SAM) to define application resources. AWS SAM is an extension of AWS CloudFormation with a simpler syntax for configuring common serverless application resources such as functions, triggers, and APIs. For resources not included in [the SAM specification](https://github.com/awslabs/serverless-application-model/blob/master/versions/2016-10-31.md), you can use standard [AWS CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-template-resource-type-ref.html) resource types.

## Fetch, tail, and filter Lambda function logs

To simplify troubleshooting, SAM CLI has a command called `sam logs`. `sam logs` lets you fetch logs generated by your deployed Lambda function from the command line. In addition to printing the logs on the terminal, this command has several nifty features to help you quickly find the bug.

`NOTE`: This command works for all AWS Lambda functions; not just the ones you deploy using SAM.

```bash
infrastructure$ sam logs -n HelloWorldFunction --stack-name infrastructure --tail
```

You can find more information and examples about filtering Lambda function logs in the [SAM CLI Documentation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-logging.html).

## Unit tests

Tests are defined in the `hello-world/tests` folder in this project. Use NPM to install the [Mocha test framework](https://mochajs.org/) and run unit tests.

```bash
infrastructure$ cd hello-world
hello-world$ npm install
hello-world$ npm run test
```

## Cleanup

To delete the sample application that you created, use the AWS CLI. Assuming you used your project name for the stack name, you can run the following:

```bash
sam delete --stack-name infrastructure
```

## Resources

See the [AWS SAM developer guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html) for an introduction to SAM specification, the SAM CLI, and serverless application concepts.

Next, you can use AWS Serverless Application Repository to deploy ready to use Apps that go beyond hello world samples and learn how authors developed their applications: [AWS Serverless Application Repository main page](https://aws.amazon.com/serverless/serverlessrepo/)


Tech doc
Okay, EM. Here is the consolidated and updated DOC Version 1.2, incorporating all the changes, clarifications, and status updates we've discussed.

DOC Version 1.2 - 2023-10-27

Subject: AWS service architecture for the CallInsight project.

Change Log (from Version 1.1):

API Implementation: Lambda_API details finalized (Node.js), including specific endpoints (create call, get status, list, get upload URL), expanded DynamoDB schema creation, structured S3 key generation, and metadata handling.

Analysis Profiles: Introduced dynamic Analysis Profile support.

Added ProfilesTable (DynamoDB) to store profile configurations.

Lambda_Analyze now fetches profiles from ProfilesTable and uses profile-specific settings (model, prompts, temp, comprehensive analysis flag) when calling OpenAI.

Added relevant environment variables (USE_PROFILES, DEFAULT_PROFILE_ID, PROFILES_TABLE) to Lambda_Analyze.

Clarified the need to determine and pass profile_id through the workflow.

Code Review Notes: Incorporated notes regarding S3 buffering (Lambda_Transcribe), inline retries (Lambda_Transcribe - recommend removal), and profile fetching/error handling (Lambda_Analyze).

Status Update: Lambda_API marked as implemented. ProfilesTable added as implemented infrastructure. Profile logic in Lambda_Analyze noted as implemented. Core orchestration (Step Functions), triggering (S3->SQS->Lambda), and monitoring infrastructure are deployed; focus shifted to testing and refinement.

Core Principles:

Serverless First: Use Lambda, API Gateway, S3, DynamoDB, Step Functions, SQS where possible to minimize operational overhead and scale automatically.

Event-Driven: Utilize S3 events and SQS queues to trigger processing steps, decoupling services.

Scalability & Durability: Leverage S3 for storage and managed services that scale automatically.

Security: Utilize IAM roles, Secrets Manager, and potentially Cognito for securing resources and access.

Orchestration: Use Step Functions to manage the multi-step transcription and analysis workflow robustly, including task retries.

AWS Architecture Diagram:

graph TD
    subgraph User Facing
        User[User Browser] --> CloudFront[CloudFront CDN]
        CloudFront --> S3_UI[S3 Bucket: UI Hosting]
        User --> API_GW[API Gateway: REST API]
    end

    subgraph API Backend
        API_GW --> Lambda_API[Lambda: API Handler (Node.js)]
        Lambda_API <--> DynamoDB[DynamoDB: Metadata, Transcripts, Analysis]
        Lambda_API --> SQS_Upload[SQS: Upload Queue]
        Lambda_API --> SecretsManager_API[Secrets Manager: API Keys]
    end

    subgraph Call Processing Workflow
        S3_Recordings[S3 Bucket: Call Recordings] -- S3 Event Notification --> SQS_Transcription[SQS: Transcription Queue]
        SQS_Transcription --> Lambda_Orchestrator[Lambda: Start Step Function (Node.js)]
        Lambda_Orchestrator --> StepFunctions[Step Functions: Processing Workflow]

        StepFunctions -- Task --> Lambda_Transcribe[Lambda: Transcription (Node.js)]
        Lambda_Transcribe --> ElevenLabs[ElevenLabs API]
        Lambda_Transcribe --> DynamoDB
        Lambda_Transcribe --> SecretsManager_Transcribe[Secrets Manager: ElevenLabs Key]

        StepFunctions -- Task --> Lambda_Analyze[Lambda: Analysis (Node.js)]
        Lambda_Analyze --> GPT4o[OpenAI GPT-4o API]
        Lambda_Analyze --> DynamoDB
        Lambda_Analyze --> SecretsManager_Analyze[Secrets Manager: OpenAI Key]
        Lambda_Analyze --> ProfilesTable[DynamoDB: Profiles Table] // Added Interaction

        StepFunctions -- Update Status / Retry --> DynamoDB // Added Retry emphasis implicitly
    end

    subgraph Monitoring & Security
        CloudWatch[CloudWatch: Logs, Metrics, Alarms]
        Cognito[(Cognito: User Auth - Optional)]
        IAM[IAM: Roles & Permissions]
        SecretsManager_API
        SecretsManager_Transcribe
        SecretsManager_Analyze

        Lambda_API --> CloudWatch
        Lambda_Transcribe --> CloudWatch
        Lambda_Analyze --> CloudWatch
        StepFunctions --> CloudWatch
        API_GW --> CloudWatch
        API_GW -- Authorizer --> Cognito
    end

    %% Style Adjustments for Clarity (Styles remain unchanged)
    style User fill:#cde4ff,stroke:#333,stroke-width:1px
    style S3_UI fill:#f9d7a4,stroke:#333,stroke-width:1px
    style S3_Recordings fill:#f9d7a4,stroke:#333,stroke-width:1px
    style Lambda_API fill:#ffaa66,stroke:#333,stroke-width:1px
    style Lambda_Orchestrator fill:#ffaa66,stroke:#333,stroke-width:1px
    style Lambda_Transcribe fill:#ffaa66,stroke:#333,stroke-width:1px
    style Lambda_Analyze fill:#ffaa66,stroke:#333,stroke-width:1px
    style API_GW fill:#d3b8e8,stroke:#333,stroke-width:1px
    style CloudFront fill:#b8d8e8,stroke:#333,stroke-width:1px
    style DynamoDB fill:#a8d8b8,stroke:#333,stroke-width:1px
    style ProfilesTable fill:#a8d8b8,stroke:#333,stroke-width:1px // Added Style
    style SQS_Upload fill:#f8b4d4,stroke:#333,stroke-width:1px
    style SQS_Transcription fill:#f8b4d4,stroke:#333,stroke-width:1px
    style StepFunctions fill:#ffcc80,stroke:#333,stroke-width:1px
    style ElevenLabs fill:#e8d8b8,stroke:#333,stroke-width:1px
    style GPT4o fill:#e8d8b8,stroke:#333,stroke-width:1px
    style SecretsManager_API fill:#c0c0c0,stroke:#333,stroke-width:1px
    style SecretsManager_Transcribe fill:#c0c0c0,stroke:#333,stroke-width:1px
    style SecretsManager_Analyze fill:#c0c0c0,stroke:#333,stroke-width:1px
    style Cognito fill:#e8c8b8,stroke:#333,stroke-width:1px
    style CloudWatch fill:#b8e8d8,stroke:#333,stroke-width:1px
    style IAM fill:#d8b8c8,stroke:#333,stroke-width:1px


Component Breakdown:

User Facing:

User Browser: Interacts with the frontend application.

CloudFront (CDN): Delivers static assets, caches API responses.

S3 Bucket (UI Hosting): Stores frontend build artifacts.

API Gateway (REST API): Secure HTTP endpoints.

API Backend:

Lambda_API (Node.js): Handles business logic for API endpoints (POST /calls, GET /calls, GET /calls/{callId}, GET /calls/{callId}/upload-url). Creates initial DynamoDB record with PendingUpload or specified status. Generates presigned S3 URLs using a structured key (uploads/{callId}/{fileName}). Updates DynamoDB record with S3 details upon URL generation. Includes metadata handling. Status: Implemented.

DynamoDB (CallInsightTable): Stores application metadata (Call details, Transcripts, Analysis, Status, S3 details, file info, metadata). Status: Implemented.

SQS (SQS_Upload): Optional queue for decoupling complex upload initiation logic. Status: Defined, implementation optional.

Secrets Manager (SecretsManager_API): Securely stores any API keys needed by Lambda_API. Status: Implemented.

Call Processing Workflow:

S3_Recordings Bucket: Source location for call recordings. Status: Implemented.

S3 Event Notification: Configured on S3_Recordings bucket. Status: Implemented.

SQS_Transcription Queue: Receives S3 event notifications, decouples trigger from processing. Includes DLQ configuration. Status: Implemented.

Lambda_Orchestrator (Node.js): Triggered by SQS_Transcription. Parses SQS message (handles direct S3/SNS formats), extracts metadata, creates/updates initial DynamoDB record (status: Queued), determines profile_id to use (from metadata or default), and starts Step Functions execution including the profile_id in the payload. Status: Implemented (Profile ID determination logic needs confirmation).

Step Functions (Processing Workflow): Orchestrates transcription and analysis. Passes call_id, S3 details, and profile_id between states. Defines states, transitions, error handling, and task retry logic (especially for Lambda_Transcribe). Status: Implemented (Needs retry config update, profile ID propagation verification).

State 1: Trigger Lambda_Transcribe.

State 2: Wait & handle completion/failure (Leverage Step Functions Retry/Catch).

State 3: Trigger Lambda_Analyze.

State 4: Wait & handle completion/failure (Leverage Step Functions Retry/Catch).

State 5: Update final status in DynamoDB (e.g., Completed/Failed via Lambda task or direct state update).

Guidance: Configure Retry policies within Task states (e.g., for Lambda_Transcribe) instead of implementing retries inside the Lambda code itself.

Lambda_Transcribe (Node.js): Invoked by Step Functions.

Receives payload including call_id, S3 details.

Updates status in DynamoDB (READING, PREPARING, TRANSCRIBING).

Retrieves ElevenLabs API key from Secrets Manager (cached).

Fetches audio from S3 (currently buffers in memory; potential risk for large files).

Calls ElevenLabs API (Inline retry exists - recommend removal).

Saves the raw JSON transcription result to DynamoDB.

Updates status to TRANSCRIBED on success. Throws errors on failure (to be caught by Step Functions).

Status: Implemented.

Lambda_Analyze (Node.js): Invoked by Step Functions.

Receives payload including call_id and profile_id.

Updates status to Analyzing.

Fetches transcript from CallInsightTable.

Fetches analysis profile configuration from ProfilesTable using profile_id (falls back to default if needed, uses cache).

Retrieves OpenAI API key from Secrets Manager (cached).

Calls OpenAI API using profile-specific settings (model, temp, prompts, system prompt, comprehensive vs separate analysis). Handles structured JSON output requests.

Saves structured analysis results (as JSON/Map) to CallInsightTable.

Updates status to Completed on success. Throws errors on failure (to be caught by Step Functions).

Requires USE_PROFILES, DEFAULT_PROFILE_ID, PROFILES_TABLE env vars.

Status: Implemented.

ProfilesTable (DynamoDB): NEW Component. Stores analysis profile configurations (e.g., profile_id, name, openai_model, temperature, prompts, schema, etc.). Accessed by Lambda_Analyze. Status: Implemented (Schema definition/content management TBD).

Monitoring & Security:

CloudWatch: Collects logs, metrics, events. Alarms configured for key failures/queue depths. Status: Implemented (basic logging in place, alarms TBD).

Cognito (Optional): User management and API Gateway authorization. Status: Not implemented (Optional).

IAM (Roles & Permissions): Granular permissions defined for each service following least privilege. Status: Implemented.

Secrets Manager (SecretsManager_Transcribe, SecretsManager_Analyze): Securely store external API keys. Status: Implemented.

Data Flow Example (Upload & Process): (Updated for Profiles)

User uploads .aac file via Frontend UI.

Frontend calls POST /calls -> Lambda_API creates record (status: PendingUpload, metadata: {...}). Returns call_id.

Frontend calls GET /calls/{callId}/upload-url?fileName=... -> Lambda_API updates record (status: Uploading, adds S3 details, merges metadata), generates & returns presigned URL.

Frontend uploads file directly to S3_Recordings using the presigned URL.

S3 detects new object, sends event notification to SQS_Transcription.

Lambda_Orchestrator receives SQS message, parses S3 info & any metadata (e.g., profile_id potentially passed via S3 metadata/SQS attributes). Updates record (status: Queued). Starts StepFunctions execution with payload (call_id, S3 details, profile_id).

Step Functions executes Lambda_Transcribe. Status updates... -> TRANSCRIBED.

Step Functions executes Lambda_Analyze, passing call_id and profile_id. Lambda updates status -> Analyzing.

Lambda_Analyze fetches transcript, fetches profile config from ProfilesTable using profile_id, calls GPT4o with profile settings, gets structured analysis, saves to CallInsightTable, updates status -> Completed.

Step Functions marks execution as successful.

Current Status (as of v1.2):

Completed/Deployed:

Core AWS infrastructure (S3, SQS, DynamoDB CallInsightTable, Secrets Manager, Step Functions state machine definition, API Gateway endpoints).

ProfilesTable (DynamoDB) infrastructure deployed.

IAM Roles and Permissions.

All Lambda functions (Lambda_API, Lambda_Orchestrator, Lambda_Transcribe, Lambda_Analyze) implemented in Node.js. Includes profile logic in Lambda_Analyze.

Triggering Mechanisms: S3 Event Notification configured on S3_Recordings bucket pointing to SQS_Transcription; SQS queue trigger configured for Lambda_Orchestrator.

Deployment: Initial deployment of infrastructure and Lambda code completed via AWS SAM / CloudFormation.

Basic Monitoring: CloudWatch Log Groups created for Lambdas; basic logging implemented within function code.

In Progress / Needs Refinement:

End-to-End Testing: Currently underway. Focus on validating the entire workflow, including profile selection/application, error handling, and performance.

Profile Management Process Definition: Defining the schema and establishing the operational process (e.g., using scripts, potentially adapting the provided Python CLI, or another method) for creating, updating, and managing content within ProfilesTable. Defining how profile_id is specified per call.

Step Functions Configuration: Implementing robust Retry policies (esp. for Lambda_Transcribe), confirming profile_id propagation.

Lambda_Transcribe Refinement: Addressing S3 buffering risk (investigate streaming) and removing inline retry logic.

Monitoring Refinement: Creating specific CloudWatch Alarms (Lambda errors, SQS metrics, Step Functions failures) and Dashboards based on testing results.

Error Handling: Explicitly testing various failure scenarios identified during testing setup.

Unit Testing (Implied): While deployment is done, formal unit test coverage status wasn't explicitly stated but should be tracked.

Future/Optional:

Cognito integration for user authentication.

CloudFront caching strategies for API Gateway.

Detailed cost analysis and optimization.

Load Testing (explicitly, beyond basic end-to-end).

This version should provide a complete and accurate picture of the project's architecture, implementation choices, and current status as discussed.