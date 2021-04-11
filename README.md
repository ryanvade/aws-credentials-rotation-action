# AWS Credentials Rotation

This action rotates AWS Access Keys in your Action Secrets. In order for this action to work, valid AWS Access Keys and Secret Keys must already be in your Action Secrets.  The IAM User whose credentials are being rotated must also have permission to create and delete access keys. 

## Inputs

### `GITHUB_TOKEN`

**Required** An access token used to authenticate with the Github API. 


### `ACCESS_KEY_ID_SECRET_NAME`

**Required** The name of an Actions Secret that stores the Access Key Id to rotate. 


### `SECRET_ACCESS_KEY_SECRET_NAME`

**Required** The name of an Actions Secret that stores the Secret Access Key to rotate. 

### `IAM_USER_USERNAME`

The name of the IAM User whose credentials are being rotated. 

:bangbang: If an IAM User username is __not__ provided this function requires permission to call the [STS Get Caller Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html) operation.

## Example Usage

:bangbang: AWS Credentials must be configured before this action runs. If an IAM User username is __not__ provided then the AWS Credentials should __not__ be configured to use assume a role as this action calls the [STS Get Caller Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html) API. 


```
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v1
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1

- name: Rotate Credentials
  uses: ryanvade/aws-credentials-rotation-action@v1.0.1
  with:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ACCESS_KEY_ID_SECRET_NAME: "AWS_ACCESS_KEY_ID"
    SECRET_ACCESS_KEY_SECRET_NAME: "AWS_SECRET_ACCESS_KEY"
```

## Example Usage with a specific IAM User Username

```
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v1
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1

- name: Rotate Credentials
  uses: ryanvade/aws-credentials-rotation-action@v1.0.1
  with:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ACCESS_KEY_ID_SECRET_NAME: "AWS_ACCESS_KEY_ID"
    SECRET_ACCESS_KEY_SECRET_NAME: "AWS_SECRET_ACCESS_KEY"
    IAM_USER_USERNAME: "TestUser"
```

## Required IAM Permissions

This Action requires permission to Create and Delete Access Keys on an IAM User.  The following policy will provide access to the user as long as the requesting user is modifying its own keys. 

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowManageOwnAccessKeys",
            "Effect": "Allow",
            "Action": [
                "iam:CreateAccessKey",
                "iam:DeleteAccessKey",
                "iam:ListAccessKeys"
            ],
            "Resource": "arn:aws:iam::AWS_ACCOUNT_ID:user/${aws:username}"
        },
        {
            "Sid": "AllowGetCallerIdentity",
            "Effect": "Allow",
            "Action": "sts:GetCallerIdentity",
            "Resource": "*"
        }
    ]
}
```