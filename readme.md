## Setup
- npm install -g serverless
- nvm use 14.16

## Credentials for connecting AWS + serverless
(https://www.serverless.com/framework/docs/providers/aws/cli-reference/config-credentials)[credential docs]
```serverless config credentials --provider aws --key <API_KEY> --secret <API_SECRET_KEY> --profile <PROFILE_NAME>```


## Packages used
- (Serverless step functions)[https://www.serverless.com/plugins/serverless-step-functions]
- 