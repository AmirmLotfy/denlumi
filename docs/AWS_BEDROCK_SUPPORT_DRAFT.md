# AWS Support case draft — do not submit automatically

**Subject:** Bedrock Nova Micro authorization remains NOT_AUTHORIZED; Converse returns Operation not allowed

**Service/region:** Amazon Bedrock, `us-east-1`

**Message:**

I am testing Amazon Nova Micro from this AWS account. The CLI is authenticated as the account root user; the account is not in AWS Organizations. `GetFoundationModelAvailability` for `amazon.nova-micro-v1:0` returns `authorizationStatus: NOT_AUTHORIZED`, while agreement, entitlement and region report `AVAILABLE`. The system-defined inference profile `us.amazon.nova-micro-v1:0` reports `ACTIVE`. An actual `Converse` request through that profile returns HTTP 400 `ValidationException: Operation not allowed` (request ID `d6c70790-457e-4310-ac49-25f4dd39bb6d`, approximately 2026-09-22 20:45 UTC). An earlier standalone request returned the same error (request ID `92e24286-2089-43d7-947f-15fda7f39ab2`). Amazon Polly and Transcribe work in this account.

Please identify the reason this account is not authorized to invoke Nova Micro and the exact account action, if any, required to resolve it. I have not changed IAM or billing settings and do not want to broaden unrelated access.

No customer or animal data is included in these requests; Denlumi uses fictional demo text. This draft contains no credentials. It has not been sent to AWS.
