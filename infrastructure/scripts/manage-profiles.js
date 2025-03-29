#!/usr/bin/env node
// scripts/manage-profiles.js
// CLI tool for managing analysis profiles in ProfilesTable

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');

// Create program
const program = new Command();
program
  .name('manage-profiles')
  .description('CLI tool for managing CallInsight analysis profiles')
  .version('1.0.0');

// Add global options
program
  .option('--region <region>', 'AWS region', 'ap-south-1')
  .option('--table <tableName>', 'DynamoDB profiles table name', 'ProfilesTable')
  .option('--profile <awsProfile>', 'AWS profile to use');

// Initialize AWS SDK with options
let dynamoDB;
let profilesTableName;

// List all profiles
program
  .command('list')
  .description('List all analysis profiles')
  .action(async () => {
    try {
      initAWS();
      
      const result = await dynamoDB.send(new ScanCommand({
        TableName: profilesTableName
      }));
      
      if (result.Items && result.Items.length > 0) {
        console.log(chalk.green(`Found ${result.Items.length} profiles:`));
        
        // Display profile summaries
        result.Items.forEach(profile => {
          console.log(chalk.yellow('\n' + '='.repeat(50)));
          console.log(chalk.cyan(`ID: ${profile.profile_id}`));
          console.log(chalk.cyan(`Name: ${profile.name}`));
          console.log(chalk.cyan(`Model: ${profile.openai_model}`));
          console.log(chalk.cyan(`Analysis Type: ${profile.comprehensive_analysis ? 'Comprehensive' : 'Separate Prompts'}`));
          console.log(chalk.cyan(`Updated: ${profile.updated_at}`));
        });
      } else {
        console.log(chalk.yellow('No profiles found.'));
      }
    } catch (error) {
      console.error(chalk.red('Error listing profiles:'), error);
    }
  });

// Get a specific profile
program
  .command('get <profileId>')
  .description('Get details of a specific profile')
  .action(async (profileId) => {
    try {
      initAWS();
      
      const result = await dynamoDB.send(new GetCommand({
        TableName: profilesTableName,
        Key: { profile_id: profileId }
      }));
      
      if (result.Item) {
        console.log(chalk.green('Profile details:'));
        console.log(JSON.stringify(result.Item, null, 2));
      } else {
        console.log(chalk.yellow(`No profile found with ID: ${profileId}`));
      }
    } catch (error) {
      console.error(chalk.red('Error getting profile:'), error);
    }
  });

// Create a new profile
program
  .command('create')
  .description('Create a new analysis profile')
  .option('-f, --file <filePath>', 'JSON file containing profile configuration')
  .option('-i, --interactive', 'Create profile interactively', false)
  .action(async (options) => {
    try {
      initAWS();
      
      let profileData;
      
      if (options.interactive) {
        profileData = await createProfileInteractively();
      } else if (options.file) {
        const filePath = path.resolve(options.file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        profileData = JSON.parse(fileContent);
      } else {
        console.error(chalk.red('Error: Must specify either --file or --interactive'));
        return;
      }
      
      // Validate required fields
      if (!profileData.profile_id) {
        console.error(chalk.red('Error: profile_id is required'));
        return;
      }
      
      // Add timestamps
      const timestamp = new Date().toISOString();
      profileData.created_at = timestamp;
      profileData.updated_at = timestamp;
      
      // Check if profile exists
      const existingProfile = await dynamoDB.send(new GetCommand({
        TableName: profilesTableName,
        Key: { profile_id: profileData.profile_id }
      }));
      
      if (existingProfile.Item) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `Profile ${profileData.profile_id} already exists. Overwrite?`,
            default: false
          }
        ]);
        
        if (!overwrite) {
          console.log(chalk.yellow('Operation cancelled.'));
          return;
        }
      }
      
      // Create profile
      await dynamoDB.send(new PutCommand({
        TableName: profilesTableName,
        Item: profileData
      }));
      
      console.log(chalk.green(`Profile ${profileData.profile_id} created successfully.`));
    } catch (error) {
      console.error(chalk.red('Error creating profile:'), error);
    }
  });

