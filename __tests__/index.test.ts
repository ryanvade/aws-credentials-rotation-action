import * as AWSMock from "aws-sdk-mock";
import nock from "nock";
import {
  getIamUserName,
  createNewAccessKeyForUser,
  deleteAccessKey,
  getRepositorySecretsPublicKey,
  updateSecret,
} from "../src/index";

describe("index", () => {
  beforeEach(() => {
    process.env.AWS_ACCESS_KEY_ID = "SOME_ACCESS_KEY";
    process.env.AWS_SECRET_ACCESS_KEY = "SOME_SECRET_KEY";
    process.env.AWS_DEFAULT_REGION = "us-east-1";
    process.env.GITHUB_REPOSITORY = "test/repo";
    process.env.GITHUB_ACTION = "test-action";
    process.env[`INPUT_${"GITHUB_TOKEN".replace(/ /g, "_").toUpperCase()}`] =
      "SOME_GITHUB_TOKEN";
  });

  describe("getIamUserName", () => {
    const name = "IAM_USER_NAME";
    it("returns a provided username if it exists", async () => {
      process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] =
        "testUser";
      const userName = await getIamUserName();
      expect(userName).toBe("testUser");
    });

    it("returns a username from STS", async () => {
      delete process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`];
      AWSMock.mock("STS", "getCallerIdentity", () => {
        return new Promise((resolve) => {
          resolve({
            UserId: "SOME_USER_ID",
            Account: "123456789123",
            Arn: "arn:aws:iam::123456789123:user/TestUser",
          });
        });
      });

      const userName = await getIamUserName();
      expect(userName).toBe("TestUser");
      AWSMock.restore();
    });

    it("throws an error if a user arn is not returned", async () => {
      delete process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`];
      AWSMock.mock("STS", "getCallerIdentity", () => {
        return new Promise((resolve) => {
          resolve({
            Account: "123456789123",
          });
        });
      });

      await expect(getIamUserName()).rejects.toThrowError(
        "Cannot get current IAM User username"
      );
      AWSMock.restore();
    });
  });

  describe("createNewAccessKeyForUser", () => {
    it("creates a new access key", async () => {
      const accessKey = {
        UserName: "TestUser",
        AccessKeyId: "TEST_SOME_ACCESS_KEY",
        Status: "Active",
        SecretAccessKey: "TEST_SOME_SECRET_KEY",
        CreateDate: new Date(),
      };

      AWSMock.mock("IAM", "createAccessKey", () => {
        return new Promise((resolve) => {
          resolve({
            AccessKey: accessKey,
          });
        });
      });

      const response = await createNewAccessKeyForUser("TestUser");

      expect(response).toEqual(accessKey);

      AWSMock.restore();
    });
  });

  describe("deleteAccessKey", () => {
    it("deletes an access key", async () => {
      AWSMock.mock("IAM", "deleteAccessKey", (params: any) => {
        expect(params).toEqual({
          UserName: "TestUser",
          AccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        });
        return new Promise((resolve) => {
          resolve({});
        });
      });

      const response = deleteAccessKey(
        "TestUser",
        process.env.AWS_ACCESS_KEY_ID || "",
        {
          AccessKeyId: "TEST_SOME_ACCESS_KEY_ID",
          SecretAccessKey: "TEST_SOME_SECRET_ACCESS_KEY",
          UserName: "TestUser",
          Status: "Active",
        }
      );
      expect(response).toBeTruthy();
      AWSMock.restore();
    });
  });

  describe("getRepositorySecretsPublicKey", () => {
    it("can get the repository public key", async () => {
      const scope = nock("https://api.github.com")
        .get("/repos/test/repo/actions/secrets/public-key")
        .reply(200, {
          key_id: "SOME_KEY_ID",
          key: "SOME_KEY",
        });

      const response = await getRepositorySecretsPublicKey();

      expect(response).toEqual({
        key_id: "SOME_KEY_ID",
        key: "SOME_KEY",
      });

      scope.done();
    });
  });

  describe("updateSecret", () => {
    it("can update a github action repository secret", async () => {
      const scope = nock("https://api.github.com")
        .put("/repos/test/repo/actions/secrets/TEST-SECRET-NAME")
        .reply(204);

      const response = await updateSecret(
        "TEST-SECRET-NAME",
        "TEST_SOME_ACCESS_KEY",
        {
          key_id: "SOME_KEY",
          key: "wSXrksYGOupypWCJbux1hLU8ZeTpIgAqG65YaK0Za18=",
        }
      );
      expect(response.status).toEqual(204);
      scope.done();
    });
  });
});
