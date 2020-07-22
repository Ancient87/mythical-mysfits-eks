#! /bin/bash

#set -eu


STACK_NAME=mythicaldistributionstack

aws cloudformation describe-stacks --stack-name "$STACK_NAME" | jq -r '[.Stacks[0].Outputs[] | {key: .OutputKey, value: .OutputValue}] | from_entries' > cfn-dist-output.json


BUCKET_NAME=$(jq < cfn-dist-output.json -r '.mythicalbucketoutput // empty')

DISTRIBUTION_ID=$(jq < cfn-dist-output.json -r '.mythicaldistribution // empty')

if [[ -z $BUCKET_NAME ]]; then
  echo "Unable to determine S3 bucket to use. Ensure that it is returned as an output from CloudFormation or passed as the first argument to the script."
  exit 1
fi


API_ENDPOINT=$(kubectl get ingress/mysfits-ingress $MM -o json | jq -er '.status.loadBalancer.ingress[0].hostname')

if [[ -z $API_ENDPOINT ]]; then
  echo "No ingress yet"
  API_ENDPOINT=$(kubectl get service/mysfits-service $MM -o json | jq -er '.status.loadBalancer.ingress[0].hostname')
fi

echo $API_ENDPOINT

# For auth, not used now
#USER_POOL_ID=$(jq < cfn-output.json -er '.UserPoolId')
#CLIENT_ID=$(jq < cfn-output.json -er '.ClientId')
REGION=$(aws configure get region)

TEMP_DIR=$(mktemp -d)

cp -R web/. $TEMP_DIR/.

if which gsed; then
  sed_cmd=gsed
else
  sed_cmd=sed
fi

WEBSITE="$(jq < cfn-dist-output.json -r '.mythicalwebsite')"

sed_prog="s|REPLACE_ME_API_ENDPOINT|http://$API_ENDPOINT|;"
$sed_cmd -i $sed_prog $TEMP_DIR/index.html
$sed_cmd -i $sed_prog $TEMP_DIR/register.html
$sed_cmd -i $sed_prog $TEMP_DIR/confirm.html

aws s3 sync $TEMP_DIR s3://$BUCKET_NAME
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths="/"

echo "export MYTHICAL_WEBSITE=https://$WEBSITE" >> .environ