// Delete a profile
program
  .command('delete <profileId>')
  .description('Delete an analysis profile')
  .action(async (profileId) => {
    try {
      initAWS();
      
      // Check if profile exists
      const existingProfile = await dynamoDB.send(new GetCommand({
        TableName: profilesTableName,
        Key: { profile_id: profileId }
      }));
      
      if (!existingProfile.Item) {
        console.log(chalk.yellow(`No profile found with ID: ${profileId}`));
        return;
      }
      
      // Confirm deletion
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete profile ${profileId}?`,
          default: false
        }
      ]);
      
      if (!confirm) {
        console.log(chalk.yellow('Operation cancelled.'));
        return;
      }
      
      // Delete profile
      await dynamoDB.send(new DeleteCommand({
        TableName: profilesTableName,
        Key: { profile_id: profileId }
      }));
      
      console.log(chalk.green(`Profile ${profileId} deleted successfully.`));
    } catch (error) {
      console.error(chalk.red('Error deleting profile:'), error);
    }
  });

// Export profile to file
program
  .command('export <profileId>')
  .description('Export a profile to a JSON file')
  .option('-o, --output <filePath>', 'Output file path', './profile-export.json')
  .action(async (profileId, options) => {
    try {
      initAWS();
      
      const result = await dynamoDB.send(new GetCommand({
        TableName: profilesTableName,
        Key: { profile_id: profileId }
      }));
      
      if (!result.Item) {
        console.log(chalk.yellow(`No profile found with ID: ${profileId}`));
        return;
      }
      
      const filePath = path.resolve(options.output);
      fs.writeFileSync(filePath, JSON.stringify(result.Item, null, 2));
      
      console.log(chalk.green(`Profile exported to ${filePath}`));
    } catch (error) {
      console.error(chalk.red('Error exporting profile:'), error);
    }
  });

// Create profile interactively
async function createProfileInteractively() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'profile_id',
      message: 'Profile ID (unique identifier):',
      validate: input => input.trim() !== '' ? true : 'Profile ID is required'
    },
    {
      type: 'input',
      name: 'name',
      message: 'Profile Name:',
      default: ({ profile_id }) => `${profile_id.charAt(0).toUpperCase() + profile_id.slice(1)} Analysis Profile`
    },
    {
      type: 'input',
      name: 'openai_model',
      message: 'OpenAI Model:',
      default: 'gpt-4o'
    },
    {
      type: 'number',
      name: 'temperature',
      message: 'Temperature (0.0-1.0):',
      default: 0.1,
      validate: input => (input >= 0 && input <= 1) ? true : 'Temperature must be between 0 and 1'
    },
    {
      type: 'input',
      name: 'system_prompt',
      message: 'System Prompt:',
      default: 'You are an expert call analyzer. Analyze the following transcript to identify key information, sentiments, and action items.'
    },
    {
      type: 'confirm',
      name: 'comprehensive_analysis',
      message: 'Use comprehensive analysis (single prompt)?',
      default: true
    }
  ]);
  
  // Add response format
  const { useJsonFormat } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useJsonFormat',
      message: 'Specify JSON response format?',
      default: true
    }
  ]);
  
  if (useJsonFormat) {
    answers.response_format = {
      type: 'json_object'
    };
    
    const { useSchema } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useSchema',
        message: 'Specify JSON schema?',
        default: true
      }
    ]);
    
    if (useSchema) {
      const defaultSchema = {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'A concise summary of the call'
          },
          action_items: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of action items from the call'
          }
        }
      };
      
      answers.response_format.schema = defaultSchema;
      
      console.log(chalk.yellow('\nDefault schema added. You can edit the exported JSON file for more complex schemas.'));
    }
  }
  
  // For separate analyses, get prompts
  if (!answers.comprehensive_analysis) {
    const { promptCount } = await inquirer.prompt([
      {
        type: 'number',
        name: 'promptCount',
        message: 'How many separate analysis prompts do you want to add?',
        default: 3,
        validate: input => input > 0 ? true : 'Must add at least one prompt'
      }
    ]);
    
    answers.analysis_prompts = {};
    
    for (let i = 0; i < promptCount; i++) {
      const { promptKey, promptValue } = await inquirer.prompt([
        {
          type: 'input',
          name: 'promptKey',
          message: `Prompt ${i+1} key (e.g., summary, action_items):`,
          validate: input => input.trim() !== '' ? true : 'Key is required'
        },
        {
          type: 'input',
          name: 'promptValue',
          message: `Prompt ${i+1} value:`,
          default: ({ promptKey }) => `Provide a ${promptKey} for this call.`
        }
      ]);
      
      answers.analysis_prompts[promptKey] = promptValue;
    }
  }
  
  return answers;
}

// Initialize AWS SDK
function initAWS() {
  const options = program.opts();
  const config = { region: options.region };
  
  if (options.profile) {
    process.env.AWS_PROFILE = options.profile;
  }
  
  // Initialize DynamoDB client
  const client = new DynamoDBClient(config);
  dynamoDB = DynamoDBDocumentClient.from(client);
  profilesTableName = options.table;
}

program.parse(process.argv);

// If no commands were provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}