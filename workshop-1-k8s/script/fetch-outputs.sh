#! /bin/bash

set -eu

if [[ $# -eq 1 ]]; then
  STACK_NAME=$#
else
  STACK_NAME=mythicalstack
fi

aws cloudformation describe-stacks --stack-name "$STACK_NAME" | jq -r '[.Stacks[0].Outputs[] | {key: .OutputKey, value: .OutputValue}] | from_entries' > cfn-output.json

TABLE_NAME="$(jq < cfn-output.json -r '.mythicaltableoutput')"
ECR_LIKE="$(jq < cfn-output.json -r '.likerepository')"
ECR_MONOLITH="$(jq < cfn-output.json -r '.monolithrepository')"
WEBSITE="$(jq < cfn-output.json -r '.mythicalwebsite')"
CONFIG_KUBECTL="$(jq < cfn-output.json -r '. | to_entries[] | select(.key|startswith("mythicaleksclusterConfigCommand")).value')"

echo "export DDB_TABLE_NAME=$TABLE_NAME" > .environ
echo "export ECR_MONOLITH=$ECR_MONOLITH" >> .environ
echo "export ECR_LIKE=$ECR_LIKE" >> .environ
echo "export AWS_DEFAULT_REGION=ap-southeast-1" >> .environ
MMC="$CONFIG_KUBECTL --alias mythicalcluster"
echo "export MYTHICAL_KUBE_CONFIG='$MMC'" >> .environ
echo "export MM='--namespace mysfits --context mythicalcluster'" >> .environ

eval $MMC
