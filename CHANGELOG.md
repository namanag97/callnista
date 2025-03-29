# Changelog

## [Unreleased]

### Added
- New UI pages:
  - Call Center UI (`ui/call-center-ui.html`)
  - Transcript Chat Page (`ui/transcript-chat-page.html`)
  - Uploads Page (`ui/uploads-page.html`)

### Changed
- Updated infrastructure template configuration in `template.yaml`
- Improved sidebar UI with:
  - Enhanced responsive design for mobile and tablet
  - Better icon rendering and alignment
  - Logout functionality in user profile
  - Fixed styling conflicts between multiple sidebar versions

### Infrastructure
- AWS SAM template updates for improved Lambda function configurations
- Enhanced state machine workflow definitions

## [Initial Release] - 2024-03-29

### Added
- Initial project setup
- AWS Lambda functions:
  - API Gateway handler
  - Orchestrator
  - Transcription service
  - Analysis service
- AWS Step Functions state machine
- Basic UI components 