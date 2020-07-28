#! /bin/bash

set -eu

#echo "Removing unneeded docker images..."
#docker images -q | xargs docker rmi || true

echo "Installing dependencies..."
sudo yum install -y jq

echo "Fetching CloudFormation outputs..."
script/fetch-outputs.sh

echo "Populating DynamoDB table..."
script/load-ddb.sh

#echo "Uploading static site to S3..."
#if [[ $# -eq 1 ]]; then
#  script/upload-site.sh $1
#else
#  script/upload-site.sh
#fi

#echo "Installing ECR Cred Helper..."
#sudo script/credhelper

#echo "Attaching Instance Profile to Cloud9..."
#script/associate-profile.sh

echo "Success!"
