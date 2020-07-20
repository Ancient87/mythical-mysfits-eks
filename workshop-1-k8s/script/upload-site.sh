#! /bin/bash

#set -eu

if [[ $# -eq 1 ]]; then
  BUCKET_NAME="$1"
else
  BUCKET_NAME=$(jq < cfn-output.json -r '.mythicalbucketoutput // empty')
  DISTRIBUTION_ID=$(jq < cfn-output.json -r '.mythicaldistribution // empty')
fi

if [[ -z $BUCKET_NAME ]]; then
  echo "Unable to determine S3 bucket to use. Ensure that it is returned as an output from CloudFormation or passed as the first argument to the script."
  exit 1
fi


API_ENDPOINT=$(kubectl get service/mysfits-service $MM -o json | jq -er '.status.loadBalancer.ingress[0].hostname')

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

sed_prog="s|REPLACE_ME_API_ENDPOINT|http://$API_ENDPOINT|;"
$sed_cmd -i $sed_prog $TEMP_DIR/index.html
$sed_cmd -i $sed_prog $TEMP_DIR/register.html
$sed_cmd -i $sed_prog $TEMP_DIR/confirm.html

aws s3 sync $TEMP_DIR s3://$BUCKET_NAME
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths="/"
