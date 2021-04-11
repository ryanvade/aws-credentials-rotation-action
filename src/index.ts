import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "@octokit/action";
import { IAM, STS, Credentials } from "aws-sdk";
import { seal } from "tweetsodium";

export async function getIamUserName() {
  const providedUserName = core.getInput("IAM_USER_NAME", { required: false });
  if (providedUserName && providedUserName !== "") {
    core.debug(`Provided IAM User username: ${providedUserName}`);
    return await new Promise<string>((resolve) => resolve(providedUserName));
  }

  const sts = new STS();
  const response = await sts.getCallerIdentity().promise();
  const arn = response.Arn;
  core.debug(`IAM User ARN: ${arn}`);
  if (!arn) {
    throw new Error("Cannot get current IAM User username");
  }
  const username = arn.split("/").slice(-1)[0];
  core.debug(`IAM User username: ${username}`);
  return username;
}

export async function createNewAccessKeyForUser(username: string) {
  const iam = new IAM();
  const response = await iam
    .createAccessKey({
      UserName: username,
    })
    .promise();
  return response.AccessKey;
}

export async function deleteAccessKey(
  username: string,
  oldAccessKeyId: string,
  newAccessKey: IAM.AccessKey
) {
  const creds = new Credentials({
    accessKeyId: newAccessKey.AccessKeyId,
    secretAccessKey: newAccessKey.SecretAccessKey,
  });
  const iam = new IAM({
    credentials: creds,
  });
  const response = await iam
    .deleteAccessKey({
      UserName: username,
      AccessKeyId: oldAccessKeyId,
    })
    .promise();
  return response.$response;
}

export async function getRepositorySecretsPublicKey() {
  const octokit = new Octokit();

  const repo = github.context.repo;

  const response = await octokit.request(
    "GET /repos/{owner}/{repo}/actions/secrets/public-key",
    {
      owner: repo.owner,
      repo: repo.repo,
    }
  );

  return response.data;
}

export async function updateSecret(
  secretName: string,
  secretValue: string,
  publicKey: { key_id: string; key: string }
) {
  const octokit = new Octokit();

  const { key } = publicKey;

  const messageBytes = Buffer.from(secretValue);
  const keyBytes = Buffer.from(key, "base64");

  const encryptedBytes = seal(messageBytes, keyBytes);

  const encrypted = Buffer.from(encryptedBytes).toString("base64");

  const repo = github.context.repo;

  const response = await octokit.request(
    "PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}",
    {
      owner: repo.owner,
      repo: repo.repo,
      secret_name: secretName,
      encrypted_value: encrypted,
      key_id: publicKey.key_id,
    }
  );
  core.debug(`Response: ${response.data}`);
  return response;
}

async function run() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  try {
    const username = await getIamUserName();
    const accessKeySecretName = core.getInput("ACCESS_KEY_ID_SECRET_NAME", {
      required: true,
    });
    const secretAccessKeySecretName = core.getInput(
      "SECRET_ACCESS_KEY_SECRET_NAME",
      { required: true }
    );

    core.debug(`Access Key ID Secret Name: ${accessKeySecretName}`);
    core.debug(`Secret Access Key Secret Name: ${secretAccessKeySecretName}`);

    const newAccessKey = await createNewAccessKeyForUser(username);
    const publicKey = await getRepositorySecretsPublicKey();

    await Promise.all([
      updateSecret(accessKeySecretName, newAccessKey.AccessKeyId, publicKey),
      updateSecret(
        secretAccessKeySecretName,
        newAccessKey.SecretAccessKey,
        publicKey
      ),
    ]);

    await deleteAccessKey(
      username,
      process.env.AWS_ACCESS_KEY_ID || "",
      newAccessKey
    );
  } catch (err) {
    core.error(err.message);
    core.setFailed(err.message);
  }
}

run();
